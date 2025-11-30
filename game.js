// game.js – dej do stejné složky jako index.html

(() => {
  // ---------- Konfigurace levelů ----------

  /** Typy dlaždic:
   *  G = tráva (průchozí)
   *  P = cesta (průchozí)
   *  D = okraj/hlína (neprůchozí)
   *  B = keř/překážka (neprůchozí)
   *  Q = dlaždice s úlohou (průchozí, spustí příklad)
   */

  const LEVELS = [
    {
      id: "level1",
      name: "Lesní stezka",
      width: 8,
      height: 16,
      playerStart: { x: 3, y: 15 }, // sloupec, řádek (0-based)
      map: [
        "DDGGQGDD",
        "DDGGPGDD",
        "DDGBPGDD",
        "DDGGPGDD",
        "DDGGPGDD",
        "DDGGQGDD",
        "DDGGPGDD",
        "DDGBPGDD",
        "DDGGPGDD",
        "DDGGQGDD",
        "DDGGPGDD",
        "DDGGPGDD",
        "DDGGQGDD",
        "DDGGPGDD",
        "DDGGPGDD",
        "DDGGPGDD"
      ]
    }
  ];

  // ---------- DOM prvky ----------

  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");

  const hudLevel = document.getElementById("hud-level");
  const hudProgress = document.getElementById("hud-progress");

  const overlay = document.getElementById("question-overlay");
  const questionTextEl = document.getElementById("question-text");
  const answerInputEl = document.getElementById("answer-input");
  const answerSubmitBtn = document.getElementById("answer-submit");
  const answerCancelBtn = document.getElementById("answer-cancel");
  const questionFeedbackEl = document.getElementById("question-feedback");

  // ---------- Stav hry ----------

  let currentLevelIndex = 0;
  let currentLevel = null;

  let tileSize = 32; // dopočítá se podle okna
  let cols = 0;
  let rows = 0;

  const player = {
    x: 0,
    y: 0
  };

  let solvedQuestions = 0;
  let totalQuestions = 0;
  let solvedQuestionTiles = new Set(); // "x,y"

  let awaitingAnswer = false;
  let currentCorrectAnswer = null;

  // ---------- Pomocné funkce ----------

  function loadLevel(index) {
    currentLevelIndex = index;
    currentLevel = LEVELS[index];
    cols = currentLevel.width;
    rows = currentLevel.height;

    // výchozí pozice hráče
    player.x = currentLevel.playerStart.x;
    player.y = currentLevel.playerStart.y;

    // spočítat počet úloh v levelu
    solvedQuestions = 0;
    solvedQuestionTiles = new Set();
    totalQuestions = 0;

    for (let y = 0; y < rows; y++) {
      const row = currentLevel.map[y];
      for (let x = 0; x < cols; x++) {
        if (row[x] === "Q") totalQuestions++;
      }
    }

    updateHud();
    resizeCanvas();
    render(); // první vykreslení
  }

  function updateHud() {
    if (hudLevel) {
      hudLevel.textContent = `Level ${currentLevelIndex + 1}: ${
        currentLevel.name
      }`;
    }
    if (hudProgress) {
      hudProgress.textContent = `Příklady: ${solvedQuestions} / ${totalQuestions}`;
    }
  }

  function resizeCanvas() {
    const root = document.getElementById("game-root");
    const availableWidth = root ? root.clientWidth : window.innerWidth;
    const availableHeight = root ? root.clientHeight : window.innerHeight;

    // chceme spíš vyšší mapu (portrait), takže omezíme velikost podle šířky i výšky
    tileSize = Math.floor(
      Math.min(availableWidth / cols, availableHeight / rows)
    );

    const width = tileSize * cols;
    const height = tileSize * rows;

    canvas.width = width;
    canvas.height = height;

    // CSS velikost (pro ostrost 1:1)
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    render();
  }

  function getTile(x, y) {
    if (
      !currentLevel ||
      y < 0 ||
      y >= currentLevel.height ||
      x < 0 ||
      x >= currentLevel.width
    ) {
      return "D"; // mimo mapu bereme jako neprůchozí
    }
    return currentLevel.map[y][x];
  }

  function isWalkable(tile) {
    return tile === "G" || tile === "P" || tile === "Q";
  }

  function movePlayer(dx, dy) {
    if (awaitingAnswer) return;

    const newX = player.x + dx;
    const newY = player.y + dy;
    const tile = getTile(newX, newY);

    if (!isWalkable(tile)) return;

    player.x = newX;
    player.y = newY;

    handleTileAfterMove(tile, newX, newY);
    render();
  }

  function handleTileAfterMove(tile, x, y) {
    if (tile === "Q") {
      const key = `${x},${y}`;
      if (!solvedQuestionTiles.has(key)) {
        // ještě nezodpovězený příklad
        const question = generateQuestion();
        currentCorrectAnswer = question.answer;
        openQuestionDialog(question.text, () => {
          // při správné odpovědi
          solvedQuestionTiles.add(key);
          solvedQuestions++;
          updateHud();
          checkLevelComplete();
        });
      }
    }
  }

  function checkLevelComplete() {
    if (solvedQuestions >= totalQuestions) {
      // zapsat progress do localStorage
      const progressKey = "mathTrailProgress";
      let progress = {};
      try {
        progress = JSON.parse(localStorage.getItem(progressKey)) || {};
      } catch {
        progress = {};
      }

      const completed = progress.completedLevels || [];
      if (!completed.includes(currentLevel.id)) {
        completed.push(currentLevel.id);
      }
      progress.completedLevels = completed;
      localStorage.setItem(progressKey, JSON.stringify(progress));

      // jednoduché dokončení – zatím jen alert
      setTimeout(() => {
        alert("Skvěle! Dokončil jsi tento level.");
      }, 50);
    }
  }

  // ---------- Příklady ----------

  function generateQuestion() {
    // jednoduché sčítání/odčítání do 20, bez záporných výsledků
    const isAddition = Math.random() < 0.5;
    let a = randomInt(0, 10);
    let b = randomInt(0, 10);

    if (!isAddition) {
      // aby výsledek nebyl záporný
      if (b > a) [a, b] = [b, a];
    }

    const text = isAddition ? `${a} + ${b} = ?` : `${a} − ${b} = ?`;
    const answer = isAddition ? a + b : a - b;

    return { text, answer };
  }

  function randomInt(min, max) {
    // včetně min i max
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // ---------- Dialog s otázkou ----------

  function openQuestionDialog(questionText, onCorrect) {
    awaitingAnswer = true;

    if (questionTextEl) questionTextEl.textContent = questionText;
    if (answerInputEl) {
      answerInputEl.value = "";
      answerInputEl.focus();
    }
    if (questionFeedbackEl) questionFeedbackEl.textContent = "";

    overlay.classList.remove("hidden");

    const handleSubmit = () => {
      if (!answerInputEl) return;
      const value = answerInputEl.value.trim();
      if (value === "") return;

      const num = Number(value);
      if (Number.isNaN(num)) {
        if (questionFeedbackEl)
          questionFeedbackEl.textContent = "Zadej prosím číslo.";
        return;
      }

      if (num === currentCorrectAnswer) {
        // správně
        closeDialog();
        onCorrect?.();
      } else {
        if (questionFeedbackEl)
          questionFeedbackEl.textContent = "Zkus to znovu 🙂";
      }
    };

    const handleCancel = () => {
      closeDialog();
    };

    answerSubmitBtn.addEventListener("click", handleSubmit, { once: true });
    answerCancelBtn.addEventListener("click", handleCancel, { once: true });

    const keyHandler = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    };

    // uložíme si handler na element, abychom ho mohli odregistrovat
    overlay._keyHandler = keyHandler;
    window.addEventListener("keydown", keyHandler);
  }

  function closeDialog() {
    awaitingAnswer = false;
    overlay.classList.add("hidden");

    if (overlay._keyHandler) {
      window.removeEventListener("keydown", overlay._keyHandler);
      overlay._keyHandler = null;
    }

    // po zavření dialogu může dítě hned pokračovat šipkami
  }

  // ---------- Vykreslování ----------

  function render() {
    if (!currentLevel) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // podklad
    ctx.fillStyle = "#2b2623";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // dlaždice
    for (let y = 0; y < rows; y++) {
      const row = currentLevel.map[y];
      for (let x = 0; x < cols; x++) {
        const tile = row[x];
        drawTile(x, y, tile);
      }
    }

    // grid (aby byly vidět jednotlivé tiles)
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * tileSize + 0.5, 0);
      ctx.lineTo(x * tileSize + 0.5, rows * tileSize);
      ctx.stroke();
    }
    for (let y = 0; y <= rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * tileSize + 0.5);
      ctx.lineTo(cols * tileSize, y * tileSize + 0.5);
      ctx.stroke();
    }

    // hráč
    drawPlayer();
  }

  function drawTile(x, y, tile) {
    const px = x * tileSize;
    const py = y * tileSize;

    // základ – tráva
    if (tile === "G" || tile === "Q") {
      ctx.fillStyle = "#2f8a3b"; // zelená
      ctx.fillRect(px, py, tileSize, tileSize);
    }

    if (tile === "P") {
      ctx.fillStyle = "#6b4731"; // cesta
      ctx.fillRect(px, py, tileSize, tileSize);
    }

    if (tile === "D") {
      ctx.fillStyle = "#4f3626"; // tmavá hlína / okraj
      ctx.fillRect(px, py, tileSize, tileSize);
    }

    if (tile === "B") {
      ctx.fillStyle = "#2f8a3b";
      ctx.fillRect(px, py, tileSize, tileSize);
      ctx.fillStyle = "#1f5c27"; // keř
      const margin = tileSize * 0.15;
      ctx.fillRect(px + margin, py + margin, tileSize - 2 * margin, tileSize - 2 * margin);
    }

    if (tile === "Q") {
      // symbol otázky/“mince”
      const key = `${x},${y}`;
      if (!solvedQuestionTiles.has(key)) {
        ctx.fillStyle = "#ffd94a";
        ctx.beginPath();
        const r = tileSize * 0.25;
        ctx.arc(px + tileSize / 2, py + tileSize / 2, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawPlayer() {
    const px = player.x * tileSize;
    const py = player.y * tileSize;

    const margin = tileSize * 0.15;
    ctx.fillStyle = "#3b7cff";
    ctx.beginPath();
    ctx.roundRect(
      px + margin,
      py + margin,
      tileSize - 2 * margin,
      tileSize - 2 * margin,
      tileSize * 0.2
    );
    ctx.fill();
  }

  // ---------- Ovládání ----------

  function handleKeyDown(e) {
    if (awaitingAnswer) return;

    switch (e.key) {
      case "ArrowUp":
      case "w":
      case "W":
        e.preventDefault();
        movePlayer(0, -1);
        break;
      case "ArrowDown":
      case "s":
      case "S":
        e.preventDefault();
        movePlayer(0, 1);
        break;
      case "ArrowLeft":
      case "a":
      case "A":
        e.preventDefault();
        movePlayer(-1, 0);
        break;
      case "ArrowRight":
      case "d":
      case "D":
        e.preventDefault();
        movePlayer(1, 0);
        break;
    }
  }

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("resize", resizeCanvas);

  // ---------- Start hry ----------

  loadLevel(0);
})();
