/**
 * Modo IA del Asistente de sueño.
 *
 * Si el usuario guarda su propia clave de API de Anthropic, las respuestas
 * del asistente las genera Claude directamente desde el navegador, con el
 * contexto en tiempo real del bebé y memoria de la conversación.
 *
 * - La clave se guarda SOLO en este dispositivo (localStorage aparte, nunca
 *   se sincroniza con la familia ni se incluye en la exportación de datos).
 * - Si no hay clave, o la llamada falla, el asistente usa el motor experto
 *   local de assistant.js.
 * - Las señales de alarma médicas se detectan siempre localmente antes de
 *   llamar a la IA.
 */

const AI_KEY_STORAGE = "bebe-sueno-apikey";
const AI_API_URL = "https://api.anthropic.com/v1/messages";
const AI_MODEL = "claude-opus-5";
const AI_MAX_HISTORY = 12; // turnos guardados (usuario + asistente)

const AI_SYSTEM_PROMPT = `Eres el "Asistente de sueño" de la app Sueño Bebé: un experto en sueño infantil (0 a 5 años) que ayuda a madres y padres, basándote en las recomendaciones de la American Academy of Sleep Medicine, la Academia Americana de Pediatría y la OMS.

Cómo respondes:
- Siempre en español, con tono cálido, cercano y tranquilizador, como una enfermera pediátrica con experiencia.
- Conciso: normalmente menos de 150 palabras, salvo que pidan más detalle. Párrafos cortos.
- Formato: texto plano con párrafos; puedes usar **negrita** para lo importante y listas con "•". No uses encabezados Markdown, tablas ni enlaces.
- Usa los datos del bebé del bloque de contexto cuando sean relevantes (edad, siesta en curso, despertares, medias) y menciónalos con naturalidad ("ahora mismo lleva 40 minutos de siesta...").
- Normaliza sin juzgar: los despertares y las dificultades de sueño son evolutivos en la mayoría de los casos.

Límites de seguridad (obligatorios):
- NUNCA diagnostiques enfermedades ni indiques medicamentos ni dosis.
- Ante cualquier señal de alarma (fiebre — especialmente con menos de 3 meses —, dificultad para respirar, convulsiones, color azulado, decaimiento marcado, vómitos persistentes, no reacciona), NO des consejos de sueño: indica contactar de inmediato con el pediatra o urgencias (112 en España).
- En temas de sueño seguro, sigue siempre las recomendaciones de prevención de la muerte súbita (boca arriba, cuna despejada, no sobrecalentar).
- Cuando la duda sea persistente o preocupante, recuerda que no sustituyes al pediatra.
- Si preguntan algo sin relación con el sueño o el cuidado del bebé, redirige amablemente al tema de la app.`;

let aiHistory = [];

function aiGetKey() {
  try {
    return localStorage.getItem(AI_KEY_STORAGE) || "";
  } catch (e) {
    return "";
  }
}

function aiEnabled() {
  return aiGetKey().length > 0;
}

function aiSetKey(key) {
  localStorage.setItem(AI_KEY_STORAGE, key.trim());
  aiHistory = [];
}

function aiClearKey() {
  localStorage.removeItem(AI_KEY_STORAGE);
  aiHistory = [];
}

/** Bloque de contexto con lo que está pasando ahora mismo, regenerado en cada pregunta. */
function aiContextText() {
  const ctx = buildAssistantContext();
  const lines = ["Contexto actual de la app (datos reales registrados por la familia):"];
  lines.push(`- Bebé: ${ctx.name}${ctx.ageText ? `, ${ctx.ageText}` : " (edad sin configurar)"}`);
  if (ctx.rec) {
    lines.push(`- Sueño recomendado para su edad: ${ctx.rec.minHours}-${ctx.rec.maxHours} h al día. ${ctx.rec.naps}`);
  }
  if (ctx.active) {
    const tipo = ctx.active.type === "nap" ? "siesta" : "sueño nocturno";
    lines.push(`- AHORA MISMO: lleva ${ctx.active.minutes} minutos de ${tipo}${ctx.active.wakings ? ` con ${ctx.active.wakings} despertares` : ""}.`);
  } else {
    lines.push("- Ahora mismo no hay ninguna sesión de sueño en curso.");
  }
  lines.push(`- Hoy: ${(ctx.todayMs / 3600000).toFixed(1)} h de sueño, ${ctx.todayNaps} siestas, ${ctx.todayWakings} despertares nocturnos.`);
  if (ctx.bottleCount > 0 || ctx.milkTarget) {
    let milk = `- Biberón hoy: ${ctx.bottleMl} ml en ${ctx.bottleCount} tomas`;
    if (ctx.milkTarget) milk += ` (objetivo diario orientativo: ${ctx.milkTarget} ml)`;
    if (ctx.weightKg) milk += `. Peso: ${ctx.weightKg} kg`;
    lines.push(milk + ".");
  }
  if (ctx.daysWithData >= 2) {
    lines.push(`- Última semana (${ctx.daysWithData} días con datos): media de ${ctx.avgSleepHours.toFixed(1)} h/día, ${ctx.avgNaps.toFixed(1)} siestas/día, ${ctx.avgWakings.toFixed(1)} despertares/noche.`);
  } else {
    lines.push("- Todavía hay pocos registros esta semana.");
  }
  lines.push(`- Hora local del usuario: ${new Date().toLocaleString("es-ES", { weekday: "long", hour: "2-digit", minute: "2-digit" })}.`);
  return lines.join("\n");
}

function aiTrimHistory() {
  if (aiHistory.length <= AI_MAX_HISTORY) return;
  aiHistory = aiHistory.slice(aiHistory.length - AI_MAX_HISTORY);
  // La conversación debe empezar por un turno del usuario
  while (aiHistory.length && aiHistory[0].role !== "user") {
    aiHistory.shift();
  }
}

/** Pregunta a Claude. Devuelve el texto de la respuesta o lanza un error. */
async function askClaude(question) {
  const messages = aiHistory.concat([{ role: "user", content: question }]);

  const res = await fetch(AI_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": aiGetKey(),
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "server-side-fallback-2026-07-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: 4096,
      output_config: { effort: "low" },
      fallbacks: "default",
      system: [
        { type: "text", text: AI_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        { type: "text", text: aiContextText() }
      ],
      messages
    })
  });

  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();

  if (data.stop_reason === "refusal") {
    const err = new Error("refusal");
    err.refusal = true;
    throw err;
  }

  const text = (data.content || [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
  if (!text) throw new Error("empty");

  // Guardar el turno completo (incluidos los bloques de razonamiento) para
  // continuar la conversación tal y como pide la API
  aiHistory.push({ role: "user", content: question });
  aiHistory.push({ role: "assistant", content: data.content });
  aiTrimHistory();

  return text;
}

function aiErrorMessage(e) {
  if (e && e.status === 401) return "La clave de API no es válida o ha caducado — revísala en los ajustes del Modo IA.";
  if (e && e.status === 429) return "Se alcanzó el límite de uso de la API — espera un momento.";
  if (e && (e.status === 400 || e.status === 413)) return "La petición no fue aceptada por la API.";
  if (e && e.refusal) return "La IA prefirió no responder a esta pregunta.";
  return "No se pudo contactar con la IA (¿sin conexión?).";
}
