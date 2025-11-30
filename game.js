// game.js

// -------------------------
// Konfigurace levelů
// -------------------------

// Značky v mapě:
// G = tráva (volný průchod)
// P = cesta (volný průchod)
// W = zeď / bariéra (nelze projít)
// S = start hráče
// Q = políčko s příkladem
// F = cílové políčko (konec levelu)

const LEVELS = [
  {
    id: "level1",
    name: "Lesní stezka",
    cols: 7,
    rows: 26,
    solvedNeeded: 5,
    layout: [
      "WWWWWWW",
      "WGGPGGW",
      "WGGPGGW",
      "WGGPGGW",
      "WGGPGGW",
      "WGGPGGW",
      "WGGPGGW",
      "WGGPGGW",
      "WGGPGGW",
      "WGGPGGW",
      "WGGPGGW",
      "WGGPGGW",
      "WGGPGGW",
      "WGGPGGW",
      "WGGPGGW",
      "WGGPGGW",
      "WGGPGGW",
      "WGGPGGW",
      "WGGPGGW",
      "WGGPGGW",
      "WGGPGGW",
      "WGGPGGW",
      "WGGPGGW",
      "WGGPGGW",
      "WGGPGGW",
      "WWWWWWW"
    ],
    // souřadnice příkladů (řádek, sloupec) – podle indexu v poli questions
    questionsPositions: [
      { row: 2, col: 3 },
      { row: 6, col: 3 },
      { row: 10, col: 3 },
      { row: 14, col: 3 },
      { row: 18, col: 3 }
    ],
    questions: [
      { text: "2 + 3 = ?", answer: 5 },
      { text: "9 - 4 = ?", answer: 5 },
      { text: "3 + 6 = ?", answer: 9 },
      { text: "8 - 5 = ?", answer: 3 },
      { text: "4 + 5 = ?", answer: 9 }
    ],
    start: { row: 20, col: 3 },
    finish: { row: 1, col: 3 } // nahoře
  }
];

// -------------------------
// Stav hry
// -------------------------

let currentLevelIndex = 0;
let player = { row: 0, col: 0 };
let solvedCount = 0;
let answeredQuestions = new Set();

let gameRoot;
let gridEl;
let hudLevelEl;
let hudTasksEl;

// Ukládání checkpointů (jen do localStorage – jednoduché)
const SAVE_KEY = "math-forest-save";

function saveProgress() {
  const data = {
    levelIndex: currentLevelIndex,
    solvedCount,
    answeredQuestions: Array.from(answeredQuestions)
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (typeof data.levelIndex === "number") {
      currentLevelIndex = Math.min(
        Math.max(data.levelIndex, 0),
        LEVELS.length - 1
      );
    }
    solvedCount = data.solvedCount || 0;
    answeredQuestions = new Set(data.answeredQuestions || []);
  } catch {
    // když se save rozbije, ignoruj
  }
}

// -------------------------
// Inicializace DOM
// -------------------------

function createBaseLayout() {
  gameRoot = document.getElementById("game-root");
  gameRoot.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.className = "game-wrapper";

  // HUD (fixně nahoře)
  const hud = document.createElement("div");
  hud.className = "game-hud";

  hudLevelEl = document.createElement("div");
  hudLevelEl.className = "hud-level";

  hudTasksEl = document.createElement("div");
  hudTasksEl.className = "hud-tasks";

  hud.appendChild(hudLevelEl);
  hud.appendChild(hudTasksEl);

  // Mřížka
  gridEl = document.createElement("div");
  gridEl.id = "game-grid";
  gridEl.className = "game-grid";

  wrapper.appendChild(hud);
  wrapper.appendChild(gridEl);

  gameRoot.appendChild(wrapper);
}

// -------------------------
// Vykreslení levelu
// -------------------------

function buildGrid(level) {
  gridEl.innerHTML = "";
  gridEl.style.setProperty("--cols", level.cols);

  const tiles = [];

  for (let r = 0; r < level.rows; r++) {
    tiles[r] = [];
    const rowStr = level.layout[r] || "";

    for (let c = 0; c < level.cols; c++) {
      const ch = rowStr[c] || "G";

      const tile = document.createElement("div");
      tile.classList.add("tile");

      switch (ch) {
        case "W":
          tile.dataset.type = "wall";
          tile.classList.add("tile-wall");
          break;
        case "P":
          tile.dataset.type = "path";
          tile.classList.add("tile-path");
          break;
        case "S":
          tile.dataset.type = "start";
          tile.classList.add("tile-path");
          break;
        case "F":
          tile.dataset.type = "finish";
          tile.classList.add("tile-path");
          break;
        default:
          tile.dataset.type = "ground";
          tile.classList.add("tile-ground");
      }

      tile.dataset.row = r;
      tile.dataset.col = c;

      tiles[r][c] = tile;
      gridEl.appendChild(tile);
    }
  }

  // označ otázkové dlaždice
  level.questionsPositions.forEach((pos, index) => {
    const t = tiles[pos.row][pos.col];
    if (!t) return;
    t.dataset.type = "question";
    t.dataset.qindex = index.toString();
    t.classList.remove("tile-ground", "tile-path");
    t.classList.add("tile-question");
  });

  // označ cílové políčko
  const finishTile = tiles[level.finish.row][level.finish.col];
  if (finishTile) {
    finishTile.dataset.type = "finish";
    finishTile.classList.add("tile-finish");
  }

  return tiles;
}

