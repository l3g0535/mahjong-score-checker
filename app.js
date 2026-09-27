import { SCORING_RULES } from './rules.js';

const tiles = [
  "🀇","🀈","🀉","🀊","🀋","🀌","🀍","🀎","🀏", // Bamboo
  "🀐","🀑","🀒","🀓","🀔","🀕","🀖","🀗","🀘", // Characters
  "🀙","🀚","🀛","🀜","🀝","🀞","🀟","🀠","🀡", // Dots
  "🀀","🀁","🀂","🀃","🀄","🀅","🀆" // Winds & Dragons
];

let hand = [];

function renderKeyboard() {
  const kb = document.getElementById("keyboard");
  tiles.forEach(tile => {
    const btn = document.createElement("button");
    btn.className = "tile-btn";
    btn.textContent = tile;
    btn.onclick = () => addTile(tile);
    kb.appendChild(btn);
  });
}

function addTile(tile) {
  hand.push(tile);
  document.getElementById("hand").textContent = "Hand: " + hand.join(" ");
}

function calculateScore() {
  let matchedRules = [];

  SCORING_RULES.forEach(rule => {
    if (rule.exampleTiles && rule.exampleTiles.every(t => hand.includes(t))) {
      matchedRules.push(rule);
    }
  });

  const totalFan = matchedRules.reduce((sum, r) => sum + r.fan, 0);

  document.getElementById("score").textContent = "Score: " + totalFan;
  document.getElementById("rules").innerHTML =
    matchedRules.map(r => `<div>${r.name} (${r.chineseName}) — ${r.fan} fan</div>`).join("");
}

document.getElementById("calcBtn").addEventListener("click", calculateScore);

renderKeyboard();
