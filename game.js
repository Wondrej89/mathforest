import { LEVELS, isBlocked, findQuestionAt, findPlayerStart } from './js/levels.js';
import { loadSave, saveProgress } from './js/storage.js';

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const container = document.getElementById("game-container");

let currentLevelIndex = 0;
let levelData = null;
let player = { x: 0, y: 0 };
let camera = { x: 0, y: 0 };

// Dynamická velikost dlaždice (spočítá se podle šířky okna)
let tileSize = 32; 

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
  loadLevel(0); // Nejdřív načteme data levelu (potřebujeme znát šířku mapy)
  resize();     // Pak dopočítáme velikost dlaždic
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
  
  // Pokud se změní level, přepočítáme zoom, aby seděl
  if (container) resize();
}

function gameLoop() {
  updateCamera();
  draw();
  requestAnimationFrame(gameLoop);
}

function updateCamera() {
  if (!levelData) return;

  // 1. Zjistíme rozměry světa v pixelech
  const mapWidthPx = levelData.width * tileSize;
  const mapHeightPx = levelData.height * tileSize;

  // 2. Kde by kamera chtěla být (střed hráče - střed obrazovky)
  let targetX = (player.x * tileSize + tileSize / 2) - (canvas.width / 2);
  let targetY = (player.y * tileSize + tileSize / 2) - (canvas.height / 2);

  // 3. Omezení (Clamping) - nepustíme kameru mimo mapu
  // X osa: Kamera nesmí jít do mínusu (0) a nesmí jít dál než je šířka mapy minus šířka obrazovky
  const maxCamX = mapWidthPx - canvas.width;
  const maxCamY = mapHeightPx - canvas.height;

  // Math.max(0, ...) zajistí, že nepůjdeme pod nulu
  // Math.min(max, ...) zajistí, že nepůjdeme za konec mapy
  // Pokud je mapa menší než obrazovka, maxCam bude záporné -> použijeme 0 (zarovnání vlevo/nahoru) nebo vycentrujeme.
  
  if (maxCamX < 0) {
    // Mapa je užší než obrazovka -> vycentrujeme ji
    camera.x = (mapWidthPx - canvas.width) / 2;
  } else {
    camera.x = Math.max(0, Math.min(targetX, maxCamX));
  }

  if (maxCamY < 0) {
    // Mapa je nižší než obrazovka -> vycentrujeme ji
    camera.y = (mapHeightPx - canvas.height) / 2;
  } else {
    camera.y = Math.max(0, Math.min(targetY, maxCamY));
  }
}

function draw() {
  // Pozadí canvasu (kdyby náhodou něco prosvítalo)
  ctx.fillStyle = "#111"; 
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!levelData) return;

  ctx.save();
  // Posun kamery - zaokrouhlujeme pro ostré pixely
  ctx.translate(-Math.floor(camera.x), -Math.floor(camera.y));

  // Iterujeme přes mapu
  for (let y = 0; y < levelData.height; y++) {
    // Bezpečnostní kontrola řádku
    if (!levelData.backgroundMap[y] || !levelData.objectMap[y]) continue;

    for (let x = 0; x < levelData.width; x++) {
      const posX = x * tileSize;
      const posY = y * tileSize;

      // --- 1. Pozadí ---
      const bgChar = levelData.backgroundMap[y][x];
      if (bgChar === "#") ctx.fillStyle = "#554d44"; 
      else ctx.fillStyle = "#2d8b3a"; // Tráva
      
      // Nakreslíme čtverec o velikosti 'tileSize'
      ctx.fillRect(posX, posY, tileSize, tileSize);
      
      // Mřížka (volitelné, teď ji uděláme slabší)
      ctx.strokeStyle = "rgba(0,0,0,0.05)";
      ctx.lineWidth = 1;
      ctx.strokeRect(posX, posY, tileSize, tileSize);

      // --- 2. Objekty ---
      const objChar = levelData.objectMap[y][x];

      if (objChar === "T") {
        // Strom
        ctx.fillStyle = "#1e5927";
        // Strom nakreslíme trochu větší než dlaždici pro efekt
        ctx.fillRect(posX + tileSize * 0.1, posY - tileSize * 0.2, tileSize * 0.8, tileSize * 1.2);
      } 
      else if (objChar === "Q") {
        // Otázka
        const qData = findQuestionAt(levelData, x, y);
        const isSolved = levelData.solvedQuestions.includes(qData?.id);
        
        if (!isSolved) {
           ctx.fillStyle = "#ffd94a";
           ctx.beginPath();
           // Kruh uprostřed dlaždice
           ctx.arc(posX + tileSize/2, posY + tileSize/2, tileSize * 0.35, 0, Math.PI*2);
           ctx.fill();
           
           ctx.fillStyle = "black";
           ctx.font = `bold ${tileSize * 0.6}px sans-serif`;
           ctx.textAlign = "center";
           ctx.textBaseline = "middle";
           // Text "?" vycentrujeme
           ctx.fillText("?", posX + tileSize/2, posY + tileSize/2 + (tileSize*0.05));
        }
      }
    }
  }

  // --- 3. Hráč ---
  ctx.fillStyle = "#3fa7ff";
  const pMargin = tileSize * 0.15; // Odsazení hráče od kraje dlaždice
  const pSize = tileSize - pMargin * 2;
  
  ctx.fillRect(
    player.x * tileSize + pMargin, 
    player.y * tileSize + pMargin, 
    pSize, 
    pSize
  );
  
  // Oči hráče
  ctx.fillStyle = "white";
  const eyeSize = pSize * 0.2;
  ctx.fillRect(player.x * tileSize + tileSize*0.3, player.y * tileSize + tileSize*0.35, eyeSize, eyeSize);
  ctx.fillRect(player.x * tileSize + tileSize*0.6, player.y * tileSize + tileSize*0.35, eyeSize, eyeSize);

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
  if (!levelData.objectMap[player.y]) return;
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

function resize() {
  // Nastavíme velikost canvasu podle kontejneru
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  
  // Zde je ten trik:
  // Pokud máme načtený level, spočítáme velikost dlaždice tak, aby se mapa vešla na šířku.
  if (levelData) {
    // Vydělíme šířku obrazovky počtem dlaždic v mapě (levelData.width je u tebe 12)
    tileSize = Math.floor(canvas.width / levelData.width);
  } else {
    tileSize = 32; // Fallback
  }
  
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