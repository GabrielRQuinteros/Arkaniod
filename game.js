// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------
const CANVAS_W = 800, CANVAS_H = 600;
const COLS = 10, ROWS = 6;
const BLOCK_W = 64, BLOCK_H = 32;       // sprite 32×16 escalado ×2
const GRID_X = 80, GRID_Y = 60;         // grilla centrada: 10×64 = 640
const ROW_COLORS = ['red', 'yellow', 'cyan', 'magenta', 'hotpink', 'green'];
const POINTS_PER_BLOCK = 10;
const BALL_SPEED_START = 5, BALL_SPEED_STEP = 0.1, BALL_SPEED_MAX = 9;
const MAX_BOUNCE_ANGLE = 60;            // grados respecto a la vertical
const PADDLE_KEY_SPEED = 8;
const START_LIVES = 3;
const SCORES_KEY = 'arkanoid:highscores:v1';
const MAX_SCORES = 5;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// ---------------------------------------------------------------------------
// Estado global
// ---------------------------------------------------------------------------
const state = {
  screen: 'menu',      // 'menu' | 'scores' | 'ready' | 'playing' | 'paused' | 'gameover' | 'victory'
  score: 0,
  lives: START_LIVES,
  menuIndex: 0,        // opción resaltada (menú de inicio o de pausa)
  paddle: { x: 340, y: 560, w: 120, h: 14 },
  ball: { x: 0, y: 0, r: 8, vx: 0, vy: 0, speed: BALL_SPEED_START, stuck: true },
  blocks: [],          // { x, y, w, h, color, alive }
  explosions: [],      // { block, startedAt }
  lastResult: null,    // 'victory' | 'gameover' en pantalla final
};

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------
const sounds = {
  bounce: new Audio('assets/sounds/ball-bounce.mp3'),
  brk: new Audio('assets/sounds/break-sound.mp3'),
};

function playSound(name) {
  try {
    const s = sounds[name];
    s.currentTime = 0;               // reinicio para solapar sonidos
    const p = s.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* ignorado */ }
}

// ---------------------------------------------------------------------------
// Ranking (localStorage con fallback en memoria)
// ---------------------------------------------------------------------------
let memoryScores = [];

function loadScores() {
  let raw = null;
  try {
    raw = localStorage.getItem(SCORES_KEY);
  } catch (e) {
    return memoryScores.slice();
  }
  if (raw === null) return memoryScores.slice();
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter((s) => s && typeof s.score === 'number' && typeof s.date === 'string')
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SCORES);
  } catch (e) {
    return [];                       // JSON inválido: se descarta
  }
}

function todayString() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + mm + '-' + dd;
}

function saveScore(score) {
  if (!(score > 0)) return;          // un puntaje de 0 no entra
  const list = loadScores();
  list.push({ score: score, date: todayString() });
  list.sort((a, b) => b.score - a.score);   // sort estable: empates conservan el orden previo
  const top = list.slice(0, MAX_SCORES);
  memoryScores = top;
  try {
    localStorage.setItem(SCORES_KEY, JSON.stringify(top));
  } catch (e) { /* queda el fallback en memoria */ }
}

function drawScoresTable(x, y) {
  const list = loadScores();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffd24a';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('MEJORES PUNTAJES', x, y);
  ctx.font = '18px monospace';
  if (list.length === 0) {
    ctx.fillStyle = '#888';
    ctx.fillText('Sin puntajes aun', x, y + 40);
    return;
  }
  list.forEach((s, i) => {
    ctx.fillStyle = '#fff';
    const line = (i + 1) + '. ' + String(s.score).padStart(5, ' ') + '  ' + s.date;
    ctx.fillText(line, x, y + 40 + i * 30);
  });
}

// ---------------------------------------------------------------------------
// Partida
// ---------------------------------------------------------------------------
function createBlocks() {
  const blocks = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      blocks.push({
        x: GRID_X + c * BLOCK_W,
        y: GRID_Y + r * BLOCK_H,
        w: BLOCK_W,
        h: BLOCK_H,
        color: ROW_COLORS[r],
        alive: true,
      });
    }
  }
  return blocks;
}

