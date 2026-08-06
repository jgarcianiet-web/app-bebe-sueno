/**
 * Datos de recomendaciones y consejos de sueño infantil.
 * Rangos de horas basados en las recomendaciones generales de la
 * American Academy of Sleep Medicine / OMS. Son orientativos:
 * cada bebé es diferente y el pediatra siempre tiene la última palabra.
 */

const SLEEP_RECOMMENDATIONS = [
  {
    maxMonths: 3,
    label: "0–3 meses (recién nacido)",
    minHours: 14,
    maxHours: 17,
    naps: "El sueño es fragmentado: duerme en periodos de 2–4 horas, de día y de noche.",
    description:
      "A esta edad todavía no distingue el día de la noche. Es normal que se despierte cada pocas horas para comer. No existen 'malos hábitos' aún: responde siempre a sus necesidades."
  },
  {
    maxMonths: 6,
    label: "4–6 meses",
    minHours: 12,
    maxHours: 16,
    naps: "Suele hacer 3–4 siestas al día.",
    description:
      "Empieza a consolidarse el sueño nocturno y a regularse el ritmo circadiano. Es buen momento para instaurar una rutina de sueño sencilla y constante."
  },
  {
    maxMonths: 11,
    label: "7–11 meses",
    minHours: 12,
    maxHours: 16,
    naps: "Suele hacer 2–3 siestas al día.",
    description:
      "Muchos bebés ya pueden dormir tramos largos por la noche. Pueden aparecer despertares por ansiedad de separación: son una fase normal del desarrollo."
  },
  {
    maxMonths: 24,
    label: "12–24 meses",
    minHours: 11,
    maxHours: 14,
    naps: "Suele hacer 1–2 siestas al día; hacia los 15–18 meses muchos pasan a una sola siesta.",
    description:
      "La rutina y los horarios regulares son la clave. Los despertares nocturnos ocasionales siguen siendo normales, sobre todo con la dentición o los saltos de desarrollo."
  },
  {
    maxMonths: 60,
    label: "2–5 años",
    minHours: 10,
    maxHours: 13,
    naps: "Una siesta al día, que suele desaparecer entre los 3 y los 5 años.",
    description:
      "A esta edad pueden aparecer pesadillas o resistencia a irse a la cama. Mantener límites claros y una rutina relajante ayuda mucho."
  }
];

const GENERAL_TIPS = [
  {
    title: "Rutina constante antes de dormir",
    text: "Repite cada noche la misma secuencia (baño, pijama, cuento o canción, luz tenue). En 15–30 minutos el bebé aprende a anticipar que llega la hora de dormir y le resulta más fácil relajarse."
  },
  {
    title: "Acuéstalo somnoliento pero despierto",
    text: "A partir de los 4–6 meses, intenta dejarlo en la cuna cuando esté relajado pero aún despierto. Así aprende a conciliar el sueño por sí mismo y le costará menos volver a dormirse si se despierta de noche."
  },
  {
    title: "Luz y oscuridad: sus aliados",
    text: "Mucha luz natural y actividad durante el día, y oscuridad y calma por la noche. Esto ayuda a que su reloj biológico distinga el día de la noche. Evita pantallas al menos 1 hora antes de acostarlo."
  },
  {
    title: "Ambiente ideal para dormir",
    text: "Habitación tranquila, oscura y a una temperatura de 18–21 °C. El bebé debe dormir boca arriba, en una cuna con colchón firme y sin almohadas, peluches ni mantas sueltas durante el primer año (prevención de la muerte súbita)."
  },
  {
    title: "Vigila las ventanas de sueño",
    text: "Un bebé demasiado cansado duerme peor. Observa sus señales de sueño (bostezos, frotarse los ojos, mirada perdida) y acuéstalo antes de que llegue al llanto por sobrecansancio."
  },
  {
    title: "Diferencia el día de la noche desde el principio",
    text: "Las tomas y despertares nocturnos deben ser aburridos: luz mínima, voz baja y poca interacción. Durante el día, en cambio, juega y háblale mucho."
  },
  {
    title: "Las regresiones del sueño existen",
    text: "Alrededor de los 4, 8–10, 12 y 18 meses muchos bebés empeoran temporalmente su sueño por saltos de desarrollo. Son fases pasajeras: mantén la rutina y ten paciencia."
  },
  {
    title: "Cuídate tú también",
    text: "El descanso de los padres importa. Turnaos en los despertares si es posible, dormid cuando el bebé duerma y pedid ayuda a vuestro entorno. Un padre o madre agotado tiene menos recursos para acompañar el sueño del bebé."
  }
];

