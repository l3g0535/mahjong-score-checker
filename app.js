const honors = [
  'tiles/01-white-dragon.svg',
  'tiles/02-green-dragon.svg',
  'tiles/03-red-dragon.svg',
  'tiles/04-east-wind.svg',
  'tiles/05-south-wind.svg',
  'tiles/06-west-wind.svg',
  'tiles/07-north-wind.svg'
];

const characters = [
  'tiles/08-characters-1.svg',
  'tiles/09-characters-2.svg',
  'tiles/10-characters-3.svg',
  'tiles/11-characters-4.svg',
  'tiles/12-characters-5.svg',
  'tiles/13-characters-6.svg',
  'tiles/14-characters-7.svg',
  'tiles/15-characters-8.svg',
  'tiles/16-characters-9.svg'
];

const circles = [
  'tiles/17-circles-1.svg',
  'tiles/18-circles-2.svg',
  'tiles/19-circles-3.svg',
  'tiles/20-circles-4.svg',
  'tiles/21-circles-5.svg',
  'tiles/22-circles-6.svg',
  'tiles/23-circles-7.svg',
  'tiles/24-circles-8.svg',
  'tiles/25-circles-9.svg'
];

const bamboos = [
  'tiles/26-bamboos-1.svg',
  'tiles/27-bamboos-2.svg',
  'tiles/28-bamboos-3.svg',
  'tiles/29-bamboos-4.svg',
  'tiles/30-bamboos-5.svg',
  'tiles/31-bamboos-6.svg',
  'tiles/32-bamboos-7.svg',
  'tiles/33-bamboos-8.svg',
  'tiles/34-bamboos-9.svg'
];

const flowersandseasons = [
  'tiles/35-spring.svg',
  'tiles/36-summer.svg',
  'tiles/37-autumn.svg',
  'tiles/38-winter.svg',
  'tiles/39-plum.svg',
  'tiles/40-orchid.svg',
  'tiles/41-chrysanthemum.svg',
  'tiles/42-bamboo.svg'
];

let hand = [];
let MAX_POINTS = 13;
let currentSeatWind = "tiles/04-east-wind.svg";
let currentTableWind = "tiles/04-east-wind.svg";

// --- Event Listeners ---

// --- DOM Element References ---
const seatWindEl = document.getElementById("seatWind");
const tableWindEl = document.getElementById("tableWind");
const ziMoCb = document.getElementById('ziMo');
const concealedHandCb = document.getElementById('concealedHand');
const heavenlyHandCb = document.getElementById('heavenlyHand');
const earthlyHandCb = document.getElementById('earthlyHand');
const robbingKongCb = document.getElementById('robbingKong');
const replacementTileCb = document.getElementById('replacementTile');
const instantFlowerWinCb = document.getElementById('instantFlowerWin');

// --- Dynamic Wind Selectors Listener ---
if (seatWindEl) {
  seatWindEl.addEventListener("change", e => {
    currentSeatWind = e.target.value;
    calculateScore();
  });
}

if (tableWindEl) {
  tableWindEl.addEventListener("change", e => {
    currentTableWind = e.target.value;
    calculateScore();
  });
}

// 1. When "Concealed Hand" is checked, "Zi Mo" MUST also be checked
concealedHandCb.addEventListener('change', () => {
  if (concealedHandCb.checked) {
    ziMoCb.checked = true;
  } else {
    // If Concealed Hand is unchecked, Heavenly Hand can no longer be active
    if (heavenlyHandCb) heavenlyHandCb.checked = false;
  }
  calculateScore(); // Trigger recalculation
});

// 2. "Zi Mo" can be true without Concealed Hand, but unchecking Zi Mo unchecks Concealed Hand & Heavenly Hand
ziMoCb.addEventListener('change', () => {
  if (!ziMoCb.checked) {
    concealedHandCb.checked = false;
    if (heavenlyHandCb) heavenlyHandCb.checked = false;
  }
  calculateScore(); // Trigger recalculation
});

