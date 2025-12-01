// js/levels.js

// Legend:
// background:
//   "." = tráva
//   "#" = cesta / kamení
//
// objects:
//   "." = nic
//   "T" = strom (kolizní)
//   "S" = start hráče
//   "Q" = místo s příkladem (otázka)

export const TILE_SIZE = 16; // přizpůsob podle Kenney packu (často 16 nebo 32)

export const LEVELS = [
  {
    id: "forest-1",
    name: "Lesní stezka",
    width: 12,
    height: 40, // vertikální mapa
    // pozor: každý řádek musí mít přesně 12 znaků
    backgroundMap: [
      "############",
      "############",
      "####....####",
      "###......###",
      "##........##",
      "##........##",
      "#..........#",
      "#..........#",
      "#....##....#",
      "#....##....#",
      "#..........#",
      "#..........#",
      "#....##....#",
      "#....##....#",
      "#..........#",
      "#..........#",
      "#....##....#",
      "#....##....#",
      "#..........#",
      "#..........#",
      "#....##....#",
      "#....##....#",
      "#..........#",
      "#..........#",
      "#....##....#",
      "#....##....#",
      "#..........#",
      "#..........#",
      "#....##....#",
      "#....##....#",
      "#..........#",
      "#..........#",
      "#....##....#",
      "#....##....#",
      "#..........#",
      "#..........#",
      "############",
      "############",
      "############",
      "############"
    ],
    objectMap: [
      "............",
      "............",
      "............",
      ".....T......",
      "....TTT.....",
      "............",
      ".....Q......",
      "............",
      "....T.......",
      "............",
      "........T...",
      "............",
      ".....Q......",
      "............",
      "............",
      "....T.......",
      "............",
      ".....Q......",
      "............",
      "............",
      "....T.......",
      "............",
      ".....Q......",
      "............",
      "............",
      "............",
      "....T.......",
      "............",
      ".....Q......",
      "............",
      "............",
      "....T.......",
      "............",
      ".....S......",
      "............",
      "............",
      "............",
      "............",
      "............"
    ],
    // Konfigurace úkolů – jednoduché plus / mínus
    questions: [
      { id: "q1", x: 5, y: 6, type: "add", aMin: 1, aMax: 10, bMin: 1, bMax: 10 },
      { id: "q2", x: 5, y: 12, type: "sub", aMin: 5, aMax: 15, bMin: 1, bMax: 10 },
      { id: "q3", x: 5, y: 17, type: "add", aMin: 2, aMax: 20, bMin: 2, bMax: 10 },
      { id: "q4", x: 5, y: 22, type: "sub", aMin: 10, aMax: 20, bMin: 1, bMax: 10 },
      { id: "q5", x: 5, y: 28, type: "add", aMin: 1, aMax: 15, bMin: 1, bMax: 10 }
    ],
    requiredSolved: 5 // zatím 5, pak klidně 10
  }
];

// Pomocná funkce – najde startovací pozici hráče podle "S"
export function findPlayerStart(level) {
  for (let y = 0; y < level.height; y++) {
    const row = level.objectMap[y];
    const x = row.indexOf("S");
    if (x !== -1) return { x, y };
  }
  // fallback – když není S, dej (1,1)
  return { x: 1, y: 1 };
}

// Je na daném tile strom nebo zeď -> kolize?
export function isBlocked(level, x, y) {
  // 1. Základní kontrola hranic (pokud jdeme do mínusu nebo za deklarovanou šířku/výšku)
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) return true;

  // 2. BEZPEČNOSTNÍ KONTROLA: Existuje tento řádek skutečně v datech?
  // Pokud je mapa v kódu kratší, než tvrdí 'level.height', vrátíme true (jako zeď)
  if (!level.objectMap[y] || !level.backgroundMap[y]) {
    return true;
  }

  // 3. Teď už můžeme bezpečně číst konkrétní políčko
  const objChar = level.objectMap[y][x];
  
  // Strom "T" je neprůchozí
  if (objChar === "T") return true;

  // Volitelné: Pokud chceš, aby se nedalo chodit mimo cestu (#), můžeš přidat:
  // const bgChar = level.backgroundMap[y][x];
  // if (bgChar !== "#") return true; 

  return false;
}

// Najde otázku na daném tile, pokud existuje
export function findQuestionAt(level, x, y) {
  return level.questions.find(q => q.x === x && q.y === y) || null;
}
