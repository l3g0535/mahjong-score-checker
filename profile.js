const ALL_PROFILE_TILES = [
  "tiles/01-white-dragon.svg",
  "tiles/02-green-dragon.svg",
  "tiles/03-red-dragon.svg",
  "tiles/04-east-wind.svg",
  "tiles/05-south-wind.svg",
  "tiles/06-west-wind.svg",
  "tiles/07-north-wind.svg",
  "tiles/08-characters-1.svg",
  "tiles/09-characters-2.svg",
  "tiles/10-characters-3.svg",
  "tiles/11-characters-4.svg",
  "tiles/12-characters-5.svg",
  "tiles/13-characters-6.svg",
  "tiles/14-characters-7.svg",
  "tiles/15-characters-8.svg",
  "tiles/16-characters-9.svg",
  "tiles/17-circles-1.svg",
  "tiles/18-circles-2.svg",
  "tiles/19-circles-3.svg",
  "tiles/20-circles-4.svg",
  "tiles/21-circles-5.svg",
  "tiles/22-circles-6.svg",
  "tiles/23-circles-7.svg",
  "tiles/24-circles-8.svg",
  "tiles/25-circles-9.svg",
  "tiles/26-bamboos-1.svg",
  "tiles/27-bamboos-2.svg",
  "tiles/28-bamboos-3.svg",
  "tiles/29-bamboos-4.svg",
  "tiles/30-bamboos-5.svg",
  "tiles/31-bamboos-6.svg",
  "tiles/32-bamboos-7.svg",
  "tiles/33-bamboos-8.svg",
  "tiles/34-bamboos-9.svg",
  "tiles/35-spring.svg",
  "tiles/36-summer.svg",
  "tiles/37-autumn.svg",
  "tiles/38-winter.svg",
  "tiles/39-plum.svg",
  "tiles/40-orchid.svg",
  "tiles/41-chrysanthemum.svg",
  "tiles/42-bamboo.svg"
];

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];

let selectedAvatarUrl = "tiles/01-white-dragon.svg";

function showFeedback(elId, message, isError = false) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = message;
  el.classList.remove("hidden", "error-feedback", "success-feedback");
  el.classList.add(isError ? "error-feedback" : "success-feedback");
}

function hideFeedback(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = "";
  el.classList.add("hidden");
}

function formatJoinDate(isoString) {
  if (!isoString) return "";
  const dt = new Date(isoString);
  if (Number.isNaN(dt.getTime())) return "";
  return `Joined ${dt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  })}`;
}

function updateSelectedAvatarPreview(avatarUrl) {
  selectedAvatarUrl = avatarUrl;
  const previewEl = document.getElementById("profileAvatarPreview");
  if (previewEl) {
    previewEl.src = avatarUrl;
  }

  const buttons = document.querySelectorAll(".avatar-tile-option");
  buttons.forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.tile === avatarUrl);
  });
}

function renderAvatarTileGrid() {
  const grid = document.getElementById("avatarPickerGrid");
  if (!grid) return;
  grid.innerHTML = "";

  ALL_PROFILE_TILES.forEach(tilePath => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "avatar-tile-option";
    btn.dataset.tile = tilePath;
    if (tilePath === selectedAvatarUrl) {
      btn.classList.add("selected");
    }

    const img = document.createElement("img");
    img.src = tilePath;
    img.alt = tilePath;
    btn.appendChild(img);

    btn.addEventListener("click", () => {
      hideFeedback("avatarErrorMsg");
      updateSelectedAvatarPreview(tilePath);
    });

    grid.appendChild(btn);
  });
}

function renderPlayHistory(historyList) {
  const countBadge = document.getElementById("playHistoryCount");
  const emptyEl = document.getElementById("playHistoryEmpty");
  const tableWrapper = document.getElementById("playHistoryTableWrapper");
  const tbody = document.getElementById("playHistoryBody");

  const items = Array.isArray(historyList) ? historyList : [];
  if (countBadge) {
    countBadge.textContent = `${items.length} ${items.length === 1 ? "Hand" : "Hands"}`;
  }

  if (items.length === 0) {
    emptyEl?.classList.remove("hidden");
    tableWrapper?.classList.add("hidden");
    return;
  }

  emptyEl?.classList.add("hidden");
  tableWrapper?.classList.remove("hidden");
  if (!tbody) return;
  tbody.innerHTML = "";

  items.forEach(entry => {
    const tr = document.createElement("tr");

    const handTd = document.createElement("td");
    const tilesContainer = document.createElement("div");
    tilesContainer.className = "history-hand-tiles";

    let tiles = [];
    if (Array.isArray(entry.winning_hand)) {
      tiles = entry.winning_hand;
    } else if (typeof entry.winning_hand === "string") {
      try {
        const parsed = JSON.parse(entry.winning_hand);
        tiles = Array.isArray(parsed) ? parsed : entry.winning_hand.split(",").filter(Boolean);
      } catch (err) {
        tiles = entry.winning_hand.split(",").filter(Boolean);
      }
    }

    tiles.forEach(tilePath => {
      const img = document.createElement("img");
      img.src = tilePath.trim();
      img.alt = tilePath.trim();
      img.className = "history-mini-tile";
      tilesContainer.appendChild(img);
    });
    handTd.appendChild(tilesContainer);

    const scoreTd = document.createElement("td");
    scoreTd.className = "history-fan-cell";
    scoreTd.textContent = `${entry.fan_score} Fan`;

    const ptsTd = document.createElement("td");
    const delta = Number(entry.point_delta) || 0;
    const ptsClass = delta > 0 ? "pts-positive" : delta < 0 ? "pts-negative" : "pts-neutral";
    const ptsLabel = delta > 0 ? `+${delta} pts` : `${delta} pts`;
    ptsTd.innerHTML = `<span class="seat-points-chip ${ptsClass}">${ptsLabel}</span>`;

    const sessionTd = document.createElement("td");
    sessionTd.textContent = entry.table_session || "Standard Table";

    tr.appendChild(handTd);
    tr.appendChild(scoreTd);
    tr.appendChild(ptsTd);
    tr.appendChild(sessionTd);
    tbody.appendChild(tr);
  });
}

