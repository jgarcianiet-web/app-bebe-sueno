import { loadState, saveState, clearState, seedCommunity, uid, isoDate, ZONES, clubsFor } from "./store.js";
import { levelChanges, levelLabel, roundLevel, RELIABLE_AFTER, LEVEL_MIN, LEVEL_MAX } from "./level.js";
import { affinity, likesBack, OBJECTIVES, AVAILABILITY, POSITIONS, labelOf } from "./affinity.js";
import { createScorer, addPoint, pointLabels, situation, percent } from "./scoring.js";
import {
  americanoSchedule, americanoDefaultRounds, americanoStandings, roundRobin, leagueStandings,
  createBracket, setBracketWinner, clearBracketWinner, bracketChampion, roundName, parseSets
} from "./tournaments.js";
import { computeAlerts, formatWhen, gameDate, freeSlots, levelRangeText } from "./alerts.js";

let state = loadState();

const ui = {
  tab: "descubrir",
  gamesView: "abiertos",
  gameFilters: { zone: null, myLevel: true },
  deckFilters: { objective: "all", onlyZone: false },
  tournamentId: null
};

const SHOTS = ["Saque", "Resto", "Volea", "Bandeja", "Víbora", "Remate", "Globo", "Salida de pared", "Defensa"];
const SESSION_TYPES = ["Partido", "Entrenamiento", "Clase", "Físico"];
const TOURNAMENT_TYPES = {
  americano: "Americano",
  liga: "Liga",
  eliminatoria: "Eliminatoria"
};

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

const $ = (sel, root = document) => root.querySelector(sel);

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function persist() {
  saveState(state);
}

function commit(fn) {
  fn();
  persist();
  render();
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function fmtLevel(level) {
  return Number(level).toFixed(2).replace(/\.?0+$/, "").replace(".", ",");
}

function levelOptions(selected) {
  const out = [];
  for (let v = LEVEL_MIN; v <= LEVEL_MAX; v += 0.5) {
    out.push(`<option value="${v}" ${v === selected ? "selected" : ""}>${fmtLevel(v)}</option>`);
  }
  return out.join("");
}

function person(id) {
  if (state.profile && id === state.profile.id) return state.profile;
  return state.players.find((p) => p.id === id) || null;
}

function shortName(id) {
  if (state.profile && id === state.profile.id) return "Tú";
  return person(id)?.name ?? "Jugador";
}

const AVATAR_COLORS = ["#1F7A5A", "#2563EB", "#C2410C", "#7C3AED", "#0E7490", "#B91C1C", "#4D7C0F", "#BE185D"];

function avatar(p, size = "md") {
  if (!p) return `<span class="avatar avatar-${size} avatar-empty">+</span>`;
  const initials = p.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  let h = 0;
  for (const c of p.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `<span class="avatar avatar-${size}" style="background:${AVATAR_COLORS[h % AVATAR_COLORS.length]}">${esc(initials)}</span>`;
}

function chips(ids, list, extraClass = "") {
  return ids.map((id) => `<span class="chip ${extraClass}">${esc(labelOf(list, id))}</span>`).join("");
}

function checkboxChips(name, list, selected = []) {
  return `<div class="chip-picker">${list
    .map((item) => {
      const id = typeof item === "string" ? item : item.id;
      const label = typeof item === "string" ? item : item.label;
      return `<label class="chip-check"><input type="checkbox" name="${name}" value="${esc(id)}" ${selected.includes(id) ? "checked" : ""}><span>${esc(label)}</span></label>`;
    })
    .join("")}</div>`;
}

function toast(text) {
  const el = $("#toast");
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.hidden = true), 2800);
}

function openModal(html) {
  const modal = $("#modal");
  modal.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true">${html}</div>`;
  modal.hidden = false;
  document.body.classList.add("modal-open");
  modal.querySelector("input, select, textarea, button")?.focus({ preventScroll: true });
}

function closeModal() {
  const modal = $("#modal");
  modal.hidden = true;
  modal.innerHTML = "";
  document.body.classList.remove("modal-open");
}

function formError(form, message) {
  let box = form.querySelector(".form-error");
  if (!box) {
    box = document.createElement("p");
    box.className = "form-error";
    form.querySelector(".form-actions")?.before(box);
  }
  box.textContent = message;
}

const ICONS = {
  descubrir: '<path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z"/>',
  partidos: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  torneos: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 21h8"/>',
  marcador: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14M7 10v4M17 10v4"/>',
  perfil: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>'
};

function icon(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" class="icon">${ICONS[name]}</svg>`;
}

/* ------------------------------------------------------------------ */
/* Render principal                                                    */
/* ------------------------------------------------------------------ */

const TABS = [
  ["descubrir", "Descubrir"],
  ["partidos", "Partidos"],
  ["torneos", "Torneos"],
  ["marcador", "Marcador"],
  ["perfil", "Perfil"]
];

function render() {
  const app = $("#app");
  if (!state.profile) {
    app.innerHTML = renderOnboarding();
    return;
  }
  const unread = state.inbox.filter((n) => !n.read).length;
  const views = {
    descubrir: renderDiscover,
    partidos: renderGames,
    torneos: renderTournaments,
    marcador: renderScorer,
    perfil: renderProfile
  };
  app.innerHTML = `
    <header class="topbar">
      <h1 class="brand"><img src="icons/icon.svg" alt="" width="28" height="28"> Pádel Match</h1>
      <button class="icon-btn" data-action="open-inbox" aria-label="Avisos${unread ? `: ${unread} sin leer` : ""}">
        ${icon("bell")}${unread ? `<span class="badge">${unread}</span>` : ""}
      </button>
    </header>
    <main class="view view-${ui.tab}">${views[ui.tab]()}</main>
    <nav class="tabbar">
      ${TABS.map(([id, label]) => `
        <button class="tab ${ui.tab === id ? "active" : ""}" data-action="tab" data-tab="${id}" ${ui.tab === id ? 'aria-current="page"' : ""}>
          ${icon(id)}<span>${label}</span>
        </button>`).join("")}
    </nav>`;
  if (ui.tab === "descubrir") attachSwipe();
}

/* ------------------------------------------------------------------ */
/* Perfil: alta y edición                                             */
/* ------------------------------------------------------------------ */

function profileFields(p = {}) {
  const level = p.level ?? 3;
  return `
    <label class="field">Nombre
      <input name="name" required maxlength="40" value="${esc(p.name)}" placeholder="Cómo te verán los demás">
    </label>
    <label class="field">Tu nivel: <strong data-level-out>${fmtLevel(level)} · ${levelLabel(level)}</strong>
      <input type="range" name="level" min="1" max="7" step="0.25" value="${level}" data-level-range>
      <small>Orientativo: 1–2 empiezas, 3 juegas a menudo, 4 compites en tu club, 5 o más juegas torneos. Se ajustará solo con tus resultados.</small>
    </label>
    <label class="field">Zona
      <select name="zone" required>
        ${ZONES.map((z) => `<option ${z === p.zone ? "selected" : ""}>${esc(z)}</option>`).join("")}
      </select>
    </label>
    <div class="field-row">
      <label class="field">Posición
        <select name="position">${POSITIONS.map((x) => `<option value="${x.id}" ${x.id === p.position ? "selected" : ""}>${x.label}</option>`).join("")}</select>
      </label>
      <label class="field">Mano
        <select name="hand">
          <option value="diestro" ${p.hand !== "zurdo" ? "selected" : ""}>Diestro</option>
          <option value="zurdo" ${p.hand === "zurdo" ? "selected" : ""}>Zurdo</option>
        </select>
      </label>
    </div>
    <fieldset class="field"><legend>¿Qué buscas?</legend>${checkboxChips("objectives", OBJECTIVES, p.objectives ?? ["amistosos"])}</fieldset>
    <fieldset class="field"><legend>¿Cuándo puedes jugar?</legend>${checkboxChips("availability", AVAILABILITY, p.availability ?? ["tardes"])}</fieldset>
    <label class="check"><input type="checkbox" name="federated" ${p.federated ? "checked" : ""}> Tengo licencia federativa</label>
    <label class="field">Sobre ti <small>(opcional)</small>
      <textarea name="bio" rows="2" maxlength="160" placeholder="Ej.: juego de revés, busco pareja para la liga del club">${esc(p.bio)}</textarea>
    </label>`;
}

