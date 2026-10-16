// Forward legacy deep links (NFC/QR tags, auth links) to the lobby dashboard.
(function forwardLegacyLinks() {
  const params = new URLSearchParams(window.location.search);
  if (params.has("table") || params.has("auth")) {
    window.location.replace("lobby.html" + window.location.search);
  }
})();

const FALLBACK_HAND = {
  tiles: [
    "08-characters-1", "16-characters-9", "17-circles-1", "25-circles-9", "26-bamboos-1",
    "34-bamboos-9", "04-east-wind", "05-south-wind", "06-west-wind", "07-north-wind",
    "01-white-dragon", "02-green-dragon", "03-red-dragon", "03-red-dragon"
  ].map((n) => `tiles/${n}.svg`),
  hand_name: "Thirteen Orphans",
  fan_score: 13,
  display_name: "a player",
  avatar_url: "tiles/01-white-dragon.svg"
};

const HERO_TILES = [
  "01-white-dragon", "02-green-dragon", "03-red-dragon", "04-east-wind", "05-south-wind",
  "08-characters-1", "12-characters-5", "17-circles-1", "21-circles-5", "26-bamboos-1",
  "30-bamboos-5", "39-plum", "40-orchid", "07-north-wind"
];

function buildHeroTiles() {
  const wrap = document.getElementById("heroTiles");
  if (!wrap) return;
  HERO_TILES.forEach((name, i) => {
    const el = document.createElement("img");
    el.src = `tiles/${name}.svg`;
    el.alt = "";
    el.className = "l-tile";
    el.style.setProperty("--x", `${(i * 37 + 8) % 92}%`);
    el.style.setProperty("--y", `${(i * 53 + 6) % 82}%`);
    el.style.setProperty("--r", `${((i * 29) % 50) - 25}deg`);
    el.style.setProperty("--d", `${(i % 5) * 0.7}s`);
    el.style.setProperty("--depth", String(0.2 + (i % 4) * 0.25));
    wrap.appendChild(el);
  });
}

function renderTopHand(hand) {
  const wrap = document.getElementById("topHandTiles");
  if (!wrap || !hand || !hand.tiles?.length) return;
  wrap.innerHTML = "";
  hand.tiles.forEach((src, i) => {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    img.className = "l-hand-tile";
    img.style.animationDelay = `${0.35 + i * 0.07}s`;
    wrap.appendChild(img);
  });
  document.getElementById("topHandFan").textContent = `${hand.fan_score} fan`;
  document.getElementById("topHandName").textContent = hand.display_name;
  document.getElementById("topHandTitle").textContent = hand.hand_name || "";
  const av = document.getElementById("topHandAvatar");
  if (av && hand.avatar_url) av.src = hand.avatar_url;
}

async function loadTopHand() {
  try {
    const res = await fetch("/api/public/top-hand");
    const data = res.ok ? await res.json() : null;
    renderTopHand(data?.top_hand || FALLBACK_HAND);
  } catch (err) {
    renderTopHand(FALLBACK_HAND);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  buildHeroTiles();
  loadTopHand();
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const nav = document.getElementById("landingNav");
  const hero = document.getElementById("hero");
  const tiles = document.getElementById("heroTiles");

  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    nav?.classList.toggle("scrolled", y > 40);
    if (!reduce && tiles && y < hero.offsetHeight) {
      tiles.style.transform = `translateY(${y * 0.25}px)`;
      tiles.style.opacity = String(Math.max(0, 1 - y / (hero.offsetHeight * 0.9)));
    }
  }, { passive: true });

  const items = document.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.2 });
  items.forEach((el, i) => {
    el.style.transitionDelay = `${(i % 3) * 120}ms`;
    io.observe(el);
  });
});
