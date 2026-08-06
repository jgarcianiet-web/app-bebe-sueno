/* Sueño Bebé — lógica principal de la aplicación */

const STORAGE_KEY = "bebe-sueno-v1";

const state = loadState();
let timerInterval = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        baby: parsed.baby || { name: "", birthdate: "" },
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        feedings: Array.isArray(parsed.feedings) ? parsed.feedings : [],
        activeSession: parsed.activeSession || null,
        reminder: parsed.reminder || { enabled: false, time: "20:00" },
        lastReminderDay: parsed.lastReminderDay || ""
      };
    }
  } catch (e) {
    console.warn("No se pudo leer el almacenamiento local", e);
  }
  return {
    baby: { name: "", birthdate: "" },
    sessions: [],
    feedings: [],
    activeSession: null,
    reminder: { enabled: false, time: "20:00" },
    lastReminderDay: ""
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ---------- Utilidades ---------- */

function $(id) {
  return document.getElementById(id);
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function formatDuration(ms) {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}m`;
}

function formatClock(ms) {
  const s = Math.floor(ms / 1000);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function dayKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatTime(date) {
  const d = new Date(date);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDayLabel(key) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = dayKey(new Date());
  const yesterday = dayKey(new Date(Date.now() - 86400000));
  if (key === today) return "Hoy";
  if (key === yesterday) return "Ayer";
  return date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

function getAgeMonths() {
  if (!state.baby.birthdate) return null;
  const birth = new Date(state.baby.birthdate + "T00:00:00");
  if (isNaN(birth.getTime()) || birth > new Date()) return null;
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months--;
  return Math.max(0, months);
}

function formatAge(months) {
  if (months === null) return "";
  if (months < 1) return "menos de 1 mes";
  if (months < 24) return `${months} ${months === 1 ? "mes" : "meses"}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  let out = `${years} ${years === 1 ? "año" : "años"}`;
  if (rest > 0) out += ` y ${rest} ${rest === 1 ? "mes" : "meses"}`;
  return out;
}

/* ---------- Sesiones y métricas ---------- */

function sessionDuration(s) {
  return new Date(s.end).getTime() - new Date(s.start).getTime();
}

/** Sesiones agrupadas por el día en que empezaron (una noche cuenta para el día en que se acostó). */
function sessionsByDay() {
  const map = {};
  for (const s of state.sessions) {
    const key = dayKey(s.start);
    if (!map[key]) map[key] = [];
    map[key].push(s);
  }
  return map;
}

function dayMetrics(sessions) {
  let total = 0, naps = 0, napMs = 0, nightMs = 0, wakings = 0, nights = 0;
  for (const s of sessions) {
    const dur = sessionDuration(s);
    total += dur;
    if (s.type === "nap") { naps++; napMs += dur; }
    else { nights++; nightMs += dur; wakings += s.wakings || 0; }
  }
  return { total, naps, napMs, nightMs, wakings, nights };
}

function lastDaysKeys(n) {
  const keys = [];
  for (let i = n - 1; i >= 0; i--) {
    keys.push(dayKey(new Date(Date.now() - i * 86400000)));
  }
  return keys;
}

function weeklyContext() {
  const byDay = sessionsByDay();
  const keys = lastDaysKeys(7);
  let totalMs = 0, totalNaps = 0, totalWakings = 0, totalNights = 0, daysWithData = 0;
  for (const key of keys) {
    const sessions = byDay[key];
    if (!sessions || sessions.length === 0) continue;
    daysWithData++;
    const m = dayMetrics(sessions);
    totalMs += m.total;
    totalNaps += m.naps;
    totalWakings += m.wakings;
    totalNights += m.nights;
  }
  const ageMonths = getAgeMonths();
  return {
    ageMonths,
    rec: getRecommendationForAge(ageMonths),
    daysWithData,
    avgSleepHours: daysWithData ? totalMs / daysWithData / 3600000 : 0,
    avgNaps: daysWithData ? totalNaps / daysWithData : 0,
    avgWakings: totalNights ? totalWakings / totalNights : 0
  };
}

/* ---------- Tomas ---------- */

const FEEDING_LABELS = {
  pecho: { icon: "🤱", label: "Pecho" },
  biberon: { icon: "🍼", label: "Biberón" },
  solidos: { icon: "🥄", label: "Sólidos" }
};

function addFeeding(type) {
  state.feedings.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    type,
    time: new Date().toISOString()
  });
  saveState();
  renderAll();
}