function startGame() {
  state.score = 0;
  state.lives = START_LIVES;
  state.blocks = createBlocks();
  state.explosions = [];
  state.lastResult = null;
  state.ball.speed = BALL_SPEED_START;
  state.paddle.x = (CANVAS_W - state.paddle.w) / 2;
  stickBall();
  state.screen = 'ready';
}

function endGame(result) {
  state.lastResult = result;
  saveScore(state.score);
  state.screen = result;
}

function goToMenu() {
  state.screen = 'menu';
  state.menuIndex = 0;
}

function exitFromPause() {
  saveScore(state.score);
  goToMenu();
}

// ---------------------------------------------------------------------------
// Paleta
// ---------------------------------------------------------------------------
function clampPaddle() {
  const p = state.paddle;
  p.x = Math.max(0, Math.min(CANVAS_W - p.w, p.x));
}

function isPlaying() {
  return state.screen === 'ready' || state.screen === 'playing';
}

function updatePaddle() {
  const p = state.paddle;
  if (keys.ArrowLeft || keys.KeyA) p.x -= PADDLE_KEY_SPEED;
  if (keys.ArrowRight || keys.KeyD) p.x += PADDLE_KEY_SPEED;
  clampPaddle();
}

// ---------------------------------------------------------------------------
// Pelota
// ---------------------------------------------------------------------------
function stickBall() {
  const b = state.ball, p = state.paddle;
  b.stuck = true;
  b.vx = 0;
  b.vy = 0;
  b.x = p.x + p.w / 2;
  b.y = p.y - b.r;
}

function launchBall() {
  const b = state.ball;
  if (state.screen !== 'ready' || !b.stuck) return;
  b.stuck = false;
  const angle = (Math.random() < 0.5 ? -1 : 1) * 15 * Math.PI / 180;
  b.vx = b.speed * Math.sin(angle);
  b.vy = -b.speed * Math.cos(angle);
  state.screen = 'playing';
}

function setBallSpeed(speed) {
  const b = state.ball;
  const cur = Math.hypot(b.vx, b.vy);
  b.speed = speed;
  if (cur > 0) {
    b.vx = b.vx / cur * speed;
    b.vy = b.vy / cur * speed;
  }
}

function bounceOnPaddle() {
  const b = state.ball, p = state.paddle;
  if (b.vy <= 0) return;
  const hit = b.y + b.r >= p.y && b.y - b.r <= p.y + p.h &&
              b.x + b.r >= p.x && b.x - b.r <= p.x + p.w;
  if (!hit) return;
  let offset = (b.x - (p.x + p.w / 2)) / (p.w / 2);
  offset = Math.max(-1, Math.min(1, offset));
  const angle = offset * MAX_BOUNCE_ANGLE * Math.PI / 180;
  b.vx = b.speed * Math.sin(angle);
  b.vy = -b.speed * Math.cos(angle);
  b.y = p.y - b.r;
  playSound('bounce');
}

function collideBlocks() {
  const b = state.ball;
  for (const bl of state.blocks) {
    if (!bl.alive) continue;
    const overlapX = Math.min(b.x + b.r - bl.x, bl.x + bl.w - (b.x - b.r));
    const overlapY = Math.min(b.y + b.r - bl.y, bl.y + bl.h - (b.y - b.r));
    if (overlapX <= 0 || overlapY <= 0) continue;

    // Invierte el eje de menor penetración
    if (overlapX < overlapY) {
      if (b.x < bl.x + bl.w / 2) { b.x -= overlapX; b.vx = -Math.abs(b.vx); }
      else { b.x += overlapX; b.vx = Math.abs(b.vx); }
    } else {
      if (b.y < bl.y + bl.h / 2) { b.y -= overlapY; b.vy = -Math.abs(b.vy); }
      else { b.y += overlapY; b.vy = Math.abs(b.vy); }
    }
    breakBlock(bl);
    return;                          // un bloque por frame
  }
}

function breakBlock(bl) {
  bl.alive = false;
  state.explosions.push({ block: bl, startedAt: performance.now() });
  state.score += POINTS_PER_BLOCK;
  setBallSpeed(Math.min(BALL_SPEED_MAX, state.ball.speed + BALL_SPEED_STEP));
  playSound('brk');
  if (state.blocks.every((x) => !x.alive)) endGame('victory');
}

