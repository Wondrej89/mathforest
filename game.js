import { LEVELS, TILE_SIZE, isBlocked, findQuestionAt, findPlayerStart } from './js/levels.js';
import { loadSave, saveProgress } from './js/storage.js';

// --- Nastavení Canvasu ---
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// --- Stav hry ---
let currentLevelIndex = 0;
let levelData = null; // Aktuálně načtený objekt levelu
let player = { x: 0, y: 0 };
let camera = { x: 0, y: 0 };

// UI Elementy (cache pro rychlejší přístup)
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

// --- Inicializace ---
function initGame() {
  resize();
  // Načteme první level
  loadLevel(0);
  
  // Nastavení ovládání
  setupInputs();
  
  // Spustíme hlavní smyčku
  requestAnimationFrame(gameLoop);
}

function loadLevel(index) {
  if (index >= LEVELS.length) return; // Konec hry?

  currentLevelIndex = index;
  const rawData = LEVELS[index];
  
  // Vytvoříme pracovní kopii levelu, abychom si do ní mohli psát stav (vyřešené otázky)
  levelData = {
    ...rawData,
    solvedQuestions: [] // Seznam ID vyřešených otázek
  };
  
  // Najdeme startovní pozici
  const start = findPlayerStart(levelData);
  player.x = start.x;
  player.y = start.y;

  ui.levelName.textContent = levelData.name;
}

// --- Vykreslování (Render Loop) ---
function gameLoop() {
  updateCamera();
  draw();
  requestAnimationFrame(gameLoop);
}

function updateCamera() {
  // Kamera se snaží držet hráče uprostřed
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  
  // Cílová pozice kamery (pixelová pozice hráče)
  let targetX = player.x * TILE_SIZE + TILE_SIZE/2;
  let targetY = player.y * TILE_SIZE + TILE_SIZE/2;

  // Nastavíme kameru tak, aby hráč byl ve středu (odečteme půlku obrazovky)
  camera.x = targetX - centerX;
  camera.y = targetY - centerY;
}