function feedingsByDay() {
  const map = {};
  for (const f of state.feedings) {
    const key = dayKey(f.time);
    if (!map[key]) map[key] = [];
    map[key].push(f);
  }
  return map;
}

function feedingItemHTML(f) {
  const info = FEEDING_LABELS[f.type] || FEEDING_LABELS.biberon;
  return `
    <span class="h-icon">${info.icon}</span>
    <div class="h-info">
      <div class="h-title">Toma · ${info.label}</div>
      <div class="h-detail">${formatTime(f.time)}</div>
    </div>
    <button class="h-delete" title="Eliminar toma" aria-label="Eliminar toma">✕</button>`;
}

function attachFeedingDelete(item, feeding) {
  item.querySelector(".h-delete").addEventListener("click", () => {
    if (confirm("¿Eliminar esta toma?")) {
      state.feedings = state.feedings.filter((x) => x.id !== feeding.id);
      saveState();
      renderAll();
    }
  });
}

function renderFeedingsToday() {
  const container = $("feedings-today");
  container.innerHTML = "";
  const today = (feedingsByDay()[dayKey(new Date())] || [])
    .sort((a, b) => new Date(b.time) - new Date(a.time));
  for (const f of today) {
    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = feedingItemHTML(f);
    attachFeedingDelete(item, f);
    container.appendChild(item);
  }
}

/* ---------- Recordatorio de rutina ---------- */

function renderReminder() {
  $("reminder-time").value = state.reminder.time || "20:00";
  $("reminder-enabled").checked = !!state.reminder.enabled;
}

function checkReminder() {
  const r = state.reminder;
  if (!r.enabled || !r.time) return;
  const now = new Date();
  const [h, m] = r.time.split(":").map(Number);
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  const key = dayKey(now);
  if (now >= target && now - target < 10 * 60000 && state.lastReminderDay !== key) {
    state.lastReminderDay = key;
    saveState();
    $("reminder-banner").classList.remove("hidden");
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("🌙 Hora de la rutina de sueño", {
          body: "Baño, pijama, cuento y luz tenue: es el momento de preparar a tu bebé para dormir.",
          icon: "icons/icon.svg"
        });
      } catch (e) { /* algunos navegadores móviles no permiten Notification directa */ }
    }
  }
}

/* ---------- Cronómetro ---------- */

function startSession(type) {
  state.activeSession = { type, start: new Date().toISOString(), wakings: 0 };
  saveState();
  renderTimer();
}

function stopSession() {
  if (!state.activeSession) return;
  const end = new Date().toISOString();
  const durationMs = new Date(end) - new Date(state.activeSession.start);
  if (durationMs >= 60000) {
    state.sessions.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      type: state.activeSession.type,
      start: state.activeSession.start,
      end,
      wakings: state.activeSession.wakings || 0
    });
  }
  state.activeSession = null;
  saveState();
  renderAll();
}