// 3. When "Heavenly Hand" is checked, BOTH Concealed Hand and Zi Mo must be checked
if (heavenlyHandCb) {
  heavenlyHandCb.addEventListener('change', () => {
    if (heavenlyHandCb.checked) {
      concealedHandCb.checked = true;
      ziMoCb.checked = true;
    }
    calculateScore(); // Trigger recalculation
  });
}
document.getElementById("seatWind")?.addEventListener("change", e => {
  currentSeatWind = e.target.value;
  calculateScore();
});

document.getElementById("tableWind")?.addEventListener("change", e => {
  currentTableWind = e.target.value;
  calculateScore();
});
// All Checkboxes Event Binding
const allCheckboxes = [
  "ziMo", "concealedHand", "robbingKong", 
  "replacementTile", "instantFlowerWin",
  "heavenlyHand", "earthlyHand"
];
allCheckboxes.forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener("change", () => {
      // Mutual exclusivity between Heavenly and Earthly Hands
      if (id === "heavenlyHand" && el.checked) {
        const earthly = document.getElementById("earthlyHand");
        if (earthly) earthly.checked = false;
      }
      if (id === "earthlyHand" && el.checked) {
        const heavenly = document.getElementById("heavenlyHand");
        if (heavenly) heavenly.checked = false;
      }
      calculateScore();
    });
  }
});

// --- Event Listener for Instant 8-Flower Win Checkbox ---
document.getElementById("instantFlowerWin")?.addEventListener("change", () => {
  calculateScore();
});

// --- Helper Functions ---
function parseTile(tilePath) {
  if (characters.includes(tilePath)) return { suit: "characters", value: characters.indexOf(tilePath) + 1, path: tilePath };
  if (circles.includes(tilePath)) return { suit: "circles", value: circles.indexOf(tilePath) + 1, path: tilePath };
  if (bamboos.includes(tilePath)) return { suit: "bamboos", value: bamboos.indexOf(tilePath) + 1, path: tilePath };
  if (honors.includes(tilePath)) {
    if (tilePath.includes("dragon")) return { suit: "dragon", value: tilePath, path: tilePath };
    if (tilePath.includes("wind")) return { suit: "wind", value: tilePath, path: tilePath };
  }
  if (flowersandseasons.includes(tilePath)) return { suit: "flower", value: tilePath, path: tilePath };
  return { suit: "other", value: tilePath, path: tilePath };
}

function isTerminal(tilePath) {
  const p = parseTile(tilePath);
  return ["characters", "circles", "bamboos"].includes(p.suit) && (p.value === 1 || p.value === 9);
}

function isHonor(tilePath) {
  return honors.includes(tilePath);
}

function isTerminalOrHonor(tilePath) {
  return isTerminal(tilePath) || isHonor(tilePath);
}

function separateHand(handTiles) {
  const normalTiles = handTiles.filter(t => !flowersandseasons.includes(t));
  const flowerTiles = handTiles.filter(t => flowersandseasons.includes(t));
  return { normalTiles, flowerTiles };
}

function getCounts(tiles) {
  const counts = {};
  tiles.forEach(t => counts[t] = (counts[t] || 0) + 1);
  return counts;
}

