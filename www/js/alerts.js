/**
 * Avisos: "falta 1 jugador para el partido de mañana a las 19:00",
 * recordatorios y resultados pendientes. Es una función pura: recibe el estado
 * y la hora actual y devuelve la lista de avisos que tocan. Cada aviso lleva
 * una clave estable para no repetirlo.
 */

const DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const HOUR = 60 * 60 * 1000;

/** Fecha local a partir de "2026-10-17" y "19:00". */
export function gameDate(game) {
  const [y, m, d] = game.date.split("-").map(Number);
  const [hh, mm] = game.time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** "hoy a las 19:00", "mañana a las 19:00", "ayer a las 19:00" o "el jueves 22 a las 19:00". */
export function formatWhen(game, now = new Date()) {
  const when = gameDate(game);
  const days = Math.round((startOfDay(when) - startOfDay(now)) / (24 * HOUR));
  const at = `a las ${game.time}`;
  if (days === 0) return `hoy ${at}`;
  if (days === 1) return `mañana ${at}`;
  if (days === -1) return `ayer ${at}`;
  return `el ${DAY_NAMES[when.getDay()]} ${when.getDate()} ${at}`;
}

export function freeSlots(game) {
  return game.slots.filter((s) => s === null).length;
}

export function levelRangeText(game) {
  return game.minLevel === game.maxLevel ? `nivel ${game.minLevel}` : `nivel ${game.minLevel}–${game.maxLevel}`;
}

function missingText(free) {
  return free === 1 ? "Falta 1 jugador" : `Faltan ${free} jugadores`;
}

export function computeAlerts(state, now = new Date()) {
  const me = state.profile;
  if (!me) return [];
  const alerts = [];
  for (const game of state.games) {
    const start = gameDate(game);
    const untilStart = start - now;
    const mine = game.slots.includes(me.id);
    const free = freeSlots(game);
    const when = formatWhen(game, now);

    if (mine && untilStart > 0 && untilStart <= 48 * HOUR && free > 0) {
      alerts.push({
        key: `need-${game.id}-${free}`,
        gameId: game.id,
        text: `${missingText(free)} para tu partido de ${when} en ${game.club}`
      });
    } else if (
      !mine && untilStart > 0 && untilStart <= 48 * HOUR && free === 1 &&
      game.zone === me.zone && me.level >= game.minLevel - 0.25 && me.level <= game.maxLevel + 0.25
    ) {
      alerts.push({
        key: `open1-${game.id}`,
        gameId: game.id,
        text: `Falta 1 jugador para el partido de ${when} en ${game.club} (${levelRangeText(game)}). ¡Apúntate!`
      });
    }

    if (mine && free === 0 && untilStart > 0 && untilStart <= 24 * HOUR) {
      alerts.push({
        key: `reminder-${game.id}`,
        gameId: game.id,
        text: `Recordatorio: juegas ${when} en ${game.club}`
      });
    }

    if (mine && free === 0 && !game.result && untilStart < -1.5 * HOUR) {
      alerts.push({
        key: `result-${game.id}`,
        gameId: game.id,
        text: `¿Cómo quedó el partido de ${when}? Apunta el resultado para actualizar tu nivel`
      });
    }
  }
  return alerts;
}
