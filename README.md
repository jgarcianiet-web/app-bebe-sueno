# 🎾 Pádel Match

App de pádel para **encontrar compañeros de tu nivel**, **completar partidos**, **organizar torneos** y **llevar el marcador** desde la pista.

Es una web app (PWA) en HTML, CSS y JavaScript puro, sin compilación, pensada para empaquetarse después como app nativa de iOS y Android con Capacitor.

## ✨ Funcionalidades

### Descubrir: compañeros tipo Tinder
- Tarjetas de jugadores que se **deslizan a la derecha (me gusta) o a la izquierda (paso)**. También funcionan los botones ✕/♥ y las flechas del teclado.
- **Afinidad del 0 al 100 %** con cada jugador, con los motivos a la vista: nivel parecido, misma zona, objetivos en común, horarios compatibles y posiciones que se complementan (drive + revés).
- **Objetivos de cada jugador:** amistosos, competitivos, torneos, ligas, federarse o entrenar. Puedes filtrar por cualquiera de ellos y también ver solo a los federados.
- Si los dos os dais "me gusta", **¡es un match!** Desde ahí puedes montar un partido con esa persona en un toque.

### Partidos
- **Crear un partido** con fecha, hora, club, zona, rango de nivel e invitaciones a tus matches.
- **Partidos abiertos** filtrados por zona y por tu nivel. Puedes elegir en qué hueco (pareja) te unes.
- **Avisos** del tipo *"Falta 1 jugador para el partido de mañana a las 19:00 en Club X"*, recordatorios y aviso para apuntar el resultado. Se ven en la campana y, si los activas, como notificación del sistema.
- **El resultado ajusta el nivel automáticamente** a los cuatro jugadores, con un sistema tipo Elo por parejas:
  - Ganar a una pareja de más nivel sube mucho.
  - Perder contra una de menos nivel baja mucho.
  - El margen de juegos también cuenta.
  - Los jugadores nuevos se ajustan más rápido durante sus primeros 10 partidos.
  - Los amistosos no cambian el nivel.

### Torneos
- **Americano:** las parejas rotan cada ronda y la clasificación es individual. Los cruces se generan solos, procurando no repetir compañero, y si hay jugadores de más descansan por turnos.
- **Liga:** todos contra todos por jornadas. La clasificación da 3 puntos por victoria y desempata por diferencia de sets y de juegos.
- **Eliminatoria:** cuadro con cabezas de serie. Las mejores parejas pasan directamente a la siguiente ronda si no hay parejas suficientes para llenar el cuadro. Se toca la pareja ganadora para que avance y se puede deshacer.

### Marcador
- Cuenta punto a punto: 15-30-40, juegos, **tie-break a 7 con 6-6**, a 1 o 3 sets.
- Tres modos para el 40-40:
  - **Punto de oro:** el siguiente punto decide el juego.
  - **Ventajas:** hay que ganar dos puntos seguidos.
  - **Star point:** se juegan hasta dos ventajas y, si se llega a iguales por tercera vez, un punto decisivo cierra el juego.
- Opción de jugar el set decisivo como **super tie-break a 10**.
- Indica quién saca, siguiendo las reglas del tie-break.
- Botón para deshacer.
- **Estadísticas:** puntos ganados, % de puntos ganados con el saque, roturas, puntos de oro y mejor racha.

### Perfil y diario
- Nivel actual con su categoría, gráfica de evolución, partidos, victorias y matches.
- **Diario de entrenamiento:** sesiones (partido, entrenamiento, clase o físico), minutos, sensación y golpes trabajados, con el resumen del mes.

## 🚀 Cómo probarla

```bash
npm run serve   # abre http://localhost:8765
npm test        # tests de la lógica (nivel, afinidad, marcador, torneos y avisos)
```

En `main`, la app se publica automáticamente en GitHub Pages: https://jgarcianiet-web.github.io/app-bebe-sueno/

## ☁️ Servidor (Supabase)

Las cuentas, los perfiles, los "me gusta", los matches, los partidos y los niveles viven en **Supabase**. Los torneos, el diario y el marcador se guardan, de momento, solo en el dispositivo.

La URL del proyecto y la clave *publishable* están en `www/js/config.js`. Esa clave es pública por diseño. **Nunca pongas ahí una clave `secret` o `service_role`.**

### Puesta en marcha (una sola vez)

1. **Crear las tablas:** en el panel de Supabase, abre **SQL Editor** → **New query**, pega el contenido de [`supabase/schema.sql`](supabase/schema.sql) y pulsa **Run**. Se puede volver a ejecutar sin perder datos.
2. **Direcciones de la app:** en **Authentication → URL Configuration**:
   - Pon como **Site URL** la dirección donde está publicada la app, por ejemplo `https://jgarcianiet-web.github.io/app-bebe-sueno/`.
   - Añade esa misma dirección en **Redirect URLs**.

   Así, el enlace del email de confirmación lleva a la app.

### Seguridad

- Todas las tablas tienen *Row Level Security*.
- Cada jugador solo edita su perfil y solo ve sus propios "me gusta". Nadie puede ver quién le ha dado "me gusta" sin que haya match.
- Crear partidos, apuntarse, salir, cancelar y apuntar resultados se hace mediante funciones del servidor, que comprueban las reglas: hueco libre, partido futuro, solo invitar a tus matches…
- **El nivel lo calcula el servidor** con la misma fórmula que `www/js/level.js`. Tras el primer partido, nadie puede cambiárselo a mano.

### Limitaciones conocidas

- Cualquiera de los cuatro jugadores puede apuntar el resultado, y no hace falta que los rivales lo confirmen.
- Los datos se actualizan cada minuto y al volver a la app (todavía no en tiempo real).
- Aún no hay recuperación de contraseña desde la app.

## 📁 Estructura

```
www/
  index.html, manifest.webmanifest, sw.js   PWA instalable y con funcionamiento sin conexión
  css/styles.css                             Estilos (modo claro y oscuro)
  js/app.js                                  Interfaz y navegación
  js/config.js                               URL y clave pública de Supabase
  js/remote.js                               Acceso al servidor: cuentas, perfiles, matches y partidos
  js/store.js                                Datos guardados en el dispositivo (torneos, diario…)
  js/level.js                                Nivel 1–7 y ajuste por resultado
  js/affinity.js                             Afinidad entre jugadores
  js/scoring.js                              Reglas del marcador
  js/tournaments.js                          Americano, liga y eliminatoria
  js/alerts.js                               Avisos de partidos
  vendor/supabase.js                         Librería de Supabase (incluida para funcionar sin CDN)
supabase/schema.sql                          Tablas, reglas de seguridad y funciones del servidor
tests/logic.test.js                          Tests de la lógica
```