// Sequential meld parser based on tile input order
function parseHandIntoMelds(normalTiles) {
  const melds = [];
  let pair = null;
  let i = 0;

  while (i < normalTiles.length) {
    const remaining = normalTiles.length - i;

    // 1. Kong (4 identical tiles)
    if (remaining >= 4 &&
        normalTiles[i] === normalTiles[i + 1] &&
        normalTiles[i] === normalTiles[i + 2] &&
        normalTiles[i] === normalTiles[i + 3]) {
      melds.push({ type: 'kong', tiles: normalTiles.slice(i, i + 4) });
      i += 4;
      continue;
    }

    // 2. Pair (2 identical tiles)
    if (!pair && remaining >= 2 && normalTiles[i] === normalTiles[i + 1]) {
      const isTripsOrMore = remaining >= 3 && normalTiles[i] === normalTiles[i + 2];
      if (!isTripsOrMore) {
        pair = { type: 'pair', tiles: normalTiles.slice(i, i + 2) };
        i += 2;
        continue;
      }
    }

    // 3. 3-tile Meld (Pong or Chow)
    if (remaining >= 3) {
      const rawChunk = [normalTiles[i], normalTiles[i + 1], normalTiles[i + 2]];
      const [t1, t2, t3] = rawChunk;

      // Check for Pong / Triplet
      if (t1 === t2 && t2 === t3) {
        melds.push({ type: 'pong', tiles: rawChunk });
      } else {
        // Check for Chow with auto-sorting
        const parsedChunk = rawChunk.map(parseTile);
        const isSuited = ["characters", "circles", "bamboos"].includes(parsedChunk[0].suit);
        const isSameSuit = parsedChunk.every(p => p.suit === parsedChunk[0].suit);

        if (isSuited && isSameSuit) {
          parsedChunk.sort((a, b) => a.value - b.value);

          const [p1, p2, p3] = parsedChunk;
          if (p1.value + 1 === p2.value && p2.value + 1 === p3.value) {
            melds.push({ type: 'chow', tiles: parsedChunk.map(p => p.path) });
          } else {
            melds.push({ type: 'invalid', tiles: rawChunk });
          }
        } else {
          melds.push({ type: 'invalid', tiles: rawChunk });
        }
      }
      i += 3;
      continue;
    }

    // Fallback pair check for 2 remaining tiles
    if (!pair && remaining === 2 && normalTiles[i] === normalTiles[i + 1]) {
      pair = { type: 'pair', tiles: normalTiles.slice(i, i + 2) };
      i += 2;
      continue;
    }

    i++;
  }

  return { melds, pair };
}

function isValidWinningHand(normalTiles, melds, pair) {
  // 1. Check special structures
  if (isThirteenOrphans(normalTiles) || isSevenPairs(normalTiles) || isNineGates(normalTiles)) {
    return true;
  }

  // 2. Check standard structure: exactly 4 valid melds (Chow, Pong, Kong) and 1 pair
  const has4Melds = melds.length === 4;
  const hasPair = pair !== null;
  const allMeldsValid = melds.every(m => m.type === 'chow' || m.type === 'pong' || m.type === 'kong');

  return has4Melds && hasPair && allMeldsValid;
}

// --- Rule Checks ---
function isAllSequences(normalTiles, melds, pair) {
  if (normalTiles.some(isHonor)) return false;
  return melds.length === 4 && pair !== null && melds.every(m => m.type === 'chow');
}

function isAllPongs(melds, pair) {
  return melds.length === 4 && pair !== null && melds.every(m => m.type === 'pong' || m.type === 'kong');
}

function isAllSimple(normalTiles) {
  return normalTiles.every(t => {
    const p = parseTile(t);
    return ["characters", "circles", "bamboos"].includes(p.suit) && p.value >= 2 && p.value <= 8;
  });
}

function isPureStraight(melds) {
  const chows = melds.filter(m => m.type === 'chow');

  for (let suit of ["characters", "circles", "bamboos"]) {
    let has123 = false, has456 = false, has789 = false;

    for (let m of chows) {
      const p1 = parseTile(m.tiles[0]);
      if (p1.suit === suit) {
        if (p1.value === 1) has123 = true;
        if (p1.value === 4) has456 = true;
        if (p1.value === 7) has789 = true;
      }
    }
    if (has123 && has456 && has789) return true;
  }
  return false;
}

function isFullFlush(normalTiles) {
  const suits = new Set(normalTiles.map(t => parseTile(t).suit));
  return suits.size === 1 && ["characters", "circles", "bamboos"].includes([...suits][0]);
}

function isHalfFlush(normalTiles) {
  const suits = new Set(normalTiles.map(t => parseTile(t).suit));
  const hasHonors = suits.has('dragon') || suits.has('wind');
  const suitedSuits = ['characters', 'circles', 'bamboos'].filter(s => suits.has(s));
  return hasHonors && suitedSuits.length === 1;
}

