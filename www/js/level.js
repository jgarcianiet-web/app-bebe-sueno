/**
 * Nivel de juego (escala 1–7, como Playtomic) y su ajuste tras cada partido.
 *
 * Funciona como un Elo adaptado a parejas: el nivel de cada pareja es la media
 * de sus dos jugadores, se calcula el resultado esperado según la diferencia de
 * nivel y cada jugador sube o baja en proporción a lo que sorprende el
 * resultado real. Ganar a una pareja de más nivel sube mucho; perder contra una
 * pareja de menos nivel baja mucho; el resultado "esperado" apenas mueve nada.
 */

export const LEVEL_MIN = 1;
export const LEVEL_MAX = 7;

/** Partidos necesarios para que el nivel se considere fiable. */
export const RELIABLE_AFTER = 10;

export function clampLevel(value) {
  return Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, value));
}

export function roundLevel(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Probabilidad de que la pareja con `teamLevel` gane a la de `oppLevel`.
 * Un punto de diferencia equivale a ~76 % de probabilidad de victoria.
 */
export function expectedScore(teamLevel, oppLevel) {
  return 1 / (1 + Math.pow(10, (oppLevel - teamLevel) / 2));
}

/** Los jugadores nuevos se ajustan más rápido hasta que su nivel es fiable. */
export function kFactor(matchesPlayed) {
  return matchesPlayed < RELIABLE_AFTER ? 0.3 : 0.15;
}

/** Un set es válido si termina 6-0…6-4, 7-5 o 7-6 (en cualquier orden). */
export function isValidSet(a, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return false;
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi === 6 && lo <= 4) || (hi === 7 && (lo === 5 || lo === 6));
}

/** Resume un resultado en sets ([[6,4],[3,6],[7,5]]) para la pareja A y la B. */
export function matchOutcome(sets) {
  let setsA = 0, setsB = 0, gamesA = 0, gamesB = 0;
  for (const [a, b] of sets) {
    gamesA += a;
    gamesB += b;
    if (a > b) setsA++;
    else if (b > a) setsB++;
  }
  const winner = setsA > setsB ? "A" : setsB > setsA ? "B" : null;
  return { setsA, setsB, gamesA, gamesB, winner };
}

/**
 * Comprueba que un resultado se pueda registrar: entre 1 y 3 sets válidos,
 * con un ganador claro y sin sets jugados después de que el partido acabara.
 * Devuelve un mensaje de error o null si es correcto.
 */
export function validateResult(sets) {
  if (!Array.isArray(sets) || sets.length === 0) return "Introduce al menos un set";
  if (sets.length > 3) return "Un partido tiene como máximo 3 sets";
  for (const [a, b] of sets) {
    if (!isValidSet(a, b)) return `El set ${a}-${b} no es válido (6-0 a 6-4, 7-5 o 7-6)`;
  }
  const { winner, setsA, setsB } = matchOutcome(sets);
  if (!winner) return "El resultado tiene que tener un ganador";
  if (sets.length === 3 && (setsA === 3 || setsB === 3)) {
    return "El partido ya estaba decidido antes del tercer set";
  }
  return null;
}

/**
 * Calcula el nuevo nivel de los cuatro jugadores.
 * `players` son [{id, level, matches}] en orden: pareja A (0, 1) y pareja B (2, 3).
 * El resultado combina la victoria (70 %) y la proporción de juegos ganados
 * (30 %), así que un 6-0 6-0 cuenta más que un 7-6 7-6.
 */
export function levelChanges(players, sets) {
  if (players.length !== 4) throw new Error("Un partido de pádel necesita 4 jugadores");
  const error = validateResult(sets);
  if (error) throw new Error(error);

  const outcome = matchOutcome(sets);
  const totalGames = outcome.gamesA + outcome.gamesB;
  const gameShareA = totalGames ? outcome.gamesA / totalGames : 0.5;
  const actualA = 0.7 * (outcome.winner === "A" ? 1 : 0) + 0.3 * gameShareA;

  const levelA = (players[0].level + players[1].level) / 2;
  const levelB = (players[2].level + players[3].level) / 2;
  const expectedA = expectedScore(levelA, levelB);

  return players.map((p, i) => {
    const inA = i < 2;
    const actual = inA ? actualA : 1 - actualA;
    const expected = inA ? expectedA : 1 - expectedA;
    const after = roundLevel(clampLevel(p.level + kFactor(p.matches || 0) * (actual - expected)));
    return {
      id: p.id,
      before: p.level,
      after,
      delta: roundLevel(after - p.level),
      won: (outcome.winner === "A") === inA
    };
  });
}

/** Etiqueta de categoría orientativa para cada tramo de nivel. */
export function levelLabel(level) {
  if (level < 2) return "Iniciación";
  if (level < 3) return "Principiante";
  if (level < 4) return "Intermedio";
  if (level < 5) return "Intermedio alto";
  if (level < 6) return "Avanzado";
  if (level < 6.5) return "Competición";
  return "Profesional";
}
