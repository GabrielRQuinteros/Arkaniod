# SPEC 01 — MVP jugable de Arkanoid

> **Status:** Approved
> **Depends on:** —
> **Date:** 2026-11-09
> **Objective:** Un Arkanoid jugable en canvas 800×600 con menú de inicio, un nivel de 10×6 bloques, 3 vidas, puntaje, pausa y tabla local de los 5 mejores puntajes.

## Scope

**In:**

- `index.html` en la raíz con `<canvas width="800" height="600">`, y `game.js` (scripts planos, sin módulos) junto a `assets/spritesheet.js`.
- Máquina de estados: `menu`, `scores`, `ready`, `playing`, `paused`, `gameover`, `victory`.
- Menú de inicio con opciones **Nueva partida** y **Mejores puntajes** (tabla top 5).
- Nivel único: grilla 10 columnas × 6 filas, bloques de 1 golpe, filas por color, animación `EXPLOSION_FRAMES` al romperse.
- Paleta (mouse + teclado), pelota con rebote por ángulo según punto de impacto, velocidad creciente.
- 3 vidas, puntaje, HUD (puntaje y vidas).
- Menú de pausa (P/Esc) con **Reanudar** y **Salir**, y tabla top 5 en el lateral derecho.
- Pantalla final (VICTORIA / GAME OVER) con puntaje; Enter vuelve al menú.
- Persistencia del top 5 (puntaje + fecha) en `localStorage`.
- SFX: `ball-bounce.mp3` (paleta y paredes), `break-sound.mp3` (bloque roto).
- Navegación de menús con teclado (↑/↓ + Enter) y mouse (hover + clic).

**Out of scope (for future specs):**

- Varios niveles o progresión.
- Bloques gray (2 golpes) y power-ups.
- Ingreso de nombre o iniciales en el ranking.
- Música de fondo, ajustes de volumen, mute.
- Controles táctiles / versión móvil.
- Sistema de build, bundler, tests automatizados, linter.

## Data model

```js
// Estado global (game.js)
const state = {
  screen: 'menu',      // 'menu' | 'scores' | 'ready' | 'playing' | 'paused' | 'gameover' | 'victory'
  score: 0,
  lives: 3,
  menuIndex: 0,        // opción resaltada (menú de inicio o de pausa)
  paddle: { x: 340, y: 560, w: 120, h: 14 },
  ball:   { x: 0, y: 0, r: 8, vx: 0, vy: 0, speed: 5, stuck: true },
  blocks: [],          // { x, y, w, h, color, alive, explodeT } ; w=64, h=32
  explosions: [],      // bloques en animación: { block, startedAt }
  lastResult: null,    // 'victory' | 'gameover' en pantalla final
};

// Constantes
const CANVAS_W = 800, CANVAS_H = 600;
const COLS = 10, ROWS = 6;
const BLOCK_W = 64, BLOCK_H = 32;       // sprite 32×16 escalado ×2
const GRID_X = 80, GRID_Y = 60;         // grilla centrada: 10×64 = 640
const ROW_COLORS = ['red', 'yellow', 'cyan', 'magenta', 'hotpink', 'green'];
const POINTS_PER_BLOCK = 10;
const BALL_SPEED_START = 5, BALL_SPEED_STEP = 0.1, BALL_SPEED_MAX = 9;
const MAX_BOUNCE_ANGLE = 60;            // grados respecto a la vertical
const PADDLE_KEY_SPEED = 8;

// Persistencia
// localStorage key: 'arkanoid:highscores:v1'
// valor: JSON string de [{ score: number, date: 'YYYY-MM-DD' }], orden descendente, máx. 5.
```

Convenciones:

- Origen arriba-izquierda; velocidades en píxeles/frame (loop con `requestAnimationFrame`).
- El loop arranca dentro del callback de `loadSpritesheet`.
- Un puntaje de 0 no entra al ranking.