function readProfileForm(form) {
  const data = new FormData(form);
  return {
    name: String(data.get("name")).trim(),
    level: Number(data.get("level")),
    zone: String(data.get("zone")),
    position: String(data.get("position")),
    hand: String(data.get("hand")),
    objectives: data.getAll("objectives").map(String),
    availability: data.getAll("availability").map(String),
    federated: data.get("federated") === "on",
    bio: String(data.get("bio") || "").trim()
  };
}

function renderOnboarding() {
  return `
    <main class="onboarding">
      <div class="hero">
        <img src="icons/icon.svg" alt="" width="72" height="72">
        <h1>Pádel Match</h1>
        <p>Encuentra compañeros de tu nivel, completa partidos, organiza torneos y lleva el marcador.</p>
      </div>
      <form class="card form" data-form="onboarding">
        <h2>Crea tu perfil de jugador</h2>
        ${profileFields()}
        <div class="form-actions"><button class="btn primary block" type="submit">Empezar a jugar</button></div>
      </form>
    </main>`;
}

/* ------------------------------------------------------------------ */
/* Descubrir: buscador de compañeros tipo Tinder                      */
/* ------------------------------------------------------------------ */

function deck() {
  const me = state.profile;
  const f = ui.deckFilters;
  return state.players
    .filter((p) => !state.swipes[p.id])
    .filter((p) => f.objective === "all" || (f.objective === "federados" ? p.federated : p.objectives.includes(f.objective)))
    .filter((p) => !f.onlyZone || p.zone === me.zone)
    .map((p) => ({ player: p, aff: affinity(me, p) }))
    .sort((a, b) => b.aff.score - a.aff.score);
}

