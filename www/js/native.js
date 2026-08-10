/**
 * Puente con las capacidades nativas (Capacitor).
 *
 * La app es la misma en web y en móvil: este módulo detecta si se está
 * ejecutando dentro de la app nativa de iOS/Android y, en ese caso, usa las
 * APIs del sistema (notificaciones programadas reales, hoja de compartir,
 * barra de estado). En el navegador cae a las APIs web equivalentes.
 *
 * No requiere ningún paso de compilación: en nativo, Capacitor expone los
 * plugins en window.Capacitor.Plugins.
 */

/** URL pública de la app — usada en los enlaces de invitación familiar.
 *  En nativo, location.origin es "capacitor://localhost", que no sirve para
 *  compartir, así que siempre se usa esta dirección. */
const APP_WEB_URL = "https://jgarcianiet-web.github.io/app-bebe-sueno/";

const REMINDER_NOTIFICATION_ID = 1001;

function isNative() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

function nativePlatform() {
  return (window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform()) || "web";
}

function plugin(name) {
  return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[name]) || null;
}

/* ---------- Notificaciones ---------- */

/**
 * Programa (o cancela) el recordatorio diario de la rutina de sueño.
 * En nativo es una notificación real del sistema: suena aunque la app esté
 * cerrada. En web se mantiene el aviso dentro de la app (app.js).
 */
async function scheduleRoutineReminder(enabled, time) {
  const LN = plugin("LocalNotifications");
  if (!isNative() || !LN) return false;

  try {
    await LN.cancel({ notifications: [{ id: REMINDER_NOTIFICATION_ID }] });
    if (!enabled) return true;

    const perm = await LN.requestPermissions();
    if (perm && perm.display !== "granted") return false;

    const [hour, minute] = (time || "20:00").split(":").map(Number);
    await LN.schedule({
      notifications: [
        {
          id: REMINDER_NOTIFICATION_ID,
          title: "🌙 Hora de la rutina de sueño",
          body: "Baño, pijama, cuento y luz tenue: toca preparar a tu bebé para dormir.",
          schedule: { on: { hour, minute }, allowWhileIdle: true },
          smallIcon: "ic_stat_icon"
        }
      ]
    });
    return true;
  } catch (e) {
    console.warn("No se pudo programar la notificación nativa", e);
    return false;
  }
}

/* ---------- Compartir ---------- */

/** Comparte texto + enlace con la hoja nativa; devuelve true si se compartió. */
async function nativeShare(title, text, url) {
  const Share = plugin("Share");
  if (isNative() && Share) {
    try {
      await Share.share({ title, text, url, dialogTitle: title });
      return true;
    } catch (e) {
      // El usuario canceló la hoja de compartir: no es un error
      return true;
    }
  }
  return false;
}

/* ---------- Arranque de la app nativa ---------- */

function initNativeShell(onResume) {
  if (!isNative()) return;

  document.body.classList.add("native", `native-${nativePlatform()}`);

  const StatusBar = plugin("StatusBar");
  if (StatusBar) {
    // Texto claro sobre la cabecera degradada
    StatusBar.setStyle({ style: "DARK" }).catch(() => {});
    if (nativePlatform() === "android") {
      StatusBar.setBackgroundColor({ color: "#5B6EE1" }).catch(() => {});
    }
  }

  const SplashScreen = plugin("SplashScreen");
  if (SplashScreen) {
    setTimeout(() => SplashScreen.hide().catch(() => {}), 200);
  }

  const App = plugin("App");
  if (App && typeof onResume === "function") {
    App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) onResume();
    });
  }
}
