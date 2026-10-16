import { test } from "node:test";
import assert from "node:assert/strict";

import { levelChanges, validateResult, isValidSet, expectedScore } from "../www/js/level.js";
import { affinity, likesBack } from "../www/js/affinity.js";
import { createScorer, addPoint, pointLabels } from "../www/js/scoring.js";
import {
  americanoSchedule, americanoStandings, americanoDefaultRounds, seededRandom,
  roundRobin, leagueStandings, createBracket, setBracketWinner, bracketChampion, parseSets, seedOrder
} from "../www/js/tournaments.js";
import { computeAlerts, formatWhen } from "../www/js/alerts.js";

const player = (id, level, matches = 20) => ({ id, level, matches });

test("sets válidos e inválidos", () => {
  assert.ok(isValidSet(6, 4));
  assert.ok(isValidSet(7, 6));
  assert.ok(isValidSet(5, 7));
  assert.ok(!isValidSet(6, 5));
  assert.ok(!isValidSet(8, 6));
  assert.equal(validateResult([[6, 4], [6, 3]]), null);
  assert.match(validateResult([[6, 4], [3, 6]]), /ganador/);
  assert.match(validateResult([[6, 4], [6, 3], [6, 2]]), /decidido/);
});

test("el nivel sube al ganar y baja al perder, y suma cero entre parejas iguales", () => {
  const changes = levelChanges([player("a", 4), player("b", 4), player("c", 4), player("d", 4)], [[6, 3], [6, 4]]);
  assert.ok(changes[0].delta > 0 && changes[1].delta > 0);
  assert.ok(changes[2].delta < 0 && changes[3].delta < 0);
  assert.equal(Math.round((changes[0].delta + changes[2].delta) * 100), 0);
});

test("ganar a una pareja de más nivel sube más que ganar a una de menos", () => {
  const vsStronger = levelChanges([player("a", 3), player("b", 3), player("c", 4), player("d", 4)], [[6, 4], [6, 4]]);
  const vsWeaker = levelChanges([player("a", 3), player("b", 3), player("c", 2), player("d", 2)], [[6, 4], [6, 4]]);
  assert.ok(vsStronger[0].delta > vsWeaker[0].delta);
  assert.ok(expectedScore(4, 3) > 0.7 && expectedScore(4, 3) < 0.8);
});

test("los jugadores nuevos se ajustan más rápido y el nivel no sale de 1–7", () => {
  const newbie = levelChanges([player("a", 3, 0), player("b", 3, 0), player("c", 3), player("d", 3)], [[6, 0], [6, 0]]);
  assert.ok(newbie[0].delta > newbie[2].delta * -1);
  const top = levelChanges([player("a", 7), player("b", 7), player("c", 1), player("d", 1)], [[6, 0], [6, 0]]);
  assert.equal(top[0].after, 7);
  assert.equal(top[2].after, 1);
});

test("afinidad máxima con un jugador idéntico y complementario", () => {
  const me = { id: "me", level: 3.5, zone: "Madrid Norte", objectives: ["torneos"], availability: ["tardes"], position: "drive" };
  const twin = { ...me, id: "x", position: "reves" };
  const far = { id: "y", level: 6, zone: "Sevilla", objectives: ["amistosos"], availability: ["mananas"], position: "drive" };
  assert.equal(affinity(me, twin).score, 100);
  assert.ok(affinity(me, far).score < 10);
  assert.equal(likesBack("me", "x", 100), true);
  assert.equal(likesBack("me", "y", 40), likesBack("me", "y", 40));
});

test("marcador: juego normal, punto de oro y ventajas", () => {
  let s = createScorer({ goldenPoint: true });
  for (let i = 0; i < 3; i++) s = addPoint(s, "A");
  for (let i = 0; i < 3; i++) s = addPoint(s, "B");
  assert.deepEqual(pointLabels(s), { A: "40", B: "40" });
  s = addPoint(s, "B");
  assert.deepEqual(s.games, { A: 0, B: 1 });
  assert.equal(s.stats.breaks.B, 1, "B gana al resto: rotura");
  assert.equal(s.server, "B");

  let adv = createScorer({ goldenPoint: false });
  for (let i = 0; i < 3; i++) { adv = addPoint(adv, "A"); adv = addPoint(adv, "B"); }
  adv = addPoint(adv, "A");
  assert.deepEqual(pointLabels(adv), { A: "AD", B: "40" });
  adv = addPoint(adv, "B");
  assert.deepEqual(adv.games, { A: 0, B: 0 });
  adv = addPoint(adv, "A");
  adv = addPoint(adv, "A");
  assert.deepEqual(adv.games, { A: 1, B: 0 });
});

const winGames = (s, team, n) => {
  for (let g = 0; g < n; g++) for (let p = 0; p < 4; p++) s = addPoint(s, team);
  return s;
};

test("marcador: tie-break a 6-6 y partido a dos sets", () => {
  let s = createScorer();
  for (let i = 0; i < 6; i++) { s = winGames(s, "A", 1); s = winGames(s, "B", 1); }
  assert.equal(s.tiebreak, true);
  const tbServer = s.server;
  s = addPoint(s, "A");
  assert.notEqual(s.server, tbServer, "el saque cambia tras el primer punto del tie-break");
  for (let i = 0; i < 6; i++) s = addPoint(s, "A");
  assert.deepEqual(s.sets, [[7, 6]]);
  assert.equal(s.tiebreak, false);
  assert.equal(s.server, tbServer === "A" ? "B" : "A", "tras el tie-break saca quien empezó restando");
  s = winGames(s, "A", 6);
  assert.deepEqual(s.sets, [[7, 6], [6, 0]]);
  assert.equal(s.finished, true);
  assert.equal(s.winner, "A");
  assert.equal(addPoint(s, "B"), s, "no se puede puntuar en un partido terminado");
});

