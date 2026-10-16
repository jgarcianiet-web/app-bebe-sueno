/**
 * Afinidad entre dos jugadores (0–100) para el buscador de compañeros.
 *
 * Reparto de puntos:
 *   - Nivel parecido ........ 40  (0 a partir de 2 puntos de diferencia)
 *   - Misma zona ............ 20
 *   - Objetivos en común .... 20  (amistosos, torneos, federarse…)
 *   - Horarios compatibles .. 15
 *   - Posiciones que encajan  5   (drive + revés)
 */

export const OBJECTIVES = [
  { id: "amistosos", label: "Amistosos" },
  { id: "competitivos", label: "Competitivos" },
  { id: "torneos", label: "Torneos" },
  { id: "ligas", label: "Ligas" },
  { id: "federarse", label: "Federarse" },
  { id: "entrenar", label: "Entrenar" }
];

export const AVAILABILITY = [
  { id: "mananas", label: "Mañanas" },
  { id: "mediodia", label: "Mediodía" },
  { id: "tardes", label: "Tardes" },
  { id: "noches", label: "Noches" },
  { id: "findes", label: "Fines de semana" }
];

export const POSITIONS = [
  { id: "drive", label: "Drive" },
  { id: "reves", label: "Revés" },
  { id: "indiferente", label: "Indiferente" }
];

export function labelOf(list, id) {
  return list.find((x) => x.id === id)?.label ?? id;
}

/** Proporción de elementos compartidos entre dos listas (0–1). */
export function overlap(a = [], b = []) {
  const setA = new Set(a);
  const setB = new Set(b);
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  let shared = 0;
  for (const x of setA) if (setB.has(x)) shared++;
  return shared / union.size;
}

function positionFit(a, b) {
  if (a === "indiferente" || b === "indiferente") return 0.6;
  return a !== b ? 1 : 0;
}

export function affinity(me, other) {
  const reasons = [];
  const levelDiff = Math.abs(me.level - other.level);
  const levelPts = 40 * Math.max(0, 1 - levelDiff / 2);
  if (levelDiff <= 0.5) reasons.push("Nivel muy parecido");
  else if (levelDiff <= 1) reasons.push("Nivel compatible");

  const zonePts = me.zone && me.zone === other.zone ? 20 : 0;
  if (zonePts) reasons.push(`Los dos jugáis en ${other.zone}`);

  const sharedObjectives = (me.objectives || []).filter((o) => (other.objectives || []).includes(o));
  const objectivePts = 20 * overlap(me.objectives, other.objectives);
  if (sharedObjectives.length) {
    reasons.push(`Buscáis lo mismo: ${sharedObjectives.map((o) => labelOf(OBJECTIVES, o).toLowerCase()).join(", ")}`);
  }

  const availabilityPts = 15 * overlap(me.availability, other.availability);
  if (availabilityPts >= 7.5) reasons.push("Horarios compatibles");

  const fit = positionFit(me.position, other.position);
  if (fit === 1) reasons.push(`Os complementáis: ${labelOf(POSITIONS, me.position).toLowerCase()} y ${labelOf(POSITIONS, other.position).toLowerCase()}`);

  const score = Math.round(levelPts + zonePts + objectivePts + availabilityPts + 5 * fit);
  return { score: Math.min(100, Math.max(0, score)), reasons };
}
