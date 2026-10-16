-- =====================================================================
-- Pádel Match · esquema de base de datos para Supabase
--
-- Cómo usarlo: en el panel de Supabase, abre "SQL Editor", pega todo este
-- archivo y pulsa "Run". Se puede volver a ejecutar sin perder datos.
--
-- Seguridad: todas las tablas tienen Row Level Security. Los jugadores
-- pueden leer perfiles y partidos, pero solo modifican lo suyo. Las
-- operaciones delicadas (crear partido, apuntarse, resultados y nivel,
-- matches) pasan por funciones que comprueban las reglas en el servidor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Perfiles de jugador
-- ---------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  age smallint check (age between 12 and 99),
  level numeric(4, 2) not null default 3 check (level between 1 and 7),
  matches integer not null default 0,
  zone text not null,
  position text not null default 'indiferente' check (position in ('drive', 'reves', 'indiferente')),
  hand text not null default 'diestro' check (hand in ('diestro', 'zurdo')),
  objectives text[] not null default '{}',
  availability text[] not null default '{}',
  federated boolean not null default false,
  bio text not null default '' check (char_length(bio) <= 160),
  created_at timestamptz not null default now()
);

create table if not exists public.level_history (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.profiles (id) on delete cascade,
  level numeric(4, 2) not null,
  recorded_at timestamptz not null default now()
);
create index if not exists level_history_player_idx on public.level_history (player_id, recorded_at);

-- El nivel solo lo cambian los resultados. El jugador puede elegir su nivel
-- inicial mientras no haya jugado ningún partido; después, solo las funciones
-- de resultados (que activan padel.trusted) pueden tocar nivel y partidos.
create or replace function public.protect_level() returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('padel.trusted', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.matches := 0;
  else
    new.matches := old.matches;
    if old.matches > 0 then
      new.level := old.level;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profiles_protect_level on public.profiles;
create trigger profiles_protect_level
  before insert or update on public.profiles
  for each row execute function public.protect_level();

-- Mientras el nivel es autoevaluado (0 partidos), el historial es solo ese punto.
create or replace function public.track_initial_level() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or (new.matches = 0 and new.level <> old.level) then
    delete from level_history where player_id = new.id;
    insert into level_history (player_id, level) values (new.id, new.level);
  end if;
  return new;
end $$;

drop trigger if exists profiles_track_level on public.profiles;
create trigger profiles_track_level
  after insert or update of level on public.profiles
  for each row execute function public.track_initial_level();

-- ---------------------------------------------------------------------
-- Partidos
-- ---------------------------------------------------------------------

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  club text not null check (char_length(club) between 1 and 60),
  zone text not null,
  min_level numeric(3, 1) not null check (min_level between 1 and 7),
  max_level numeric(3, 1) not null check (max_level between 1 and 7),
  competitive boolean not null default true,
  result jsonb,
  created_at timestamptz not null default now(),
  check (min_level <= max_level)
);
create index if not exists games_starts_idx on public.games (starts_at);
create index if not exists games_zone_idx on public.games (zone, starts_at);

-- Huecos 0 y 1 = pareja A, 2 y 3 = pareja B.
create table if not exists public.game_slots (
  game_id uuid not null references public.games (id) on delete cascade,
  slot smallint not null check (slot between 0 and 3),
  player_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (game_id, slot),
  unique (game_id, player_id)
);
create index if not exists game_slots_player_idx on public.game_slots (player_id);

-- ---------------------------------------------------------------------
-- Descubrir: "me gusta" y matches
-- ---------------------------------------------------------------------

create table if not exists public.swipes (
  swiper uuid not null references public.profiles (id) on delete cascade,
  target uuid not null references public.profiles (id) on delete cascade,
  liked boolean not null,
  created_at timestamptz not null default now(),
  primary key (swiper, target),
  check (swiper <> target)
);
create index if not exists swipes_target_idx on public.swipes (target) where liked;

create or replace function public.is_match(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from swipes where swiper = a and target = b and liked)
     and exists (select 1 from swipes where swiper = b and target = a and liked);
$$;

-- Registra un "me gusta" o un "paso" y devuelve true si hay match.
create or replace function public.swipe(p_target uuid, p_liked boolean) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'Inicia sesión para continuar'; end if;
  insert into swipes (swiper, target, liked) values (me, p_target, p_liked)
  on conflict (swiper, target) do update set liked = excluded.liked, created_at = now();
  return p_liked and is_match(me, p_target);
end $$;

-- Quiénes son tus matches (sin revelar quién te ha dado "me gusta" sin serlo).
create or replace function public.my_matches() returns setof uuid
language sql stable security definer set search_path = public as $$
  select s.target
  from swipes s
  join swipes r on r.swiper = s.target and r.target = s.swiper and r.liked
  where s.swiper = auth.uid() and s.liked;
$$;

-- ---------------------------------------------------------------------
-- Operaciones de partidos
-- ---------------------------------------------------------------------

