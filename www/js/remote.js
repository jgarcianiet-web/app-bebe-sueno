/**
 * Acceso al servidor (Supabase): cuentas, perfiles, "me gusta", matches y
 * partidos. Convierte las filas de la base de datos al mismo formato que usa
 * la interfaz, así el resto de la app no sabe de dónde vienen los datos.
 */

import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const MESSAGES = [
  [/invalid login credentials/i, "Email o contraseña incorrectos"],
  [/user already registered/i, "Ya existe una cuenta con ese email. Prueba a entrar"],
  [/email not confirmed/i, "Confirma tu email antes de entrar: revisa tu bandeja de entrada (y la de spam)"],
  [/password should be at least/i, "La contraseña debe tener al menos 6 caracteres"],
  [/unable to validate email|invalid email/i, "Ese email no parece válido"],
  [/rate limit|too many requests|only request this after/i, "Demasiados intentos. Espera un minuto y vuelve a probar"],
  [/failed to fetch|networkerror|load failed/i, "No hay conexión con el servidor. Revisa tu internet"],
  [/schema cache|does not exist/i, "La base de datos aún no está preparada (falta ejecutar supabase/schema.sql)"]
];

function toError(error) {
  const raw = error?.message || String(error);
  const known = MESSAGES.find(([re]) => re.test(raw));
  return new Error(known ? known[1] : raw);
}

function check({ data, error }) {
  if (error) throw toError(error);
  return data;
}

/* ---------------------------- Cuentas ---------------------------- */

export async function getSession() {
  const { data } = await sb.auth.getSession();
  return data.session;
}

export function onAuthChange(callback) {
  sb.auth.onAuthStateChange((event, session) => callback(event, session));
}

export async function signUp(email, password) {
  const data = check(await sb.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: location.origin + location.pathname }
  }));
  return { needsConfirmation: !data.session };
}

export async function signIn(email, password) {
  check(await sb.auth.signInWithPassword({ email, password }));
}

export async function signOut() {
  await sb.auth.signOut();
}

/* --------------------------- Conversión --------------------------- */

const pad = (n) => String(n).padStart(2, "0");

/** Fecha y hora locales ("2026-10-17", "19:00") de un instante del servidor. */
export function localParts(iso) {
  const d = new Date(iso);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`
  };
}

function mapProfile(row) {
  return {
    id: row.id,
    name: row.name,
    age: row.age,
    level: Number(row.level),
    matches: row.matches,
    zone: row.zone,
    position: row.position,
    hand: row.hand,
    objectives: row.objectives || [],
    availability: row.availability || [],
    federated: row.federated,
    bio: row.bio || ""
  };
}

function mapGame(row) {
  const slots = [null, null, null, null];
  for (const s of row.game_slots || []) slots[s.slot] = s.player_id;
  const result = row.result
    ? {
        sets: row.result.sets,
        changes: row.result.changes.map((c) => ({ ...c, before: Number(c.before), after: Number(c.after), delta: Number(c.delta) }))
      }
    : null;
  return {
    id: row.id,
    ...localParts(row.starts_at),
    club: row.club,
    zone: row.zone,
    minLevel: Number(row.min_level),
    maxLevel: Number(row.max_level),
    competitive: row.competitive,
    slots,
    createdBy: row.created_by,
    result
  };
}

/* ----------------------------- Lectura ----------------------------- */

/** Todo lo que necesita la app para el usuario con sesión iniciada. */
export async function fetchAll(userId) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const gameFields = "*, game_slots(slot, player_id)";
  const [me, players, recentGames, mySlots, swipes, matches, history] = await Promise.all([
    sb.from("profiles").select("*").eq("id", userId).maybeSingle(),
    sb.from("profiles").select("*").neq("id", userId).order("created_at", { ascending: false }).limit(500),
    sb.from("games").select(gameFields).gte("starts_at", since).order("starts_at").limit(300),
    sb.from("game_slots").select(`game:games(${gameFields})`).eq("player_id", userId),
    sb.from("swipes").select("target, liked").eq("swiper", userId),
    sb.rpc("my_matches"),
    sb.from("level_history").select("level, recorded_at").eq("player_id", userId).order("recorded_at")
  ].map((p) => p.then(check)));

  const games = new Map();
  for (const row of recentGames) games.set(row.id, row);
  for (const { game } of mySlots) if (game) games.set(game.id, game);

  const profile = me
    ? {
        ...mapProfile(me),
        levelHistory: history.map((h) => ({ date: localParts(h.recorded_at).date, level: Number(h.level) }))
      }
    : null;

  return {
    profile,
    players: players.map(mapProfile),
    games: [...games.values()].map(mapGame),
    swipes: Object.fromEntries(swipes.map((s) => [s.target, s.liked ? "like" : "pass"])),
    connections: (matches || []).map((m) => (typeof m === "string" ? m : Object.values(m)[0]))
  };
}

/* ---------------------------- Escritura ---------------------------- */

const PROFILE_FIELDS = ["name", "age", "level", "zone", "position", "hand", "objectives", "availability", "federated", "bio"];

export async function saveProfile(userId, data, isNew) {
  const row = Object.fromEntries(PROFILE_FIELDS.filter((k) => k in data).map((k) => [k, data[k]]));
  if (isNew) check(await sb.from("profiles").insert({ id: userId, ...row }));
  else check(await sb.from("profiles").update(row).eq("id", userId));
}

/** Devuelve true si hay match. */
export async function swipe(targetId, liked) {
  return check(await sb.rpc("swipe", { p_target: targetId, p_liked: liked }));
}

export async function resetPasses(userId) {
  check(await sb.from("swipes").delete().eq("swiper", userId).eq("liked", false));
}

export async function createGame(game) {
  return check(await sb.rpc("create_game", {
    p_starts_at: game.startsAt,
    p_club: game.club,
    p_zone: game.zone,
    p_min_level: game.minLevel,
    p_max_level: game.maxLevel,
    p_competitive: game.competitive,
    p_invites: game.invites
  }));
}

export async function joinGame(gameId, slot = null) {
  return check(await sb.rpc("join_game", { p_game: gameId, p_slot: slot }));
}

export async function leaveGame(gameId) {
  check(await sb.rpc("leave_game", { p_game: gameId }));
}

export async function cancelGame(gameId) {
  check(await sb.rpc("cancel_game", { p_game: gameId }));
}

export async function submitResult(gameId, sets) {
  const changes = check(await sb.rpc("submit_result", { p_game: gameId, p_sets: sets }));
  return changes.map((c) => ({ ...c, before: Number(c.before), after: Number(c.after), delta: Number(c.delta) }));
}

export async function deleteAccount() {
  check(await sb.rpc("delete_my_account"));
}