## Implementation plan

1. Crear `index.html` (canvas 800×600, carga `assets/spritesheet.js` y `game.js`) y `game.js` con `loadSpritesheet`, loop y fondo. Prueba: abrir el HTML, ver canvas sin errores en consola.
2. Añadir paleta con sprite `paddle`, movimiento por mouse y por flechas/A-D, limitada a los bordes. Prueba: la paleta sigue al mouse y al teclado.
3. Añadir pelota pegada a la paleta, lanzamiento con Espacio/clic, rebote en paredes y techo. Prueba: la pelota rebota y cae.
4. Rebote en paleta con ángulo según punto de impacto (`MAX_BOUNCE_ANGLE`). Prueba: impactar en el borde izquierdo desvía a la izquierda.
5. Generar la grilla 10×6 con sprites `block_<color>` y colisión pelota-bloque (invierte `vx`/`vy` según eje de menor penetración). El bloque desaparece. Prueba: la pelota rompe bloques.
6. Puntaje (+10) y aumento de velocidad por bloque roto hasta `BALL_SPEED_MAX`; HUD con puntaje y vidas. Prueba: el puntaje sube y la pelota acelera.
7. Animación de explosión con `drawFrame` y `EXPLOSION_DURATION` por bloque roto. Prueba: se ve la animación de 4 frames en ~150 ms.
8. Vidas: al caer la pelota resta 1 y reaparece pegada a la paleta; con 0 vidas pasa a `gameover`. Con todos los bloques rotos pasa a `victory`. Pantalla final con puntaje; Enter vuelve a `menu`.
9. Audio: reproducir `ball-bounce.mp3` en rebotes de paleta/paredes/techo y `break-sound.mp3` al romper bloque (reinicio del `currentTime` para solapar sonidos). Prueba: suenan en el evento correcto.
10. Módulo de ranking en `game.js`: `loadScores()`, `saveScore(score)`, `drawScoresTable(x, y)` con `localStorage` clave `arkanoid:highscores:v1`, con try/catch y fallback en memoria. Prueba: llamar `saveScore` desde consola y recargar.
11. Menú de inicio (Nueva partida, Mejores puntajes) con navegación teclado + mouse; pantalla `scores` con tabla top 5 y Esc/clic para volver. Prueba: ambas opciones funcionan.
12. Menú de pausa (P/Esc): Reanudar y Salir, con tabla top 5 en el lateral derecho. Salir guarda el puntaje actual en el ranking y vuelve a `menu`. Guardar también el puntaje al entrar en `gameover`/`victory`. Prueba: flujo completo menú → partida → pausa → salir → ver puntaje en la tabla.

## Acceptance criteria

- [ ] Abrir `index.html` desde la raíz del proyecto carga sin errores en la consola.
- [ ] El canvas mide exactamente 800×600 px.
- [ ] Al cargar se muestra el menú de inicio con las opciones **Nueva partida** y **Mejores puntajes**.
- [ ] Las opciones de los menús se pueden elegir con ↑/↓ + Enter y con clic del mouse.
- [ ] **Mejores puntajes** muestra una tabla con un máximo de 5 entradas (puntaje + fecha), de mayor a menor; vacía si no hay datos.
- [ ] **Nueva partida** muestra la grilla de 60 bloques (10×6) con una fila por color, en el orden de `ROW_COLORS`.
- [ ] La paleta se mueve con el mouse y con flechas/A-D, y no sale del canvas.
- [ ] La pelota empieza pegada a la paleta y se lanza con Espacio o clic.
- [ ] La pelota rebota en paredes, techo, paleta y bloques.
- [ ] Impactar en el extremo izquierdo/derecho de la paleta desvía la pelota hacia ese lado; en el centro sale casi vertical.
- [ ] Romper un bloque suma exactamente 10 puntos y reproduce `break-sound.mp3`.
- [ ] Los rebotes en paleta y paredes reproducen `ball-bounce.mp3`.
- [ ] Cada bloque roto muestra la animación de explosión de su color antes de desaparecer.
- [ ] La velocidad de la pelota aumenta 0.1 por bloque roto y nunca supera 9.
- [ ] Dejar caer la pelota resta 1 vida y la pelota reaparece pegada a la paleta.
- [ ] Con 0 vidas aparece GAME OVER con el puntaje; al romper los 60 bloques aparece VICTORIA con el puntaje.
- [ ] En la pantalla final, Enter vuelve al menú de inicio.
- [ ] P o Esc durante `playing` congela el juego y muestra el menú de pausa con **Reanudar**, **Salir** y la tabla top 5 en el lateral derecho.
- [ ] Reanudar continúa la partida con el mismo estado; P/Esc también reanuda.
- [ ] **Salir** guarda el puntaje actual (si es > 0 y entra en el top 5) y vuelve al menú de inicio.
- [ ] Al terminar por victoria o game over el puntaje se guarda en el top 5 si corresponde.
- [ ] Recargar la página conserva el top 5.
- [ ] Con `localStorage` bloqueado el juego sigue funcionando sin errores.

