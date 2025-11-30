// js/main.js
import { LEVELS, TILE_SIZE, findPlayerStart, isBlocked, findQuestionAt } from "./levels.js";
import { loadSave, saveProgress } from "./storage.js";

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

// UI prvky
const hudLevel = document.getElementById("hud-level");
const hudProgress = document.getElementById("hud-progress");
const overlay = document.getElementById("overlay");
const overlayQuestion = document.getElementById("overlay-question");
const overlayAnswer = document.getElementById("overlay-answer");
const overlayConfirm = document.getElementById("overlay-confirm");
const overlayCancel = document.getElementById("overlay-cancel");

// Rozměry herního světa (v tilech) – z levelu
let currentLevelIndex = 0;
let level = LEVELS[currentLevelIndex];

// Player
let player = {
  x: 0,
  y: 0,
};

// Kamera – kolik tileů je vidět
const VIEW_TILES_W = 12; // šířka
const VIEW_TILES_H = 18; // výška (víc na výšku, kvůli mobilu)

// Progres v levelu
let solvedCount = 0;
let totalNeeded = level.requiredSolved || 10;

// Tilesheet
const tilesetImg = new Image();
tilesetImg.src = "assets/tiles.png"; // uprav dle skutečné cesty

let keys = {
  up: false,
  down: false,
  left: false,
  right: false
};

let awaitingAnswer = null; // { levelId, questionId }

// Inicializace
init();

function init() {
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  initInput();
  loadLevelFromSaveOrDefault();
  requestAnimationFrame(gameLoop);

  overlayConfirm.addEventListener("click", onConfirmAnswer);
  overlayCancel.addEventListener("click", closeOverlay);
  overlayAnswer.addEventListener("keydown", (e) => {
    if (e.key === "Enter") onConfirmAnswer();
  });
}

function resizeCanvas() {
  // Udržíme poměr stran podle tile mřížky
  const desiredRatio = VIEW_TILES_W / VIEW_TILES_H;
  const w = canvas.parentElement.clientWidth;
  const h = canvas.parentElement.clientHeight;
  const realRatio = w / h;

  if (realRatio > desiredRatio) {
    // příliš široké, omezíme šířku
    canvas.height = h;
    canvas.width = h * desiredRatio;
  } else {
    canvas.width = w;
    canvas.height = w / desiredRatio;
  }
}

function initInput() {
  // Klávesnice
  window.addEventListener("keydown", (e) => {
    if (overlayIsOpen()) return;
    if (e.key === "ArrowUp" || e.key === "w") keys.up = true;
    if (e.key === "ArrowDown" || e.key === "s") keys.down = true;
    if (e.key === "ArrowLeft" || e.key === "a") keys.left = true;
    if (e.key === "ArrowRight" || e.key === "d") keys.right = true;
  });

  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowUp" || e.key === "w") keys.up = false;
    if (e.key === "ArrowDown" || e.key === "s") keys.down = false;
    if (e.key === "ArrowLeft" || e.key === "a") keys.left = false;
    if (e.key === "ArrowRight" || e.key === "d") keys.right = false;
  });

  // Dotykové ovládání
  document.querySelectorAll(".btn-dir").forEach(btn => {
    const dir = btn.dataset.dir;
    const setKey = (state) => {
      if (dir === "up") keys.up = state;
      if (dir === "down") keys.down = state;
      if (dir === "left") keys.left = state;
      if (dir === "right") keys.right = state;
    };

    btn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      setKey(true);
    });
    btn.addEventListener("touchend", (e) => {
      e.preventDefault();
      setKey(false);
    });
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      setKey(true);
    });
    btn.addEventListener("mouseup", (e) => {
      e.preventDefault();
      setKey(false);
    });
    btn.addEventListener("mouseleave", (e) => {
      e.preventDefault();
      setKey(false);
    });
  });
}

function loadLevelFromSaveOrDefault() {
  const save = loadSave();
  if (save) {
    const idx = LEVELS.findIndex(l => l.id === save.levelId);
    if (idx !== -1) {
      currentLevelIndex = idx;
      level = LEVELS[idx];
      solvedCount = save.solvedCount || 0;
    }
  }

  const start = findPlayerStart(level);
  player.x = start.x;
  player.y = start.y;
  totalNeeded = level.requiredSolved || 10;

  hudLevel.textContent = `Level ${currentLevelIndex + 1}: ${level.name}`;
  updateHud();
}

function saveCurrentProgress() {
  saveProgress({
    levelId: level.id,
    solvedCount
  });
}

// Herní smyčka
let lastTime = 0;
let moveCooldown = 0;

function gameLoop(timestamp) {
  const delta = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  update(delta);
  render();

  requestAnimationFrame(gameLoop);
}

