/**
 * Formatos de competición: americano, liga (todos contra todos) y
 * eliminatoria con cuadro.
 */

import { matchOutcome, validateResult } from "./level.js";

/** Generador pseudoaleatorio con semilla (mulberry32), para cuadros reproducibles. */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/* ------------------------------------------------------------------ */
/* Americano: parejas que rotan cada ronda, clasificación individual  */
/* ------------------------------------------------------------------ */

/** Rondas recomendadas: cada jugador juega una vez con cada compañero posible. */
export function americanoDefaultRounds(playerCount) {
  return playerCount % 4 === 0 ? playerCount - 1 : playerCount;
}

/**
 * Genera las rondas de un americano. Cada ronda reparte a los jugadores en
 * pistas de cuatro; si sobran jugadores, descansan los que menos lo han hecho.
 * Se prueban muchos repartos y se queda el que menos repite compañeros y rivales.
 */
export function americanoSchedule(players, rounds, rng = Math.random, attempts = 300) {
  if (players.length < 4) throw new Error("Un americano necesita al menos 4 jugadores");
  const courts = Math.floor(players.length / 4);
  const partners = new Map();
  const opponents = new Map();
  const rests = new Map(players.map((p) => [p, 0]));
  const count = (map, a, b) => map.get(pairKey(a, b)) || 0;
  const bump = (map, a, b) => map.set(pairKey(a, b), count(map, a, b) + 1);

  const schedule = [];
  for (let r = 0; r < rounds; r++) {
    let best = null;
    for (let t = 0; t < attempts; t++) {
      const order = shuffle(players, rng).sort((a, b) => rests.get(a) - rests.get(b));
      const restCount = players.length - courts * 4;
      const resting = order.slice(0, restCount);
      const playing = shuffle(order.slice(restCount), rng);
      const matches = [];
      let cost = 0;
      for (let c = 0; c < courts; c++) {
        const [a, b, x, y] = playing.slice(c * 4, c * 4 + 4);
        matches.push({ teamA: [a, b], teamB: [x, y], score: null });
        cost += 100 * (count(partners, a, b) + count(partners, x, y));
        cost += count(opponents, a, x) + count(opponents, a, y) + count(opponents, b, x) + count(opponents, b, y);
      }
      if (!best || cost < best.cost) best = { cost, matches, resting };
      if (cost === 0) break;
    }
    for (const m of best.matches) {
      bump(partners, ...m.teamA);
      bump(partners, ...m.teamB);
      for (const p of m.teamA) for (const q of m.teamB) bump(opponents, p, q);
    }
    for (const p of best.resting) rests.set(p, rests.get(p) + 1);
    schedule.push({ matches: best.matches, resting: best.resting });
  }
  return schedule;
}

/** Clasificación individual del americano: suma de puntos de cada jugador. */
export function americanoStandings(players, schedule) {
  const rows = new Map(players.map((p) => [p, { player: p, points: 0, played: 0, won: 0 }]));
  for (const round of schedule) {
    for (const m of round.matches) {
      if (!m.score) continue;
      const [a, b] = m.score;
      for (const p of m.teamA) {
        const row = rows.get(p);
        row.points += a;
        row.played++;
        if (a > b) row.won++;
      }
      for (const p of m.teamB) {
        const row = rows.get(p);
        row.points += b;
        row.played++;
        if (b > a) row.won++;
      }
    }
  }
  return [...rows.values()].sort((x, y) => y.points - x.points || y.won - x.won || x.player.localeCompare(y.player));
}

/* ------------------------------------------------------------------ */
/* Liga: todos contra todos por parejas                               */
/* ------------------------------------------------------------------ */

/** Jornadas con el método del círculo. Con número impar, una pareja descansa. */
export function roundRobin(teams) {
  if (teams.length < 2) throw new Error("Una liga necesita al menos 2 parejas");
  const list = teams.length % 2 ? [...teams, null] : [...teams];
  const n = list.length;
  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const matches = [];
    let resting = null;
    for (let i = 0; i < n / 2; i++) {
      const home = list[i];
      const away = list[n - 1 - i];
      if (home === null || away === null) resting = home ?? away;
      else matches.push({ home, away, sets: null });
    }
    rounds.push({ matches, resting });
    // Fijo el primero y giro el resto.
    list.splice(1, 0, list.pop());
  }
  return rounds;
}

