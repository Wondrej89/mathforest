import { LEVELS, TILE_SIZE, isBlocked, findQuestionAt, findPlayerStart } from './js/levels.js';
import { loadSave, saveProgress } from './js/storage.js';

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const container = document.getElementById("game-container"); // Reference na kontejner

let currentLevelIndex = 0;
let levelData = null;
let player = { x: 0, y: 0 };
let camera = { x: 0, y: 0 };

const ui = {
  overlay: document.getElementById("quiz-overlay"),
  eqA: document.getElementById("eq-a"),
  eqOp: document.getElementById("eq-op"),
  eqB: document.getElementById("eq-b"),
  eqRes: document.getElementById("eq-res"),
  tokensContainer: document.getElementById("tokens-container"),
  msg: document.getElementById("quiz-message"),
  levelName: document.getElementById("level-name")
};

function initGame() {
  resize(); // Nastaví velikost plátna podle kontejneru
  loadLevel(0);
  setupInputs();
  requestAnimationFrame(gameLoop);
}

function loadLevel(index) {
  if (index >= LEVELS.length) return;
  currentLevelIndex = index;
  const rawData = LEVELS[index];
  
  levelData = {
    ...rawData,
    solvedQuestions: []
  };
  
  const start = findPlayerStart(levelData);
  player.x = start.x;
  player.y = start.y;
  ui.levelName.textContent = levelData.name;
}

function gameLoop() {
  updateCamera();
  draw();
  requestAnimationFrame(gameLoop);
}

function updateCamera() {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  let targetX = player.x * TILE_SIZE + TILE_SIZE/2;
  let targetY = player.y * TILE_SIZE + TILE_SIZE/2;
  camera.x = targetX - centerX;
  camera.y = targetY - centerY;
}

function draw() {
  ctx.fillStyle = "#111"; 
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!levelData) return;

  ctx.save();
  ctx.translate(-Math.floor(camera.x), -Math.floor(camera.y));

  // --- OPRAVA CHYBY: Bezpečnější vykreslování ---
  // Iterujeme přes výšku definovanou v levelData
  for (let y = 0; y < levelData.height; y++) {
    // ZKONTROLUJEME, ZDA ŘÁDEK EXISTUJE
    // Pokud v levels.js chybí řádek v objectMap nebo backgroundMap, přeskočíme ho (hra nespadne)
    if (!levelData.backgroundMap[y] || !levelData.objectMap[y]) {
        continue; 
    }

    for (let x = 0; x < levelData.width; x++) {
      // 1. Pozadí
      // Zkontrolujeme i znak na pozici x (prevence erroru "reading '0'")
      const bgChar = levelData.backgroundMap[y][x];
      const posX = x * TILE_SIZE;
      const posY = y * TILE_SIZE;
      
      if (bgChar === "#") ctx.fillStyle = "#554d44"; 
      else ctx.fillStyle = "#2d8b3a"; 
      ctx.fillRect(posX, posY, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = "rgba(0,0,0,0.1)";
      ctx.strokeRect(posX, posY, TILE_SIZE, TILE_SIZE);

      // 2. Objekty
      const objChar = levelData.objectMap[y][x];

      if (objChar === "T") {
        ctx.fillStyle = "#1e5927";
        ctx.fillRect(posX + 2, posY - TILE_SIZE * 0.5, TILE_SIZE - 4, TILE_SIZE * 1.5);
      } 
      else if (objChar === "Q") {
        const qData = findQuestionAt(levelData, x, y);
        const isSolved = levelData.solvedQuestions.includes(qData?.id);
        
        if (!isSolved) {
           ctx.fillStyle = "#ffd94a";
           ctx.beginPath();
           ctx.arc(posX + TILE_SIZE/2, posY + TILE_SIZE/2, TILE_SIZE * 0.4, 0, Math.PI*2);
           ctx.fill();
           ctx.fillStyle = "black";
           ctx.font = `bold ${TILE_SIZE * 0.6}px sans-serif`;
           ctx.textAlign = "center";
           ctx.textBaseline = "middle";
           ctx.fillText("?", posX + TILE_SIZE/2, posY + TILE_SIZE/2);
        }
      }
    }
  }

  // Hráč
  ctx.fillStyle = "#3fa7ff";
  const pMargin = TILE_SIZE * 0.1;
  ctx.fillRect(
    player.x * TILE_SIZE + pMargin, 
    player.y * TILE_SIZE + pMargin, 
    TILE_SIZE - pMargin*2, 
    TILE_SIZE - pMargin*2
  );
  
  ctx.fillStyle = "white";
  ctx.fillRect(player.x * TILE_SIZE + TILE_SIZE*0.3, player.y * TILE_SIZE + TILE_SIZE*0.3, TILE_SIZE*0.15, TILE_SIZE*0.15);
  ctx.fillRect(player.x * TILE_SIZE + TILE_SIZE*0.6, player.y * TILE_SIZE + TILE_SIZE*0.3, TILE_SIZE*0.15, TILE_SIZE*0.15);

  ctx.restore();
}