function loseLife() {
  state.lives -= 1;
  if (state.lives <= 0) {
    endGame('gameover');
  } else {
    stickBall();
    state.screen = 'ready';
  }
}

function updateBall() {
  const b = state.ball;
  if (b.stuck) {
    stickBall();
    return;
  }
  b.x += b.vx;
  b.y += b.vy;

  // Paredes y techo
  if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx); playSound('bounce'); }
  if (b.x + b.r > CANVAS_W) { b.x = CANVAS_W - b.r; b.vx = -Math.abs(b.vx); playSound('bounce'); }
  if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy); playSound('bounce'); }

  bounceOnPaddle();
  collideBlocks();
  if (state.screen !== 'playing') return;   // la colisión pudo terminar la partida

  // Cae por abajo
  if (b.y - b.r > CANVAS_H) loseLife();
}

// ---------------------------------------------------------------------------
// Menús
// ---------------------------------------------------------------------------
const MENU_ITEM_W = 280, MENU_ITEM_H = 44, MENU_ITEM_GAP = 60;

function getMenu() {
  if (state.screen === 'menu') {
    return {
      cx: CANVAS_W / 2, top: 300,
      items: [
        { label: 'Nueva partida', action: startGame },
        { label: 'Mejores puntajes', action: () => { state.screen = 'scores'; } },
      ],
    };
  }
  if (state.screen === 'paused') {
    return {
      cx: 260, top: 260,
      items: [
        { label: 'Reanudar', action: () => { state.screen = 'playing'; } },
        { label: 'Salir', action: exitFromPause },
      ],
    };
  }
  return null;
}

function menuItemRect(menu, i) {
  return {
    x: menu.cx - MENU_ITEM_W / 2,
    y: menu.top + i * MENU_ITEM_GAP,
    w: MENU_ITEM_W,
    h: MENU_ITEM_H,
  };
}

function menuIndexAt(mx, my) {
  const menu = getMenu();
  if (!menu) return -1;
  for (let i = 0; i < menu.items.length; i++) {
    const r = menuItemRect(menu, i);
    if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) return i;
  }
  return -1;
}

function activateMenuItem(i) {
  const menu = getMenu();
  if (!menu || !menu.items[i]) return;
  state.menuIndex = 0;
  menu.items[i].action();
}

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------
const keys = {};

function mousePos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (CANVAS_W / rect.width),
    y: (e.clientY - rect.top) * (CANVAS_H / rect.height),
  };
}

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.repeat) return;

  const menu = getMenu();
  if (menu) {
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      e.preventDefault();
      const n = menu.items.length;
      state.menuIndex = (state.menuIndex + (e.code === 'ArrowDown' ? 1 : n - 1)) % n;
      return;
    }
    if (e.code === 'Enter') {
      activateMenuItem(state.menuIndex);
      return;
    }
  }

  switch (state.screen) {
    case 'ready':
      if (e.code === 'Space') { e.preventDefault(); launchBall(); }
      break;
    case 'playing':
      if (e.code === 'KeyP' || e.code === 'Escape') { state.screen = 'paused'; state.menuIndex = 0; }
      break;
    case 'paused':
      if (e.code === 'KeyP' || e.code === 'Escape') state.screen = 'playing';
      break;
    case 'scores':
      if (e.code === 'Escape') goToMenu();
      break;
    case 'gameover':
    case 'victory':
      if (e.code === 'Enter') goToMenu();
      break;
  }
});

window.addEventListener('keyup', (e) => { keys[e.code] = false; });

canvas.addEventListener('mousemove', (e) => {
  const pos = mousePos(e);
  if (isPlaying()) {
    state.paddle.x = pos.x - state.paddle.w / 2;
    clampPaddle();
  } else {
    const i = menuIndexAt(pos.x, pos.y);
    if (i >= 0) state.menuIndex = i;
  }
});