## Decisions

- **Yes:** Arkanoid con los assets existentes (el "Arcane" del pedido se confirmó como Arkanoid).
- **Yes:** `index.html` + `game.js` planos en la raíz. Coinciden con el patrón sin módulos de `assets/spritesheet.js` y funcionan abriendo el HTML.
- **No:** varios archivos `.js` o módulos ES. Excesivo para un MVP y los módulos fallan con `file://`.
- **Yes:** un solo nivel fijo de 10×6 con bloques de 1 golpe. Mantiene el MVP pequeño; bloques gray y niveles quedan para otra spec.
- **Yes:** rebote por ángulo de impacto y velocidad creciente. Decisión del usuario, da control y dificultad.
- **Yes:** ranking `{ score, date }` sin nombre, en `localStorage` con clave versionada `arkanoid:highscores:v1`. Sin pantalla de ingreso de nombre, más simple; la versión permite migrar luego.
- **No:** IndexedDB o archivo JSON. Excesivo para 5 números.
- **Yes:** guardar puntaje al terminar y al salir desde pausa, para no perderlo.
- **Yes:** navegación con teclado y mouse en todos los menús.
- **Yes:** valores numéricos (+10 por bloque, paso de velocidad 0.1, máximo 9, paleta 120×14, ángulo máximo 60°, bloques ×2) fijados en esta spec como punto de partida; ajustables en revisión antes de aprobar.
- **Yes:** pausa con P y Esc; la pausa muestra el top 5 a la derecha por pedido del usuario.

## Risks

| Risk | Mitigation |
| --- | --- |
| `localStorage` deshabilitado o corrupto | try/catch en lectura/escritura; fallback a objeto en memoria; JSON inválido se descarta y se reconstruye vacío. |
| Autoplay de audio bloqueado por el navegador | Los sonidos solo se reproducen tras una interacción del usuario (clic/tecla en el menú). Fallos de `play()` se ignoran. |
| Pelota atraviesa bloques o paleta a alta velocidad (túnel) | Velocidad máxima 9 px/frame, menor que `BLOCK_H` y `paddle.h`. |
| Spritesheet no carga (HTML abierto desde otra carpeta) | El loop arranca solo en el callback de `loadSpritesheet`; el error ya se registra en consola. |
| `EXPLOSION_FRAMES.gray` es un placeholder | No se usa: no hay bloques gray en este MVP. |

## What is **not** in this spec

- Más de un nivel.
- Bloques gray, power-ups o cualquier tipo de bloque especial.
- Nombre o iniciales en el ranking.
- Música, mute o ajustes de volumen.
- Controles táctiles / móvil.
- Tests automatizados, build o linter.

Cada uno, si se hace, va en su propia spec.
