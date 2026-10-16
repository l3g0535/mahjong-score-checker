let activeLobbyState = null;
let mySeatState = null;
let handScannedByCamera = false;
let lastScannedPhotoDataUrl = "";
let autoJoinAttemptedForTable = null;

function showTableFeedback(message, isError = false) {
  const el = document.getElementById("tableWinFeedback");
  if (!el) return;
  el.textContent = message;
  el.classList.remove("hidden", "error-feedback", "success-feedback");
  el.classList.add(isError ? "error-feedback" : "success-feedback");
}

function hideTableFeedback() {
  const el = document.getElementById("tableWinFeedback");
  if (!el) return;
  el.textContent = "";
  el.classList.add("hidden");
}

function formatPointsBadge(pts) {
  const n = Number(pts) || 0;
  if (n > 0) return `+${n} pts`;
  return `${n} pts`;
}

function markHandScanned(imageDataUrl) {
  handScannedByCamera = true;
  lastScannedPhotoDataUrl = typeof imageDataUrl === "string" ? imageDataUrl : "";

  const badge = document.getElementById("scanStatusBadge");
  const thumb = document.getElementById("scannedPhotoThumb");
  if (badge) {
    badge.textContent = "Camera scan complete — verify or fix tiles below, then log your win";
    badge.classList.remove("scan-badge-pending");
    badge.classList.add("scan-badge-ready");
  }
  if (thumb && lastScannedPhotoDataUrl) {
    thumb.src = lastScannedPhotoDataUrl;
    thumb.classList.remove("hidden");
  }
  document.getElementById("editHandBtn")?.classList.remove("hidden");
  updateWinPayoutUI();
}

function resetHandScanState() {
  document.getElementById("editHandBtn")?.classList.add("hidden");
  document.getElementById("editHandSection")?.classList.add("hidden");
  const editBtn = document.getElementById("editHandBtn");
  if (editBtn) editBtn.textContent = "Edit wrongly scanned tiles";
  handScannedByCamera = false;
  lastScannedPhotoDataUrl = "";

  const badge = document.getElementById("scanStatusBadge");
  const thumb = document.getElementById("scannedPhotoThumb");
  if (badge) {
    badge.textContent = "Not scanned yet — camera scan required to log a table win";
    badge.classList.add("scan-badge-pending");
    badge.classList.remove("scan-badge-ready");
  }
  if (thumb) {
    thumb.src = "";
    thumb.classList.add("hidden");
  }
  updateWinPayoutUI();
}

const IS_LOBBY_PAGE = Boolean(document.getElementById("availableTablesList"));
const IS_TABLE_PAGE = Boolean(document.getElementById("tableSeatsGrid"));

// index.html = table sessions (lobby), table.html = inside a table session.
function routeBySeat() {
  const seated = Boolean(getMyTableObj());
  if (IS_LOBBY_PAGE && seated) {
    window.location.replace("table.html");
    return true;
  }
  if (IS_TABLE_PAGE && !seated) {
    window.location.replace("index.html");
    return true;
  }
  return false;
}

function getMyTableObj() {
  if (!activeLobbyState || !mySeatState) return null;
  const tables = activeLobbyState.tables || [];
  return tables.find(t => t.table_number === mySeatState.table_number) || null;
}
function renderAvailableTables() {
  const listEl = document.getElementById("availableTablesList");
  if (!listEl) return;

  const tables = activeLobbyState?.tables || [];
  if (!activeLobbyState || getMyTableObj() || tables.length === 0) {
    listEl.classList.add("hidden");
    listEl.innerHTML = "";
    return;
  }

  listEl.innerHTML = "";
  listEl.classList.remove("hidden");
  const loggedIn = Boolean(window.currentSessionUser);

  tables.forEach(t => {
    const seats = t.seats || [];
    const seated = seats.length;
    const isFull = seated >= 4;
    const card = document.createElement("div");
    card.className = `available-table-card ${isFull ? "full" : "open"}`;

    const visual = document.createElement("div");
    visual.className = "mj-table-visual";
    for (let i = 1; i <= 4; i++) {
      const occupant = seats.find(s => s.seat_index === i);
      const seat = document.createElement("div");
      seat.className = `mj-seat mj-seat-${i}${occupant ? " taken" : ""}`;
      if (occupant) {
        seat.title = occupant.display_name || occupant.username || "";
        const img = document.createElement("img");
        img.src = occupant.avatar_url || "tiles/01-white-dragon.svg";
        img.alt = "";
        seat.appendChild(img);
      }
      visual.appendChild(seat);
    }
    const felt = document.createElement("div");
    felt.className = "mj-table-felt";
    felt.textContent = t.table_number;
    visual.appendChild(felt);

    const title = document.createElement("div");
    title.className = "available-table-name";
    title.textContent = `Table ${t.table_number}`;
    const count = document.createElement("div");
    count.className = "available-table-count";
    count.textContent = isFull ? "Full — 4 of 4 seats taken" : `${seated} of 4 seats taken`;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "primary-btn small-btn";
    btn.textContent = isFull ? "Full" : loggedIn ? "Join" : "Log in to join";
    btn.disabled = isFull || !loggedIn;
    btn.addEventListener("click", () => joinTableByNumber(t.table_number));

    card.append(visual, title, count, btn);
    listEl.appendChild(card);
  });
}