function renderTimer() {
  const active = state.activeSession;
  $("timer-buttons").classList.toggle("hidden", !!active);
  $("timer-active-buttons").classList.toggle("hidden", !active);
  $("timer-display").classList.toggle("hidden", !active);
  $("timer-type-badge").classList.toggle("hidden", !active);
  $("waking-count").classList.toggle("hidden", !active || active.type !== "night");
  clearInterval(timerInterval);

  if (active) {
    const isNap = active.type === "nap";
    $("timer-title").textContent = isNap ? "Siesta en curso" : "Sueño nocturno en curso";
    const badge = $("timer-type-badge");
    badge.textContent = isNap ? "😴 Siesta" : "🌙 Noche";
    badge.className = `badge ${active.type}`;
    const tick = () => {
      $("timer-display").textContent = formatClock(Date.now() - new Date(active.start).getTime());
    };
    tick();
    timerInterval = setInterval(tick, 1000);
    $("waking-count").textContent = `Despertares registrados: ${active.wakings || 0}`;
  } else {
    $("timer-title").textContent = "¿Está durmiendo tu bebé?";
  }
}

/* ---------- Renderizado ---------- */

function renderHeader() {
  const name = state.baby.name;
  const age = formatAge(getAgeMonths());
  $("header-subtitle").textContent = name
    ? `El sueño de ${name}${age ? ` · ${age}` : ""}`
    : "Controla y mejora el sueño de tu bebé";
}

function renderToday() {
  const byDay = sessionsByDay();
  const today = byDay[dayKey(new Date())] || [];
  const m = dayMetrics(today);
  $("today-total").textContent = formatDuration(m.total);
  $("today-naps").textContent = m.naps;
  $("today-wakings").textContent = m.wakings;

  const rec = getRecommendationForAge(getAgeMonths());
  const wrap = $("today-goal");
  if (rec) {
    wrap.classList.remove("hidden");
    const hours = m.total / 3600000;
    const pct = Math.min(100, (hours / rec.minHours) * 100);
    $("goal-bar-fill").style.width = pct + "%";
    $("goal-text").textContent =
      `${hours.toFixed(1)} h de las ${rec.minHours}–${rec.maxHours} h recomendadas para su edad`;
  } else {
    wrap.classList.add("hidden");
  }
}

function renderDailyTip() {
  const dayIndex = Math.floor(Date.now() / 86400000) % GENERAL_TIPS.length;
  const tip = GENERAL_TIPS[dayIndex];
  $("daily-tip").innerHTML = `<strong>${tip.title}.</strong> ${tip.text}`;
}

function renderHistory() {
  const container = $("history-list");
  container.innerHTML = "";
  if (state.sessions.length === 0 && state.feedings.length === 0) {
    container.innerHTML = `<p class="empty-state">Todavía no hay registros.<br>Usa el cronómetro o añade un registro manual desde Inicio.</p>`;
    return;
  }
  const byDay = sessionsByDay();
  const feedsByDay = feedingsByDay();
  const keys = [...new Set([...Object.keys(byDay), ...Object.keys(feedsByDay)])].sort().reverse();
  for (const key of keys) {
    const header = document.createElement("p");
    header.className = "history-day-header";
    const daySessions = byDay[key] || [];
    const dayFeedings = feedsByDay[key] || [];
    const parts = [formatDayLabel(key)];
    if (daySessions.length) parts.push(formatDuration(dayMetrics(daySessions).total));
    if (dayFeedings.length) parts.push(`${dayFeedings.length} toma${dayFeedings.length > 1 ? "s" : ""}`);
    header.textContent = parts.join(" · ");
    container.appendChild(header);

    for (const f of [...dayFeedings].sort((a, b) => new Date(b.time) - new Date(a.time))) {
      const item = document.createElement("div");
      item.className = "history-item";
      item.innerHTML = feedingItemHTML(f);
      attachFeedingDelete(item, f);
      container.appendChild(item);
    }

    const sessions = [...daySessions].sort((a, b) => new Date(b.start) - new Date(a.start));
    for (const s of sessions) {
      const item = document.createElement("div");
      item.className = "history-item";
      const isNap = s.type === "nap";
      const wakingsTxt = !isNap && s.wakings ? ` · ${s.wakings} despertar${s.wakings > 1 ? "es" : ""}` : "";
      item.innerHTML = `
        <span class="h-icon">${isNap ? "😴" : "🌙"}</span>
        <div class="h-info">
          <div class="h-title">${isNap ? "Siesta" : "Sueño nocturno"} · ${formatDuration(sessionDuration(s))}</div>
          <div class="h-detail">${formatTime(s.start)} – ${formatTime(s.end)}${wakingsTxt}</div>
        </div>
        <button class="h-delete" title="Eliminar registro" aria-label="Eliminar registro">✕</button>`;
      item.querySelector(".h-delete").addEventListener("click", () => {
        if (confirm("¿Eliminar este registro?")) {
          state.sessions = state.sessions.filter((x) => x.id !== s.id);
          saveState();
          renderAll();
        }
      });
      container.appendChild(item);
    }
  }
}