test("americano de 8: todos juegan cada ronda y casi nadie repite compañero", () => {
  const players = ["Ana", "Bea", "Carlos", "Dani", "Eva", "Fran", "Gema", "Hugo"];
  const rounds = americanoDefaultRounds(players.length);
  assert.equal(rounds, 7);
  const schedule = americanoSchedule(players, rounds, seededRandom(42));
  const partnerCount = new Map();
  for (const round of schedule) {
    const seen = round.matches.flatMap((m) => [...m.teamA, ...m.teamB]);
    assert.equal(new Set(seen).size, 8);
    for (const m of round.matches) {
      for (const [a, b] of [m.teamA, m.teamB]) {
        const k = [a, b].sort().join("|");
        partnerCount.set(k, (partnerCount.get(k) || 0) + 1);
      }
    }
  }
  const repeats = [...partnerCount.values()].filter((n) => n > 1).length;
  assert.ok(repeats <= 3, `demasiadas parejas repetidas: ${repeats}`);

  schedule[0].matches[0].score = [16, 8];
  const standings = americanoStandings(players, schedule);
  assert.equal(standings[0].points, 16);
});

test("americano con jugadores que no llenan pistas: descansan por turnos", () => {
  const players = ["1", "2", "3", "4", "5", "6"];
  const schedule = americanoSchedule(players, 6, seededRandom(7));
  const rests = new Map();
  for (const round of schedule) {
    assert.equal(round.matches.length, 1);
    assert.equal(round.resting.length, 2);
    for (const p of round.resting) rests.set(p, (rests.get(p) || 0) + 1);
  }
  assert.deepEqual([...rests.values()], [2, 2, 2, 2, 2, 2]);
});

test("liga: todos contra todos y clasificación", () => {
  const teams = ["A", "B", "C", "D", "E"];
  const rounds = roundRobin(teams);
  assert.equal(rounds.length, 5);
  const faced = new Set();
  for (const r of rounds) for (const m of r.matches) faced.add([m.home, m.away].sort().join(""));
  assert.equal(faced.size, 10);
  rounds[0].matches[0].sets = [[6, 1], [6, 1]];
  const table = leagueStandings(teams, rounds);
  assert.equal(table[0].team, rounds[0].matches[0].home);
  assert.equal(table[0].points, 3);
});

test("eliminatoria con byes: las mejores parejas pasan directas y hay campeón", () => {
  assert.deepEqual(seedOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]);
  const b = createBracket(["P1", "P2", "P3", "P4", "P5", "P6"]);
  assert.equal(b.rounds.length, 3);
  assert.equal(b.rounds[1][0].a, "P1");
  assert.equal(b.rounds[1][1].a, "P2");
  setBracketWinner(b, 0, 1, "P4", "6-3 6-3");
  assert.equal(b.rounds[1][0].b, "P4");
  setBracketWinner(b, 0, 3, "P3");
  setBracketWinner(b, 1, 0, "P1");
  setBracketWinner(b, 1, 1, "P2");
  setBracketWinner(b, 2, 0, "P2");
  assert.equal(bracketChampion(b), "P2");
  assert.throws(() => setBracketWinner(b, 2, 0, "P9"));
});

test("leer resultados escritos a mano", () => {
  assert.deepEqual(parseSets("6-4 3-6 7-5").sets, [[6, 4], [3, 6], [7, 5]]);
  assert.match(parseSets("6-4 tres").error, /No entiendo/);
  assert.match(parseSets("6-4 6-5").error, /no es válido/);
});

test("avisos: falta 1 jugador mañana a las 19:00", () => {
  const now = new Date(2026, 9, 16, 10, 0);
  const me = { id: "me", level: 3.5, zone: "Madrid Norte" };
  const game = { id: "g1", date: "2026-10-17", time: "19:00", club: "Club Norte", zone: "Madrid Norte", minLevel: 3, maxLevel: 4, slots: ["a", "b", "c", null] };
  assert.equal(formatWhen(game, now), "mañana a las 19:00");
  const alerts = computeAlerts({ profile: me, games: [game] }, now);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].text, "Falta 1 jugador para el partido de mañana a las 19:00 en Club Norte (nivel 3–4). ¡Apúntate!");

  const mine = { ...game, id: "g2", slots: ["me", "a", null, null] };
  const mineAlerts = computeAlerts({ profile: me, games: [mine] }, now);
  assert.equal(mineAlerts[0].text, "Faltan 2 jugadores para tu partido de mañana a las 19:00 en Club Norte");

  const otherZone = { ...game, zone: "Sevilla" };
  assert.equal(computeAlerts({ profile: me, games: [otherZone] }, now).length, 0);

  const played = { ...game, id: "g3", date: "2026-10-15", slots: ["me", "a", "b", "c"], result: null };
  assert.match(computeAlerts({ profile: me, games: [played] }, now)[0].text, /^¿Cómo quedó el partido de ayer/);
});