/** Clasificación: 3 puntos por victoria; desempata la diferencia de sets y de juegos. */
export function leagueStandings(teams, rounds) {
  const rows = new Map(
    teams.map((t) => [t, { team: t, played: 0, won: 0, lost: 0, points: 0, setsFor: 0, setsAgainst: 0, gamesFor: 0, gamesAgainst: 0 }])
  );
  for (const round of rounds) {
    for (const m of round.matches) {
      if (!m.sets) continue;
      const o = matchOutcome(m.sets);
      const home = rows.get(m.home);
      const away = rows.get(m.away);
      home.played++;
      away.played++;
      home.setsFor += o.setsA; home.setsAgainst += o.setsB;
      away.setsFor += o.setsB; away.setsAgainst += o.setsA;
      home.gamesFor += o.gamesA; home.gamesAgainst += o.gamesB;
      away.gamesFor += o.gamesB; away.gamesAgainst += o.gamesA;
      const [winner, loser] = o.winner === "A" ? [home, away] : [away, home];
      winner.won++;
      winner.points += 3;
      loser.lost++;
    }
  }
  return [...rows.values()].sort(
    (x, y) =>
      y.points - x.points ||
      (y.setsFor - y.setsAgainst) - (x.setsFor - x.setsAgainst) ||
      (y.gamesFor - y.gamesAgainst) - (x.gamesFor - x.gamesAgainst) ||
      x.team.localeCompare(y.team)
  );
}

/* ------------------------------------------------------------------ */
/* Eliminatoria: cuadro con cabezas de serie y byes                   */
/* ------------------------------------------------------------------ */

/** Orden de cabezas de serie para un cuadro de `size` (potencia de 2): 1 contra el último, etc. */
export function seedOrder(size) {
  let seeds = [1];
  while (seeds.length < size) {
    const total = seeds.length * 2 + 1;
    seeds = seeds.flatMap((s) => [s, total - s]);
  }
  return seeds;
}

/**
 * Crea el cuadro. Las parejas van en orden de cabeza de serie; si no llenan
 * una potencia de 2, las mejores pasan directamente a la segunda ronda.
 */
export function createBracket(teams) {
  if (teams.length < 2) throw new Error("Una eliminatoria necesita al menos 2 parejas");
  let size = 1;
  while (size < teams.length) size *= 2;
  const slots = seedOrder(size).map((seed) => teams[seed - 1] ?? null);
  const rounds = [];
  const first = [];
  for (let i = 0; i < size; i += 2) first.push({ a: slots[i], b: slots[i + 1], winner: null, result: "" });
  rounds.push(first);
  for (let n = size / 4; n >= 1; n /= 2) {
    rounds.push(Array.from({ length: n }, () => ({ a: null, b: null, winner: null, result: "" })));
  }
  const bracket = { rounds };
  first.forEach((m, i) => {
    if (m.a && !m.b) setBracketWinner(bracket, 0, i, m.a, "Pasa directo");
  });
  return bracket;
}

/** Marca el ganador de un partido del cuadro y lo coloca en la ronda siguiente. */
export function setBracketWinner(bracket, roundIndex, matchIndex, winner, result = "") {
  const match = bracket.rounds[roundIndex][matchIndex];
  if (winner !== match.a && winner !== match.b) throw new Error("El ganador tiene que ser una de las dos parejas");
  match.winner = winner;
  match.result = result;
  const next = bracket.rounds[roundIndex + 1];
  if (next) {
    const target = next[Math.floor(matchIndex / 2)];
    if (matchIndex % 2 === 0) target.a = winner;
    else target.b = winner;
  }
  return bracket;
}

/** Deshace el ganador de un partido si la ronda siguiente aún no se ha jugado. */
export function clearBracketWinner(bracket, roundIndex, matchIndex) {
  const match = bracket.rounds[roundIndex][matchIndex];
  const next = bracket.rounds[roundIndex + 1];
  if (next) {
    const target = next[Math.floor(matchIndex / 2)];
    if (target.winner) throw new Error("Primero deshaz el partido de la ronda siguiente");
    if (matchIndex % 2 === 0) target.a = null;
    else target.b = null;
  }
  match.winner = null;
  match.result = "";
  return bracket;
}

export function bracketChampion(bracket) {
  const final = bracket.rounds[bracket.rounds.length - 1][0];
  return final.winner;
}

export function roundName(roundIndex, totalRounds) {
  const fromEnd = totalRounds - roundIndex;
  if (fromEnd === 1) return "Final";
  if (fromEnd === 2) return "Semifinales";
  if (fromEnd === 3) return "Cuartos";
  if (fromEnd === 4) return "Octavos";
  return `Ronda ${roundIndex + 1}`;
}

/**
 * Convierte "6-4 3-6 7-5" en [[6,4],[3,6],[7,5]] y lo valida.
 * Devuelve { sets } o { error }.
 */
export function parseSets(text) {
  const parts = String(text).trim().split(/[\s,;]+/).filter(Boolean);
  const sets = [];
  for (const part of parts) {
    const m = part.match(/^(\d{1,2})[-/:](\d{1,2})$/);
    if (!m) return { error: `No entiendo "${part}". Escribe los sets así: 6-4 3-6 7-5` };
    sets.push([Number(m[1]), Number(m[2])]);
  }
  const error = validateResult(sets);
  return error ? { error } : { sets };
}