function renderStats() {
  const byDay = sessionsByDay();
  const keys = lastDaysKeys(7);
  const chart = $("week-chart");
  chart.innerHTML = "";

  const maxMs = Math.max(
    12 * 3600000,
    ...keys.map((k) => (byDay[k] ? dayMetrics(byDay[k]).total : 0))
  );

  const dayNames = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  for (const key of keys) {
    const m = byDay[key] ? dayMetrics(byDay[key]) : { total: 0, napMs: 0, nightMs: 0 };
    const col = document.createElement("div");
    col.className = "chart-col";
    const [y, mo, d] = key.split("-").map(Number);
    const label = dayNames[new Date(y, mo - 1, d).getDay()];
    const stackH = maxMs ? (m.total / maxMs) * 100 : 0;
    const nightPct = m.total ? (m.nightMs / m.total) * 100 : 0;
    const napPct = m.total ? (m.napMs / m.total) * 100 : 0;
    col.innerHTML = `
      <span class="chart-value">${m.total ? (m.total / 3600000).toFixed(1) : ""}</span>
      <div class="chart-bar-stack" style="height:${stackH}%">
        <div class="chart-seg-night" style="height:${nightPct}%"></div>
        <div class="chart-seg-nap" style="height:${napPct}%"></div>
      </div>
      <span class="chart-label">${label}</span>`;
    chart.appendChild(col);
  }

  $("chart-legend").innerHTML =
    `Horas de sueño por día<span class="legend-dot" style="background:var(--night)"></span>Nocturno` +
    `<span class="legend-dot" style="background:var(--nap)"></span>Siestas`;

  const ctx = weeklyContext();
  $("avg-total").textContent = ctx.daysWithData ? ctx.avgSleepHours.toFixed(1) + " h" : "—";
  $("avg-naps").textContent = ctx.daysWithData ? ctx.avgNaps.toFixed(1) : "—";
  $("avg-wakings").textContent = ctx.daysWithData ? ctx.avgWakings.toFixed(1) : "—";

  const recEl = $("age-recommendation");
  if (ctx.rec) {
    recEl.innerHTML =
      `<strong>${ctx.rec.label}:</strong> se recomiendan <strong>${ctx.rec.minHours}–${ctx.rec.maxHours} horas</strong> de sueño al día (incluyendo siestas). ${ctx.rec.naps}<br><br>${ctx.rec.description}`;
  } else {
    recEl.textContent =
      "Añade la fecha de nacimiento de tu bebé en la pestaña Perfil para ver las recomendaciones para su edad.";
  }
}