function update(delta) {
  if (overlayIsOpen()) return;

  moveCooldown -= delta;
  if (moveCooldown <= 0) {
    const dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);

    if (dx !== 0 || dy !== 0) {
      const newX = player.x + dx;
      const newY = player.y + dy;
      if (!isBlocked(level, newX, newY)) {
        player.x = newX;
        player.y = newY;

        // Zkusíme, jestli tady není otázka
        const q = findQuestionAt(level, player.x, player.y);
        if (q) {
          openQuestion(q);
        }
      }
      moveCooldown = 0.12; // hráč se posune max ~8 tile/s
      saveCurrentProgress();
    }
  }
}

function render() {
  const tileW = canvas.width / VIEW_TILES_W;
  const tileH = canvas.height / VIEW_TILES_H;

  // Kamera – centrovat hráče
  let camX = player.x - VIEW_TILES_W / 2;
  let camY = player.y - VIEW_TILES_H / 2;

  camX = Math.max(0, Math.min(camX, level.width - VIEW_TILES_W));
  camY = Math.max(0, Math.min(camY, level.height - VIEW_TILES_H));

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // --- background layer ---
  for (let ty = 0; ty < VIEW_TILES_H; ty++) {
    for (let tx = 0; tx < VIEW_TILES_W; tx++) {
      const mapX = Math.floor(camX + tx);
      const mapY = Math.floor(camY + ty);

      if (mapX < 0 || mapY < 0 || mapX >= level.width || mapY >= level.height) continue;

      const char = level.backgroundMap[mapY][mapX];

      // PROTEĎ: jen barvy místo spritů, ať to vidíš
      let color = "#2e7d32"; // tráva
      if (char === "#") color = "#5d4037"; // cesta/hlína

      const px = tx * tileW;
      const py = ty * tileH;
      ctx.fillStyle = color;
      ctx.fillRect(px, py, tileW, tileH);
    }
  }

  // --- object layer ---
  for (let ty = 0; ty < VIEW_TILES_H; ty++) {
    for (let tx = 0; tx < VIEW_TILES_W; tx++) {
      const mapX = Math.floor(camX + tx);
      const mapY = Math.floor(camY + ty);
      if (mapX < 0 || mapY < 0 || mapX >= level.width || mapY >= level.height) continue;

      const obj = level.objectMap[mapY][mapX];
      if (obj === "." || obj === "S") continue;

      const px = tx * tileW;
      const py = ty * tileH;

      if (obj === "T") {
        ctx.fillStyle = "#1b5e20"; // strom placeholder
        ctx.fillRect(px + tileW * 0.1, py, tileW * 0.8, tileH);
      }
      if (obj === "Q") {
        ctx.fillStyle = "#ffeb3b"; // místo s otázkou
        ctx.beginPath();
        ctx.arc(px + tileW / 2, py + tileH / 2, Math.min(tileW, tileH) * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // --- player ---
  const playerScreenX = (player.x - camX) * tileW;
  const playerScreenY = (player.y - camY) * tileH;

  ctx.fillStyle = "#2196f3";
  ctx.fillRect(
    playerScreenX + tileW * 0.1,
    playerScreenY + tileH * 0.1,
    tileW * 0.8,
    tileH * 0.8
  );
}

function overlayIsOpen() {
  return !overlay.classList.contains("hidden");
}

function openQuestion(qDef) {
  awaitingAnswer = {
    levelId: level.id,
    questionId: qDef.id,
    def: qDef,
    // Vygenerujeme konkrétní příklad:
    ...generateExample(qDef)
  };
  const { a, b, op } = awaitingAnswer;
  overlayQuestion.textContent = `${a} ${op} ${b} = ?`;
  overlay.classList.remove("hidden");
  overlayAnswer.value = "";
  overlayAnswer.focus();
}

function closeOverlay() {
  overlay.classList.add("hidden");
  awaitingAnswer = null;
}

function generateExample(q) {
  const a = randomInt(q.aMin, q.aMax);
  const b = randomInt(q.bMin, q.bMax);
  let op = "+";
  let correct = a + b;
  if (q.type === "sub") {
    // aby nám nešlo do záporných čísel v 1.–2. třídě
    const bigger = Math.max(a, b);
    const smaller = Math.min(a, b);
    op = "-";
    return {
      a: bigger,
      b: smaller,
      op,
      correct: bigger - smaller
    };
  }
  return { a, b, op, correct };
}

function onConfirmAnswer() {
  if (!awaitingAnswer) return;
  const userVal = Number(overlayAnswer.value);
  if (Number.isNaN(userVal)) return;

  const { correct } = awaitingAnswer;
  if (userVal === correct) {
    solvedCount++;
    updateHud();
    saveCurrentProgress();
    // TADY později můžeme zobrazit krátkou pochvalu, zvuk, hvězdičky atd.
    closeOverlay();

    if (solvedCount >= totalNeeded) {
      // level hotový – zatím jen jednoduchá hláška
      alert("Skvěle! Level dokončen 🎉 (tady později přechod na další mapu)");
      // sem pak přidáme logiku pro přechod na next level
    }
  } else {
    // špatná odpověď – třeba jen info, žádný stres
    alert("Zkus to znovu 🙂");
  }
}

function updateHud() {
  hudProgress.textContent = `Příklady: ${solvedCount} / ${totalNeeded}`;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