function renderTableSessionCard() {
  renderAvailableTables();
  const badgeEl = document.getElementById("lobbyStatusBadge");
  const titleEl = document.getElementById("tableSessionTitle");
  const hintEl = document.getElementById("tableSessionHint");
  const seatsGridEl = document.getElementById("tableSeatsGrid");
  const leaveBtn = document.getElementById("leaveTableBtn");
  const payoutControls = document.getElementById("winPayoutControls");

  if (!activeLobbyState) {
    if (badgeEl) {
      badgeEl.textContent = "No Active Lobby";
      badgeEl.className = "lobby-badge";
    }
    if (titleEl) titleEl.textContent = "Table Session";
    if (hintEl) {
      hintEl.innerHTML =
        "No event lobby is currently open. Once an Admin opens a lobby, scan your table's NFC tag or QR code (e.g. <code>/?table=1</code>) to join.";
    }
    seatsGridEl?.classList.add("hidden");
    leaveBtn?.classList.add("hidden");
    payoutControls?.classList.add("hidden");
    return;
  }

  if (badgeEl) {
    badgeEl.textContent = `${activeLobbyState.name} (${activeLobbyState.num_tables} Tables)`;
    badgeEl.className = "lobby-badge lobby-badge-active";
  }

  const myTable = getMyTableObj();
  if (!myTable) {
    if (titleEl) titleEl.textContent = "Not Seated at a Table";
    if (hintEl) {
      hintEl.innerHTML = window.currentSessionUser
        ? `Scan your table's NFC tag or QR code (<code>/?table=1</code> … <code>/?table=${activeLobbyState.num_tables}</code>) or pick a table below to take a seat.`
        : `Log in and scan your table's NFC tag or QR code (<code>/?table=1</code> … <code>/?table=${activeLobbyState.num_tables}</code>) or pick a table below to take a seat.`;
    }
    seatsGridEl?.classList.add("hidden");
    leaveBtn?.classList.add("hidden");
    payoutControls?.classList.add("hidden");
    return;
  }

  if (titleEl) {
    titleEl.textContent = `Table ${myTable.table_number} (${myTable.seats.length}/4 Seated)`;
  }
  if (hintEl) {
    const pendingCount = (myTable.pending_wins || []).length;
    const pendingText =
      pendingCount > 0 ? ` • ${pendingCount} hand(s) awaiting Admin review` : "";
    hintEl.textContent =
      myTable.seats.length < 4
        ? `Waiting for ${4 - myTable.seats.length} more player(s) to join Table ${myTable.table_number} before wins can be logged.${pendingText}`
        : `All 4 seats filled! Scan your winning hand with the camera to log points.${pendingText}`;
  }

  leaveBtn?.classList.remove("hidden");
  payoutControls?.classList.remove("hidden");

  if (seatsGridEl) {
    seatsGridEl.innerHTML = "";
    seatsGridEl.classList.remove("hidden");

    for (let seatIdx = 1; seatIdx <= 4; seatIdx++) {
      const occupant = myTable.seats.find(s => s.seat_index === seatIdx);
      const seatCard = document.createElement("div");
      const isMe = occupant && window.currentSessionUser && occupant.user_id === window.currentSessionUser.id;
      seatCard.className = `table-seat-slot ${occupant ? "occupied" : "empty"} ${isMe ? "my-seat-slot" : ""}`;

      if (occupant) {
        const pts = Number(occupant.session_points) || 0;
        const ptsClass = pts > 0 ? "pts-positive" : pts < 0 ? "pts-negative" : "pts-neutral";
        seatCard.innerHTML = `
          <div class="seat-slot-top">
            <span class="seat-slot-number">Seat ${seatIdx}${isMe ? " (You)" : ""}</span>
            <span class="seat-points-chip ${ptsClass}">${formatPointsBadge(pts)}</span>
          </div>
          <div class="seat-player-row">
            <img src="${occupant.avatar_url || "tiles/01-white-dragon.svg"}" alt="Avatar" class="seat-avatar">
            <div class="seat-player-names">
              <div class="seat-display-name">${occupant.display_name || occupant.username}</div>
              <div class="seat-username">@${occupant.username}</div>
            </div>
          </div>
        `;
      } else {
        seatCard.innerHTML = `
          <div class="seat-slot-top">
            <span class="seat-slot-number">Seat ${seatIdx}</span>
            <span class="seat-open-label">Open</span>
          </div>
          <div class="seat-empty-text">Waiting for player...</div>
        `;
      }
      seatsGridEl.appendChild(seatCard);
    }
  }

  populateDiscarderOptions(myTable);
  updateWinPayoutUI();
}

