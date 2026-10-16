/**
 * Datos que viven solo en el dispositivo: torneos, diario, marcador y avisos.
 * Se guardan en localStorage, separados por usuario. Los perfiles, partidos y
 * matches vienen del servidor (ver remote.js).
 */

export const ZONES = [
  "Madrid Centro", "Madrid Norte", "Madrid Sur", "Madrid Este", "Madrid Oeste",
  "Barcelona", "Valencia", "Sevilla", "Málaga", "Bilbao", "Zaragoza", "Murcia",
  "Alicante", "Palma", "Valladolid", "A Coruña"
];

export function uid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Fecha local "YYYY-MM-DD" desplazada `offset` días desde hoy. */
export function isoDate(offset = 0, from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function clubsFor(zone) {
  return [`Club Pádel ${zone}`, `Indoor ${zone}`, `Polideportivo ${zone}`];
}

export const LOCAL_FIELDS = ["tournaments", "diary", "inbox", "notifiedKeys", "scorer", "scoreHistory"];

export function defaultLocal() {
  return {
    tournaments: [],
    diary: [],
    inbox: [],
    notifiedKeys: [],
    scorer: null,
    scoreHistory: []
  };
}

const keyFor = (userId) => `padel-local-${userId}`;

export function loadLocal(userId) {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    return raw ? { ...defaultLocal(), ...JSON.parse(raw) } : defaultLocal();
  } catch {
    return defaultLocal();
  }
}

export function saveLocal(userId, state) {
  try {
    const data = Object.fromEntries(LOCAL_FIELDS.map((k) => [k, state[k]]));
    localStorage.setItem(keyFor(userId), JSON.stringify(data));
  } catch {
    // Sin almacenamiento (modo privado, cuota llena): la sesión sigue en memoria.
  }
}

export function clearLocal(userId) {
  try {
    localStorage.removeItem(keyFor(userId));
  } catch {
    // Nada que borrar.
  }
}
