function showAdminFeedback(message, isError = false) {
  const el = document.getElementById("adminGlobalFeedback");
  if (!el) return;
  el.textContent = message;
  el.classList.remove("hidden", "error-feedback", "success-feedback");
  el.classList.add(isError ? "error-feedback" : "success-feedback");
}

function hideAdminFeedback() {
  const el = document.getElementById("adminGlobalFeedback");
  if (!el) return;
  el.textContent = "";
  el.classList.add("hidden");
}

function buildTableFullUrl(tableNumber) {
  const url = new URL("index.html", window.location.origin + "/");
  url.searchParams.set("table", String(tableNumber));
  return url.toString();
}

function buildQrImageUrl(targetUrl) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=6&data=${encodeURIComponent(targetUrl)}`;
}

function renderPendingWins(pendingWins) {
  const badge = document.getElementById("pendingReviewCountBadge");
  const emptyEl = document.getElementById("pendingWinsEmpty");
  const listEl = document.getElementById("pendingWinsList");

  const items = Array.isArray(pendingWins) ? pendingWins : [];
  if (badge) {
    badge.textContent = `${items.length} Pending`;
  }

  if (!listEl) return;
  listEl.innerHTML = "";

  if (items.length === 0) {
    emptyEl?.classList.remove("hidden");
    return;
  }
  emptyEl?.classList.add("hidden");

  items.forEach(item => {
    const card = document.createElement("div");
    card.className = "pending-win-card";

    const winTypeLabel =
      item.win_type === "zimo"
        ? "Self-Drawn (Zi Mo — all 3 opponents pay)"
        : `Discard Win (Discarder: ${item.discarder_display_name || item.discarder_username || "Opponent"})`;

    const payoutSummary =
      item.win_type === "zimo"
        ? `Supposed Points: Winner +${3 * item.fan_score} pts • Each of the 3 opponents -${item.fan_score} pts`
        : `Supposed Points: Winner +${item.fan_score} pts • Discarder -${item.fan_score} pts`;

    const tilesHtml = (item.winning_hand || [])
      .map(t => `<img src="${t}" alt="${t}" class="history-mini-tile">`)
      .join("");

    const photoHtml = item.hand_photo
      ? `<div class="pending-photo-box">
           <span class="field-hint">Scanned Camera Photo:</span>
           <img src="${item.hand_photo}" alt="Scanned winning hand" class="pending-hand-photo">
         </div>`
      : `<div class="pending-photo-box"><span class="field-hint">No camera photo data attached</span></div>`;

    card.innerHTML = `
      <div class="pending-win-header">
        <div>
          <strong>Table ${item.table_number}</strong> — Winner: <strong>${item.winner_display_name || item.winner_username}</strong> (@${item.winner_username})
          <div class="field-hint">${winTypeLabel}</div>
        </div>
        <span class="lobby-badge lobby-badge-active">${item.fan_score} Fan</span>
      </div>

      ${photoHtml}

      <div class="pending-tiles-section">
        <span class="field-hint">Submitted Winning Tiles:</span>
        <div class="history-hand-tiles">${tilesHtml}</div>
      </div>

      <div class="payout-preview-box">${payoutSummary}</div>

      <div class="pending-review-controls">
        <div class="form-field inline-fan-override">
          <label for="overrideFan_${item.id}">Approved Fan Score:</label>
          <input type="number" id="overrideFan_${item.id}" min="0" max="18" value="${item.fan_score}">
        </div>
        <div class="pending-review-buttons">
          <button type="button" class="primary-btn approve-win-btn" data-id="${item.id}">Approve &amp; Log Points</button>
          <button type="button" class="auth-logout-btn reject-win-btn" data-id="${item.id}">Reject</button>
        </div>
      </div>
    `;

    card.querySelector(".approve-win-btn")?.addEventListener("click", () => {
      const fanInput = document.getElementById(`overrideFan_${item.id}`);
      const fanVal = fanInput ? parseInt(fanInput.value, 10) : item.fan_score;
      handleReviewPendingWin(item.id, "approve", Number.isNaN(fanVal) ? item.fan_score : fanVal);
    });

    card.querySelector(".reject-win-btn")?.addEventListener("click", () => {
      handleReviewPendingWin(item.id, "reject", null);
    });

    listEl.appendChild(card);
  });
}

function renderAdminTables(lobby) {
  const statusBadge = document.getElementById("adminLobbyStatusBadge");
  const tablesBadge = document.getElementById("activeTablesCountBadge");
  const closeBtn = document.getElementById("closeLobbyBtn");
  const emptyEl = document.getElementById("adminTablesEmpty");
  const gridEl = document.getElementById("adminTablesGrid");

  if (!gridEl) return;
  gridEl.innerHTML = "";

  if (!lobby) {
    if (statusBadge) {
      statusBadge.textContent = "No Active Lobby";
      statusBadge.className = "lobby-badge";
    }
    if (tablesBadge) tablesBadge.textContent = "0 Tables";
    closeBtn?.classList.add("hidden");
    emptyEl?.classList.remove("hidden");
    return;
  }

  if (statusBadge) {
    statusBadge.textContent = `Active: ${lobby.name}`;
    statusBadge.className = "lobby-badge lobby-badge-active";
  }
  if (tablesBadge) {
    tablesBadge.textContent = `${lobby.num_tables} ${lobby.num_tables === 1 ? "Table" : "Tables"}`;
  }
  closeBtn?.classList.remove("hidden");
  emptyEl?.classList.add("hidden");

  (lobby.tables || []).forEach(table => {
    const fullUrl = buildTableFullUrl(table.table_number);
    const qrSrc = buildQrImageUrl(fullUrl);
    const card = document.createElement("div");
    card.className = "admin-table-card";

    let seatsHtml = "";
    for (let seatIdx = 1; seatIdx <= 4; seatIdx++) {
      const occupant = (table.seats || []).find(s => s.seat_index === seatIdx);
      if (occupant) {
        const pts = Number(occupant.session_points) || 0;
        const ptsSign = pts > 0 ? `+${pts}` : `${pts}`;
        seatsHtml += `
          <div class="admin-seat-row occupied">
            <div class="admin-seat-user">
              <img src="${occupant.avatar_url || "tiles/01-white-dragon.svg"}" alt="Avatar" class="seat-avatar">
              <div>
                <div class="seat-display-name">Seat ${seatIdx}: ${occupant.display_name || occupant.username}</div>
                <div class="seat-username">@${occupant.username} • <strong>${ptsSign} pts</strong></div>
              </div>
            </div>
            <button type="button" class="auth-logout-btn remove-seat-btn" data-table="${table.table_number}" data-user="${occupant.user_id}">Remove</button>
          </div>
        `;
      } else {
        seatsHtml += `
          <div class="admin-seat-row empty">
            <span class="seat-empty-text">Seat ${seatIdx}: Open</span>
          </div>
        `;
      }
    }

    card.innerHTML = `
      <div class="admin-table-card-header">
        <h4>Table ${table.table_number}</h4>
        <span class="lobby-badge ${table.is_full ? "lobby-badge-active" : ""}">${table.seats.length}/4 Seated</span>
      </div>

      <div class="admin-qr-box">
        <img src="${qrSrc}" alt="QR Code for Table ${table.table_number}" class="admin-qr-img" loading="lazy">
        <div class="admin-nfc-info">
          <div class="field-hint">NFC / QR Target URL:</div>
          <code class="table-url-code">${fullUrl}</code>
          <div class="admin-link-buttons">
            <button type="button" class="secondary-btn small-btn copy-url-btn" data-url="${fullUrl}">Copy Link</button>
            <a href="index.html?table=${table.table_number}" class="secondary-btn small-btn">Open Table ${table.table_number}</a>
          </div>
        </div>
      </div>

      <div class="admin-seats-list">
        ${seatsHtml}
      </div>
    `;

    card.querySelector(".copy-url-btn")?.addEventListener("click", async e => {
      const urlToCopy = e.currentTarget.dataset.url;
      try {
        await navigator.clipboard.writeText(urlToCopy);
        showAdminFeedback(`Copied NFC/QR URL for Table ${table.table_number}!`, false);
      } catch (_) {
        showAdminFeedback(`Table ${table.table_number} URL: ${urlToCopy}`, false);
      }
    });

    card.querySelectorAll(".remove-seat-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const tNum = Number(btn.dataset.table);
        const uId = Number(btn.dataset.user);
        handleRemovePlayerFromSeat(tNum, uId);
      });
    });

    gridEl.appendChild(card);
  });
}

async function loadAdminDashboard() {
  try {
    const meRes = await fetch("/api/me", { credentials: "same-origin" });
    if (meRes.status === 401) {
      window.location.href = "index.html?auth=login";
      return;
    }
    const me = await meRes.json();
    const headerName = document.getElementById("adminHeaderName");
    if (headerName) headerName.textContent = me.display_name || me.username;

    if (!me.is_admin) {
      showAdminFeedback("Access denied: Admin privileges are required to manage lobbies and tables.", true);
      return;
    }

    const [lobbyRes, pendingRes] = await Promise.all([
      fetch("/api/lobby/active", { credentials: "same-origin" }),
      fetch("/api/admin/pending-wins", { credentials: "same-origin" })
    ]);

    if (lobbyRes.ok) {
      const lobbyData = await lobbyRes.json();
      renderAdminTables(lobbyData.lobby);
    }
    if (pendingRes.ok) {
      const pendingData = await pendingRes.json();
      renderPendingWins(pendingData.pending_wins || []);
    }
  } catch (err) {
    showAdminFeedback("Could not connect to server.", true);
  }
}

async function handleCreateLobby(e) {
  e.preventDefault();
  hideAdminFeedback();

  const nameInput = document.getElementById("lobbyNameInput");
  const tablesInput = document.getElementById("lobbyTablesInput");
  const submitBtn = document.getElementById("openLobbyBtn");

  const name = (nameInput?.value || "Mahjong Event Lobby").trim();
  const numTables = parseInt(tablesInput?.value || "4", 10);

  try {
    if (submitBtn) submitBtn.disabled = true;
    const res = await fetch("/api/admin/lobby", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ name, num_tables: numTables })
    });
    const data = await res.json();
    if (!res.ok) {
      showAdminFeedback(data.detail || "Could not open lobby.", true);
      return;
    }
    renderAdminTables(data.lobby);
    renderPendingWins([]);
    showAdminFeedback(`Opened lobby "${data.lobby.name}" with ${data.lobby.num_tables} tables!`, false);
  } catch (err) {
    showAdminFeedback("Could not connect to server.", true);
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function handleCloseLobby() {
  hideAdminFeedback();
  try {
    const res = await fetch("/api/admin/lobby/close", {
      method: "POST",
      credentials: "same-origin"
    });
    const data = await res.json();
    if (!res.ok) {
      showAdminFeedback(data.detail || "Could not close lobby.", true);
      return;
    }
    renderAdminTables(null);
    renderPendingWins([]);
    showAdminFeedback("Closed the active lobby.", false);
  } catch (err) {
    showAdminFeedback("Could not connect to server.", true);
  }
}

async function handleRemovePlayerFromSeat(tableNumber, userId) {
  hideAdminFeedback();
  try {
    const res = await fetch(`/api/admin/tables/${tableNumber}/seats/${userId}`, {
      method: "DELETE",
      credentials: "same-origin"
    });
    const data = await res.json();
    if (!res.ok) {
      showAdminFeedback(data.detail || "Could not remove player.", true);
      return;
    }
    renderAdminTables(data.lobby);
    showAdminFeedback(`Removed player from Table ${tableNumber}.`, false);
  } catch (err) {
    showAdminFeedback("Could not connect to server.", true);
  }
}

async function handleReviewPendingWin(winId, action, fanScore) {
  hideAdminFeedback();
  try {
    const body = { action };
    if (fanScore !== null && fanScore !== undefined) {
      body.fan_score = fanScore;
    }
    const res = await fetch(`/api/admin/pending-wins/${winId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) {
      showAdminFeedback(data.detail || "Review action failed.", true);
      return;
    }
    await loadAdminDashboard();
    showAdminFeedback(
      action === "approve"
        ? "Approved winning hand and updated player points!"
        : "Rejected pending winning hand.",
      false
    );
  } catch (err) {
    showAdminFeedback("Could not connect to server.", true);
  }
}

async function handleAdminLogout() {
  try {
    await fetch("/api/logout", {
      method: "POST",
      credentials: "same-origin"
    });
  } finally {
    window.location.href = "index.html";
  }
}

document.getElementById("createLobbyForm")?.addEventListener("submit", handleCreateLobby);
document.getElementById("closeLobbyBtn")?.addEventListener("click", handleCloseLobby);
document.getElementById("refreshAdminBtn")?.addEventListener("click", loadAdminDashboard);
document.getElementById("adminLogoutBtn")?.addEventListener("click", handleAdminLogout);

loadAdminDashboard();