function isSevenPairs(normalTiles) {
  if (normalTiles.length !== 14) return false;
  const counts = Object.values(getCounts(normalTiles));
  // Allows counts of 2 (1 pair) or 4 (2 pairs), as long as total tiles equals 14
  return counts.every(c => c === 2 || c === 4);
}

function isPureOrphans(normalTiles, melds, pair) {
  if (normalTiles.some(isHonor)) return false;
  if (melds.length !== 4 || !pair) return false;
  return [...melds, pair].every(unit => unit.tiles.some(isTerminal));
}

function isMixedOrphans(normalTiles, melds, pair) {
  if (!normalTiles.some(isHonor)) return false;
  if (melds.length !== 4 || !pair) return false;
  return [...melds, pair].every(unit => unit.tiles.some(isTerminalOrHonor));
}

function isSmallThreeDragons(melds, pair) {
  const dragons = [honors[0], honors[1], honors[2]];
  const pongCount = melds.filter(m => (m.type === 'pong' || m.type === 'kong') && dragons.includes(m.tiles[0])).length;
  const pairCount = pair && dragons.includes(pair.tiles[0]) ? 1 : 0;
  return pongCount === 2 && pairCount === 1;
}

function isBigThreeDragons(melds) {
  const dragons = [honors[0], honors[1], honors[2]];
  return dragons.every(d => melds.some(m => (m.type === 'pong' || m.type === 'kong') && m.tiles[0] === d));
}

function isSmallFourWinds(melds, pair) {
  const winds = [honors[3], honors[4], honors[5], honors[6]];
  const pongCount = melds.filter(m => (m.type === 'pong' || m.type === 'kong') && winds.includes(m.tiles[0])).length;
  const pairCount = pair && winds.includes(pair.tiles[0]) ? 1 : 0;
  return pongCount === 3 && pairCount === 1;
}

function isBigFourWinds(melds) {
  const winds = [honors[3], honors[4], honors[5], honors[6]];
  return winds.every(w => melds.some(m => (m.type === 'pong' || m.type === 'kong') && m.tiles[0] === w));
}

function isAllHonors(normalTiles) {
  return normalTiles.length === 14 && normalTiles.every(isHonor);
}

function isThirteenOrphans(normalTiles) {
  if (normalTiles.length !== 14) return false;
  const required = [
    characters[0], characters[8],
    circles[0], circles[8],
    bamboos[0], bamboos[8],
    honors[0], honors[1], honors[2],
    honors[3], honors[4], honors[5], honors[6]
  ];
  return required.every(r => normalTiles.includes(r));
}

function isAllTerminals(normalTiles, melds, pair) {
  return normalTiles.length === 14 && normalTiles.every(isTerminal) && isAllPongs(melds, pair);
}

function isNineGates(normalTiles) {
  if (normalTiles.length !== 14 || !isFullFlush(normalTiles)) return false;

  const values = normalTiles.map(t => parseTile(t).value).sort((a, b) => a - b);
  const counts = getCounts(values);

  if ((counts[1] || 0) < 3 || (counts[9] || 0) < 3) return false;
  for (let i = 2; i <= 8; i++) {
    if ((counts[i] || 0) < 1) return false;
  }

  const requiredPattern = [1, 1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 9];
  for (let val of values) {
    const copy = [...values];
    copy.splice(copy.indexOf(val), 1);
    if (JSON.stringify(copy) === JSON.stringify(requiredPattern)) return true;
  }
  return false;
}

function isFourKongs(melds, pair) {
  return melds.length === 4 && pair !== null && melds.every(m => m.type === 'kong');
}

function isFourConcealedPongs(melds, pair, isConcealed) {
  return isConcealed && melds.length === 4 && pair !== null && melds.every(m => m.type === 'pong' || m.type === 'kong');
}

