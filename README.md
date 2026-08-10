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

## 📱 Las apps nativas se compilan solas en GitHub

No hace falta instalar nada ni tener un Mac: **GitHub Actions compila las dos apps** con cada cambio en `main`, igual que despliega la web.

| Workflow | Qué hace | Dónde queda el resultado |
|---|---|---|
| `deploy-pages.yml` | Publica la web | https://jgarcianiet-web.github.io/app-bebe-sueno/ |
| `build-android.yml` | Compila el APK de Android | [Descarga directa](../../releases/tag/app-android) |
| `build-ios.yml` | Compila la app de iOS | Artefactos de la ejecución |

### 🤖 Android — instalación en un toque

Cada compilación publica el APK en la versión [**app-android**](../../releases/tag/app-android), que siempre apunta a la última.

1. Abre esa página **desde el móvil Android**.
2. Descarga `sueno-bebe.apk` y ábrelo.
3. Android pedirá permiso para instalar apps de esa procedencia: acéptalo.

Es una compilación de prueba firmada con la clave de depuración: perfecta para usarla en familia sin pasar por Google Play.

### 🍎 iOS — la limitación de Apple

El workflow compila la app y genera un `.ipa`, pero **Apple no permite instalar una app en un iPhone sin firmarla** con una cuenta de desarrollador. No es algo que GitHub pueda saltarse. Dos opciones:

- **Apple Developer Program** (~99 $/año): añade los secretos de abajo y el mismo workflow generará el `.ipa` firmado, listo para TestFlight y la App Store.
- **Sideloadly o AltStore** con un Apple ID gratuito: descargas el `.ipa` sin firmar de los artefactos y esas herramientas lo firman desde un ordenador e instalan en el iPhone, con renovación cada 7 días.

Mientras tanto, en el iPhone la versión web funciona con "Añadir a pantalla de inicio".

### 🔐 Publicar en las tiendas

Los workflows ya contemplan la firma: en cuanto el repositorio tenga los secretos configurados (**Settings → Secrets and variables → Actions**), pasan a generar también los archivos firmados. Sin ellos siguen funcionando igual, solo que sin la parte de firma.

**Google Play** (cuenta de desarrollador: pago único de ~25 $) — genera el almacén de claves una vez y guárdalo a buen recaudo, porque no se puede sustituir después:

```bash
keytool -genkey -v -keystore sueno-bebe.keystore -alias sueno-bebe \
  -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 sueno-bebe.keystore     # el resultado va en ANDROID_KEYSTORE_BASE64
```

| Secreto | Contenido |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | El almacén de claves en base64 |
| `ANDROID_KEYSTORE_PASSWORD` | Contraseña del almacén |
| `ANDROID_KEY_ALIAS` | `sueno-bebe` |
| `ANDROID_KEY_PASSWORD` | Contraseña de la clave |

Con eso, cada compilación genera además `sueno-bebe-play.aab` para subir a [Google Play Console](https://play.google.com/console).

**App Store** (Apple Developer Program: ~99 $/año):

| Secreto | Contenido |
|---|---|
| `APPLE_CERTIFICATE_BASE64` | Certificado de distribución (`.p12`) en base64 |
| `APPLE_CERTIFICATE_PASSWORD` | Contraseña del `.p12` |
| `APPLE_PROVISIONING_PROFILE_BASE64` | Perfil de aprovisionamiento en base64 |
| `APPLE_TEAM_ID` | Identificador del equipo de desarrollo |

### 💻 Compilar en local (opcional)

Si algún día quieres compilarlas tú, los proyectos nativos están en `android/` e `ios/`:

```bash
npm install
npm run android      # abre el proyecto en Android Studio
npm run ios          # abre el proyecto en Xcode (requiere Mac)
```

El código de la app vive en `www/`; tras cambiar algo, `npx cap sync` lo copia a los dos proyectos (los workflows ya lo hacen solos).

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
