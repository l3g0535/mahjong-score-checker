// Forward legacy deep links (NFC/QR tags, auth links) to the lobby dashboard.
(function forwardLegacyLinks() {
  const params = new URLSearchParams(window.location.search);
  if (params.has("table") || params.has("auth")) {
    window.location.replace("lobby.html" + window.location.search);
  }
})();

// Preview switch: ?v=a (default) or ?v=b
(function applyVariant() {
  const v = new URLSearchParams(window.location.search).get("v") === "b" ? "b" : "a";
  document.documentElement.dataset.variant = v;
  const link = document.getElementById("landingTheme");
  if (link) link.setAttribute("href", `landing-${v}.css`);
})();

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

document.addEventListener("DOMContentLoaded", () => {
  buildHeroTiles();
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const nav = document.getElementById("landingNav");
  const tiles = document.getElementById("heroTiles");
  const hero = document.getElementById("hero");

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