// --- Bonus Points Helper Functions ---
function getDragonPongs(normalTiles) {
  const dragonTiles = honors.slice(0, 3);
  const results = [];
  dragonTiles.forEach(dragon => {
    if (normalTiles.filter(t => t === dragon).length >= 3) {
      results.push({ name: "Dragon Pong", fan: 1 });
    }
  });
  return results;
}
function getSeatWindNumber() {
  switch (currentSeatWind) {
    case 'tiles/04-east-wind.svg':  return 1;
    case 'tiles/05-south-wind.svg': return 2;
    case 'tiles/06-west-wind.svg':  return 3;
    case 'tiles/07-north-wind.svg': return 4;
    default: return 1;
  }
}

// --- Flower & Season Scoring Logic ---
function getFlowerScoring(handTiles) {
  const seatNum = getSeatWindNumber();
  const matchedFlowers = [];
  
  const seasons = ['tiles/35-spring.svg', 'tiles/36-summer.svg', 'tiles/37-autumn.svg', 'tiles/38-winter.svg'];
  const flowers = ['tiles/39-plum.svg', 'tiles/40-orchid.svg', 'tiles/41-chrysanthemum.svg', 'tiles/42-bamboo.svg'];

  const presentSeasons = seasons.filter(t => handTiles.includes(t));
  const presentFlowers = flowers.filter(t => handTiles.includes(t));

  // 1. Seasons scoring
  if (presentSeasons.length === 4) {
    matchedFlowers.push({ name: "All Seasons", fan: 2 });
  } else if (handTiles.includes(seasons[seatNum - 1])) {
    matchedFlowers.push({ name: "Seat Season", fan: 1 });
  }

  // 2. Flowers scoring
  if (presentFlowers.length === 4) {
    matchedFlowers.push({ name: "All Flowers", fan: 2 });
  } else if (handTiles.includes(flowers[seatNum - 1])) {
    matchedFlowers.push({ name: "Seat Flower", fan: 1 });
  }

  return matchedFlowers;
}