canvas.addEventListener('mousedown', (e) => {
  const pos = mousePos(e);
  switch (state.screen) {
    case 'ready':
      launchBall();
      break;
    case 'menu':
    case 'paused': {
      const i = menuIndexAt(pos.x, pos.y);
      if (i >= 0) activateMenuItem(i);
      break;
    }
    case 'scores':
      goToMenu();
      break;
  }
});

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------
function update() {
  if (isPlaying()) {
    updatePaddle();
    updateBall();
  }
  // Explosiones terminadas
  const now = performance.now();
  state.explosions = state.explosions.filter((x) => now - x.startedAt < EXPLOSION_DURATION);
}

// ---------------------------------------------------------------------------
// Dibujo
// ---------------------------------------------------------------------------
function drawBackground() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

function drawBlocks() {
  for (const bl of state.blocks) {
    if (bl.alive) drawSprite(ctx, 'block_' + bl.color, bl.x, bl.y, bl.w, bl.h);
  }
}

function drawExplosions() {
  const now = performance.now();
  for (const ex of state.explosions) {
    const frames = EXPLOSION_FRAMES[ex.block.color];
    const t = now - ex.startedAt;
    const idx = Math.min(frames.length - 1, Math.floor(t / (EXPLOSION_DURATION / frames.length)));
    drawFrame(ctx, frames[idx], ex.block.x, ex.block.y, ex.block.w, ex.block.h);
  }
}

function drawPaddle() {
  const p = state.paddle;
  drawSprite(ctx, 'paddle', p.x, p.y, p.w, p.h);
}

function drawBall() {
  const b = state.ball;
  drawSprite(ctx, 'ball', b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
}

function drawHud() {
  ctx.font = 'bold 20px monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.fillText('PUNTAJE: ' + state.score, 20, 32);
  ctx.textAlign = 'right';
  ctx.fillText('VIDAS: ' + state.lives, CANVAS_W - 20, 32);
}

function drawScene() {
  drawBlocks();
  drawExplosions();
  drawPaddle();
  drawBall();
  drawHud();
}

function drawCenteredText(text, y, font, color) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, CANVAS_W / 2, y);
}

function drawOverlay(alpha) {
  ctx.fillStyle = 'rgba(0, 0, 0, ' + alpha + ')';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

function drawMenu(menu) {
  menu.items.forEach((item, i) => {
    const r = menuItemRect(menu, i);
    const selected = i === state.menuIndex;
    ctx.fillStyle = selected ? '#2a2a55' : '#151515';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = selected ? '#ffd24a' : '#444';
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = selected ? '#ffd24a' : '#ddd';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.label, menu.cx, r.y + r.h / 2);
  });
}

function draw() {
  drawBackground();
  switch (state.screen) {
    case 'menu':
      drawCenteredText('ARKANOID', 160, 'bold 72px monospace', '#ffd24a');
      drawMenu(getMenu());
      drawCenteredText('Flechas + Enter o mouse', 520, '16px monospace', '#777');
      break;
    case 'scores':
      drawScoresTable(250, 200);
      drawCenteredText('Esc o clic para volver', 520, '16px monospace', '#777');
      break;
    case 'ready':
      drawScene();
      drawCenteredText('Espacio o clic para lanzar', 400, 'bold 22px monospace', '#fff');
      break;
    case 'playing':
      drawScene();
      break;
    case 'paused':
      drawScene();
      drawOverlay(0.7);
      drawCenteredText('PAUSA', 160, 'bold 48px monospace', '#ffd24a');
      drawMenu(getMenu());
      drawScoresTable(500, 240);
      break;
    case 'gameover':
    case 'victory':
      drawScene();
      drawOverlay(0.75);
      drawCenteredText(state.screen === 'victory' ? 'VICTORIA' : 'GAME OVER', 230, 'bold 64px monospace',
        state.screen === 'victory' ? '#7CFC00' : '#ff5555');
      drawCenteredText('Puntaje: ' + state.score, 320, 'bold 28px monospace', '#fff');
      drawCenteredText('Enter para volver al menu', 400, '18px monospace', '#aaa');
      break;
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

// El loop arranca solo cuando el spritesheet está cargado.
loadSpritesheet(() => {
  requestAnimationFrame(loop);
});
