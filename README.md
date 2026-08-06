# 🌙 Sueño Bebé

Aplicación web para ayudar a madres y padres a **controlar el sueño de su bebé** y recibir **consejos personalizados** para mejorarlo.

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
- **Recordatorio de rutina** ⏰: aviso a la hora elegida para empezar la rutina de sueño (con notificación del navegador si se concede permiso; funciona mientras la app está abierta).
- **Exportación de datos** en JSON y borrado completo.
- **PWA instalable**: funciona sin conexión y se puede añadir a la pantalla de inicio del móvil.

## 🔒 Privacidad

Todos los datos se guardan **únicamente en el dispositivo** (localStorage del navegador). No se envía nada a ningún servidor.

## 🚀 Cómo usarla

**En línea**: la app se despliega automáticamente en GitHub Pages con cada cambio en `main`:

👉 **https://jgarcianiet-web.github.io/app-bebe-sueno/**

Desde el móvil, abre esa dirección y usa "Añadir a pantalla de inicio" para instalarla como una app.

**En local**: no necesita instalación ni dependencias. Es HTML, CSS y JavaScript puro:

```bash
# Opción 1: abrir directamente
open index.html

# Opción 2: servir en local
python3 -m http.server 8000
# y abrir http://localhost:8000
```

## 📁 Estructura

```
├── .github/workflows/deploy-pages.yml  # Despliegue automático en GitHub Pages
├── index.html            # Estructura de la app (5 pestañas)
├── css/styles.css        # Estilos (modo claro y oscuro automático)
├── js/app.js             # Lógica: cronómetro, registros, estadísticas
├── js/tips.js            # Recomendaciones por edad y motor de consejos
├── manifest.webmanifest  # Manifiesto PWA
├── sw.js                 # Service worker (uso sin conexión)
└── icons/icon.svg        # Icono de la app
```

## ⚠️ Aviso

Las recomendaciones de horas de sueño son orientativas (basadas en las guías de la American Academy of Sleep Medicine). Esta app **no sustituye el consejo de un pediatra**.