// --- Main Scoring ---
// --- Main Scoring ---
function calculateScore() {
  const heavenlyEl = document.getElementById("heavenlyHand");
  const earthlyEl = document.getElementById("earthlyHand");
  const instantFlowerEl = document.getElementById("instantFlowerWin");

  if (seatWindEl) currentSeatWind = seatWindEl.value;
  if (tableWindEl) currentTableWind = tableWindEl.value;
  
  const { normalTiles } = separateHand(hand);
  const { melds, pair } = parseHandIntoMelds(normalTiles);

  const kongCount = melds.filter(m => m.type === 'kong').length;
  const requiredTileCount = 14 + kongCount;
  const hasEnoughTiles = normalTiles.length >= requiredTileCount;
  const isValidHand = hasEnoughTiles && isValidWinningHand(normalTiles, melds, pair);
  
  if (heavenlyEl) {
    heavenlyEl.disabled = !isValidHand;
    if (!isValidHand) heavenlyEl.checked = false;
  }
  if (earthlyEl) {
    earthlyEl.disabled = !isValidHand;
    if (!isValidHand) earthlyEl.checked = false;
  } 

  // Standalone Win Checkboxes
  if (heavenlyEl?.checked) {
    updateDisplay(Math.min(10, MAX_POINTS), [{ name: "Heavenly Hand", fan: 10 }]);
    return;
  }
  if (earthlyEl?.checked) {
    updateDisplay(Math.min(10, MAX_POINTS), [{ name: "Earthly Hand", fan: 10 }]);
    return;
  }
  if (instantFlowerEl?.checked) {
    updateDisplay(Math.min(5, MAX_POINTS), [{ name: "Instant 8-Flower Win (Zi Mo)", fan: 5 }]);
    return;
  }

  // Render info/warning messages in the Rules Box
  if (!hasEnoughTiles) {
    document.getElementById("score").textContent = "0";
    document.getElementById("rules").innerHTML = `
      <span class="info-text">You need ${requiredTileCount} non-flower tiles for score calculation (Currently: ${normalTiles.length}/${requiredTileCount}).</span>
    `;
    return;
  }

  if (!isValidHand) {
    document.getElementById("score").textContent = "0";
    document.getElementById("rules").innerHTML = `
      <span class="warning-text">Invalid hand structure (Must be 4 valid melds + 1 pair).</span>
    `;
    return;
  }

  const MAX_FAN = Math.max(13, MAX_POINTS);
  let matchedRules = [];
  const isConcealed = document.getElementById("concealedHand")?.checked;

  // Exclusive / Limit Hands
  if (isFourKongs(melds, pair)) matchedRules.push({ name: "Four Kongs", fan: MAX_FAN, exclusive: true });
  if (isFourConcealedPongs(melds, pair, isConcealed)) matchedRules.push({ name: "Four Concealed Pongs", fan: MAX_FAN, exclusive: true });
  if (isNineGates(normalTiles)) matchedRules.push({ name: "Nine Gates", fan: MAX_FAN, exclusive: true });
  if (isBigFourWinds(melds)) matchedRules.push({ name: "Big Four Winds", fan: MAX_FAN, exclusive: true });
  if (isSmallFourWinds(melds, pair)) matchedRules.push({ name: "Small Four Winds", fan: 10, exclusive: true });
  if (isBigThreeDragons(melds)) matchedRules.push({ name: "Big Three Dragons", fan: MAX_FAN, exclusive: true });
  if (isAllHonors(normalTiles)) matchedRules.push({ name: "All Honors", fan: MAX_FAN, exclusive: true });
  if (isThirteenOrphans(normalTiles)) matchedRules.push({ name: "Thirteen Orphans", fan: MAX_FAN, exclusive: true });
  if (isAllTerminals(normalTiles, melds, pair)) matchedRules.push({ name: "All Terminals", fan: MAX_FAN, exclusive: true });

  if (matchedRules.some(r => r.exclusive)) {
    updateDisplay(Math.min(matchedRules[0].fan, MAX_POINTS), matchedRules);
    return;
  }

  // Base & Stackable Hands
  const isSevenPairsHand = isSevenPairs(normalTiles);
  
  if (isSmallThreeDragons(melds, pair)) matchedRules.push({ name: "Small Three Dragons", fan: 5 });
  if (isAllSequences(normalTiles, melds, pair)) matchedRules.push({ name: "All Sequences", fan: 1 });
  if (isAllPongs(melds, pair)) matchedRules.push({ name: "All Pongs", fan: 3 });
  if (isAllSimple(normalTiles)) matchedRules.push({ name: "All Simple", fan: 1 });
  if (isPureStraight(melds)) matchedRules.push({ name: "Pure Straight", fan: 3 });
  if (isFullFlush(normalTiles)) matchedRules.push({ name: "Full Flush", fan: 7 });
  else if (isHalfFlush(normalTiles)) matchedRules.push({ name: "Half Flush", fan: 3 });
  if (isSevenPairs(normalTiles)) matchedRules.push({ name: "Seven Pairs", fan: 4 });
  if (isPureOrphans(normalTiles, melds, pair)) matchedRules.push({ name: "Pure Orphans", fan: 5 });
  if (isMixedOrphans(normalTiles, melds, pair)) matchedRules.push({ name: "Mixed Orphans", fan: 3 });

  // Stackable Checkbox Bonuses
  if (document.getElementById("ziMo")?.checked) matchedRules.push({ name: "Self-Drawn (Zi Mo)", fan: 1 });
  if (isConcealed) matchedRules.push({ name: "Concealed Hand", fan: 1 });
  if (document.getElementById("robbingKong")?.checked) matchedRules.push({ name: "Robbing Kong", fan: 1 });
  if (document.getElementById("replacementTile")?.checked) matchedRules.push({ name: "Replacement Tile", fan: 1 });

  // Dragons & Winds (Excluded if hand is Seven Pairs)
  if (!isSevenPairsHand) {
    if (!matchedRules.some(r => r.name.includes("Three Dragons"))) {
      matchedRules.push(...getDragonPongs(normalTiles));
    }
    if (normalTiles.filter(t => t === currentSeatWind).length >= 3) {
      matchedRules.push({ name: "Seat Wind Pong", fan: 1 });
    }
    if (normalTiles.filter(t => t === currentTableWind).length >= 3) {
      matchedRules.push({ name: "Table Wind Pong", fan: 1 });
    }
  }
  // Chicken Hand
  if (matchedRules.length === 0) {
    matchedRules.push({ name: "Chicken Hand", fan: 0 });
  }

  // Flowers & Seasons
  matchedRules.push(...getFlowerScoring(hand));

  const totalFan = Math.min(matchedRules.reduce((sum, r) => sum + r.fan, 0), MAX_POINTS);
  updateDisplay(totalFan, matchedRules);
}

