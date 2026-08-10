# 🌙 Sueño Bebé

App **nativa para iOS y Android** (y también web) para ayudar a madres y padres a **controlar el sueño de su bebé** y recibir **consejos personalizados** para mejorarlo.

Una única base de código en `www/` se ejecuta en los tres sitios: los proyectos nativos se generan con [Capacitor](https://capacitorjs.com) y aprovechan las capacidades del sistema (notificaciones programadas reales, hoja de compartir, barra de estado).

## ✨ Funcionalidades

- **Cronómetro de sueño**: registra siestas 😴 y sueño nocturno 🌙 en tiempo real, con contador de despertares nocturnos.
- **Registro manual**: añade sesiones de sueño pasadas indicando inicio, fin y despertares.
- **Resumen diario**: sueño total del día, número de siestas y despertares, con barra de progreso frente a las horas recomendadas para la edad del bebé.
- **Historial**: todas las sesiones agrupadas por día, con opción de eliminar registros.
- **Estadísticas**: gráfica de los últimos 7 días (sueño nocturno vs. siestas) y promedios semanales.
- **Consejos personalizados**: la app analiza los datos registrados (horas de sueño, despertares, siestas) y la edad del bebé para sugerir mejoras concretas.
- **Consejos generales**: buenas prácticas de higiene del sueño infantil (rutinas, ambiente, seguridad en la cuna…).
- **Perfil del bebé**: nombre y fecha de nacimiento para ajustar las recomendaciones por edad (0–3 meses, 4–6, 7–11, 12–24, 2–5 años).
- **Registro de tomas** 🍼: apunta cada toma (pecho, biberón o sólidos) con un toque; aparecen en el resumen del día y en el historial.
- **Cantidades de biberón** 🍼: al registrar un biberón se elige cuántos ml se ha tomado (cantidades rápidas o cantidad libre). La app suma el **total del día** y lo compara con la **cantidad diaria recomendada**, calculada automáticamente por peso antes de los 6 meses (~150 ml/kg/día) o por edad después, con la opción de fijar un objetivo manual indicado por el pediatra.
- **Recordatorio de rutina** ⏰: aviso diario a la hora elegida para empezar la rutina de sueño. En las apps nativas es una **notificación real del sistema**, que llega aunque la app esté cerrada y sobrevive al reinicio del móvil; en la web es un aviso dentro de la app.
- **Asistente de sueño** 🤖: un chat experto al que preguntarle en cualquier momento ("se despierta mucho", "¿cuánto debería dormir?", "solo se duerme en brazos"...). Responde según la edad del bebé y lo que está pasando ahora mismo (sesión en curso, registros de hoy, patrones de la semana), detecta señales de alarma que remite al pediatra, y funciona sin conexión y sin enviar datos a nadie.
- **Modo IA avanzado** ✨ (opcional): guardando tu propia clave de API de Anthropic en los ajustes del asistente, las respuestas las genera **Claude** con todo el contexto del bebé y memoria de la conversación. La clave se guarda solo en el dispositivo (nunca se sincroniza ni se exporta), las señales de alarma se siguen detectando localmente, y ante cualquier fallo el asistente vuelve automáticamente al modo básico gratuito.
- **Sincronización familiar** 👨‍👩‍👧: comparte los registros entre dos (o más) móviles. Uno crea el código familiar y comparte el enlace de invitación; a partir de ahí, lo que registre cualquiera de los dos se combina y aparece en ambos dispositivos (sincronización automática cada minuto y al hacer cambios).
- **Exportación de datos** en JSON y borrado completo.
- **PWA instalable**: funciona sin conexión y se puede añadir a la pantalla de inicio del móvil.

## 🔒 Privacidad

Por defecto, todos los datos se guardan **únicamente en el dispositivo** (localStorage del navegador) y no se envía nada a ningún servidor.

Si activas la **sincronización familiar**, la copia compartida se guarda en [jsonblob.com](https://jsonblob.com) (almacén JSON gratuito) protegida por un código aleatorio imposible de adivinar: solo quien tenga el enlace de invitación puede acceder. Los datos locales siguen siendo la copia principal — si el servicio no está disponible, la app funciona igualmente y se sincroniza cuando vuelva la conexión.

## 🚀 Cómo usarla

**En línea**: la app se despliega automáticamente en GitHub Pages con cada cambio en `main`:

👉 **https://jgarcianiet-web.github.io/app-bebe-sueno/**

Desde el móvil, abre esa dirección y usa "Añadir a pantalla de inicio" para instalarla como una app.

**En local**: la app web no necesita compilación. Es HTML, CSS y JavaScript puro:

```bash
npm run serve        # sirve www/ en http://localhost:8765
```

## 📱 Compilar las apps nativas

Los proyectos nativos (`android/` y `ios/`) ya están generados y versionados en el repositorio. El código de la app vive en `www/`: después de cambiar algo ahí, ejecuta `npx cap sync` para copiarlo a los dos proyectos.

```bash
npm install          # una sola vez
npx cap sync         # copia www/ a los proyectos nativos
```

### Android

Requiere [Android Studio](https://developer.android.com/studio) (Windows, Mac o Linux).

```bash
npm run android      # sincroniza y abre el proyecto en Android Studio
```

En Android Studio: **Run ▶** para instalarla en un móvil conectado o en el emulador. Para publicar en Google Play, genera un bundle firmado con **Build → Generate Signed Bundle / APK → Android App Bundle**, y súbelo en [Google Play Console](https://play.google.com/console) (cuenta de desarrollador: pago único de ~25 $).

### iOS

Requiere un **Mac** con [Xcode](https://developer.apple.com/xcode/) y CocoaPods (`sudo gem install cocoapods`).

```bash
npm run ios          # sincroniza y abre el proyecto en Xcode
```

En Xcode: selecciona tu equipo de desarrollo en **Signing & Capabilities** y pulsa **Run ▶**. Para publicar en la App Store, usa **Product → Archive → Distribute App** (se necesita el Apple Developer Program: ~99 $/año).

### Qué cambia en nativo

| | Web | App nativa |
|---|---|---|
| Instalación | "Añadir a pantalla de inicio" | Desde App Store / Google Play |
| Recordatorio de rutina | Solo con la app abierta | Notificación del sistema, aunque esté cerrada; se reprograma tras reiniciar el móvil |
| Funcionamiento sin conexión | Service worker (necesita recargar para actualizarse) | Archivos empaquetados en el dispositivo |
| Compartir invitación | Copiar enlace / API del navegador | Hoja de compartir nativa |
| Icono, splash y barra de estado | Icono web | Icono e inicio nativos, barra de estado integrada |

## 📁 Estructura

```
├── www/                          # LA APP (web + contenido de las apps nativas)
│   ├── index.html                #   Estructura (6 pestañas)
│   ├── css/styles.css            #   Estilos (modo claro y oscuro automático)
│   ├── js/app.js                 #   Lógica: cronómetro, tomas, estadísticas
│   ├── js/native.js              #   Puente con iOS/Android (Capacitor)
│   ├── js/assistant.js           #   Asistente de sueño (chat experto)
│   ├── js/ai.js                  #   Modo IA opcional (Claude vía API)
│   ├── js/sync.js                #   Sincronización familiar
│   ├── js/tips.js                #   Recomendaciones por edad, sueño y leche
│   ├── manifest.webmanifest      #   Manifiesto PWA
│   └── sw.js                     #   Service worker (solo web)
├── android/                      # Proyecto nativo de Android (Android Studio)
├── ios/                          # Proyecto nativo de iOS (Xcode)
├── assets/                       # Icono y splash de origen para regenerarlos
├── capacitor.config.json         # Configuración de las apps nativas
└── .github/workflows/            # Despliegue automático de la web
```

Para regenerar los iconos y pantallas de inicio tras cambiar `assets/icon.png`:

```bash
npx capacitor-assets generate --iconBackgroundColor '#5B6EE1' --splashBackgroundColor '#5B6EE1'
```

## ⚠️ Aviso

Las recomendaciones de horas de sueño y de cantidad de leche son orientativas (guías de la American Academy of Sleep Medicine, la AAP y la Asociación Española de Pediatría). Cada bebé regula su apetito y su sueño de forma distinta: esta app **no sustituye el consejo de un pediatra**.
