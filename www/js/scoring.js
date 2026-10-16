/**
 * Marcador de pádel: puntos (15-30-40), punto de oro o ventajas, juegos,
 * tie-break a 7 con 6-6 y sets. Cada función devuelve un estado nuevo, así que
 * deshacer es tan simple como volver al estado anterior.
 */

const POINT_LABELS = ["0", "15", "30", "40"];

const other = (team) => (team === "A" ? "B" : "A");

export function createScorer({ goldenPoint = true, bestOf = 3, firstServer = "A" } = {}) {
  return {
    config: { goldenPoint, bestOf },
    sets: [],
    games: { A: 0, B: 0 },
    points: { A: 0, B: 0 },
    tiebreak: false,
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

function winSet(s, team) {
  s.sets.push([s.games.A, s.games.B]);
  s.games = { A: 0, B: 0 };
  s.points = { A: 0, B: 0 };
  if (setsWon(s, team) > s.config.bestOf / 2) {
    s.finished = true;
    s.winner = team;
  }
}

function winGame(s, team) {
  if (team !== s.server) s.stats.breaks[team]++;
  s.games[team]++;
  s.points = { A: 0, B: 0 };
  s.server = other(s.server);
  const lead = s.games[team] - s.games[other(team)];
  if (s.games[team] >= 6 && lead >= 2) {
    winSet(s, team);
  } else if (s.games.A === 6 && s.games.B === 6) {
    s.tiebreak = true;
    s.tiebreakFirstServer = s.server;
  }
}

export function addPoint(state, team) {
  if (state.finished) return state;
  const s = structuredClone(state);
  const opp = other(team);

  s.stats.pointsWon[team]++;
  s.stats.servePlayed[s.server]++;
  if (team === s.server) s.stats.serveWon[s.server]++;
  if (s.stats.streak.team === team) s.stats.streak.length++;
  else s.stats.streak = { team, length: 1 };
  s.stats.bestStreak[team] = Math.max(s.stats.bestStreak[team], s.stats.streak.length);

  if (s.tiebreak) {
    s.points[team]++;
    if (s.points[team] >= 7 && s.points[team] - s.points[opp] >= 2) {
      // Tras el tie-break saca quien lo empezó restando.
      const nextServer = other(s.tiebreakFirstServer);
      s.games[team]++;
      s.tiebreak = false;
      s.tiebreakFirstServer = null;
      winSet(s, team);
      s.server = nextServer;
    } else if ((s.points.A + s.points.B) % 2 === 1) {
      // En el tie-break el saque cambia tras el primer punto y luego cada dos.
      s.server = other(s.server);
    }
    return s;
  }

  if (s.config.goldenPoint && s.points.A === 3 && s.points.B === 3) {
    s.stats.goldenPoints[team]++;
    winGame(s, team);
    return s;
  }

  s.points[team]++;
  if (s.points[team] >= 4 && s.points[team] - s.points[opp] >= 2) {
    winGame(s, team);
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

/** "Punto de oro", "Iguales", "Bola de set A"… o null si no hay nada que destacar. */
export function situation(state) {
  if (state.finished) return null;
  const { A, B } = state.points;
  if (!state.tiebreak && A === 3 && B === 3) return state.config.goldenPoint ? "Punto de oro" : "Iguales";
  if (state.tiebreak) return "Tie-break";
  return null;
}

/** Porcentaje entero, o 0 si no hay datos. */
export function percent(part, total) {
  return total ? Math.round((part / total) * 100) : 0;
}
