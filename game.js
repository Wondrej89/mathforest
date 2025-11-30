// js/game.js
// Jednoduchý prototyp hry: průzkum lesní stezky + minihra s příkladem
// Všechen text a GUI je vykreslený přímo do canvasu.

(function () {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  // --- Herní mřížka (logické rozlišení) ---
  const GRID_COLS = 7;
  const GRID_ROWS = 20;

  let canvasWidth = 0;
  let canvasHeight = 0;
  let tileSize = 32;
  let worldWidthPx = 0;
  let worldHeightPx = 0;
  let worldLeft = 0;
  let worldTop = 0;

  const COLORS = {
    bg: "#000000",
    wall: "#4b352a",
    grass: "#2d8b3a",
    path: "#865439",
    question: "#ffd94a",
    questionBorder: "#d1aa00",
    player: "#3fa7ff",
    playerBorder: "#ffffff",
    hudText: "#ffffff",
    hudShadow: "rgba(0,0,0,0.7)",
    overlayBg: "rgba(0,0,0,0.75)",
    panelBg: "#333333",
    panelBorder: "#ffffff",
    slotBg: "#222222",
    slotActive: "#555555",
    slotText: "#ffffff",
    tokenBg: "#444444",
    tokenUsedBg: "#222222",
    tokenBorder: "#dddddd",
    buttonBg: "#4caf50",
    buttonText: "#ffffff",
    errorText: "#ff8080",
    successText: "#9cff9c"
  };

  // --- Definice levelu 1 (Lesní stezka) ---
  // W = stěna / okraj, G = tráva, P = cesta, Q = cesta + otázka
  const level1 = {
    id: 1,
    name: "Lesní stezka",
    tiles: [
      "WWWWWWW",
      "WGGPGGW",
      "WGGPGGW",
      "WGGQGGW",
      "WGGPGGW",
      "WGGPGGW",
      "WGGQGGW",
      "WGGPGGW",
      "WGGPGGW",
      "WGGQGGW",
      "WGGPGGW",
      "WGGPGGW",
      "WGGQGGW",
      "WGGPGGW",
      "WGGPGGW",
      "WGGQGGW",
      "WGGPGGW",
      "WGGPGGW",
      "WGGPGGW",
      "WWWWWWW"
    ]
  };

  let currentLevel = level1;
  let totalQuestions = countQuestions(currentLevel);
  let solvedQuestions = 0;

  const player = {
    col: 3,
    row: GRID_ROWS - 2,
    size: 0.6
  };

  let gameState = "explore"; // "explore" | "quiz"
  let currentQuiz = null;
  let lastMessage = "";
  let lastMessageColor = COLORS.successText;
  let lastMessageTimer = 0;

  // --- Pomocné funkce ---

  function countQuestions(level) {
    let count = 0;
    for (let r = 0; r < GRID_ROWS; r++) {
      const row = level.tiles[r];
      for (let c = 0; c < GRID_COLS; c++) {
        if (row.charAt(c) === "Q") count++;
      }
    }
    return count;
  }

  function getTile(col, row) {
    return currentLevel.tiles[row].charAt(col);
  }

  function setTile(col, row, ch) {
    const rowStr = currentLevel.tiles[row];
    currentLevel.tiles[row] =
      rowStr.substring(0, col) + ch + rowStr.substring(col + 1);
  }

  function isWalkable(col, row) {
    const ch = getTile(col, row);
    return ch !== "W";
  }

  function randInt(min, maxInclusive) {
    return Math.floor(Math.random() * (maxInclusive - min + 1)) + min;
  }

  // --- Resize / layout ---

  function resize() {
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Zkusíme využít co nejvíc zobrazené plochy, ale zachovat poměr mřížky
    tileSize = Math.floor(canvasHeight / GRID_ROWS);
    worldHeightPx = tileSize * GRID_ROWS;
    worldWidthPx = tileSize * GRID_COLS;

    if (worldWidthPx > canvasWidth) {
      tileSize = Math.floor(canvasWidth / GRID_COLS);
      worldWidthPx = tileSize * GRID_COLS;
      worldHeightPx = tileSize * GRID_ROWS;
    }

    worldLeft = Math.floor((canvasWidth - worldWidthPx) / 2);
    worldTop = Math.floor((canvasHeight - worldHeightPx) / 2);
  }

  window.addEventListener("resize", resize);
  resize();

  // --- Ovládání ---

  window.addEventListener("keydown", (e) => {
    if (gameState === "explore") {
      let dcol = 0;
      let drow = 0;
      if (e.key === "ArrowUp" || e.key === "w") drow = -1;
      else if (e.key === "ArrowDown" || e.key === "s") drow = 1;
      else if (e.key === "ArrowLeft" || e.key === "a") dcol = -1;
      else if (e.key === "ArrowRight" || e.key === "d") dcol = 1;
      else return;

      e.preventDefault();

      const newCol = player.col + dcol;
      const newRow = player.row + drow;
      if (
        newCol < 0 ||
        newCol >= GRID_COLS ||
        newRow < 0 ||
        newRow >= GRID_ROWS
      ) {
        return;
      }
      if (!isWalkable(newCol, newRow)) return;

      player.col = newCol;
      player.row = newRow;

      const ch = getTile(newCol, newRow);
      if (ch === "Q") {
        startQuiz(newCol, newRow);
      }
    } else if (gameState === "quiz") {
      if (e.key === "Escape") {
        // Zavřít příklad bez vyřešení (dočasně)
        gameState = "explore";
        currentQuiz = null;
      }
    }
  });

  canvas.addEventListener("pointerdown", (ev) => {
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    ev.preventDefault();

    if (gameState === "quiz" && currentQuiz) {
      handleQuizPointer(x, y);
    }
  });

  // --- Quiz logika ---

  function startQuiz(tileCol, tileRow) {
    currentQuiz = createQuiz();
    currentQuiz.tileCol = tileCol;
    currentQuiz.tileRow = tileRow;
    gameState = "quiz";
  }

  function createQuiz() {
    const op = Math.random() < 0.5 ? "+" : "-";
    let a, b, res;
    if (op === "+") {
      a = randInt(0, 10);
      b = randInt(0, 10);
      res = a + b;
    } else {
      a = randInt(0, 20);
      b = randInt(0, a);
      res = a - b;
    }

    // základní tokeny: a, b, výsledek, operátor + pár náhodných čísel
    const tokens = [];
    const needed = [String(a), String(b), String(res), op];
    needed.forEach((t) => tokens.push({ text: t, used: false }));

    while (tokens.length < 8) {
      const n = randInt(0, 20);
      tokens.push({ text: String(n), used: false });
    }

    return {
      a,
      b,
      op,
      res,
      chosenOp: "",
      chosenRes: "",
      tokens,
      tokenButtons: [],
      opSlot: null,
      resSlot: null,
      confirmButton: null,
      message: "",
      messageColor: COLORS.errorText
    };
  }

  function handleQuizPointer(x, y) {
    const q = currentQuiz;
    if (!q) return;

    // nejdřív zjistit klik na sloty
    if (q.opSlot && pointInRect(x, y, q.opSlot)) {
      q.activeSlot = "op";
      return;
    }
    if (q.resSlot && pointInRect(x, y, q.resSlot)) {
      q.activeSlot = "res";
      return;
    }

    // klik na token
    if (q.tokenButtons) {
      for (let i = 0; i < q.tokenButtons.length; i++) {
        const btn = q.tokenButtons[i];
        if (pointInRect(x, y, btn)) {
          const token = q.tokens[i];
          if (token.used) {
            // zrušit použití tokenu
            token.used = false;
            if (q.chosenOp === token.text) q.chosenOp = "";
            if (q.chosenRes === token.text) q.chosenRes = "";
          } else {
            // přiřadit do aktivního slotu nebo do prvního volného
            if (!q.activeSlot) q.activeSlot = "op";
            if (q.activeSlot === "op") {
              q.chosenOp = token.text;
            } else {
              q.chosenRes = token.text;
            }
            token.used = true;
          }
          return;
        }
      }
    }

    // klik na tlačítko Potvrdit
    if (q.confirmButton && pointInRect(x, y, q.confirmButton)) {
      checkQuizAnswer();
      return;
    }
  }

  function pointInRect(x, y, rect) {
    return (
      x >= rect.x &&
      x <= rect.x + rect.w &&
      y >= rect.y &&
      y <= rect.y + rect.h
    );
  }

  function checkQuizAnswer() {
    const q = currentQuiz;
    if (!q) return;

    if (!q.chosenOp || q.chosenRes === "") {
      q.message = "Nejdřív doplň oba čtverečky.";
      q.messageColor = COLORS.errorText;
      return;
    }

    const okOp = q.chosenOp === q.op;
    const okRes = Number(q.chosenRes) === q.res;

    if (okOp && okRes) {
      // úspěch
      solvedQuestions++;
      setTile(q.tileCol, q.tileRow, "P");
      gameState = "explore";
      currentQuiz = null;
      lastMessage = "Správně!";
      lastMessageColor = COLORS.successText;
      lastMessageTimer = 2.0; // sekundy
    } else {
      q.message = "Tohle nesedí, zkus to znovu.";
      q.messageColor = COLORS.errorText;
      // povolit znovupoužití tokenů
      q.tokens.forEach((t) => (t.used = false));
      q.chosenOp = "";
      q.chosenRes = "";
    }
  }

  // --- Kreslení ---

  function draw() {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    drawWorld();
    drawHUD();

    if (gameState === "quiz" && currentQuiz) {
      drawQuizOverlay();
    }

    // odpočet zprávy
    if (lastMessageTimer > 0) {
      lastMessageTimer -= 1 / 60;
      if (lastMessageTimer < 0) lastMessageTimer = 0;
    }

    requestAnimationFrame(draw);
  }

  function drawWorld() {
    // okraje (mimo herní pole) necháme černé
    for (let r = 0; r < GRID_ROWS; r++) {
      const row = currentLevel.tiles[r];
      for (let c = 0; c < GRID_COLS; c++) {
        const ch = row.charAt(c);
        const x = worldLeft + c * tileSize;
        const y = worldTop + r * tileSize;

        // podklad
        if (ch === "W") {
          ctx.fillStyle = COLORS.wall;
        } else if (ch === "P" || ch === "Q") {
          ctx.fillStyle = COLORS.path;
        } else {
          ctx.fillStyle = COLORS.grass;
        }
        ctx.fillRect(x, y, tileSize, tileSize);

        // mřížka (lehce)
        ctx.strokeStyle = "rgba(0,0,0,0.2)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, tileSize, tileSize);

        // otázka
        if (ch === "Q") {
          const cx = x + tileSize / 2;
          const cy = y + tileSize / 2;
          const rQuestion = tileSize * 0.3;
          ctx.beginPath();
          ctx.fillStyle = COLORS.question;
          ctx.strokeStyle = COLORS.questionBorder;
          ctx.lineWidth = 2;
          ctx.arc(cx, cy, rQuestion, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#000000";
          ctx.font = `${Math.floor(tileSize * 0.6)}px system-ui`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("?", cx, cy + 1);
        }
      }
    }

    // hráč
    const px =
      worldLeft + (player.col + 0.5 - player.size / 2) * tileSize;
    const py =
      worldTop + (player.row + 0.5 - player.size / 2) * tileSize;
    const ps = tileSize * player.size;

    ctx.fillStyle = COLORS.player;
    ctx.strokeStyle = COLORS.playerBorder;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(px, py, ps, ps, tileSize * 0.15);
    ctx.fill();
    ctx.stroke();
  }

  function drawHUD() {
    const padding = tileSize * 0.3;
    const hudY = worldTop + padding;

    ctx.font = `${Math.floor(tileSize * 0.6)}px system-ui`;
    ctx.textBaseline = "top";

    // levý text: název levelu
    const leftText = `Level ${currentLevel.id}: ${currentLevel.name}`;
    ctx.textAlign = "left";
    ctx.fillStyle = COLORS.hudShadow;
    ctx.fillText(leftText, worldLeft + padding + 2, hudY + 2);
    ctx.fillStyle = COLORS.hudText;
    ctx.fillText(leftText, worldLeft + padding, hudY);

    // pravý text: počet příkladů
    const rightText = `Příklady: ${solvedQuestions} / ${totalQuestions}`;
    ctx.textAlign = "right";
    const rightX = worldLeft + worldWidthPx - padding;
    ctx.fillStyle = COLORS.hudShadow;
    ctx.fillText(rightText, rightX + 2, hudY + 2);
    ctx.fillStyle = COLORS.hudText;
    ctx.fillText(rightText, rightX, hudY);

    // zpráva dole
    if (lastMessageTimer > 0 && lastMessage) {
      const msgY = worldTop + worldHeightPx - padding - tileSize * 0.8;
      ctx.textAlign = "center";
      ctx.fillStyle = COLORS.hudShadow;
      ctx.fillText(
        lastMessage,
        worldLeft + worldWidthPx / 2 + 2,
        msgY + 2
      );
      ctx.fillStyle = lastMessageColor;
      ctx.fillText(lastMessage, worldLeft + worldWidthPx / 2, msgY);
    }
  }

  function drawQuizOverlay() {
    const q = currentQuiz;

    // průhledné pozadí přes celou hrací plochu
    ctx.fillStyle = COLORS.overlayBg;
    ctx.fillRect(worldLeft, worldTop, worldWidthPx, worldHeightPx);

    // panel
    const panelW = worldWidthPx * 0.9;
    const panelH = tileSize * 7;
    const panelX = worldLeft + (worldWidthPx - panelW) / 2;
    const panelY = worldTop + (worldHeightPx - panelH) / 2;

    ctx.fillStyle = COLORS.panelBg;
    ctx.strokeStyle = COLORS.panelBorder;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, tileSize * 0.3);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = COLORS.hudText;
    ctx.font = `${Math.floor(tileSize * 0.7)}px system-ui`;
    ctx.fillText(
      "Doplň příklad přetažením kartiček",
      panelX + panelW / 2,
      panelY + tileSize * 0.4
    );

    // Rovnice: a [op] b = [result]
    const equationY = panelY + tileSize * 2;
    ctx.font = `${Math.floor(tileSize * 0.8)}px system-ui`;
    ctx.textBaseline = "middle";
    ctx.fillStyle = COLORS.slotText;

    let xCursor = panelX + tileSize * 1.0;

    // číslo a
    const aText = String(q.a);
    ctx.textAlign = "left";
    ctx.fillText(aText, xCursor, equationY);
    xCursor += ctx.measureText(aText).width + tileSize * 0.5;

    // op slot
    const slotSize = tileSize * 1.2;
    const opSlot = {
      x: xCursor,
      y: equationY - slotSize / 2,
      w: slotSize,
      h: slotSize
    };
    drawSlot(opSlot, q.chosenOp, q.activeSlot === "op");
    xCursor += slotSize + tileSize * 0.5;

    // číslo b
    const bText = String(q.b);
    ctx.fillStyle = COLORS.slotText;
    ctx.fillText(bText, xCursor, equationY);
    xCursor += ctx.measureText(bText).width + tileSize * 0.5;

    // "="
    ctx.fillText("=", xCursor, equationY);
    xCursor += ctx.measureText("=").width + tileSize * 0.5;

    // result slot
    const resSlot = {
      x: xCursor,
      y: equationY - slotSize / 2,
      w: slotSize * 1.2,
      h: slotSize
    };
    drawSlot(resSlot, q.chosenRes, q.activeSlot === "res");

    q.opSlot = opSlot;
    q.resSlot = resSlot;

    // instrukce k ovládání
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = `${Math.floor(tileSize * 0.5)}px system-ui`;
    ctx.fillStyle = COLORS.slotText;
    ctx.fillText(
      "Klepni na čtvereček a potom na kartičku. Znovu klepnutím kartičku vrátíš.",
      panelX + panelW / 2,
      equationY + slotSize
    );

    // kartičky (tokeny)
    const tokensTop = equationY + slotSize + tileSize * 1.4;
    const btnSize = tileSize * 1.4;
    const btnMargin = tileSize * 0.3;
    const tokensPerRow = Math.max(
      1,
      Math.floor((panelW - tileSize * 1.5) / (btnSize + btnMargin))
    );

    q.tokenButtons = [];
    ctx.font = `${Math.floor(tileSize * 0.7)}px system-ui`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    for (let i = 0; i < q.tokens.length; i++) {
      const token = q.tokens[i];
      const row = Math.floor(i / tokensPerRow);
      const col = i % tokensPerRow;

      const bx =
        panelX +
        tileSize * 0.75 +
        col * (btnSize + btnMargin);
      const by =
        tokensTop + row * (btnSize + btnMargin);

      const rect = { x: bx, y: by, w: btnSize, h: btnSize };
      q.tokenButtons.push(rect);

      ctx.beginPath();
      ctx.roundRect(
        rect.x,
        rect.y,
        rect.w,
        rect.h,
        tileSize * 0.2
      );
      ctx.fillStyle = token.used
        ? COLORS.tokenUsedBg
        : COLORS.tokenBg;
      ctx.fill();
      ctx.strokeStyle = COLORS.tokenBorder;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.fillText(token.text, rect.x + rect.w / 2, rect.y + rect.h / 2);
    }

    // tlačítko Potvrdit
    const btnW = tileSize * 4;
    const btnH = tileSize * 1.2;
    const btnX = panelX + panelW - btnW - tileSize * 0.8;
    const btnY = panelY + panelH - btnH - tileSize * 0.6;

    const confirmButton = { x: btnX, y: btnY, w: btnW, h: btnH };
    q.confirmButton = confirmButton;

    ctx.beginPath();
    ctx.roundRect(
      confirmButton.x,
      confirmButton.y,
      confirmButton.w,
      confirmButton.h,
      tileSize * 0.25
    );
    ctx.fillStyle = COLORS.buttonBg;
    ctx.fill();

    ctx.fillStyle = COLORS.buttonText;
    ctx.font = `${Math.floor(tileSize * 0.6)}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      "Potvrdit",
      confirmButton.x + confirmButton.w / 2,
      confirmButton.y + confirmButton.h / 2
    );

    // zpráva k příkladu (chyba apod.)
    if (q.message) {
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = q.messageColor;
      ctx.font = `${Math.floor(tileSize * 0.5)}px system-ui`;
      ctx.fillText(
        q.message,
        panelX + tileSize * 0.8,
        confirmButton.y + confirmButton.h / 2
      );
    }
  }

  function drawSlot(rect, value, isActive) {
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.w, rect.h, tileSize * 0.2);
    ctx.fillStyle = isActive ? COLORS.slotActive : COLORS.slotBg;
    ctx.fill();
    ctx.strokeStyle = COLORS.tokenBorder;
    ctx.lineWidth = 2;
    ctx.stroke();

    if (value) {
      ctx.fillStyle = COLORS.slotText;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${Math.floor(tileSize * 0.8)}px system-ui`;
      ctx.fillText(
        value,
        rect.x + rect.w / 2,
        rect.y + rect.h / 2
      );
    }
  }

  // start
  requestAnimationFrame(draw);
})();