function populateProfileView(user) {
  const headerName = document.getElementById("profileHeaderDisplayName");
  const usernameBadge = document.getElementById("profileUsernameBadge");
  const totalPointsBadge = document.getElementById("profileTotalPointsBadge");
  const joinedDate = document.getElementById("profileJoinedDate");
  const displayNameInput = document.getElementById("profileDisplayName");
  const bioInput = document.getElementById("profileBio");
  const adminLink = document.getElementById("profileAdminLink");

  if (headerName) headerName.textContent = user.display_name || user.username;
  if (usernameBadge) usernameBadge.textContent = `@${user.username}`;
  if (totalPointsBadge) {
    const pts = Number(user.total_points) || 0;
    totalPointsBadge.textContent = pts > 0 ? `+${pts} pts` : `${pts} pts`;
    totalPointsBadge.className = `seat-points-chip ${pts > 0 ? "pts-positive" : pts < 0 ? "pts-negative" : "pts-neutral"}`;
  }
  if (joinedDate) joinedDate.textContent = formatJoinDate(user.created_at);
  if (displayNameInput) displayNameInput.value = user.display_name || user.username;
  if (bioInput) bioInput.value = user.bio || "";
  if (adminLink) {
    adminLink.classList.toggle("hidden", !user.is_admin);
  }

  updateSelectedAvatarPreview(user.avatar_url || "tiles/01-white-dragon.svg");
  renderPlayHistory(user.play_history || []);
}

async function loadProfile() {
  try {
    const res = await fetch("/api/me", { credentials: "same-origin" });
    if (res.status === 401) {
      window.location.href = "lobby.html?auth=login";
      return;
    }
    if (!res.ok) {
      showFeedback("profileSaveFeedback", "Failed to load profile.", true);
      return;
    }
    const user = await res.json();
    populateProfileView(user);
  } catch (err) {
    showFeedback("profileSaveFeedback", "Could not connect to server.", true);
  }
}

function handleCustomAvatarChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  hideFeedback("avatarErrorMsg");

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    showFeedback(
      "avatarErrorMsg",
      "Unsupported file format. Please choose a PNG, JPEG, or WebP image.",
      true
    );
    e.target.value = "";
    return;
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    showFeedback(
      "avatarErrorMsg",
      "Image exceeds the 2MB size limit. Please choose a smaller image.",
      true
    );
    e.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = event => {
    const dataUrl = event.target?.result;
    if (typeof dataUrl === "string") {
      updateSelectedAvatarPreview(dataUrl);
    }
  };
  reader.readAsDataURL(file);
}

async function handleSaveProfile(e) {
  e.preventDefault();
  hideFeedback("profileSaveFeedback");
  hideFeedback("avatarErrorMsg");

  const displayNameInput = document.getElementById("profileDisplayName");
  const bioInput = document.getElementById("profileBio");
  const saveBtn = document.getElementById("saveProfileBtn");

  const payload = {
    display_name: (displayNameInput?.value || "").trim(),
    bio: (bioInput?.value || "").trim(),
    avatar_url: selectedAvatarUrl
  };

  try {
    if (saveBtn) saveBtn.disabled = true;
    const res = await fetch("/api/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      showFeedback("profileSaveFeedback", data.detail || "Could not update profile.", true);
      return;
    }

    populateProfileView(data);
    showFeedback("profileSaveFeedback", "Profile updated!", false);
  } catch (err) {
    showFeedback("profileSaveFeedback", "Could not connect to server.", true);
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

async function handleChangePassword(e) {
  e.preventDefault();
  hideFeedback("passwordFeedback");

  const newPassword = document.getElementById("newPassword")?.value || "";
  const confirmPassword = document.getElementById("confirmNewPassword")?.value || "";
  const submitBtn = document.getElementById("changePasswordBtn");

  if (newPassword.length < 6) {
    showFeedback("passwordFeedback", "New password must be at least 6 characters long.", true);
    return;
  }

  if (newPassword !== confirmPassword) {
    showFeedback("passwordFeedback", "New password and confirmation do not match.", true);
    return;
  }

  try {
    if (submitBtn) submitBtn.disabled = true;
    const res = await fetch("/api/me/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        new_password: newPassword
      })
    });

    const data = await res.json();
    if (!res.ok) {
      showFeedback("passwordFeedback", data.detail || "Failed to update password.", true);
      return;
    }

    document.getElementById("changePasswordForm")?.reset();
    showFeedback("passwordFeedback", "Password updated!", false);
  } catch (err) {
    showFeedback("passwordFeedback", "Could not connect to server.", true);
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function handleProfileLogout() {
  try {
    await fetch("/api/logout", {
      method: "POST",
      credentials: "same-origin"
    });
  } finally {
    window.location.href = "lobby.html";
  }
}

renderAvatarTileGrid();
loadProfile();

document.getElementById("toggleTilePickerBtn")?.addEventListener("click", () => {
  document.getElementById("avatarPickerGrid")?.classList.toggle("hidden");
});
document.getElementById("customAvatarInput")?.addEventListener("change", handleCustomAvatarChange);
document.getElementById("profileInfoForm")?.addEventListener("submit", handleSaveProfile);
document.getElementById("changePasswordForm")?.addEventListener("submit", handleChangePassword);
document.getElementById("profileLogoutBtn")?.addEventListener("click", handleProfileLogout);
