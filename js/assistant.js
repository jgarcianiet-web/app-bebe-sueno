/**
 * Asistente de sueño: agente experto que responde preguntas sobre el sueño
 * del bebé usando el contexto actual de la app (edad, sesión en curso,
 * registros de hoy y patrones de la semana).
 *
 * Funciona completamente en el dispositivo, sin conexión y sin enviar
 * datos a ningún servicio. No sustituye el consejo de un pediatra.
 */

function normalizeText(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Foto de "lo que está pasando ahora mismo" para personalizar respuestas. */
function buildAssistantContext() {
  const now = new Date();
  const ctxWeek = weeklyContext();
  const byDay = sessionsByDay();
  const today = byDay[dayKey(now)] || [];
  const todayMetrics = dayMetrics(today);
  const active = state.activeSession
    ? {
        type: state.activeSession.type,
        minutes: Math.floor((now - new Date(state.activeSession.start)) / 60000),
        wakings: state.activeSession.wakings || 0
      }
    : null;
  return {
    name: state.baby.name || "tu bebé",
    ageMonths: ctxWeek.ageMonths,
    ageText: ctxWeek.ageMonths !== null ? formatAge(ctxWeek.ageMonths) : null,
    rec: ctxWeek.rec,
    daysWithData: ctxWeek.daysWithData,
    avgSleepHours: ctxWeek.avgSleepHours,
    avgWakings: ctxWeek.avgWakings,
    todayMs: todayMetrics.total,
    todayNaps: todayMetrics.naps,
    todayWakings: todayMetrics.wakings,
    active,
    hour: now.getHours(),
    isEvening: now.getHours() >= 18 && now.getHours() <= 23,
    isNight: now.getHours() >= 0 && now.getHours() < 7
  };
}

function assistantStatusLine(ctx) {
  const parts = [];
  if (ctx.active) {
    const tipo = ctx.active.type === "nap" ? "siesta" : "sueño nocturno";
    const h = Math.floor(ctx.active.minutes / 60);
    const m = ctx.active.minutes % 60;
    const dur = h > 0 ? `${h}h ${m}m` : `${m} minutos`;
    let line = `ahora mismo ${ctx.name} lleva ${dur} de ${tipo}`;
    if (ctx.active.type === "night" && ctx.active.wakings > 0) {
      line += ` con ${ctx.active.wakings} despertar${ctx.active.wakings > 1 ? "es" : ""}`;
    }
    parts.push(line);
  }
  if (ctx.todayMs > 0) {
    parts.push(`hoy suma ${formatDuration(ctx.todayMs)} de sueño y ${ctx.todayNaps} siesta${ctx.todayNaps === 1 ? "" : "s"}`);
  }
  return parts.length ? parts.join("; ") + "." : "";
}

const RED_FLAG_KEYWORDS = [
  "fiebre", "vomit", "respira", "respiracion", "apnea", "convulsion",
  "azul", "morad", "no reacciona", "no despierta", "no responde",
  "sangre", "golpe en la cabeza", "se cayo", "deshidrat", "no come nada"
];

const ASSISTANT_TOPICS = [
  {
    id: "estado",
    keywords: ["que esta pasando", "como va", "ahora mismo", "resumen", "como lo esta haciendo", "que hago ahora", "situacion"],
    answer(ctx) {
      let out = "";
      const status = assistantStatusLine(ctx);
      if (ctx.active) {
        out += `📊 ${status.charAt(0).toUpperCase() + status.slice(1)}\n\n`;
        if (ctx.active.type === "nap") {
          if (ctx.active.minutes < 30) {
            out += "La siesta aún es corta; si se despierta antes de 30–40 minutos, prueba a darle unos minutos por si enlaza otro ciclo de sueño.";
          } else {
            out += "Va bien. Cuando se despierte, ofrécele luz natural y actividad para reforzar la diferencia entre día y noche.";
          }
        } else {
          out += "Si se despierta, atiéndelo con luz mínima y voz baja: cuanto más aburridos sean los despertares nocturnos, antes vuelve a dormirse.";
        }
        return out;
      }
      if (status) out += `📊 ${status.charAt(0).toUpperCase() + status.slice(1)}\n\n`;
      if (ctx.rec && ctx.todayMs > 0) {
        const hours = ctx.todayMs / 3600000;
        if (hours < ctx.rec.minHours * 0.6 && ctx.hour >= 15) {
          out += `Para su edad se recomiendan ${ctx.rec.minHours}–${ctx.rec.maxHours} h al día, así que aún le queda margen: protege la siguiente ventana de sueño. `;
        }
      }
      if (ctx.isEvening) {
        out += "Es buena hora para ir empezando la rutina de la noche: baño, pijama, toma tranquila, cuento o canción y luz tenue.";
      } else if (ctx.isNight) {
        out += "A estas horas, lo importante es mantener la calma: luz mínima, poca estimulación y de vuelta a la cuna.";
      } else if (!out) {
        out += "Todavía no hay registros de hoy. Usa el cronómetro cuando duerma y podré darte una foto más precisa de cómo va el día.";
      }
      return out.trim();
    }
  },
  {
    id: "despertares",
    keywords: ["se despierta", "despierta mucho", "despertares", "se desvela", "no duerme del tiron", "cada hora", "cada dos horas", "toda la noche despierto"],
    answer(ctx) {
      let out = "";
      if (ctx.ageMonths !== null && ctx.ageMonths < 6) {
        out += `A los ${ctx.ageText}, despertarse varias veces por noche es completamente normal: su estómago es pequeño y necesita comer, y sus ciclos de sueño aún están madurando. No es un mal hábito ni algo que debas corregir todavía.\n\nQué ayuda:\n• Atiende los despertares con luz mínima y sin jugar.\n• Durante el día, mucha luz y estímulo; así su reloj interno aprende la diferencia.\n• Túrnate con tu pareja si es posible para que ambos descanséis.`;
      } else {
        out += "A partir de los 6 meses muchos bebés pueden dormir tramos largos, pero los despertares siguen siendo frecuentes y suelen deberse a:\n\n• **Asociaciones de sueño**: si solo se duerme en brazos, con movimiento o comiendo, al despertar entre ciclos pedirá lo mismo. Prueba a acostarlo somnoliento pero despierto.\n• **Sobrecansancio**: un bebé que llega agotado a la noche duerme peor. Revisa que las siestas del día sean suficientes.\n• **Molestias puntuales**: dentición, mocos, calor o frío, o un salto de desarrollo.\n";
        if (ctx.avgWakings >= 3 && ctx.daysWithData >= 2) {
          out += `\nSegún tus registros, la media es de ${ctx.avgWakings.toFixed(1)} despertares por noche — merece la pena trabajar la rutina y, si no mejora en 2–3 semanas, coméntalo con tu pediatra.`;
        }
      }
      const status = assistantStatusLine(ctx);
      if (ctx.active && ctx.active.type === "night") out += `\n\n(${status.charAt(0).toUpperCase() + status.slice(1)})`;
      return out;
    }
  },
  {
    id: "cuanto-dormir",
    keywords: ["cuanto deberia dormir", "cuantas horas", "horas de sueno", "cuanto necesita", "duerme suficiente", "duerme poco", "duerme demasiado", "cuanto tiene que dormir"],
    answer(ctx) {
      if (!ctx.rec) {
        return "Añade la fecha de nacimiento en la pestaña Perfil y te diré exactamente cuántas horas se recomiendan para su edad. Como orientación general: recién nacidos 14–17 h, de 4 a 12 meses 12–16 h, de 1 a 2 años 11–14 h, y de 2 a 5 años 10–13 h (incluyendo siestas).";
      }
      let out = `Para ${ctx.name} (${ctx.ageText}) se recomiendan **${ctx.rec.minHours}–${ctx.rec.maxHours} horas** de sueño al día, incluyendo siestas. ${ctx.rec.naps}`;
      if (ctx.daysWithData >= 2) {
        const diff = ctx.avgSleepHours - ctx.rec.minHours;
        if (ctx.avgSleepHours <= 0) {
          out += "";
        } else if (diff < -1) {
          out += `\n\nSu media esta semana es de ${ctx.avgSleepHours.toFixed(1)} h, por debajo del rango. Prueba a adelantar la hora de acostarlo y proteger las siestas; si se mantiene así, coméntalo con tu pediatra.`;
        } else if (ctx.avgSleepHours > ctx.rec.maxHours + 1.5) {
          out += `\n\nSu media esta semana es de ${ctx.avgSleepHours.toFixed(1)} h, algo por encima del rango. En general no es preocupante, salvo que además lo notes muy apagado.`;
        } else {
          out += `\n\nSu media esta semana es de ${ctx.avgSleepHours.toFixed(1)} h: está dentro de lo esperable. 👍`;
        }
      } else {
        out += "\n\nRegistra unos días de sueño y te diré cómo se compara con la recomendación.";
      }
      return out;
    }
  },
  {
    id: "siestas",
    keywords: ["siesta", "siestas cortas", "no duerme de dia", "no quiere dormir de dia", "solo duerme 30 minutos", "media hora"],
    answer(ctx) {
      let out = "";
      if (ctx.rec) out += `${ctx.rec.naps}\n\n`;
      out += "Para mejorar las siestas:\n• Vigila las **ventanas de sueño**: acuéstalo a la primera señal (bostezos, frotarse los ojos), antes de que llegue al llanto.\n• Ofrécelas en un sitio tranquilo, oscuro y fresco, siempre parecido.\n• Las siestas de ~30–40 minutos (un solo ciclo) son muy comunes: si se despierta contento, era lo que necesitaba; si se despierta llorando, prueba a ayudarle a enlazar (penumbra, mano en el pecho, chupete).";
      if (ctx.active && ctx.active.type === "nap") {
        out += `\n\nAhora mismo lleva ${ctx.active.minutes} minutos de siesta — ¡buena señal!`;
      } else if (ctx.todayNaps === 0 && ctx.hour >= 12 && ctx.hour < 19) {
        out += `\n\nHoy aún no has registrado ninguna siesta; si lleva más de 2–3 horas despierto, puede ser buen momento para intentarlo.`;
      }
      return out;
    }
  },
  {
    id: "rutina",
    keywords: ["rutina", "habitos", "como acostar", "hora de acostar", "mejorar el sueno", "consejos para dormir", "que rutina"],
    answer(ctx) {
      let out = "Una buena rutina dura 20–30 minutos y se repite igual cada noche, siempre hacia la misma hora:\n\n1. Baño templado (opcional, si le relaja).\n2. Pijama y ambiente en penumbra.\n3. Última toma tranquila, sin que se duerma del todo comiendo.\n4. Cuento corto o canción suave.\n5. A la cuna somnoliento pero despierto, boca arriba.\n\nLa clave no es la secuencia exacta sino la **constancia**: en una o dos semanas el bebé anticipa lo que viene y le cuesta menos relajarse.";
      if (ctx.isEvening) out += "\n\nJusto ahora es buena hora para empezarla. 😉 Puedes activar el recordatorio diario en la pestaña Perfil.";
      else out += "\n\nPuedes activar un recordatorio diario de la rutina en la pestaña Perfil.";
      return out;
    }
  },
  {
    id: "brazos",
    keywords: ["brazos", "solo se duerme conmigo", "dormirse solo", "en la cuna se despierta", "lo dejo y se despierta", "asociacion", "mecerlo", "meciendo", "se duerme comiendo", "se duerme con el pecho"],
    answer(ctx) {
      let out = "Dormirse en brazos, meciéndolo o comiendo es lo más natural del mundo — el 'problema' aparece solo si al despertar entre ciclos necesita exactamente eso para volver a dormirse.\n\nSi quieres que aprenda a dormirse con más autonomía (a partir de los 4–6 meses):\n• Acuéstalo **somnoliento pero despierto**, aunque proteste un poco.\n• Retira la ayuda de forma gradual: de dormirse comiendo → a dormirse en brazos → a dormirse en la cuna con tu mano → a dormirse solo con tu presencia.\n• Sé constante 1–2 semanas antes de evaluar si funciona.\n\nNo hay prisa ni obligación: si a vuestra familia le funciona dormirlo en brazos, también está bien.";
      if (ctx.ageMonths !== null && ctx.ageMonths < 4) {
        out = `A los ${ctx.ageText} es demasiado pronto para trabajar la autonomía al dormirse: los recién nacidos necesitan contacto, y responder a esa necesidad no crea malos hábitos. Disfruta de los brazos sin culpa; a partir de los 4–6 meses, si quieres, podréis practicar el "somnoliento pero despierto".`;
      }
      return out;
    }
  },
  {
    id: "regresion",
    keywords: ["regresion", "dormia bien y ahora", "de repente duerme mal", "ha empeorado", "antes dormia"],
    answer(ctx) {
      let out = "Lo que describes suena a una **regresión del sueño**: fases (típicas hacia los 4, 8–10, 12 y 18 meses) en las que un bebé que dormía bien empeora de repente, por saltos de desarrollo, dentición o cambios (guardería, viajes).\n\nQué hacer:\n• Mantén la rutina de siempre, aunque parezca que no funciona — es el ancla.\n• Atiende los despertares con calma y poca estimulación.\n• Evita crear ayudas nuevas difíciles de retirar (p. ej. volver a dormirlo en brazos toda la noche si ya no lo necesitaba).\n\nSuelen durar de 2 a 6 semanas y pasan solas.";
      if (ctx.ageMonths !== null && [4, 8, 9, 10, 12, 18].includes(ctx.ageMonths)) {
        out += `\n\nDe hecho, ${ctx.name} tiene ${ctx.ageText}: está justo en una edad típica de regresión, así que encaja.`;
      }
      return out;
    }
  },
  {
    id: "denticion",
    keywords: ["diente", "dientes", "denticion", "encias", "babea", "muerde"],
    answer() {
      return "La dentición puede dar noches revueltas los días en que el diente está a punto de salir (encías hinchadas, más babeo, todo a la boca, irritabilidad).\n\nQué ayuda:\n• Mordedores fríos (de nevera, no congelador) durante el día.\n• Masajear la encía con el dedo limpio antes de dormir.\n• Si está claramente dolorido, consulta a tu pediatra sobre analgésicos adecuados a su edad — no uses geles con benzocaína ni collares de ámbar (no son seguros).\n\nSi el mal sueño dura más de una semana seguida, probablemente no sea solo la dentición: revisa también rutina y ventanas de sueño.";
    }
  },
  {
    id: "pesadillas",
    keywords: ["pesadilla", "terror nocturno", "grita dormido", "llora dormido", "se despierta gritando", "miedo"],
    answer(ctx) {
      let out = "Conviene distinguir dos cosas:\n\n• **Pesadillas** (más típicas a partir de los 2 años, en la segunda mitad de la noche): el niño se despierta asustado y te reconoce. Consuélalo, dale seguridad y evita pantallas o historias intensas antes de dormir.\n\n• **Terrores nocturnos** (primeras horas de la noche): grita o llora agitado pero **sigue dormido** y no te reconoce. Impresionan mucho, pero no son peligrosos ni los recordará. No intentes despertarlo; solo vigila que no se haga daño y espera a que pase (5–15 min). Se agravan con el sobrecansancio, así que adelantar la hora de acostarse suele reducirlos.";
      if (ctx.ageMonths !== null && ctx.ageMonths < 12) {
        out += `\n\nCon ${ctx.ageText}, lo más probable es que sean despertares con llanto normales (hambre, molestias o fase de sueño activo) más que pesadillas propiamente dichas.`;
      }
      return out;
    }
  },
  {
    id: "madruga",
    keywords: ["madruga", "se despierta muy pronto", "muy temprano", "a las 5", "a las 6 de la manana"],
    answer() {
      return "Los madrugones (5–6 de la mañana) son de lo más difícil de cambiar, pero hay margen:\n\n• **Oscuridad total** en la habitación: con la primera luz del día el sueño de madrugada es muy ligero. Unas cortinas opacas marcan la diferencia.\n• Revisa que no se acueste **demasiado tarde ni demasiado pronto**: ambas cosas provocan despertares tempranos. Prueba ajustes de 15 minutos durante varios días.\n• Al despertarse, no empieces el día enseguida: trato de madrugada (luz mínima, aburrido) hasta una hora razonable.\n• Comprueba que la última siesta no termine demasiado tarde.\n\nY a veces, simplemente, hay temporadas: constancia y paciencia.";
    }
  },
  {
    id: "tomas-noche",
    keywords: ["toma de noche", "tomas nocturnas", "pecho por la noche", "biberon por la noche", "hambre por la noche", "destete nocturno", "comer de noche"],
    answer(ctx) {
      let out = "";
      if (ctx.ageMonths !== null && ctx.ageMonths < 6) {
        out = `A los ${ctx.ageText}, las tomas nocturnas siguen siendo necesarias para la mayoría de bebés: no intentes eliminarlas todavía. Hazlas tranquilas y con luz mínima para que se vuelva a dormir fácil.`;
      } else {
        out = "A partir de los 6 meses (y con buen peso), muchos bebés ya no necesitan comer de noche por hambre, aunque sí por costumbre o consuelo. Si quieres reducir las tomas nocturnas:\n\n• Asegura tomas completas durante el día (sin distracciones).\n• Reduce gradualmente: acorta minutos de pecho o ml de biberón cada pocas noches.\n• Ofrece consuelo alternativo en los despertares (caricias, voz).\n• Hazlo siempre de acuerdo con tu pediatra, sobre todo si hay dudas con el peso.";
      }
      return out;
    }
  },
  {
    id: "seguridad",
    keywords: ["colecho", "nuestra cama", "seguridad", "boca arriba", "boca abajo", "muerte subita", "almohada", "cojin", "manta", "peluche en la cuna"],
    answer(ctx) {
      let out = "Recomendaciones de sueño seguro (primer año):\n\n• Siempre **boca arriba**, en una cuna con colchón firme.\n• Sin almohadas, cojines, mantas sueltas, protectores ni peluches en la cuna.\n• Habitación entre 18–21 °C, sin sobreabrigar.\n• Ideal: cuna en la habitación de los padres los primeros 6 meses.\n• Colecho en la cama de los adultos: si se practica, debe ser con condiciones estrictas (colchón firme, sin edredones pesados, nunca con sofá, ni si habéis fumado, bebido alcohol o tomado medicación que dé sueño). Coméntalo con tu pediatra.\n• Lactancia materna y chupete para dormir se asocian a menor riesgo de muerte súbita.";
      if (ctx.ageMonths !== null && ctx.ageMonths >= 12) {
        out += "\n\nA partir del año el riesgo de muerte súbita baja mucho y las normas se relajan (puede usar una manta ligera, por ejemplo).";
      }
      return out;
    }
  },
  {
    id: "llanto",
    keywords: ["llora", "llanto", "dejarlo llorar", "no para de llorar", "colicos", "colico"],
    answer(ctx) {
      let out = "";
      if (ctx.ageMonths !== null && ctx.ageMonths <= 4) {
        out = "En los primeros meses el llanto vespertino intenso y sin causa aparente (los famosos 'cólicos del lactante') es muy común: suele empezar hacia las 2–3 semanas, tener su pico a las 6–8 semanas y desaparecer hacia los 3–4 meses.\n\nQué ayuda: contacto piel con piel, porteo, movimiento suave, ruido blanco, y turnarse — sostener a un bebé que llora agota. Si el llanto va con fiebre, vómitos, rechazo total del alimento o lo ves enfermo, acude al pediatra.\n\nA esta edad **no** se recomienda dejarle llorar solo para dormir: responder a su llanto es lo adecuado.";
      } else {
        out = "Un poco de protesta al acostarse es normal cuando está aprendiendo a dormirse de otra manera; el llanto desconsolado es otra cosa y siempre merece respuesta.\n\nUn término medio que funciona a muchas familias: acuéstalo despierto, quédate cerca, y atiéndelo con caricias y voz sin sacarlo de la cuna, aumentando poco a poco tu distancia a lo largo de las noches. Es más lento que los métodos de extinción pero más llevadero.\n\nSi el llanto nocturno es nuevo, intenso o va acompañado de otros síntomas (fiebre, tirarse de las orejas, mocos), descarta causas médicas con tu pediatra.";
      }
      return out;
    }
  },
  {
    id: "ambiente",
    keywords: ["temperatura", "calor", "frio", "ruido", "ruido blanco", "luz", "oscuras", "habitacion", "como debe estar la habitacion"],
    answer() {
      return "El ambiente ideal para dormir:\n\n• **Temperatura**: 18–21 °C. Mejor quedarse un punto fresco que sobreabrigar; comprueba su temperatura tocando nuca o pecho (no manos ni pies).\n• **Oscuridad**: cuanta más, mejor — sobre todo de madrugada. Para las tomas nocturnas, una luz cálida muy tenue.\n• **Ruido**: no hace falta silencio absoluto. El ruido blanco continuo a volumen bajo (menos de 50 dB, alejado de la cuna) puede ayudar a bebés sensibles a los ruidos de la casa.\n• **Sin pantallas** en la habitación ni en la hora previa a dormir.";
    }
  },
  {
    id: "pediatra",
    keywords: ["pediatra", "medico", "preocupado", "preocupada", "es normal", "cuando consultar", "deberia preocuparme"],
    answer(ctx) {
      let out = "La mayoría de los problemas de sueño infantil son evolutivos y se resuelven con tiempo y rutina. Pero consulta con tu pediatra si:\n\n• Ronca de forma habitual, respira con pausas o con mucho esfuerzo al dormir.\n• Duerme claramente menos de lo recomendado para su edad de forma sostenida, o está siempre irritable y somnoliento de día.\n• El problema de sueño empezó de golpe junto a otros síntomas (fiebre, rechazo del alimento, decaimiento).\n• Más allá del año, los despertares múltiples persisten meses pese a rutina constante.\n• Cualquier cosa que a ti te preocupe: para eso está la consulta, y nadie conoce a tu bebé mejor que vosotros.";
      if (ctx.rec && ctx.daysWithData >= 3 && ctx.avgSleepHours > 0 && ctx.avgSleepHours < ctx.rec.minHours - 2) {
        out += `\n\nNota: según tus registros, ${ctx.name} duerme de media ${ctx.avgSleepHours.toFixed(1)} h (recomendado ${ctx.rec.minHours}–${ctx.rec.maxHours} h). Con esa diferencia mantenida, sí merece comentario en la próxima revisión.`;
      }
      return out;
    }
  }
];

function redFlagAnswer() {
  return "⚠️ Lo que describes puede necesitar valoración médica y queda fuera de lo que yo puedo aconsejar.\n\nSi tu bebé tiene fiebre (especialmente con menos de 3 meses), dificultad para respirar, vómitos repetidos, está muy decaído, no reacciona con normalidad o cualquier cosa que te alarme: contacta **ahora** con tu pediatra o acude a urgencias. Ante la duda, siempre es mejor consultar de más.\n\nPara emergencias, llama al 112.";
}

function fallbackAnswer(ctx) {
  let out = "No estoy seguro de haber entendido la pregunta. Puedo ayudarte con temas como:\n\n• Despertares nocturnos y regresiones\n• Cuánto debería dormir para su edad\n• Siestas cortas o difíciles\n• Rutinas y cómo acostarlo\n• Dormirse solo / en brazos\n• Tomas nocturnas, dentición, madrugones\n• Pesadillas y terrores nocturnos\n• Ambiente de la habitación y sueño seguro\n\nPrueba a preguntarme con otras palabras, o toca una de las sugerencias.";
  const status = assistantStatusLine(ctx);
  if (status) out += `\n\n📊 Por cierto: ${status}`;
  return out;
}

function answerQuestion(rawText) {
  const text = normalizeText(rawText);
  const ctx = buildAssistantContext();

  for (const flag of RED_FLAG_KEYWORDS) {
    if (text.includes(flag)) return redFlagAnswer();
  }

  let best = null;
  let bestScore = 0;
  for (const topic of ASSISTANT_TOPICS) {
    let score = 0;
    for (const kw of topic.keywords) {
      if (text.includes(kw)) score += kw.split(" ").length; // frases largas puntúan más
    }
    if (score > bestScore) {
      bestScore = score;
      best = topic;
    }
  }

  if (!best) return fallbackAnswer(ctx);
  return best.answer(ctx);
}

function assistantWelcome() {
  const ctx = buildAssistantContext();
  let out = `¡Hola! Soy tu asistente de sueño 🌙 Pregúntame lo que quieras sobre el sueño de ${ctx.name}: tengo en cuenta su edad y lo que está pasando ahora mismo en la app.`;
  const status = assistantStatusLine(ctx);
  if (status) out += `\n\n📊 ${status.charAt(0).toUpperCase() + status.slice(1)}`;
  out += "\n\nRecuerda: soy orientativo y no sustituyo a tu pediatra.";
  return out;
}