function updateDisplay(totalFan, matchedRules) {
  const scoreEl = document.getElementById("score");
  const rulesEl = document.getElementById("rules");

  if (scoreEl) scoreEl.textContent = totalFan;

  if (rulesEl) {
    if (matchedRules.length === 0) {
      rulesEl.innerHTML = `<span class="placeholder-text">No rules matched</span>`;
    } else {
      rulesEl.innerHTML = matchedRules
        .map(r => `<div>• ${r.name} — <strong>${r.fan} fan</strong></div>`)
        .join("");
    }
  }
}

// --- Hand Management ---

function clearHand() {
  hand = [];
  
  const checkboxesToReset = ["ziMo", "concealedHand", "robbingKong", "replacementTile", "instantFlowerWin", "heavenlyHand", "earthlyHand"];
  checkboxesToReset.forEach(id => {
    const cb = document.getElementById(id);
    if (cb) {
      cb.checked = false;
      if (id === "heavenlyHand" || id === "earthlyHand") cb.disabled = true;
    }
  });

  renderHand();
  
  const scoreEl = document.getElementById("score");
  const rulesEl = document.getElementById("rules");

  if (scoreEl) scoreEl.textContent = "0";
  if (rulesEl) {
    rulesEl.innerHTML = `<span class="info-text">You need 14 non-flower tiles for score calculation (Currently: 0/14).</span>`;
  }
  
  updateTileCount();
}

function updateTileCount() {
  const countEl = document.getElementById("tileCount");
  if (countEl) countEl.textContent = `Tiles: ${hand.length}`;
}

function renderHand() {
  const handBox = document.getElementById("hand");
  if (!handBox) return;
  handBox.innerHTML = "";

  hand.forEach((t, i) => {
    const img = document.createElement("img");
    img.src = t;
    img.alt = t;
    img.className = "hand-tile";
    img.onclick = () => removeTile(i);
    handBox.appendChild(img);
  });
}

function addTile(tilePath) {
  const isFlowerOrSeason = flowersandseasons.includes(tilePath);
  const maxAllowed = isFlowerOrSeason ? 1 : 4;
  const count = hand.filter(t => t === tilePath).length;

  if (count >= maxAllowed) return;

  hand.push(tilePath);
  renderHand();
  updateTileCount();
  calculateScore();
}

function removeTile(index) {
  hand.splice(index, 1);
  renderHand();
  updateTileCount();
  calculateScore();
}

function renderRow(rowId, tiles) {
  const row = document.getElementById(rowId);
  if (!row) return;

  tiles.forEach(tilePath => {
    const btn = document.createElement("button");
    btn.className = "tile-btn";

    const img = document.createElement("img");
    img.src = tilePath;
    img.alt = tilePath;
    btn.appendChild(img);

    btn.onclick = () => addTile(tilePath);
    row.appendChild(btn);
  });
}

// --- Max Points Slider ---
const slider = document.getElementById("maxPoints");
const sliderValue = document.getElementById("maxPointsValue");

if (slider && sliderValue) {
  slider.addEventListener("input", (e) => {
    MAX_POINTS = parseInt(e.target.value);
    sliderValue.textContent = MAX_POINTS;
    calculateScore();
  });
}

document.getElementById("clearBtn")?.addEventListener("click", clearHand);

// Initialize board
renderRow("honors", honors);
renderRow("characters", characters);
renderRow("circles", circles);
renderRow("bamboos", bamboos);
renderRow("flowersandseasons", flowersandseasons);

updateTileCount();

window.clearHand = clearHand;
window.addTile = addTile;
window.removeTile = removeTile;