function draw() {
  // Vyčistit obrazovku
  ctx.fillStyle = "#111"; 
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!levelData) return;

  ctx.save();
  // Posuneme celý kontext o pozici kamery (zaokrouhlujeme na celé pixely pro ostrost)
  ctx.translate(-Math.floor(camera.x), -Math.floor(camera.y));

  // 1. Vykreslení terénu (BackgroundMap)
  for (let y = 0; y < levelData.height; y++) {
    for (let x = 0; x < levelData.width; x++) {
      const char = levelData.backgroundMap[y][x];
      const posX = x * TILE_SIZE;
      const posY = y * TILE_SIZE;
      
      // Jednoduché barvy místo textur (zatím)
      if (char === "#") ctx.fillStyle = "#554d44"; // Cesta / kamení
      else ctx.fillStyle = "#2d8b3a"; // Tráva
      
      ctx.fillRect(posX, posY, TILE_SIZE, TILE_SIZE);
      
      // Jemná mřížka pro přehlednost
      ctx.strokeStyle = "rgba(0,0,0,0.1)";
      ctx.strokeRect(posX, posY, TILE_SIZE, TILE_SIZE);
    }
  }

  // 2. Vykreslení objektů (ObjectMap + Questions)
  for (let y = 0; y < levelData.height; y++) {
    for (let x = 0; x < levelData.width; x++) {
      const char = levelData.objectMap[y][x];
      const posX = x * TILE_SIZE;
      const posY = y * TILE_SIZE;

      if (char === "T") {
        // Strom
        ctx.fillStyle = "#1e5927";
        // Strom kreslíme trochu vyšší pro efekt hloubky
        ctx.fillRect(posX + 2, posY - TILE_SIZE * 0.5, TILE_SIZE - 4, TILE_SIZE * 1.5);
      } 
      else if (char === "Q") {
        // Otázka (pokud není vyřešená)
        const qData = findQuestionAt(levelData, x, y);
        const isSolved = levelData.solvedQuestions.includes(qData?.id);
        
        if (!isSolved) {
           // Zlatý kruh s otazníkem
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

  // 3. Hráč
  ctx.fillStyle = "#3fa7ff"; // Modrá postavička
  const pMargin = TILE_SIZE * 0.1;
  ctx.fillRect(
    player.x * TILE_SIZE + pMargin, 
    player.y * TILE_SIZE + pMargin, 
    TILE_SIZE - pMargin*2, 
    TILE_SIZE - pMargin*2
  );
  
  // Oči hráče (pro směr, zatím jen statické)
  ctx.fillStyle = "white";
  ctx.fillRect(player.x * TILE_SIZE + TILE_SIZE*0.3, player.y * TILE_SIZE + TILE_SIZE*0.3, TILE_SIZE*0.15, TILE_SIZE*0.15);
  ctx.fillRect(player.x * TILE_SIZE + TILE_SIZE*0.6, player.y * TILE_SIZE + TILE_SIZE*0.3, TILE_SIZE*0.15, TILE_SIZE*0.15);

  ctx.restore();
}

// --- Logika pohybu ---
function movePlayer(dx, dy) {
  // Pokud je otevřený kvíz, hráč se nehýbe
  if (!ui.overlay.classList.contains("hidden")) return;

  const newX = player.x + dx;
  const newY = player.y + dy;

  // Kontrola kolize (používá funkci, kterou už máš v levels.js)
  if (!isBlocked(levelData, newX, newY)) {
    player.x = newX;
    player.y = newY;
    
    checkInteraction();
  }
}

function checkInteraction() {
  // Stojí hráč na políčku s otázkou?
  // V levels.js je v objectMap písmeno 'Q'
  const char = levelData.objectMap[player.y][player.x];
  if (char === "Q") {
    const q = findQuestionAt(levelData, player.x, player.y);
    // Pokud existuje a není vyřešená
    if (q && !levelData.solvedQuestions.includes(q.id)) {
      openQuiz(q);
    }
  }
}

// --- Logika Kvízu (UI) ---
let currentQuizQ = null; // Data aktuální otázky
let currentAnswer = null; // Co hráč vybral

function openQuiz(question) {
  currentQuizQ = question;
  currentAnswer = null;
  
  // Zobrazit overlay
  ui.overlay.classList.remove("hidden");
  
  // 1. Vygenerovat čísla
  const a = getRandomInt(question.aMin, question.aMax);
  const b = getRandomInt(question.bMin, question.bMax);
  let res;
  let op = question.type === "add" ? "+" : "-";
  
  if (op === "+") res = a + b;
  else res = a - b;

  // 2. Nastavit texty v HTML
  ui.eqA.textContent = a;
  ui.eqB.textContent = b;
  ui.eqOp.textContent = op;
  ui.eqRes.textContent = "?";
  ui.eqRes.classList.add("empty");
  ui.msg.textContent = "Vyber výsledek";
  ui.msg.style.color = "#ccc";

  // 3. Generování tokenů (tlačítek)
  ui.tokensContainer.innerHTML = "";
  
  let choices = [res]; // Vždy musí obsahovat správnou odpověď
  // Doplníme náhodná čísla
  while(choices.length < 4) {
    let r = getRandomInt(Math.max(0, res - 5), res + 5);
    if (!choices.includes(r)) choices.push(r);
  }
  // Zamíchat pole, aby správná odpověď nebyla vždy první
  choices.sort(() => Math.random() - 0.5);

  // Vytvoření tlačítek
  choices.forEach(num => {
    const btn = document.createElement("button");
    btn.className = "token";
    btn.textContent = num;
    // Po kliknutí na token se spustí funkce selectToken
    btn.onclick = () => selectToken(btn, num);
    ui.tokensContainer.appendChild(btn);
  });
  
  // Uložíme si správnou odpověď bokem pro kontrolu
  currentQuizQ._expectedResult = res;
}

function selectToken(btnElement, value) {
  // Odznačit ostatní
  document.querySelectorAll(".token").forEach(t => t.classList.remove("selected"));
  // Označit tento
  btnElement.classList.add("selected");
  
  // Doplnit do rovnice vizuálně
  currentAnswer = value;
  ui.eqRes.textContent = value;
  ui.eqRes.classList.remove("empty");
}

function checkQuiz() {
  if (currentAnswer === null) {
    ui.msg.textContent = "Musíš vybrat kartičku!";
    return;
  }
  
  if (currentAnswer === currentQuizQ._expectedResult) {
    // Správně!
    ui.msg.style.color = "#4caf50";
    ui.msg.textContent = "Správně! Cesta je volná.";
    
    // Přidat do vyřešených
    levelData.solvedQuestions.push(currentQuizQ.id);
    
    // Po chvilce zavřít
    setTimeout(() => {
      ui.overlay.classList.add("hidden");
    }, 1000);
  } else {
    // Špatně
    ui.msg.style.color = "#f44336";
    ui.msg.textContent = "To není správně, zkus to znovu.";
    ui.eqRes.classList.add("empty");
    ui.eqRes.textContent = "?";
    currentAnswer = null;
    document.querySelectorAll(".token").forEach(t => t.classList.remove("selected"));
  }
}

function closeQuiz() {
  ui.overlay.classList.add("hidden");
  // Volitelné: Posunout hráče zpět, aby nestál na otázce?
}

// --- Pomocné funkce ---
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.imageSmoothingEnabled = false; // Pixel art look
}
window.addEventListener("resize", resize);

// --- Inputs (Ovládání) ---
function setupInputs() {
  // Klávesnice (PC)
  window.addEventListener("keydown", (e) => {
    if (["ArrowUp", "w"].includes(e.key)) movePlayer(0, -1);
    if (["ArrowDown", "s"].includes(e.key)) movePlayer(0, 1);
    if (["ArrowLeft", "a"].includes(e.key)) movePlayer(-1, 0);
    if (["ArrowRight", "d"].includes(e.key)) movePlayer(1, 0);
  });

  // Tlačítka v Kvízu
  document.getElementById("btn-check").onclick = checkQuiz;
  document.getElementById("btn-close").onclick = closeQuiz;
  
  // Mobilní tlačítka (Dotyk)
  // Používáme 'pointerdown' pro okamžitou reakci (rychlejší než click)
  const bindBtn = (id, dx, dy) => {
    const btn = document.getElementById(id);
    if(btn) {
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault(); // Zabrání označování textu atd.
        movePlayer(dx, dy);
      });
    }
  };

  bindBtn("btn-up", 0, -1);
  bindBtn("btn-down", 0, 1);
  bindBtn("btn-left", -1, 0);
  bindBtn("btn-right", 1, 0);
}

// Start hry
initGame();