function populateDiscarderOptions(myTable) {
  const selectEl = document.getElementById("discarderSelect");
  if (!selectEl || !myTable) return;
  const previousValue = selectEl.value;
  const myUserId = window.currentSessionUser?.id;

  const opponents = (myTable.seats || []).filter(s => s.user_id !== myUserId);
  selectEl.innerHTML = `<option value="">-- Select opponent who discarded --</option>`;
  opponents.forEach(opp => {
    const opt = document.createElement("option");
    opt.value = String(opp.user_id);
    opt.textContent = `${opp.display_name || opp.username} (@${opp.username})`;
    selectEl.appendChild(opt);
  });

  if (previousValue && opponents.some(o => String(o.user_id) === previousValue)) {
    selectEl.value = previousValue;
  }
}

function updateWinPayoutUI() {
  const myTable = getMyTableObj();
  const discarderGroup = document.getElementById("discarderPickerGroup");
  const discarderSelect = document.getElementById("discarderSelect");
  const previewBox = document.getElementById("payoutPreviewBox");
  const logWinBtn = document.getElementById("logWinBtn");
  const reviewCb = document.getElementById("sendToAdminReviewCb");

  const handState = typeof window.getHandState === "function"
    ? window.getHandState()
    : { hand: [], isValidHand: false, totalFan: 0, isZiMo: false };

  if (discarderGroup) {
    discarderGroup.classList.toggle("hidden", handState.isZiMo);
  }

  const requireReview = Boolean(reviewCb?.checked);
  if (logWinBtn) {
    logWinBtn.textContent = requireReview
      ? "Submit Scanned Hand for Admin Review"
      : "Log Winning Hand";
  }

  if (!myTable) {
    if (logWinBtn) logWinBtn.disabled = true;
    return;
  }

  const allFourSeated = (myTable.seats || []).length === 4;
  const myUserId = window.currentSessionUser?.id;
  const opponents = (myTable.seats || []).filter(s => s.user_id !== myUserId);
  const selectedDiscarderId = discarderSelect?.value ? Number(discarderSelect.value) : null;
  const fan = Number(handState.totalFan) || 0;

  if (previewBox) {
    if (!allFourSeated) {
      previewBox.textContent = `Table ${myTable.table_number} needs all 4 seated players before a win can be logged (${myTable.seats.length}/4 seated).`;
    } else if (!handScannedByCamera) {
      previewBox.textContent = "Step 1: Scan your winning hand with your phone camera above.";
    } else if (!handState.isValidHand) {
      previewBox.textContent = "Step 2: Ensure the hand has 14 valid winning tiles (adjust any misdetected tiles on the keyboard below).";
    } else if (handState.isZiMo) {
      const oppNames = opponents.map(o => o.display_name || o.username).join(", ");
      previewBox.textContent = `Self-Drawn (${fan} Fan): You gain +${3 * fan} pts • ${oppNames} each lose -${fan} pts.`;
    } else if (!selectedDiscarderId) {
      previewBox.textContent = `Discard Win (${fan} Fan): Select which opponent discarded the winning tile.`;
    } else {
      const disc = opponents.find(o => o.user_id === selectedDiscarderId);
      const discName = disc ? disc.display_name || disc.username : "Selected opponent";
      previewBox.textContent = `Discard Win (${fan} Fan): You gain +${fan} pts • ${discName} loses -${fan} pts (other 2 players: 0 pts).`;
    }
  }

  const canSubmit =
    allFourSeated &&
    handScannedByCamera &&
    handState.isValidHand &&
    (handState.isZiMo || Boolean(selectedDiscarderId));

  if (logWinBtn) {
    logWinBtn.disabled = !canSubmit;
  }
}

async function fetchActiveLobbyState() {
  try {
    const res = await fetch("/api/lobby/active", { credentials: "same-origin" });
    if (!res.ok) return;
    const data = await res.json();
    activeLobbyState = data.lobby || null;
    mySeatState = data.my_seat || null;
    renderTableSessionCard();
    if (routeBySeat()) return;
    await maybeAutoJoinTableFromUrl();
  } catch (err) {
    console.error("Failed to fetch active lobby:", err);
  }
}