function renderTips() {
  const ctx = weeklyContext();
  const personalized = PERSONALIZED_RULES
    .map((rule) => rule.evaluate(ctx))
    .filter(Boolean);

  const pContainer = $("personalized-tips");
  pContainer.innerHTML = `<p class="tips-section-title">Para tu bebé</p>`;
  for (const tip of personalized) {
    const card = document.createElement("div");
    card.className = "card tip-item" + (tip.alert ? " alert" : "");
    card.innerHTML = `<h3>${tip.alert ? "⚠️ " : "✅ "}${tip.title}</h3><p>${tip.text}</p>`;
    pContainer.appendChild(card);
  }

  const gContainer = $("general-tips");
  gContainer.innerHTML = `<p class="tips-section-title">Consejos generales</p>`;
  for (const tip of GENERAL_TIPS) {
    const card = document.createElement("div");
    card.className = "card tip-item";
    card.innerHTML = `<h3>${tip.title}</h3><p>${tip.text}</p>`;
    gContainer.appendChild(card);
  }
}

function renderProfile() {
  $("baby-name").value = state.baby.name || "";
  $("baby-birthdate").value = state.baby.birthdate || "";
  const months = getAgeMonths();
  $("baby-age").textContent = months !== null ? `Edad actual: ${formatAge(months)}.` : "";
}

function renderAll() {
  renderHeader();
  renderTimer();
  renderToday();
  renderFeedingsToday();
  renderDailyTip();
  renderHistory();
  renderStats();
  renderTips();
  renderProfile();
  renderReminder();
}

/* ---------- Navegación ---------- */

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    tab.classList.add("active");
    $("view-" + tab.dataset.view).classList.add("active");
    window.scrollTo(0, 0);
  });
});

/* ---------- Eventos ---------- */

$("btn-start-nap").addEventListener("click", () => startSession("nap"));
$("btn-start-night").addEventListener("click", () => startSession("night"));
$("btn-stop").addEventListener("click", stopSession);
$("btn-add-waking").addEventListener("click", () => {
  if (!state.activeSession) return;
  state.activeSession.wakings = (state.activeSession.wakings || 0) + 1;
  saveState();
  $("waking-count").textContent = `Despertares registrados: ${state.activeSession.wakings}`;
  $("waking-count").classList.remove("hidden");
});

$("manual-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const start = new Date($("manual-start").value);
  const end = new Date($("manual-end").value);
  if (isNaN(start) || isNaN(end)) return;
  if (end <= start) {
    alert("La hora de fin debe ser posterior a la de inicio.");
    return;
  }
  if (end - start > 24 * 3600000) {
    alert("Un registro no puede durar más de 24 horas.");
    return;
  }
  state.sessions.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    type: $("manual-type").value,
    start: start.toISOString(),
    end: end.toISOString(),
    wakings: parseInt($("manual-wakings").value, 10) || 0
  });
  saveState();
  e.target.reset();
  $("manual-wakings").value = 0;
  renderAll();
});

$("profile-form").addEventListener("submit", (e) => {
  e.preventDefault();
  state.baby.name = $("baby-name").value.trim();
  state.baby.birthdate = $("baby-birthdate").value;
  saveState();
  renderAll();
  alert("Perfil guardado ✔");
});

$("btn-feed-pecho").addEventListener("click", () => addFeeding("pecho"));
$("btn-feed-biberon").addEventListener("click", () => addFeeding("biberon"));
$("btn-feed-solidos").addEventListener("click", () => addFeeding("solidos"));

$("reminder-form").addEventListener("submit", (e) => {
  e.preventDefault();
  state.reminder.time = $("reminder-time").value || "20:00";
  state.reminder.enabled = $("reminder-enabled").checked;
  saveState();
  if (state.reminder.enabled && "Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
  alert(state.reminder.enabled
    ? `Recordatorio activado a las ${state.reminder.time} ✔`
    : "Recordatorio desactivado.");
});

$("banner-close").addEventListener("click", () => {
  $("reminder-banner").classList.add("hidden");
});

$("btn-export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `sueno-bebe-${dayKey(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$("btn-delete-all").addEventListener("click", () => {
  if (confirm("¿Seguro que quieres borrar TODOS los datos? Esta acción no se puede deshacer.")) {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }
});

/* ---------- Inicio ---------- */

renderAll();
checkReminder();
setInterval(checkReminder, 20000);

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