function movePlayer(dx, dy) {
  if (!ui.overlay.classList.contains("hidden")) return;
  const newX = player.x + dx;
  const newY = player.y + dy;
  if (!isBlocked(levelData, newX, newY)) {
    player.x = newX;
    player.y = newY;
    checkInteraction();
  }
}

function checkInteraction() {
  if (!levelData.objectMap[player.y]) return; // Záchrana proti pádu
  const char = levelData.objectMap[player.y][player.x];
  if (char === "Q") {
    const q = findQuestionAt(levelData, player.x, player.y);
    if (q && !levelData.solvedQuestions.includes(q.id)) {
      openQuiz(q);
    }
  }
}

let currentQuizQ = null;
let currentAnswer = null;

function openQuiz(question) {
  currentQuizQ = question;
  currentAnswer = null;
  ui.overlay.classList.remove("hidden");
  
  const a = getRandomInt(question.aMin, question.aMax);
  const b = getRandomInt(question.bMin, question.bMax);
  let res;
  let op = question.type === "add" ? "+" : "-";
  if (op === "+") res = a + b;
  else res = a - b;

  ui.eqA.textContent = a;
  ui.eqB.textContent = b;
  ui.eqOp.textContent = op;
  ui.eqRes.textContent = "?";
  ui.eqRes.classList.add("empty");
  ui.msg.textContent = "Vyber výsledek";
  ui.msg.style.color = "#ccc";

  ui.tokensContainer.innerHTML = "";
  let choices = [res];
  while(choices.length < 4) {
    let r = getRandomInt(Math.max(0, res - 5), res + 5);
    if (!choices.includes(r)) choices.push(r);
  }
  choices.sort(() => Math.random() - 0.5);

  choices.forEach(num => {
    const btn = document.createElement("button");
    btn.className = "token";
    btn.textContent = num;
    btn.onclick = () => selectToken(btn, num);
    ui.tokensContainer.appendChild(btn);
  });
  
  currentQuizQ._expectedResult = res;
}

function selectToken(btnElement, value) {
  document.querySelectorAll(".token").forEach(t => t.classList.remove("selected"));
  btnElement.classList.add("selected");
  currentAnswer = value;
  ui.eqRes.textContent = value;
  ui.eqRes.classList.remove("empty");
}

function checkQuiz() {
  if (currentAnswer === null) return;
  if (currentAnswer === currentQuizQ._expectedResult) {
    ui.msg.style.color = "#4caf50";
    ui.msg.textContent = "Správně!";
    levelData.solvedQuestions.push(currentQuizQ.id);
    setTimeout(() => {
      ui.overlay.classList.add("hidden");
    }, 1000);
  } else {
    ui.msg.style.color = "#f44336";
    ui.msg.textContent = "Chyba, zkus to znovu.";
    ui.eqRes.classList.add("empty");
    ui.eqRes.textContent = "?";
    currentAnswer = null;
    document.querySelectorAll(".token").forEach(t => t.classList.remove("selected"));
  }
}

function closeQuiz() {
  ui.overlay.classList.add("hidden");
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// --- ZMĚNA: Resize se řídí velikostí kontejneru, ne okna ---
function resize() {
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener("resize", resize);

function setupInputs() {
  window.addEventListener("keydown", (e) => {
    if (["ArrowUp", "w"].includes(e.key)) movePlayer(0, -1);
    if (["ArrowDown", "s"].includes(e.key)) movePlayer(0, 1);
    if (["ArrowLeft", "a"].includes(e.key)) movePlayer(-1, 0);
    if (["ArrowRight", "d"].includes(e.key)) movePlayer(1, 0);
  });

  document.getElementById("btn-check").onclick = checkQuiz;
  document.getElementById("btn-close").onclick = closeQuiz;
  
  const bindBtn = (id, dx, dy) => {
    const btn = document.getElementById(id);
    if(btn) {
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        movePlayer(dx, dy);
      });
    }
  };

  bindBtn("btn-up", 0, -1);
  bindBtn("btn-down", 0, 1);
  bindBtn("btn-left", -1, 0);
  bindBtn("btn-right", 1, 0);
}

initGame();