async function maybeAutoJoinTableFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const tableParam = params.get("table");
  if (!tableParam) return;

  const tableNum = parseInt(tableParam, 10);
  if (Number.isNaN(tableNum) || tableNum < 1) return;

  if (!window.currentSessionUser) {
    return;
  }

  if (mySeatState && mySeatState.table_number === tableNum) {
    return;
  }

  if (autoJoinAttemptedForTable === `${window.currentSessionUser.id}:${tableNum}`) {
    return;
  }
  autoJoinAttemptedForTable = `${window.currentSessionUser.id}:${tableNum}`;

  await joinTableByNumber(tableNum);
}

async function joinTableByNumber(tableNumber) {
  hideTableFeedback();
  try {
    const res = await fetch(`/api/tables/${tableNumber}/join`, {
      method: "POST",
      credentials: "same-origin"
    });
    const data = await res.json();
    if (!res.ok) {
      showTableFeedback(data.detail || `Could not join Table ${tableNumber}.`, true);
      return;
    }
    activeLobbyState = data.lobby || null;
    mySeatState = data.my_seat || null;
    renderTableSessionCard();
    showTableFeedback(`Joined Table ${tableNumber}!`, false);
    routeBySeat();
  } catch (err) {
    showTableFeedback("Could not connect to server to join table.", true);
  }
}

async function handleLeaveTable() {
  hideTableFeedback();
  try {
    const res = await fetch("/api/tables/leave", {
      method: "POST",
      credentials: "same-origin"
    });
    const data = await res.json();
    if (!res.ok) {
      showTableFeedback(data.detail || "Could not leave table.", true);
      return;
    }
    activeLobbyState = data.lobby || null;
    mySeatState = data.my_seat || null;
    const params = new URLSearchParams(window.location.search);
    if (params.has("table")) {
      params.delete("table");
      const qs = params.toString();
      window.history.replaceState({}, document.title, window.location.pathname + (qs ? `?${qs}` : ""));
    }
    renderTableSessionCard();
    showTableFeedback("You have left the table.", false);
    routeBySeat();
  } catch (err) {
    showTableFeedback("Could not connect to server.", true);
  }
}

async function handleSubmitTableWin() {
  hideTableFeedback();
  const myTable = getMyTableObj();
  if (!myTable) return;

  const handState = typeof window.getHandState === "function" ? window.getHandState() : null;
  if (!handState || !handState.isValidHand) {
    showTableFeedback("Please complete a valid winning hand before logging.", true);
    return;
  }

  const discarderSelect = document.getElementById("discarderSelect");
  const reviewCb = document.getElementById("sendToAdminReviewCb");
  const logWinBtn = document.getElementById("logWinBtn");

  const winType = handState.isZiMo ? "zimo" : "discard";
  const discarderId = winType === "discard" && discarderSelect?.value
    ? Number(discarderSelect.value)
    : null;

  const payload = {
    winning_hand: handState.hand,
    fan_score: handState.totalFan,
    win_type: winType,
    discarder_user_id: discarderId,
    seat_wind: handState.seatWind,
    table_wind: handState.tableWind,
    require_admin_review: Boolean(reviewCb?.checked),
    hand_photo: lastScannedPhotoDataUrl || "",
    scanned_by_camera: handScannedByCamera
  };

  try {
    if (logWinBtn) logWinBtn.disabled = true;
    const res = await fetch(`/api/tables/${myTable.table_number}/wins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      showTableFeedback(data.detail || "Failed to log winning hand.", true);
      updateWinPayoutUI();
      return;
    }

    if (data.lobby_state) {
      activeLobbyState = data.lobby_state.lobby || null;
      mySeatState = data.lobby_state.my_seat || null;
    }
    if (reviewCb) reviewCb.checked = false;
    if (typeof window.clearHand === "function") window.clearHand();
    resetHandScanState();
    renderTableSessionCard();

    if (data.status === "pending_review") {
      showTableFeedback(
        "Winning hand photo and supposed points sent to Admin for review!",
        false
      );
    } else {
      showTableFeedback(
        `Winning hand (${payload.fan_score} Fan) logged! Table points updated.`,
        false
      );
    }
  } catch (err) {
    showTableFeedback("Could not connect to server.", true);
  } finally {
    updateWinPayoutUI();
  }
}

document.getElementById("leaveTableBtn")?.addEventListener("click", handleLeaveTable);
document.getElementById("refreshTableBtn")?.addEventListener("click", fetchActiveLobbyState);
document.getElementById("discarderSelect")?.addEventListener("change", updateWinPayoutUI);
document.getElementById("sendToAdminReviewCb")?.addEventListener("change", updateWinPayoutUI);
document.getElementById("logWinBtn")?.addEventListener("click", handleSubmitTableWin);

window.markHandScanned = markHandScanned;
window.resetHandScanState = resetHandScanState;
window.onHandScoreUpdated = updateWinPayoutUI;
window.onAuthStateChanged = () => {
  autoJoinAttemptedForTable = null;
  fetchActiveLobbyState();
};

fetchActiveLobbyState();