create or replace function public.create_game(
  p_starts_at timestamptz,
  p_club text,
  p_zone text,
  p_min_level numeric,
  p_max_level numeric,
  p_competitive boolean,
  p_invites uuid[] default '{}'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  new_id uuid;
  invitee uuid;
  next_slot smallint := 1;
begin
  if me is null then raise exception 'Inicia sesión para continuar'; end if;
  if p_starts_at <= now() then raise exception 'El partido tiene que ser en el futuro'; end if;
  if coalesce(array_length(p_invites, 1), 0) > 3 then raise exception 'Solo caben 3 jugadores más'; end if;

  insert into games (created_by, starts_at, club, zone, min_level, max_level, competitive)
  values (me, p_starts_at, trim(p_club), p_zone, p_min_level, p_max_level, p_competitive)
  returning id into new_id;

  insert into game_slots (game_id, slot, player_id) values (new_id, 0, me);

  foreach invitee in array coalesce(p_invites, '{}') loop
    if not is_match(me, invitee) then
      raise exception 'Solo puedes invitar a jugadores con los que tienes match';
    end if;
    insert into game_slots (game_id, slot, player_id) values (new_id, next_slot, invitee);
    next_slot := next_slot + 1;
  end loop;

  return new_id;
end $$;

-- Apuntarse a un partido; p_slot null = primer hueco libre.
create or replace function public.join_game(p_game uuid, p_slot smallint default null) returns smallint
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  g games;
  target smallint := p_slot;
begin
  if me is null then raise exception 'Inicia sesión para continuar'; end if;
  select * into g from games where id = p_game for update;
  if not found then raise exception 'El partido ya no existe'; end if;
  if g.starts_at <= now() then raise exception 'El partido ya ha empezado'; end if;
  if exists (select 1 from game_slots where game_id = p_game and player_id = me) then
    raise exception 'Ya estás apuntado a este partido';
  end if;
  if target is null then
    select min(s) into target
    from generate_series(0, 3) s
    where not exists (select 1 from game_slots where game_id = p_game and slot = s);
  end if;
  if target is null then raise exception 'El partido está completo'; end if;
  if exists (select 1 from game_slots where game_id = p_game and slot = target) then
    raise exception 'Ese hueco ya está ocupado';
  end if;
  insert into game_slots (game_id, slot, player_id) values (p_game, target, me);
  return target;
end $$;

create or replace function public.leave_game(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  g games;
begin
  select * into g from games where id = p_game;
  if not found then raise exception 'El partido ya no existe'; end if;
  if g.created_by = auth.uid() then raise exception 'Eres el organizador: cancela el partido en lugar de salir'; end if;
  if g.starts_at <= now() then raise exception 'El partido ya ha empezado'; end if;
  delete from game_slots where game_id = p_game and player_id = auth.uid();
end $$;

create or replace function public.cancel_game(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from games
  where id = p_game and created_by = auth.uid() and starts_at > now() and result is null;
  if not found then raise exception 'No se puede cancelar este partido'; end if;
end $$;

-- Apunta el resultado y ajusta el nivel de los cuatro jugadores.
-- Misma fórmula que www/js/level.js: Elo por parejas en escala 1–7.
create or replace function public.submit_result(p_game uuid, p_sets jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  g games;
  ids uuid[];
  lv numeric[];
  mt int[];
  s jsonb;
  a int; b int;
  sets_a int := 0; sets_b int := 0;
  games_a int := 0; games_b int := 0;
  n int;
  winner_a boolean;
  actual_a numeric;
  expected_a numeric;
  actual numeric;
  expected numeric;
  after numeric;
  changes jsonb := '[]'::jsonb;
  i int;
begin
  select * into g from games where id = p_game for update;
  if not found then raise exception 'El partido no existe'; end if;
  if g.result is not null then raise exception 'Este partido ya tiene resultado'; end if;
  if g.starts_at > now() then raise exception 'El partido todavía no se ha jugado'; end if;

  select array_agg(player_id order by slot) into ids from game_slots where game_id = p_game;
  if coalesce(array_length(ids, 1), 0) <> 4 then raise exception 'El partido no está completo'; end if;
  if auth.uid() is null or not (auth.uid() = any (ids)) then
    raise exception 'Solo los jugadores del partido pueden apuntar el resultado';
  end if;

  if jsonb_typeof(p_sets) <> 'array' then raise exception 'Resultado no válido'; end if;
  n := jsonb_array_length(p_sets);
  if n < 1 or n > 3 then raise exception 'Un partido tiene entre 1 y 3 sets'; end if;
  for s in select value from jsonb_array_elements(p_sets) loop
    a := (s ->> 0)::int;
    b := (s ->> 1)::int;
    if a is null or b is null or a < 0 or b < 0
       or not ((greatest(a, b) = 6 and least(a, b) <= 4) or (greatest(a, b) = 7 and least(a, b) in (5, 6))) then
      raise exception 'El set %-% no es válido (6-0 a 6-4, 7-5 o 7-6)', a, b;
    end if;
    games_a := games_a + a;
    games_b := games_b + b;
    if a > b then sets_a := sets_a + 1; else sets_b := sets_b + 1; end if;
  end loop;
  if sets_a = sets_b then raise exception 'El resultado tiene que tener un ganador'; end if;
  if n = 3 and greatest(sets_a, sets_b) = 3 then
    raise exception 'El partido ya estaba decidido antes del tercer set';
  end if;
  winner_a := sets_a > sets_b;

  select array_agg(p.level order by array_position(ids, p.id)),
         array_agg(p.matches order by array_position(ids, p.id))
    into lv, mt
  from profiles p where p.id = any (ids);

  actual_a := 0.7 * (case when winner_a then 1 else 0 end) + 0.3 * games_a::numeric / (games_a + games_b);
  expected_a := 1 / (1 + power(10::numeric, (((lv[3] + lv[4]) / 2) - ((lv[1] + lv[2]) / 2)) / 2));

  perform set_config('padel.trusted', 'on', true);
  for i in 1..4 loop
    if i <= 2 then
      actual := actual_a; expected := expected_a;
    else
      actual := 1 - actual_a; expected := 1 - expected_a;
    end if;
    if g.competitive then
      after := round(least(7, greatest(1, lv[i] + (case when mt[i] < 10 then 0.3 else 0.15 end) * (actual - expected))), 2);
      insert into level_history (player_id, level) values (ids[i], after);
    else
      after := lv[i];
    end if;
    update profiles set level = after, matches = matches + 1 where id = ids[i];
    changes := changes || jsonb_build_object(
      'id', ids[i], 'before', lv[i], 'after', after,
      'delta', after - lv[i], 'won', (i <= 2) = winner_a
    );
  end loop;
  perform set_config('padel.trusted', 'off', true);

  update games set result = jsonb_build_object('sets', p_sets, 'changes', changes) where id = p_game;
  return changes;
end $$;

-- Borra la cuenta y todos sus datos (perfil, partidos creados, swipes…).
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión para continuar'; end if;
  delete from auth.users where id = auth.uid();
end $$;

-- ---------------------------------------------------------------------
-- Permisos (Row Level Security)
-- ---------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.level_history enable row level security;
alter table public.games enable row level security;
alter table public.game_slots enable row level security;
alter table public.swipes enable row level security;

drop policy if exists "Perfiles visibles para jugadores" on public.profiles;
create policy "Perfiles visibles para jugadores" on public.profiles
  for select to authenticated using (true);
drop policy if exists "Cada uno crea su perfil" on public.profiles;
create policy "Cada uno crea su perfil" on public.profiles
  for insert to authenticated with check (id = auth.uid());
drop policy if exists "Cada uno edita su perfil" on public.profiles;
create policy "Cada uno edita su perfil" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Historial de nivel visible" on public.level_history;
create policy "Historial de nivel visible" on public.level_history
  for select to authenticated using (true);

drop policy if exists "Partidos visibles" on public.games;
create policy "Partidos visibles" on public.games
  for select to authenticated using (true);

drop policy if exists "Huecos visibles" on public.game_slots;
create policy "Huecos visibles" on public.game_slots
  for select to authenticated using (true);

drop policy if exists "Ves tus propios swipes" on public.swipes;
create policy "Ves tus propios swipes" on public.swipes
  for select to authenticated using (swiper = auth.uid());
drop policy if exists "Borras tus propios swipes" on public.swipes;
create policy "Borras tus propios swipes" on public.swipes
  for delete to authenticated using (swiper = auth.uid() and not liked);

-- Las funciones solo las pueden llamar usuarios con sesión iniciada.
revoke execute on function public.swipe(uuid, boolean) from public, anon;
revoke execute on function public.my_matches() from public, anon;
revoke execute on function public.is_match(uuid, uuid) from public, anon;
revoke execute on function public.create_game(timestamptz, text, text, numeric, numeric, boolean, uuid[]) from public, anon;
revoke execute on function public.join_game(uuid, smallint) from public, anon;
revoke execute on function public.leave_game(uuid) from public, anon;
revoke execute on function public.cancel_game(uuid) from public, anon;
revoke execute on function public.submit_result(uuid, jsonb) from public, anon;
revoke execute on function public.delete_my_account() from public, anon;
revoke execute on function public.protect_level() from public, anon, authenticated;
revoke execute on function public.track_initial_level() from public, anon, authenticated;

grant execute on function public.swipe(uuid, boolean) to authenticated;
grant execute on function public.my_matches() to authenticated;
grant execute on function public.create_game(timestamptz, text, text, numeric, numeric, boolean, uuid[]) to authenticated;
grant execute on function public.join_game(uuid, smallint) to authenticated;
grant execute on function public.leave_game(uuid) to authenticated;
grant execute on function public.cancel_game(uuid) to authenticated;
grant execute on function public.submit_result(uuid, jsonb) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