/**
 * Consejos personalizados según los datos registrados.
 * Cada regla recibe un objeto de contexto y devuelve un consejo o null.
 * ctx = { ageMonths, avgSleepHours, avgNaps, avgWakings, rec, daysWithData }
 */
const PERSONALIZED_RULES = [
  {
    id: "sin-datos",
    evaluate(ctx) {
      if (ctx.daysWithData >= 2) return null;
      return {
        title: "Empieza a registrar el sueño",
        text: "Registra las siestas y el sueño nocturno durante unos días. Con al menos 2–3 días de datos podremos darte consejos personalizados sobre los patrones de tu bebé.",
        alert: false
      };
    }
  },
  {
    id: "duerme-poco",
    evaluate(ctx) {
      if (!ctx.rec || ctx.daysWithData < 2 || ctx.avgSleepHours <= 0) return null;
      if (ctx.avgSleepHours >= ctx.rec.minHours - 1) return null;
      return {
        title: "Está durmiendo menos de lo recomendado",
        text: `Su media es de ${ctx.avgSleepHours.toFixed(1)} h al día y para su edad se recomiendan ${ctx.rec.minHours}–${ctx.rec.maxHours} h. Prueba a adelantar la hora de acostarlo 15–30 minutos y protege las siestas del día: dormir bien de día ayuda a dormir mejor de noche. Si el patrón se mantiene, coméntalo con tu pediatra.`,
        alert: true
      };
    }
  },
  {
    id: "duerme-mucho",
    evaluate(ctx) {
      if (!ctx.rec || ctx.daysWithData < 2 || ctx.avgSleepHours <= 0) return null;
      if (ctx.avgSleepHours <= ctx.rec.maxHours + 1.5) return null;
      return {
        title: "Duerme algo más de lo habitual",
        text: `Su media es de ${ctx.avgSleepHours.toFixed(1)} h al día, por encima del rango orientativo (${ctx.rec.minHours}–${ctx.rec.maxHours} h). En general no es preocupante, sobre todo tras días agitados o durante un catarro, pero si además lo notas muy apagado o come poco, consúltalo con tu pediatra.`,
        alert: false
      };
    }
  },
  {
    id: "muchos-despertares",
    evaluate(ctx) {
      if (ctx.daysWithData < 2) return null;
      if (ctx.ageMonths !== null && ctx.ageMonths < 6) return null;
      if (ctx.avgWakings < 3) return null;
      return {
        title: "Noches con muchos despertares",
        text: `Registras una media de ${ctx.avgWakings.toFixed(1)} despertares por noche. Revisa la rutina: ¿se duerme siempre en brazos o con ayuda? Intenta acostarlo somnoliento pero despierto para que aprenda a enlazar ciclos de sueño solo. Descarta también molestias (dentición, mocos, calor o frío).`,
        alert: true
      };
    }
  },
  {
    id: "despertares-normales-bebe-pequeno",
    evaluate(ctx) {
      if (ctx.daysWithData < 2) return null;
      if (ctx.ageMonths === null || ctx.ageMonths >= 6) return null;
      if (ctx.avgWakings < 2) return null;
      return {
        title: "Los despertares son normales a esta edad",
        text: "Antes de los 6 meses despertarse varias veces por noche para comer es completamente normal y esperable. Responde a sus necesidades con calma y luz tenue; el sueño se irá consolidando con la madurez.",
        alert: false
      };
    }
  },
  {
    id: "pocas-siestas",
    evaluate(ctx) {
      if (!ctx.rec || ctx.daysWithData < 3) return null;
      if (ctx.ageMonths === null || ctx.ageMonths < 4 || ctx.ageMonths > 15) return null;
      if (ctx.avgNaps >= 1.5) return null;
      return {
        title: "Pocas siestas registradas",
        text: `${ctx.rec.naps} Si tu bebé apenas duerme de día, puede llegar sobrecansado a la noche y dormir peor. Ofrécele la siesta en un lugar tranquilo y oscuro tras 2–3 horas despierto.`,
        alert: false
      };
    }
  },
  {
    id: "perfil-incompleto",
    evaluate(ctx) {
      if (ctx.ageMonths !== null) return null;
      return {
        title: "Completa el perfil de tu bebé",
        text: "Añade la fecha de nacimiento en la pestaña Perfil para recibir recomendaciones ajustadas a su edad.",
        alert: false
      };
    }
  }
];

function getRecommendationForAge(ageMonths) {
  if (ageMonths === null || ageMonths === undefined || ageMonths < 0) return null;
  for (const rec of SLEEP_RECOMMENDATIONS) {
    if (ageMonths <= rec.maxMonths) return rec;
  }
  return SLEEP_RECOMMENDATIONS[SLEEP_RECOMMENDATIONS.length - 1];
}