// -------------------------
// Herní logika
// -------------------------

let tiles = [];

function startLevel(index) {
  const level = LEVELS[index];

  hudLevelEl.textContent = `Level ${index + 1}: ${level.name}`;
  updateTasksHud(level);

  tiles = buildGrid(level);

  // nastavení hráče na start
  player.row = level.start.row;
  player.col = level.start.col;
  answeredQuestions = new Set(); // při novém levelu
  solvedCount = 0;

  updateTasksHud(level);
  renderPlayer();
  scrollToPlayer(true);
  saveProgress();
}

function updateTasksHud(level) {
  hudTasksEl.textContent = `Příklady: ${solvedCount} / ${level.solvedNeeded}`;
}

function renderPlayer() {
  // nejdřív odstraň hráče z předchozí pozice
  document
    .querySelectorAll(".tile-player")
    .forEach((el) => el.classList.remove("tile-player"));

  const tile = tiles[player.row]?.[player.col];
  if (tile) {
    tile.classList.add("tile-player");
  }
}

function tileType(row, col) {
  const t = tiles[row]?.[col];
  if (!t) return "wall";
  return t.dataset.type || "ground";
}

function handleMove(dx, dy) {
  const level = LEVELS[currentLevelIndex];

  const targetRow = player.row + dy;
  const targetCol = player.col + dx;

  // mimo mapu?
  if (
    targetRow < 0 ||
    targetRow >= level.rows ||
    targetCol < 0 ||
    targetCol >= level.cols
  ) {
    return;
  }

  const type = tileType(targetRow, targetCol);
  if (type === "wall") {
    return; // nelze projít
  }

  player.row = targetRow;
  player.col = targetCol;

  renderPlayer();
  scrollToPlayer(false);

  if (type === "question") {
    handleQuestion(level, targetRow, targetCol);
  } else if (type === "finish") {
    handleFinishLevel(level);
  }

  saveProgress();
}

function handleQuestion(level, row, col) {
  const tile = tiles[row][col];
  const qIndexStr = tile.dataset.qindex;
  if (qIndexStr == null) return;

  const qIndex = parseInt(qIndexStr, 10);
  const qKey = `${currentLevelIndex}:${qIndex}`;

  if (answeredQuestions.has(qKey)) {
    return; // už vyřešeno
  }

  const q = level.questions[qIndex];
  if (!q) return;

  const answerStr = window.prompt(q.text);
  if (answerStr == null) {
    return;
  }

  const answerNum = Number(answerStr.replace(",", "."));

  if (Number.isNaN(answerNum)) {
    alert("Tohle není číslo, zkus to znovu 🙂");
    return;
  }

  if (answerNum === q.answer) {
    answeredQuestions.add(qKey);
    solvedCount++;
    tile.classList.add("tile-question-solved");
    updateTasksHud(level);

    if (solvedCount >= level.solvedNeeded) {
      // otevři cestu k cíli – tady jen informačně
      alert("Skvěle! Máš splněné všechny příklady, dojdi k cíli.");
    }
  } else {
    alert("Ještě to není ono, zkus jinou odpověď.");
  }
}

function handleFinishLevel(level) {
  if (solvedCount < level.solvedNeeded) {
    alert(
      `Nejprve spočítej všechny příklady (${solvedCount}/${level.solvedNeeded}).`
    );
    return;
  }

  alert("Výborně! Level je hotový 🎉");
  // do budoucna: přepnutí na další level
}

// posun kamery – stránku posuneme tak, aby byl hráč přibližně uprostřed
function scrollToPlayer(initial) {
  const playerTile = tiles[player.row]?.[player.col];
  if (!playerTile) return;

  const rect = playerTile.getBoundingClientRect();
  const tileSize = rect.height || rect.width || 0;

  const targetTop =
    window.scrollY + rect.top - window.innerHeight / 2 + tileSize / 2;

  window.scrollTo({
    top: targetTop,
    behavior: initial ? "auto" : "smooth"
  });
}

// -------------------------
// Ovládání
// -------------------------

function handleKeyDown(e) {
  switch (e.key) {
    case "ArrowUp":
    case "w":
    case "W":
      e.preventDefault();
      handleMove(0, -1);
      break;
    case "ArrowDown":
    case "s":
    case "S":
      e.preventDefault();
      handleMove(0, 1);
      break;
    case "ArrowLeft":
    case "a":
    case "A":
      e.preventDefault();
      handleMove(-1, 0);
      break;
    case "ArrowRight":
    case "d":
    case "D":
      e.preventDefault();
      handleMove(1, 0);
      break;
  }
}

function setupTouchControls() {
  let touchStartX = 0;
  let touchStartY = 0;

  window.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
    },
    { passive: true }
  );

  window.addEventListener(
    "touchend",
    (e) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;

      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (Math.max(absX, absY) < 20) return; // krátké šťouchnutí – ignoruj

      if (absX > absY) {
        // horizontální tah
        handleMove(dx > 0 ? 1 : -1, 0);
      } else {
        // vertikální tah
        handleMove(0, dy > 0 ? 1 : -1);
      }
    },
    { passive: true }
  );
}

// -------------------------
// Start hry
// -------------------------

function init() {
  createBaseLayout();
  loadProgress();
  startLevel(currentLevelIndex);

  window.addEventListener("keydown", handleKeyDown);
  setupTouchControls();
}

window.addEventListener("DOMContentLoaded", init);