function renderPlayerCard({ player: p, aff }, top) {
  return `
    <article class="swipe-card ${top ? "top" : "behind"}" data-id="${esc(p.id)}" ${top ? "" : 'aria-hidden="true"'}>
      <div class="swipe-stamp like">ME GUSTA</div>
      <div class="swipe-stamp pass">PASO</div>
      <div class="card-head">
        ${avatar(p, "xl")}
        <div class="affinity" style="--pct:${aff.score}">
          <span>${aff.score}%</span><small>afinidad</small>
        </div>
      </div>
      <h2>${esc(p.name)}, ${p.age}</h2>
      <p class="meta">
        <span class="level-pill">Nivel ${fmtLevel(p.level)}</span>
        ${esc(p.zone)} · ${esc(labelOf(POSITIONS, p.position))} · ${p.hand === "zurdo" ? "Zurdo" : "Diestro"}
        ${p.federated ? ' · <span class="fed">Federado</span>' : ""}
      </p>
      <p class="bio">${esc(p.bio)}</p>
      <div class="chips">${chips(p.objectives, OBJECTIVES, "accent")}</div>
      <div class="chips">${chips(p.availability, AVAILABILITY)}</div>
      ${aff.reasons.length ? `<ul class="reasons">${aff.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
    </article>`;
}

function renderDiscover() {
  const cards = deck();
  const f = ui.deckFilters;
  const filters = [["all", "Todos"], ...OBJECTIVES.map((o) => [o.id, o.label]), ["federados", "Federados"]];
  const connections = state.connections.map(person).filter(Boolean);
  return `
    ${connections.length ? `
      <section class="matches-strip">
        <h3>Tus matches <span class="count">${connections.length}</span></h3>
        <div class="strip">${connections.map((p) => `
          <button class="strip-item" data-action="open-player" data-id="${esc(p.id)}">${avatar(p, "lg")}<span>${esc(p.name.split(" ")[0])}</span></button>`).join("")}
        </div>
      </section>` : ""}
    <div class="filter-row" role="group" aria-label="Filtrar por objetivo">
      ${filters.map(([id, label]) => `<button class="pill ${f.objective === id ? "active" : ""}" data-action="deck-objective" data-value="${id}">${label}</button>`).join("")}
    </div>
    <label class="check small"><input type="checkbox" data-change="deck-zone" ${f.onlyZone ? "checked" : ""}> Solo jugadores de ${esc(state.profile.zone)}</label>
    <div class="deck">
      ${cards.length
        ? cards.slice(0, 2).reverse().map((c, i, arr) => renderPlayerCard(c, i === arr.length - 1)).join("")
        : `<div class="empty-deck card">
            <p><strong>No hay más jugadores con estos filtros.</strong></p>
            <p>Prueba a cambiar los filtros o vuelve a ver a quienes descartaste.</p>
            <button class="btn" data-action="reset-passes">Volver a ver descartados</button>
          </div>`}
    </div>
    ${cards.length ? `
      <div class="swipe-actions">
        <button class="round-btn pass" data-action="swipe" data-dir="pass" aria-label="Paso">✕</button>
        <button class="round-btn like" data-action="swipe" data-dir="like" aria-label="Me gusta">♥</button>
      </div>
      <p class="hint">Desliza a la derecha si te gustaría jugar con esta persona, a la izquierda para pasar.</p>` : ""}
    <p class="demo-note">Jugadores de demostración generados en tu zona. Al conectar el servidor aparecerán jugadores reales.</p>`;
}

function attachSwipe() {
  const card = $(".swipe-card.top");
  if (!card) return;
  let startX = 0;
  let dx = 0;
  let dragging = false;
  card.addEventListener("pointerdown", (e) => {
    dragging = true;
    startX = e.clientX;
    dx = 0;
    card.setPointerCapture(e.pointerId);
    card.style.transition = "none";
  });
  card.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    dx = e.clientX - startX;
    card.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
    card.dataset.hint = dx > 40 ? "like" : dx < -40 ? "pass" : "";
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    card.style.transition = "";
    if (Math.abs(dx) > 100) flyOut(dx > 0 ? "like" : "pass");
    else {
      card.style.transform = "";
      card.dataset.hint = "";
    }
  };
  card.addEventListener("pointerup", end);
  card.addEventListener("pointercancel", end);
}

function flyOut(dir) {
  const card = $(".swipe-card.top");
  if (!card || card.dataset.leaving) return;
  card.dataset.leaving = "1";
  card.dataset.hint = dir;
  card.style.transform = `translateX(${dir === "like" ? 640 : -640}px) rotate(${dir === "like" ? 28 : -28}deg)`;
  card.style.opacity = "0";
  setTimeout(() => swipe(card.dataset.id, dir), 200);
}

function swipe(id, dir) {
  const p = person(id);
  let matched = false;
  commit(() => {
    state.swipes[id] = dir;
    if (dir === "like" && likesBack(state.profile.id, id, affinity(state.profile, p).score)) {
      if (!state.connections.includes(id)) state.connections.push(id);
      matched = true;
    }
  });
  if (matched) {
    const aff = affinity(state.profile, p);
    openModal(`
      <div class="match-pop">
        <p class="eyebrow">¡Es un match!</p>
        <div class="pair">${avatar(state.profile, "xl")}${avatar(p, "xl")}</div>
        <h2>Tú y ${esc(p.name)} queréis jugar juntos</h2>
        <p>Afinidad ${aff.score}% · nivel ${fmtLevel(p.level)} · ${esc(p.zone)}</p>
        <div class="form-actions stack">
          <button class="btn primary block" data-action="new-game" data-invite="${esc(p.id)}">Montar un partido con ${esc(p.name.split(" ")[0])}</button>
          <button class="btn block" data-action="close-modal">Seguir descubriendo</button>
        </div>
      </div>`);
  }
}

function openPlayer(id) {
  const p = person(id);
  const aff = affinity(state.profile, p);
  openModal(`
    <div class="player-detail">
      <div class="card-head">${avatar(p, "xl")}<div class="affinity" style="--pct:${aff.score}"><span>${aff.score}%</span><small>afinidad</small></div></div>
      <h2>${esc(p.name)}, ${p.age}</h2>
      <p class="meta"><span class="level-pill">Nivel ${fmtLevel(p.level)}</span> ${esc(p.zone)} · ${esc(labelOf(POSITIONS, p.position))}${p.federated ? " · Federado" : ""}</p>
      <p class="bio">${esc(p.bio)}</p>
      <div class="chips">${chips(p.objectives, OBJECTIVES, "accent")}</div>
      <div class="chips">${chips(p.availability, AVAILABILITY)}</div>
      <div class="form-actions stack">
        <button class="btn primary block" data-action="new-game" data-invite="${esc(p.id)}">Invitar a un partido</button>
        <button class="btn block" data-action="close-modal">Cerrar</button>
      </div>
    </div>`);
}

/* ------------------------------------------------------------------ */
/* Partidos                                                            */
/* ------------------------------------------------------------------ */

function slotView(game, index) {
  const id = game.slots[index];
  const me = state.profile.id;
  const canJoin = id === null && !game.slots.includes(me) && gameDate(game) > new Date();
  if (id === null) {
    return canJoin
      ? `<button class="slot empty" data-action="join" data-id="${game.id}" data-slot="${index}" aria-label="Unirme en este hueco">${avatar(null)}<span>Libre</span></button>`
      : `<div class="slot empty">${avatar(null)}<span>Libre</span></div>`;
  }
  const p = person(id);
  return `<div class="slot ${id === me ? "me" : ""}">${avatar(p)}<span>${esc(shortName(id))}</span><small>${p ? fmtLevel(p.level) : ""}</small></div>`;
}

function renderGameCard(game) {
  const me = state.profile.id;
  const mine = game.slots.includes(me);
  const free = freeSlots(game);
  const past = gameDate(game) < new Date();
  const actions = [];
  if (!past && !mine && free > 0) actions.push(`<button class="btn primary" data-action="join" data-id="${game.id}">Unirme</button>`);
  if (!past && mine && game.createdBy !== me) actions.push(`<button class="btn" data-action="leave" data-id="${game.id}">Salir</button>`);
  if (!past && game.createdBy === me) actions.push(`<button class="btn danger" data-action="cancel-game" data-id="${game.id}">Cancelar partido</button>`);
  if (past && mine && free === 0 && !game.result) actions.push(`<button class="btn primary" data-action="result-form" data-id="${game.id}">Apuntar resultado</button>`);

  let result = "";
  if (game.result) {
    const myChange = game.result.changes.find((c) => c.id === me);
    result = `<div class="result-line">
      <strong>${game.result.sets.map(([a, b]) => `${a}-${b}`).join(" ")}</strong>
      ${myChange ? `<span class="delta ${myChange.delta >= 0 ? "up" : "down"}">${myChange.won ? "Victoria" : "Derrota"} · ${myChange.delta >= 0 ? "+" : ""}${fmtLevel(myChange.delta)}</span>` : ""}
    </div>`;
  }

  return `
    <article class="card game ${mine ? "mine" : ""}">
      <header>
        <div>
          <h3>${esc(capitalize(formatWhen(game)))}</h3>
          <p class="meta">${esc(game.club)} · ${esc(game.zone)}</p>
        </div>
        <div class="tags">
          <span class="level-pill">${esc(capitalize(levelRangeText(game)))}</span>
          ${!past && free > 0 ? `<span class="tag ${free === 1 ? "hot" : ""}">${free === 1 ? "Falta 1" : `Faltan ${free}`}</span>` : ""}
          ${!game.competitive ? '<span class="tag">Amistoso</span>' : ""}
        </div>
      </header>
      <div class="court">
        <div class="team">${slotView(game, 0)}${slotView(game, 1)}</div>
        <span class="vs">VS</span>
        <div class="team">${slotView(game, 2)}${slotView(game, 3)}</div>
      </div>
      ${result}
      ${actions.length ? `<div class="card-actions">${actions.join("")}</div>` : ""}
    </article>`;
}

function renderGames() {
  const me = state.profile;
  const now = new Date();
  const zone = ui.gameFilters.zone ?? me.zone;
  let body;
  if (ui.gamesView === "abiertos") {
    const open = state.games
      .filter((g) => !g.slots.includes(me.id) && freeSlots(g) > 0 && gameDate(g) > now)
      .filter((g) => zone === "all" || g.zone === zone)
      .filter((g) => !ui.gameFilters.myLevel || (me.level >= g.minLevel - 0.25 && me.level <= g.maxLevel + 0.25))
      .sort((a, b) => gameDate(a) - gameDate(b));
    body = `
      <div class="filters card">
        <label class="field compact">Zona
          <select data-change="game-zone">
            <option value="all" ${zone === "all" ? "selected" : ""}>Todas</option>
            ${ZONES.map((z) => `<option ${z === zone ? "selected" : ""}>${esc(z)}</option>`).join("")}
          </select>
        </label>
        <label class="check"><input type="checkbox" data-change="game-level" ${ui.gameFilters.myLevel ? "checked" : ""}> Solo partidos de mi nivel (${fmtLevel(me.level)})</label>
      </div>
      ${open.length ? open.map(renderGameCard).join("") : '<p class="empty">No hay partidos abiertos con estos filtros. ¡Crea uno y que se apunten los demás!</p>'}`;
  } else {
    const mine = state.games.filter((g) => g.slots.includes(me.id));
    const upcoming = mine.filter((g) => gameDate(g) >= now).sort((a, b) => gameDate(a) - gameDate(b));
    const past = mine.filter((g) => gameDate(g) < now).sort((a, b) => gameDate(b) - gameDate(a));
    body = `
      <h3 class="section-title">Próximos</h3>
      ${upcoming.length ? upcoming.map(renderGameCard).join("") : '<p class="empty">No tienes partidos próximos.</p>'}
      <h3 class="section-title">Jugados</h3>
      ${past.length ? past.map(renderGameCard).join("") : '<p class="empty">Aquí aparecerán tus partidos jugados para apuntar el resultado.</p>'}`;
  }
  return `
    <div class="segmented">
      <button class="${ui.gamesView === "abiertos" ? "active" : ""}" data-action="games-view" data-value="abiertos">Abiertos</button>
      <button class="${ui.gamesView === "mios" ? "active" : ""}" data-action="games-view" data-value="mios">Mis partidos</button>
    </div>
    <button class="btn primary block" data-action="new-game">+ Crear partido</button>
    ${body}`;
}

function openNewGame(inviteId) {
  const me = state.profile;
  const center = Math.round(me.level * 2) / 2;
  const connections = state.connections.map(person).filter(Boolean);
  openModal(`
    <form class="form" data-form="create-game">
      <h2>Nuevo partido</h2>
      <div class="field-row">
        <label class="field">Día <input type="date" name="date" required value="${isoDate(1)}" min="${isoDate(0)}"></label>
        <label class="field">Hora <input type="time" name="time" required value="19:00" step="900"></label>
      </div>
      <label class="field">Club
        <input name="club" required maxlength="60" list="clubs" value="${esc(clubsFor(me.zone)[0])}">
        <datalist id="clubs">${clubsFor(me.zone).map((c) => `<option value="${esc(c)}">`).join("")}</datalist>
      </label>
      <label class="field">Zona
        <select name="zone">${ZONES.map((z) => `<option ${z === me.zone ? "selected" : ""}>${esc(z)}</option>`).join("")}</select>
      </label>
      <div class="field-row">
        <label class="field">Nivel mínimo <select name="minLevel">${levelOptions(Math.max(LEVEL_MIN, center - 0.5))}</select></label>
        <label class="field">Nivel máximo <select name="maxLevel">${levelOptions(Math.min(LEVEL_MAX, center + 0.5))}</select></label>
      </div>
      <label class="check"><input type="checkbox" name="competitive" checked> Partido de nivel (el resultado ajusta el nivel)</label>
      ${connections.length ? `
        <fieldset class="field"><legend>Invitar a tus matches <small>(máx. 3)</small></legend>
          ${checkboxChips("invite", connections.map((p) => ({ id: p.id, label: `${p.name} · ${fmtLevel(p.level)}` })), inviteId ? [inviteId] : [])}
        </fieldset>` : ""}
      <div class="form-actions">
        <button class="btn" type="button" data-action="close-modal">Cancelar</button>
        <button class="btn primary" type="submit">Publicar partido</button>
      </div>
    </form>`);
}

function createGame(form) {
  const data = new FormData(form);
  const game = {
    id: uid("game"),
    date: String(data.get("date")),
    time: String(data.get("time")),
    club: String(data.get("club")).trim(),
    zone: String(data.get("zone")),
    minLevel: Number(data.get("minLevel")),
    maxLevel: Number(data.get("maxLevel")),
    competitive: data.get("competitive") === "on",
    slots: [state.profile.id, null, null, null],
    createdBy: state.profile.id,
    result: null
  };
  const invites = data.getAll("invite").map(String);
  if (!game.club) return formError(form, "Indica el club");
  if (gameDate(game) <= new Date()) return formError(form, "El partido tiene que ser en el futuro");
  if (game.minLevel > game.maxLevel) return formError(form, "El nivel mínimo no puede ser mayor que el máximo");
  if (invites.length > 3) return formError(form, "Solo caben 3 jugadores más");
  // Tu compañero va a tu lado; el resto, enfrente.
  invites.forEach((id, i) => (game.slots[[1, 2, 3][i]] = id));
  closeModal();
  ui.tab = "partidos";
  ui.gamesView = "mios";
  commit(() => state.games.push(game));
  runAlerts();
  toast(invites.length ? "Partido publicado e invitaciones enviadas" : "Partido publicado");
}

function joinGame(id, slot) {
  const game = state.games.find((g) => g.id === id);
  const me = state.profile.id;
  if (!game || game.slots.includes(me)) return;
  const index = slot ?? game.slots.indexOf(null);
  if (index < 0 || game.slots[index] !== null) return toast("Ese hueco ya está ocupado");
  commit(() => (game.slots[index] = me));
  toast(freeSlots(game) === 0 ? "¡Partido completo! Os vemos en la pista" : "Te has apuntado al partido");
  runAlerts();
}

function openResultForm(id) {
  const game = state.games.find((g) => g.id === id);
  const team = (a, b) => `${esc(shortName(game.slots[a]))} y ${esc(shortName(game.slots[b]))}`;
  const setRow = (n) => `
    <div class="set-row">
      <span>Set ${n}</span>
      <input type="number" name="a${n}" min="0" max="7" inputmode="numeric" ${n < 3 ? "required" : ""} aria-label="Juegos de la pareja 1 en el set ${n}">
      <span>–</span>
      <input type="number" name="b${n}" min="0" max="7" inputmode="numeric" ${n < 3 ? "required" : ""} aria-label="Juegos de la pareja 2 en el set ${n}">
    </div>`;
  openModal(`
    <form class="form" data-form="result" data-id="${game.id}">
      <h2>Resultado</h2>
      <p class="teams-legend"><strong>Pareja 1:</strong> ${team(0, 1)}<br><strong>Pareja 2:</strong> ${team(2, 3)}</p>
      ${setRow(1)}${setRow(2)}${setRow(3)}
      <small>Deja el tercer set vacío si no se jugó.</small>
      <div class="form-actions">
        <button class="btn" type="button" data-action="close-modal">Cancelar</button>
        <button class="btn primary" type="submit">Guardar y actualizar niveles</button>
      </div>
    </form>`);
}

function saveResult(form) {
  const game = state.games.find((g) => g.id === form.dataset.id);
  const data = new FormData(form);
  const sets = [];
  for (const n of [1, 2, 3]) {
    const a = data.get(`a${n}`);
    const b = data.get(`b${n}`);
    if (a === "" && b === "") continue;
    sets.push([Number(a), Number(b)]);
  }
  const players = game.slots.map((id) => {
    const p = person(id);
    return { id, level: p.level, matches: p.matches || 0 };
  });
  let changes;
  try {
    changes = game.competitive
      ? levelChanges(players, sets)
      : levelChanges(players, sets).map((c) => ({ ...c, after: c.before, delta: 0 }));
  } catch (err) {
    return formError(form, err.message);
  }
  commit(() => {
    game.result = { sets, changes };
    for (const c of changes) {
      const p = person(c.id);
      p.level = c.after;
      p.matches = (p.matches || 0) + 1;
      if (p === state.profile) p.levelHistory.push({ date: game.date, level: c.after });
    }
  });
  const mine = changes.find((c) => c.id === state.profile.id);
  openModal(`
    <div class="result-pop">
      <p class="eyebrow">${mine.won ? "¡Victoria!" : "Derrota"}</p>
      <h2>${sets.map(([a, b]) => `${a}-${b}`).join(" ")}</h2>
      <ul class="level-changes">
        ${changes.map((c) => `<li>${avatar(person(c.id), "sm")} <span>${esc(shortName(c.id))}</span>
          <strong>${fmtLevel(c.before)} → ${fmtLevel(c.after)}</strong>
          <span class="delta ${c.delta >= 0 ? "up" : "down"}">${c.delta >= 0 ? "+" : ""}${fmtLevel(c.delta)}</span></li>`).join("")}
      </ul>
      ${game.competitive ? "" : "<p>Era un amistoso: el resultado no cambia el nivel.</p>"}
      <div class="form-actions"><button class="btn primary block" data-action="close-modal">Hecho</button></div>
    </div>`);
}

/* ------------------------------------------------------------------ */
/* Torneos                                                             */
/* ------------------------------------------------------------------ */

function tournamentSummary(t) {
  if (t.type === "americano") return `${t.players.length} jugadores · ${t.schedule.length} rondas a ${t.pointsPerMatch} puntos`;
  if (t.type === "liga") return `${t.teams.length} parejas · ${t.rounds.length} jornadas`;
  return `${t.teams.length} parejas · ${t.bracket.rounds.length} rondas`;
}

function tournamentProgress(t) {
  let played = 0, total = 0;
  if (t.type === "americano") t.schedule.forEach((r) => r.matches.forEach((m) => { total++; if (m.score) played++; }));
  else if (t.type === "liga") t.rounds.forEach((r) => r.matches.forEach((m) => { total++; if (m.sets) played++; }));
  else t.bracket.rounds.forEach((r) => r.forEach((m) => { if (m.a && m.b) total++; if (m.a && m.b && m.winner) played++; }));
  return { played, total };
}

function renderTournaments() {
  if (ui.tournamentId) {
    const t = state.tournaments.find((x) => x.id === ui.tournamentId);
    if (t) return renderTournamentDetail(t);
    ui.tournamentId = null;
  }
  const list = [...state.tournaments].sort((a, b) => b.date.localeCompare(a.date));
  return `
    <div class="intro card">
      <h2>Organiza tu competición</h2>
      <p>Americanos con parejas que rotan, ligas todos contra todos o eliminatorias con cuadro. La app genera los cruces y calcula la clasificación.</p>
      <button class="btn primary block" data-action="new-tournament">+ Crear torneo</button>
    </div>
    ${list.map((t) => {
      const { played, total } = tournamentProgress(t);
      return `
        <button class="card tournament-item" data-action="open-tournament" data-id="${t.id}">
          <span class="tag">${TOURNAMENT_TYPES[t.type]}</span>
          <h3>${esc(t.name)}</h3>
          <p class="meta">${esc(t.date)} · ${esc(t.club || "Sin club")}</p>
          <p class="meta">${tournamentSummary(t)}</p>
          <div class="progress"><span style="width:${percent(played, total)}%"></span></div>
          <small>${played}/${total} partidos jugados</small>
        </button>`;
    }).join("") || '<p class="empty">Todavía no has creado ningún torneo.</p>'}`;
}

function openNewTournament() {
  const myName = state.profile.name;
  const connectionNames = state.connections.map((id) => person(id)?.name).filter(Boolean);
  const suggested = [myName, ...connectionNames].slice(0, 8).join("\n");
  openModal(`
    <form class="form" data-form="create-tournament">
      <h2>Nuevo torneo</h2>
      <label class="field">Nombre <input name="name" required maxlength="60" placeholder="Americano de los viernes"></label>
      <label class="field">Formato
        <select name="type" data-change="tournament-type">
          <option value="americano">Americano (individual, parejas rotativas)</option>
          <option value="liga">Liga (parejas, todos contra todos)</option>
          <option value="eliminatoria">Eliminatoria (parejas, cuadro)</option>
        </select>
      </label>
      <div class="field-row">
        <label class="field">Fecha <input type="date" name="date" required value="${isoDate(0)}"></label>
        <label class="field">Club <input name="club" maxlength="60" value="${esc(clubsFor(state.profile.zone)[0])}"></label>
      </div>
      <label class="field" data-only="americano">Puntos por partido
        <select name="points"><option>16</option><option>21</option><option selected>24</option><option>32</option></select>
      </label>
      <label class="field">
        <span data-only="americano">Jugadores (uno por línea, mínimo 4)</span>
        <span data-only="parejas" hidden>Parejas (una por línea, por orden de cabeza de serie): Ana / Bea</span>
        <textarea name="participants" rows="8" required data-participants>${esc(suggested)}</textarea>
      </label>
      <div class="form-actions">
        <button class="btn" type="button" data-action="close-modal">Cancelar</button>
        <button class="btn primary" type="submit">Crear y generar cruces</button>
      </div>
    </form>`);
}

function createTournament(form) {
  const data = new FormData(form);
  const type = String(data.get("type"));
  const names = String(data.get("participants")).split("\n").map((l) => l.trim().replace(/\s+/g, " ")).filter(Boolean);
  const dupes = names.filter((n, i) => names.findIndex((m) => m.toLowerCase() === n.toLowerCase()) !== i);
  if (dupes.length) return formError(form, `Nombre repetido: ${dupes[0]}`);
  const base = {
    id: uid("tour"),
    type,
    name: String(data.get("name")).trim(),
    date: String(data.get("date")),
    club: String(data.get("club")).trim()
  };
  let t;
  try {
    if (type === "americano") {
      if (names.length < 4) throw new Error("Un americano necesita al menos 4 jugadores");
      t = { ...base, players: names, pointsPerMatch: Number(data.get("points")), schedule: americanoSchedule(names, americanoDefaultRounds(names.length)) };
    } else if (type === "liga") {
      t = { ...base, teams: names, rounds: roundRobin(names) };
    } else {
      t = { ...base, teams: names, bracket: createBracket(names) };
    }
  } catch (err) {
    return formError(form, err.message);
  }
  closeModal();
  ui.tournamentId = t.id;
  commit(() => state.tournaments.push(t));
  toast("Torneo creado con todos los cruces");
}

function renderTournamentDetail(t) {
  const head = `
    <button class="link-btn" data-action="close-tournament">← Torneos</button>
    <div class="card">
      <span class="tag">${TOURNAMENT_TYPES[t.type]}</span>
      <h2>${esc(t.name)}</h2>
      <p class="meta">${esc(t.date)} · ${esc(t.club || "Sin club")} · ${tournamentSummary(t)}</p>
    </div>`;
  const footer = `<button class="btn danger block" data-action="delete-tournament" data-id="${t.id}">Eliminar torneo</button>`;

  if (t.type === "americano") {
    const standings = americanoStandings(t.players, t.schedule);
    return `${head}
      <section class="card">
        <h3>Clasificación</h3>
        <table class="table"><thead><tr><th>#</th><th>Jugador</th><th>PJ</th><th>PG</th><th>Puntos</th></tr></thead>
          <tbody>${standings.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.player)}</td><td>${r.played}</td><td>${r.won}</td><td><strong>${r.points}</strong></td></tr>`).join("")}</tbody>
        </table>
      </section>
      ${t.schedule.map((round, ri) => `
        <section class="card">
          <h3>Ronda ${ri + 1}</h3>
          ${round.matches.map((m, mi) => `
            <form class="score-entry" data-form="americano-score" data-round="${ri}" data-match="${mi}">
              <span class="pair-names">${esc(m.teamA.join(" y "))}</span>
              <input type="number" name="a" min="0" max="${t.pointsPerMatch}" value="${m.score ? m.score[0] : ""}" inputmode="numeric" aria-label="Puntos de ${esc(m.teamA.join(" y "))}" required>
              <span>–</span>
              <input type="number" name="b" min="0" max="${t.pointsPerMatch}" value="${m.score ? m.score[1] : ""}" inputmode="numeric" aria-label="Puntos de ${esc(m.teamB.join(" y "))}" required>
              <span class="pair-names">${esc(m.teamB.join(" y "))}</span>
              <button class="btn small ${m.score ? "" : "primary"}" type="submit">${m.score ? "✓" : "Guardar"}</button>
            </form>`).join("")}
          ${round.resting.length ? `<p class="meta">Descansan: ${esc(round.resting.join(", "))}</p>` : ""}
        </section>`).join("")}
      ${footer}`;
  }

  if (t.type === "liga") {
    const table = leagueStandings(t.teams, t.rounds);
    return `${head}
      <section class="card">
        <h3>Clasificación</h3>
        <table class="table"><thead><tr><th>#</th><th>Pareja</th><th>PJ</th><th>PG</th><th>Sets</th><th>Pts</th></tr></thead>
          <tbody>${table.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.team)}</td><td>${r.played}</td><td>${r.won}</td><td>${r.setsFor}-${r.setsAgainst}</td><td><strong>${r.points}</strong></td></tr>`).join("")}</tbody>
        </table>
      </section>
      ${t.rounds.map((round, ri) => `
        <section class="card">
          <h3>Jornada ${ri + 1}</h3>
          ${round.matches.map((m, mi) => `
            <form class="score-entry league" data-form="league-score" data-round="${ri}" data-match="${mi}">
              <span class="pair-names">${esc(m.home)} <em>vs</em> ${esc(m.away)}</span>
              <input name="sets" placeholder="6-4 6-3" value="${m.sets ? m.sets.map(([a, b]) => `${a}-${b}`).join(" ") : ""}" aria-label="Resultado de ${esc(m.home)} contra ${esc(m.away)}" required>
              <button class="btn small ${m.sets ? "" : "primary"}" type="submit">${m.sets ? "✓" : "Guardar"}</button>
            </form>`).join("")}
          ${round.resting ? `<p class="meta">Descansa: ${esc(round.resting)}</p>` : ""}
        </section>`).join("")}
      ${footer}`;
  }

  const champion = bracketChampion(t.bracket);
  const total = t.bracket.rounds.length;
  return `${head}
    ${champion ? `<div class="champion card"><p class="eyebrow">Campeones</p><h2>🏆 ${esc(champion)}</h2></div>` : '<p class="hint">Toca la pareja ganadora de cada partido para que pase de ronda.</p>'}
    <div class="bracket">
      ${t.bracket.rounds.map((round, ri) => `
        <div class="bracket-round">
          <h4>${roundName(ri, total)}</h4>
          ${round.map((m, mi) => {
            const pickable = m.a && m.b && !m.winner;
            const side = (team) => team
              ? `<button class="bracket-team ${m.winner === team ? "won" : ""} ${m.winner && m.winner !== team ? "lost" : ""}" ${pickable ? `data-action="bracket-win" data-round="${ri}" data-match="${mi}" data-team="${esc(team)}"` : "disabled"}>${esc(team)}</button>`
              : `<span class="bracket-team tbd">${ri === 0 ? "—" : "Por decidir"}</span>`;
            return `<div class="bracket-match">${side(m.a)}${side(m.b)}
              ${m.winner && m.a && m.b ? `<button class="link-btn small" data-action="bracket-undo" data-round="${ri}" data-match="${mi}">Deshacer</button>` : ""}
              ${m.result === "Pasa directo" ? '<small class="meta">Pasa directo</small>' : ""}
            </div>`;
          }).join("")}
        </div>`).join("")}
    </div>
    ${footer}`;
}

function currentTournament() {
  return state.tournaments.find((t) => t.id === ui.tournamentId);
}

/* ------------------------------------------------------------------ */
/* Marcador                                                            */
/* ------------------------------------------------------------------ */

function renderScorer() {
  const sc = state.scorer;
  if (!sc) {
    return `
      <form class="card form" data-form="scorer-setup">
        <h2>Marcador</h2>
        <p class="meta">Lleva la cuenta punto a punto desde la pista: sets, juegos, tie-break, quién saca y estadísticas del partido.</p>
        <div class="field-row">
          <label class="field">Pareja 1 <input name="a" maxlength="30" value="Nosotros"></label>
          <label class="field">Pareja 2 <input name="b" maxlength="30" value="Rivales"></label>
        </div>
        <div class="field-row">
          <label class="field">Formato <select name="bestOf"><option value="3">Al mejor de 3 sets</option><option value="1">A 1 set</option></select></label>
          <label class="field">Saca primero <select name="server"><option value="A">Pareja 1</option><option value="B">Pareja 2</option></select></label>
        </div>
        <label class="check"><input type="checkbox" name="golden" checked> Punto de oro (sin ventajas)</label>
        <div class="form-actions"><button class="btn primary block" type="submit">Empezar partido</button></div>
      </form>
      ${state.scoreHistory.length ? `
        <section class="card">
          <h3>Partidos anotados</h3>
          <ul class="history">${state.scoreHistory.slice().reverse().map((h) => `
            <li><span>${esc(h.date)}</span><strong>${esc(h.names.A)} ${h.sets.map(([a, b]) => `${a}-${b}`).join(" ")} ${esc(h.names.B)}</strong>
            <small>${esc(h.winner === "A" ? h.names.A : h.names.B)} gana · ${h.points} puntos jugados</small></li>`).join("")}
          </ul>
        </section>` : ""}`;
  }

  const s = sc.history[sc.history.length - 1];
  const labels = pointLabels(s);
  const sit = situation(s);
  const names = sc.names;
  const st = s.stats;
  const row = (team) => `
    <div class="score-row ${s.server === team && !s.finished ? "serving" : ""} ${s.winner === team ? "winner" : ""}">
      <span class="team-name">${s.server === team && !s.finished ? '<i class="ball" aria-label="Saca"></i>' : ""}${esc(names[team])}</span>
      ${s.sets.map((set) => `<span class="set">${team === "A" ? set[0] : set[1]}</span>`).join("")}
      ${s.finished ? "" : `<span class="set current">${s.games[team]}</span><span class="points">${labels[team]}</span>`}
    </div>`;
  const statRow = (label, a, b) => `<tr><td>${a}</td><th>${label}</th><td>${b}</td></tr>`;
  const totalPoints = st.pointsWon.A + st.pointsWon.B;
  return `
    <section class="scoreboard">
      ${row("A")}${row("B")}
      ${sit ? `<p class="situation">${sit}</p>` : ""}
      ${s.finished ? `<p class="situation done">🏆 Gana ${esc(names[s.winner])}</p>` : ""}
    </section>
    ${s.finished ? `
      <div class="form-actions stack">
        <button class="btn primary block" data-action="scorer-save">Guardar partido</button>
        <button class="btn block" data-action="scorer-undo">Deshacer último punto</button>
      </div>` : `
      <div class="point-buttons">
        <button class="point-btn a" data-action="point" data-team="A">Punto<br><strong>${esc(names.A)}</strong></button>
        <button class="point-btn b" data-action="point" data-team="B">Punto<br><strong>${esc(names.B)}</strong></button>
      </div>
      <div class="card-actions center">
        <button class="btn" data-action="scorer-undo" ${sc.history.length < 2 ? "disabled" : ""}>↶ Deshacer</button>
        <button class="btn danger" data-action="scorer-abandon">Terminar sin guardar</button>
      </div>`}
    <section class="card">
      <h3>Estadísticas</h3>
      <table class="stats-table">
        <thead><tr><td>${esc(names.A)}</td><th></th><td>${esc(names.B)}</td></tr></thead>
        <tbody>
          ${statRow("Puntos ganados", `${st.pointsWon.A} (${percent(st.pointsWon.A, totalPoints)}%)`, `${st.pointsWon.B} (${percent(st.pointsWon.B, totalPoints)}%)`)}
          ${statRow("Puntos ganados con su saque", `${percent(st.serveWon.A, st.servePlayed.A)}%`, `${percent(st.serveWon.B, st.servePlayed.B)}%`)}
          ${statRow("Roturas", st.breaks.A, st.breaks.B)}
          ${s.config.goldenPoint ? statRow("Puntos de oro ganados", st.goldenPoints.A, st.goldenPoints.B) : ""}
          ${statRow("Mejor racha", st.bestStreak.A, st.bestStreak.B)}
        </tbody>
      </table>
    </section>`;
}

/* ------------------------------------------------------------------ */
/* Perfil, nivel y diario                                             */
/* ------------------------------------------------------------------ */

function levelChart(history) {
  const points = history.slice(-20);
  if (points.length < 2) return '<p class="meta">Juega partidos de nivel para ver tu evolución.</p>';
  const values = points.map((p) => p.level);
  const min = Math.min(...values) - 0.1;
  const max = Math.max(...values) + 0.1;
  const w = 300, h = 80;
  const xy = values.map((v, i) => [(i / (values.length - 1)) * w, h - ((v - min) / (max - min)) * h]);
  const path = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lx, ly] = xy[xy.length - 1];
  return `<svg class="level-chart" viewBox="-6 -6 ${w + 12} ${h + 12}" role="img" aria-label="Evolución de tu nivel, de ${fmtLevel(values[0])} a ${fmtLevel(values[values.length - 1])}">
    <path d="${path} L${w},${h + 6} L0,${h + 6} Z" class="area"/>
    <path d="${path}" class="line"/>
    <circle cx="${lx}" cy="${ly}" r="5" class="dot"/>
  </svg>`;
}

function renderProfile() {
  const me = state.profile;
  const played = state.games.filter((g) => g.result && g.slots.includes(me.id));
  const wins = played.filter((g) => g.result.changes.find((c) => c.id === me.id)?.won).length;
  const reliable = (me.matches || 0) >= RELIABLE_AFTER;
  const monthPrefix = isoDate(0).slice(0, 7);
  const month = state.diary.filter((d) => d.date.startsWith(monthPrefix));
  const minutes = month.reduce((sum, d) => sum + d.minutes, 0);
  const shotCount = {};
  state.diary.forEach((d) => d.shots.forEach((s) => (shotCount[s] = (shotCount[s] || 0) + 1)));
  const topShots = Object.entries(shotCount).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return `
    <section class="card profile-card">
      <div class="profile-head">
        ${avatar(me, "xl")}
        <div>
          <h2>${esc(me.name)}</h2>
          <p class="meta">${esc(me.zone)} · ${esc(labelOf(POSITIONS, me.position))} · ${me.hand === "zurdo" ? "Zurdo" : "Diestro"}${me.federated ? " · Federado" : ""}</p>
        </div>
      </div>
      <div class="level-big">
        <span class="value">${fmtLevel(me.level)}</span>
        <span><strong>${levelLabel(me.level)}</strong><br><small>${reliable ? "Nivel fiable" : `Nivel provisional · ${me.matches || 0}/${RELIABLE_AFTER} partidos`}</small></span>
      </div>
      ${levelChart(me.levelHistory)}
      <div class="stats-grid">
        <div><strong>${played.length}</strong><span>Partidos</span></div>
        <div><strong>${wins}</strong><span>Victorias</span></div>
        <div><strong>${percent(wins, played.length)}%</strong><span>% victorias</span></div>
        <div><strong>${state.connections.length}</strong><span>Matches</span></div>
      </div>
      <div class="chips">${chips(me.objectives, OBJECTIVES, "accent")}</div>
      <button class="btn block" data-action="edit-profile">Editar perfil</button>
    </section>

    <section class="card">
      <div class="section-head">
        <h3>Diario de entrenamiento</h3>
        <button class="btn small primary" data-action="new-diary">+ Añadir</button>
      </div>
      <div class="stats-grid three">
        <div><strong>${month.length}</strong><span>Sesiones este mes</span></div>
        <div><strong>${Math.round(minutes / 60 * 10) / 10}</strong><span>Horas este mes</span></div>
        <div><strong>${esc(topShots[0]?.[0] ?? "—")}</strong><span>Golpe más trabajado</span></div>
      </div>
      ${state.diary.length ? `<ul class="diary">${[...state.diary].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15).map((d) => `
        <li>
          <div><strong>${esc(d.type)}</strong> · ${d.minutes} min <span class="feel" aria-label="Sensación ${d.feel} de 5">${"●".repeat(d.feel)}${"○".repeat(5 - d.feel)}</span></div>
          <small>${esc(d.date)}${d.shots.length ? ` · ${esc(d.shots.join(", "))}` : ""}</small>
          ${d.notes ? `<p>${esc(d.notes)}</p>` : ""}
          <button class="link-btn small" data-action="delete-diary" data-id="${d.id}">Borrar</button>
        </li>`).join("")}</ul>` : '<p class="empty">Apunta tus entrenamientos y clases para ver qué golpes trabajas y cómo te sientes.</p>'}
    </section>

    <section class="card">
      <h3>Ajustes</h3>
      <button class="btn block" data-action="enable-notifications">Activar avisos en el móvil</button>
      <button class="btn danger block" data-action="reset-all">Borrar todos mis datos</button>
    </section>`;
}

function openDiaryForm() {
  openModal(`
    <form class="form" data-form="diary">
      <h2>Nueva sesión</h2>
      <div class="field-row">
        <label class="field">Día <input type="date" name="date" required value="${isoDate(0)}"></label>
        <label class="field">Minutos <input type="number" name="minutes" required min="5" max="600" value="90" inputmode="numeric"></label>
      </div>
      <label class="field">Tipo <select name="type">${SESSION_TYPES.map((t) => `<option>${t}</option>`).join("")}</select></label>
      <label class="field">Sensación (1–5) <input type="range" name="feel" min="1" max="5" value="4"></label>
      <fieldset class="field"><legend>Golpes trabajados</legend>${checkboxChips("shots", SHOTS)}</fieldset>
      <label class="field">Notas <textarea name="notes" rows="2" maxlength="300" placeholder="Qué ha salido bien, qué mejorar…"></textarea></label>
      <div class="form-actions">
        <button class="btn" type="button" data-action="close-modal">Cancelar</button>
        <button class="btn primary" type="submit">Guardar</button>
      </div>
    </form>`);
}

/* ------------------------------------------------------------------ */
/* Avisos                                                              */
/* ------------------------------------------------------------------ */

async function systemNotify(text) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification("Pádel Match", { body: text, icon: "icons/icon.svg" });
    else new Notification("Pádel Match", { body: text, icon: "icons/icon.svg" });
  } catch {
    // Algunos navegadores no permiten avisos fuera del service worker; el aviso queda en la app.
  }
}

function runAlerts() {
  if (!state.profile) return;
  const fresh = computeAlerts(state).filter((a) => !state.notifiedKeys.includes(a.key));
  if (!fresh.length) return;
  for (const a of fresh) {
    state.notifiedKeys.push(a.key);
    state.inbox.unshift({ id: uid("note"), text: a.text, gameId: a.gameId, at: new Date().toISOString(), read: false });
    systemNotify(a.text);
  }
  state.inbox = state.inbox.slice(0, 50);
  persist();
  render();
}

function openInbox() {
  const items = state.inbox;
  openModal(`
    <h2>Avisos</h2>
    ${items.length ? `<ul class="inbox">${items.map((n) => `
      <li class="${n.read ? "" : "unread"}">
        <button data-action="inbox-go" data-game="${esc(n.gameId)}">${esc(n.text)}<small>${new Date(n.at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}</small></button>
      </li>`).join("")}</ul>` : '<p class="empty">No tienes avisos.</p>'}
    ${"Notification" in window && Notification.permission !== "granted" ? '<button class="btn block" data-action="enable-notifications">Recibir estos avisos en el móvil</button>' : ""}
    <div class="form-actions"><button class="btn primary block" data-action="close-modal">Cerrar</button></div>`);
  state.inbox.forEach((n) => (n.read = true));
  persist();
}

/* ------------------------------------------------------------------ */
/* Acciones                                                            */
/* ------------------------------------------------------------------ */

const actions = {
  tab: (el) => {
    ui.tab = el.dataset.tab;
    render();
    window.scrollTo(0, 0);
  },
  "close-modal": () => {
    closeModal();
    render();
  },
  "open-inbox": openInbox,
  "inbox-go": (el) => {
    const game = state.games.find((g) => g.id === el.dataset.game);
    closeModal();
    ui.tab = "partidos";
    ui.gamesView = game && game.slots.includes(state.profile.id) ? "mios" : "abiertos";
    if (game && ui.gamesView === "abiertos") ui.gameFilters.zone = game.zone;
    render();
  },
  "deck-objective": (el) => {
    ui.deckFilters.objective = el.dataset.value;
    render();
  },
  swipe: (el) => flyOut(el.dataset.dir),
  "reset-passes": () =>
    commit(() => {
      for (const [id, dir] of Object.entries(state.swipes)) if (dir === "pass") delete state.swipes[id];
    }),
  "open-player": (el) => openPlayer(el.dataset.id),
  "new-game": (el) => openNewGame(el.dataset.invite),
  "games-view": (el) => {
    ui.gamesView = el.dataset.value;
    render();
  },
  join: (el) => joinGame(el.dataset.id, el.dataset.slot !== undefined ? Number(el.dataset.slot) : undefined),
  leave: (el) => {
    const game = state.games.find((g) => g.id === el.dataset.id);
    commit(() => (game.slots[game.slots.indexOf(state.profile.id)] = null));
    toast("Has salido del partido");
  },
  "cancel-game": (el) => {
    if (!confirm("¿Cancelar el partido? Se avisará al resto de jugadores.")) return;
    commit(() => (state.games = state.games.filter((g) => g.id !== el.dataset.id)));
    toast("Partido cancelado");
  },
  "result-form": (el) => openResultForm(el.dataset.id),
  "new-tournament": openNewTournament,
  "open-tournament": (el) => {
    ui.tournamentId = el.dataset.id;
    render();
    window.scrollTo(0, 0);
  },
  "close-tournament": () => {
    ui.tournamentId = null;
    render();
  },
  "delete-tournament": (el) => {
    if (!confirm("¿Eliminar este torneo y todos sus resultados?")) return;
    ui.tournamentId = null;
    commit(() => (state.tournaments = state.tournaments.filter((t) => t.id !== el.dataset.id)));
  },
  "bracket-win": (el) => {
    const t = currentTournament();
    commit(() => setBracketWinner(t.bracket, Number(el.dataset.round), Number(el.dataset.match), el.dataset.team));
  },
  "bracket-undo": (el) => {
    const t = currentTournament();
    try {
      commit(() => clearBracketWinner(t.bracket, Number(el.dataset.round), Number(el.dataset.match)));
    } catch (err) {
      toast(err.message);
    }
  },
  point: (el) => {
    const sc = state.scorer;
    commit(() => {
      sc.history.push(addPoint(sc.history[sc.history.length - 1], el.dataset.team));
      if (sc.history.length > 400) sc.history.splice(1, sc.history.length - 400);
    });
    navigator.vibrate?.(15);
  },
  "scorer-undo": () => {
    if (state.scorer.history.length > 1) commit(() => state.scorer.history.pop());
  },
  "scorer-abandon": () => {
    if (!confirm("¿Terminar el partido sin guardarlo?")) return;
    commit(() => (state.scorer = null));
  },
  "scorer-save": () => {
    const sc = state.scorer;
    const s = sc.history[sc.history.length - 1];
    commit(() => {
      state.scoreHistory.push({
        date: isoDate(0),
        names: sc.names,
        sets: s.sets,
        winner: s.winner,
        points: s.stats.pointsWon.A + s.stats.pointsWon.B
      });
      state.scoreHistory = state.scoreHistory.slice(-30);
      state.scorer = null;
    });
    toast("Partido guardado");
  },
  "edit-profile": () =>
    openModal(`
      <form class="form" data-form="edit-profile">
        <h2>Editar perfil</h2>
        ${profileFields(state.profile)}
        <div class="form-actions">
          <button class="btn" type="button" data-action="close-modal">Cancelar</button>
          <button class="btn primary" type="submit">Guardar</button>
        </div>
      </form>`),
  "new-diary": openDiaryForm,
  "delete-diary": (el) => commit(() => (state.diary = state.diary.filter((d) => d.id !== el.dataset.id))),
  "enable-notifications": async () => {
    if (!("Notification" in window)) return toast("Este navegador no admite avisos");
    const result = await Notification.requestPermission();
    toast(result === "granted" ? "Avisos activados" : "No se han activado los avisos");
    if (result === "granted") closeModal();
  },
  "reset-all": () => {
    if (!confirm("Se borrarán tu perfil, partidos, torneos y diario de este dispositivo. ¿Seguro?")) return;
    clearState();
    location.reload();
  }
};

const forms = {
  onboarding: (form) => {
    const data = readProfileForm(form);
    if (!data.name) return formError(form, "Escribe tu nombre");
    if (!data.objectives.length) return formError(form, "Elige al menos un objetivo");
    const profile = {
      id: "me",
      ...data,
      level: roundLevel(data.level),
      matches: 0,
      levelHistory: [{ date: isoDate(0), level: roundLevel(data.level) }]
    };
    const community = seedCommunity(profile);
    commit(() => {
      state.profile = profile;
      state.players = community.players;
      state.games = community.games;
    });
    window.scrollTo(0, 0);
    runAlerts();
  },
  "edit-profile": (form) => {
    const data = readProfileForm(form);
    if (!data.name) return formError(form, "Escribe tu nombre");
    if (!data.objectives.length) return formError(form, "Elige al menos un objetivo");
    const p = state.profile;
    // Tras el primer partido el nivel lo marcan los resultados, no la autoevaluación.
    const level = p.matches ? p.level : roundLevel(data.level);
    closeModal();
    commit(() => {
      Object.assign(p, data, { level });
      if (!p.matches) p.levelHistory = [{ date: isoDate(0), level }];
    });
    toast(p.matches && data.level !== level ? "Perfil guardado. Tu nivel ya lo ajustan tus resultados" : "Perfil guardado");
  },
  "create-game": createGame,
  result: saveResult,
  "create-tournament": createTournament,
  "americano-score": (form) => {
    const t = currentTournament();
    const a = Number(form.elements.a.value);
    const b = Number(form.elements.b.value);
    if (a + b !== t.pointsPerMatch) return toast(`Los puntos tienen que sumar ${t.pointsPerMatch}`);
    commit(() => (t.schedule[form.dataset.round].matches[form.dataset.match].score = [a, b]));
  },
  "league-score": (form) => {
    const t = currentTournament();
    const parsed = parseSets(form.elements.sets.value);
    if (parsed.error) return toast(parsed.error);
    commit(() => (t.rounds[form.dataset.round].matches[form.dataset.match].sets = parsed.sets));
  },
  "scorer-setup": (form) => {
    const data = new FormData(form);
    const names = { A: String(data.get("a")).trim() || "Pareja 1", B: String(data.get("b")).trim() || "Pareja 2" };
    const initial = createScorer({ goldenPoint: data.get("golden") === "on", bestOf: Number(data.get("bestOf")), firstServer: String(data.get("server")) });
    commit(() => (state.scorer = { names, history: [initial] }));
  },
  diary: (form) => {
    const data = new FormData(form);
    const entry = {
      id: uid("diary"),
      date: String(data.get("date")),
      minutes: Number(data.get("minutes")),
      type: String(data.get("type")),
      feel: Number(data.get("feel")),
      shots: data.getAll("shots").map(String),
      notes: String(data.get("notes") || "").trim()
    };
    if (!(entry.minutes > 0)) return formError(form, "Indica cuántos minutos");
    closeModal();
    commit(() => state.diary.push(entry));
    toast("Sesión guardada");
  }
};

const changes = {
  "deck-zone": (el) => {
    ui.deckFilters.onlyZone = el.checked;
    render();
  },
  "game-zone": (el) => {
    ui.gameFilters.zone = el.value;
    render();
  },
  "game-level": (el) => {
    ui.gameFilters.myLevel = el.checked;
    render();
  },
  "tournament-type": (el) => {
    const form = el.form;
    const americano = el.value === "americano";
    form.querySelectorAll('[data-only="americano"]').forEach((x) => (x.hidden = !americano));
    form.querySelectorAll('[data-only="parejas"]').forEach((x) => (x.hidden = americano));
    const area = form.querySelector("[data-participants]");
    if (!americano && !area.value.includes("/")) {
      area.value = "Ana / Bea\nCarlos / Dani\nEva / Fran\nGema / Hugo";
    }
  }
};

document.addEventListener("click", (e) => {
  if (e.target.id === "modal") {
    closeModal();
    render();
    return;
  }
  const el = e.target.closest("[data-action]");
  if (!el || el.disabled) return;
  const handler = actions[el.dataset.action];
  if (handler) {
    e.preventDefault();
    handler(el);
  }
});

document.addEventListener("submit", (e) => {
  const form = e.target.closest("[data-form]");
  if (!form) return;
  e.preventDefault();
  forms[form.dataset.form]?.(form);
});

document.addEventListener("change", (e) => {
  const handler = changes[e.target.dataset.change];
  if (handler) handler(e.target);
});

document.addEventListener("input", (e) => {
  if (e.target.matches("[data-level-range]")) {
    const v = Number(e.target.value);
    e.target.form.querySelector("[data-level-out]").textContent = `${fmtLevel(v)} · ${levelLabel(v)}`;
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("#modal").hidden) {
    closeModal();
    render();
    return;
  }
  if (ui.tab === "descubrir" && $("#modal").hidden && !e.target.closest("input, select, textarea")) {
    if (e.key === "ArrowRight") flyOut("like");
    if (e.key === "ArrowLeft") flyOut("pass");
  }
});

render();
runAlerts();
setInterval(runAlerts, 60 * 1000);

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
