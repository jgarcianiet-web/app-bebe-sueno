/**
 * Estado de la app y persistencia en el dispositivo (localStorage).
 *
 * Mientras no haya servidor, la comunidad (jugadores, partidos abiertos) es de
 * demostración y se genera a partir de tu zona y tu nivel, para poder probar
 * todos los flujos de punta a punta.
 */

import { seededRandom } from "./tournaments.js";
import { OBJECTIVES, AVAILABILITY, hashString } from "./affinity.js";
import { roundLevel, clampLevel } from "./level.js";

const STORAGE_KEY = "padel-app-v1";

export const ZONES = [
  "Madrid Centro", "Madrid Norte", "Madrid Sur", "Madrid Este", "Madrid Oeste",
  "Barcelona", "Valencia", "Sevilla", "Málaga", "Bilbao", "Zaragoza", "Murcia",
  "Alicante", "Palma", "Valladolid", "A Coruña"
];

const FIRST_NAMES = [
  "Lucía", "Martín", "Sara", "Pablo", "Carmen", "Javier", "Elena", "Diego", "Laura", "Álvaro",
  "Paula", "Sergio", "Marta", "Andrés", "Irene", "Raúl", "Nuria", "Hugo", "Cristina", "Iván",
  "Alba", "Rubén", "Claudia", "Adrián", "Noelia", "Óscar", "Sofía", "Marcos", "Patricia", "Jorge"
];
const LAST_INITIALS = "ABCDEFGHIJLMNOPRSTV";
const BIOS = [
  "Juego desde hace 3 años, me encanta la bandeja.",
  "Busco pareja fija para ligas del club.",
  "Me pico fácil, pero siempre con buen rollo 😄",
  "Vengo del tenis, todavía peleándome con las paredes.",
  "Quiero sacarme la licencia y competir este año.",
  "Pádel y cerveza después, el plan perfecto.",
  "Defensa sólida, poco remate. Busco drive que remate.",
  "Entreno dos veces por semana, quiero subir de nivel.",
  "Disponible casi siempre por las tardes.",
  "Fan de los americanos de los viernes."
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

function pick(list, rng) {
  return list[Math.floor(rng() * list.length)];
}

function pickSome(list, rng, min, max) {
  const n = min + Math.floor(rng() * (max - min + 1));
  return [...list].sort(() => rng() - 0.5).slice(0, n);
}

export function clubsFor(zone) {
  return [`Club Pádel ${zone}`, `Indoor ${zone}`, `Polideportivo ${zone}`];
}

/** Genera la comunidad de demostración alrededor de tu perfil. */
export function seedCommunity(profile) {
  const rng = seededRandom(hashString(`${profile.name}|${profile.zone}`));
  const nearby = ZONES.filter((z) => z !== profile.zone);
  const players = FIRST_NAMES.map((first, i) => {
    const zone = rng() < 0.7 ? profile.zone : pick(nearby, rng);
    const level = roundLevel(clampLevel(profile.level + (rng() - 0.5) * 3));
    return {
      id: `demo-${i}`,
      demo: true,
      name: `${first} ${LAST_INITIALS[i % LAST_INITIALS.length]}.`,
      age: 20 + Math.floor(rng() * 30),
      level: Math.round(level * 2) / 2,
      matches: 5 + Math.floor(rng() * 60),
      zone,
      position: pick(["drive", "reves", "indiferente"], rng),
      hand: rng() < 0.85 ? "diestro" : "zurdo",
      objectives: pickSome(OBJECTIVES.map((o) => o.id), rng, 1, 3),
      availability: pickSome(AVAILABILITY.map((a) => a.id), rng, 1, 3),
      federated: rng() < 0.25,
      bio: pick(BIOS, rng)
    };
  });

  const local = players.filter((p) => p.zone === profile.zone);
  const clubs = clubsFor(profile.zone);
  const games = [];
  const make = (dayOffset, time, filled, levelShift) => {
    const center = Math.round((profile.level + levelShift) * 2) / 2;
    const near = local.filter((p) => Math.abs(p.level - center) <= 1).sort(() => rng() - 0.5);
    const slots = [...near.slice(0, filled).map((p) => p.id)];
    while (slots.length < 4) slots.push(null);
    games.push({
      id: uid("game"),
      date: isoDate(dayOffset),
      time,
      club: pick(clubs, rng),
      zone: profile.zone,
      minLevel: clampLevel(center - 0.5),
      maxLevel: clampLevel(center + 0.5),
      competitive: true,
      slots,
      createdBy: slots[0],
      result: null
    });
  };
  // Uno al que le falta un jugador mañana a las 19:00, para ver el aviso en acción.
  make(1, "19:00", 3, 0);
  make(1, "21:00", 2, 0.5);
  make(2, "10:00", 1, -0.5);
  make(3, "20:30", 3, 1);
  make(5, "18:00", 2, 0);
  return { players, games };
}

export function defaultState() {
  return {
    version: 1,
    profile: null,
    players: [],
    swipes: {},
    connections: [],
    games: [],
    tournaments: [],
    diary: [],
    inbox: [],
    notifiedKeys: [],
    scorer: null,
    scoreHistory: []
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch {
    return defaultState();
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Sin almacenamiento (modo privado, cuota llena): la sesión sigue en memoria.
  }
}

export function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nada que borrar.
  }
}
