/**
 * Marcador de pádel: puntos (15-30-40), juegos, tie-break a 7 con 6-6 y sets.
 * Cada función devuelve un estado nuevo, así que deshacer es tan simple como
 * volver al estado anterior.
 *
 * Modos para el 40-40 (iguales):
 *   - golden:    punto de oro, el siguiente punto decide el juego.
 *   - advantage: ventajas clásicas, hay que ganar dos puntos seguidos.
 *   - star:      star point, se juegan hasta dos ventajas y, si se llega a
 *                iguales por tercera vez, un punto decisivo cierra el juego.
 * Opcionalmente, el set decisivo se juega como super tie-break a 10.
 */

const POINT_LABELS = ["0", "15", "30", "40"];

export const DEUCE_MODES = [
  { id: "golden", label: "Punto de oro" },
  { id: "advantage", label: "Ventajas" },
  { id: "star", label: "Star point" }
];

/** Iguales a partir de los cuales el star point se convierte en punto decisivo. */
export const STAR_POINT_DEUCE = 3;

const other = (team) => (team === "A" ? "B" : "A");

/** Modo de iguales, también para partidos guardados antes de existir los modos. */
export function deuceMode(config) {
  return config.deuceMode ?? (config.goldenPoint === false ? "advantage" : "golden");
}

export function createScorer({ deuceMode = "golden", bestOf = 3, firstServer = "A", superTiebreak = false } = {}) {
  return {
    config: { deuceMode, bestOf, superTiebreak: superTiebreak && bestOf > 1 },
    sets: [],
    games: { A: 0, B: 0 },
    points: { A: 0, B: 0 },
    deuces: 0,
    tiebreak: false,
    superTiebreak: false,
    tiebreakFirstServer: null,
    server: firstServer,
    finished: false,
    winner: null,
    stats: {
      pointsWon: { A: 0, B: 0 },
      servePlayed: { A: 0, B: 0 },
      serveWon: { A: 0, B: 0 },
      breaks: { A: 0, B: 0 },
      goldenPoints: { A: 0, B: 0 },
      bestStreak: { A: 0, B: 0 },
      streak: { team: null, length: 0 }
    }
  };
}

function setsWon(state, team) {
  return state.sets.filter(([a, b]) => (team === "A" ? a > b : b > a)).length;
}

function startTiebreak(s, isSuper) {
  s.tiebreak = true;
  s.superTiebreak = isSuper;
  s.tiebreakFirstServer = s.server;
}

function winSet(s, team) {
  s.sets.push([s.games.A, s.games.B]);
  s.games = { A: 0, B: 0 };
  s.points = { A: 0, B: 0 };
  s.deuces = 0;
  const needed = Math.floor(s.config.bestOf / 2) + 1;
  if (setsWon(s, team) >= needed) {
    s.finished = true;
    s.winner = team;
  } else if (s.config.superTiebreak && setsWon(s, "A") === needed - 1 && setsWon(s, "B") === needed - 1) {
    startTiebreak(s, true);
  }
}

function winGame(s, team) {
  if (team !== s.server) s.stats.breaks[team]++;
  s.games[team]++;
  s.points = { A: 0, B: 0 };
  s.deuces = 0;
  s.server = other(s.server);
  const lead = s.games[team] - s.games[other(team)];
  if (s.games[team] >= 6 && lead >= 2) {
    winSet(s, team);
  } else if (s.games.A === 6 && s.games.B === 6) {
    startTiebreak(s, false);
  }
}

function winTiebreak(s, team) {
  // Tras un tie-break saca quien lo empezó restando.
  const nextServer = other(s.tiebreakFirstServer);
  const wasSuper = s.superTiebreak;
  s.tiebreak = false;
  s.superTiebreak = false;
  s.tiebreakFirstServer = null;
  if (wasSuper) {
    // El super tie-break se apunta como un set con sus puntos (p. ej. 10-8).
    s.sets.push([s.points.A, s.points.B]);
    s.points = { A: 0, B: 0 };
    s.finished = true;
    s.winner = team;
  } else {
    s.games[team]++;
    winSet(s, team);
  }
  s.server = nextServer;
}

/** ¿El próximo punto decide el juego aunque estén en iguales? */
export function isDecidingPoint(state) {
  if (state.tiebreak) return false;
  const { A, B } = state.points;
  if (A < 3 || A !== B) return false;
  const mode = deuceMode(state.config);
  return mode === "golden" || (mode === "star" && state.deuces >= STAR_POINT_DEUCE);
}

export function addPoint(state, team) {
  if (state.finished) return state;
  const s = structuredClone(state);
  s.deuces ??= 0;
  const opp = other(team);

  s.stats.pointsWon[team]++;
  s.stats.servePlayed[s.server]++;
  if (team === s.server) s.stats.serveWon[s.server]++;
  if (s.stats.streak.team === team) s.stats.streak.length++;
  else s.stats.streak = { team, length: 1 };
  s.stats.bestStreak[team] = Math.max(s.stats.bestStreak[team], s.stats.streak.length);

  if (s.tiebreak) {
    const target = s.superTiebreak ? 10 : 7;
    s.points[team]++;
    if (s.points[team] >= target && s.points[team] - s.points[opp] >= 2) {
      winTiebreak(s, team);
    } else if ((s.points.A + s.points.B) % 2 === 1) {
      // En el tie-break el saque cambia tras el primer punto y luego cada dos.
      s.server = other(s.server);
    }
    return s;
  }

  if (isDecidingPoint(state)) {
    s.stats.goldenPoints[team]++;
    winGame(s, team);
    return s;
  }

  s.points[team]++;
  if (s.points[team] >= 4 && s.points[team] - s.points[opp] >= 2) {
    winGame(s, team);
  } else if (s.points.A === s.points.B && s.points.A >= 3) {
    s.deuces++;
  }
  return s;
}

/** Texto de los puntos del juego en curso para cada pareja. */
export function pointLabels(state) {
  const { A, B } = state.points;
  if (state.tiebreak) return { A: String(A), B: String(B) };
  if (A >= 3 && B >= 3) {
    if (A === B) return { A: "40", B: "40" };
    return A > B ? { A: "AD", B: "40" } : { A: "40", B: "AD" };
  }
  return { A: POINT_LABELS[A], B: POINT_LABELS[B] };
}

/** "Punto de oro", "Star point", "Iguales", "Tie-break"… o null si no hay nada que destacar. */
export function situation(state) {
  if (state.finished) return null;
  if (state.tiebreak) return state.superTiebreak ? "Super tie-break · a 10" : "Tie-break · a 7";
  const { A, B } = state.points;
  const mode = deuceMode(state.config);
  if (A >= 3 && B >= 3) {
    if (isDecidingPoint(state)) return mode === "star" ? "Star point · el siguiente punto decide" : "Punto de oro";
    if (A !== B) return "Ventaja";
    if (mode === "star") {
      return state.deuces === STAR_POINT_DEUCE - 1
        ? "Iguales · si se vuelve a igualar, star point"
        : "Iguales · star point al tercer iguales";
    }
    return "Iguales";
  }
  return null;
}

/** Porcentaje entero, o 0 si no hay datos. */
export function percent(part, total) {
  return total ? Math.round((part / total) * 100) : 0;
}
