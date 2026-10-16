let currentAuthMode = "login";
window.currentSessionUser = null;

function setAuthMode(mode) {
  currentAuthMode = mode === "signup" ? "signup" : "login";

  const titleEl = document.getElementById("authModalTitle");
  const submitBtn = document.getElementById("authSubmitBtn");
  const tabLoginBtn = document.getElementById("tabLoginBtn");
  const tabSignupBtn = document.getElementById("tabSignupBtn");
  const errorEl = document.getElementById("authErrorMsg");
  const passwordInput = document.getElementById("authPassword");

  if (titleEl) {
    titleEl.textContent = currentAuthMode === "signup" ? "Create Account" : "Log In";
  }
  if (submitBtn) {
    submitBtn.textContent = currentAuthMode === "signup" ? "Sign Up" : "Log In";
  }
  if (tabLoginBtn) {
    tabLoginBtn.classList.toggle("active", currentAuthMode === "login");
  }
  if (tabSignupBtn) {
    tabSignupBtn.classList.toggle("active", currentAuthMode === "signup");
  }
  if (passwordInput) {
    passwordInput.setAttribute(
      "autocomplete",
      currentAuthMode === "signup" ? "new-password" : "current-password"
    );
  }
  if (errorEl) {
    errorEl.textContent = "";
    errorEl.classList.add("hidden");
  }
}

function openAuthModal(mode = "login") {
  setAuthMode(mode);
  const modal = document.getElementById("authModal");
  modal?.classList.remove("hidden");
  document.getElementById("authUsername")?.focus();
}

function closeAuthModal() {
  const modal = document.getElementById("authModal");
  modal?.classList.add("hidden");
  const form = document.getElementById("authForm");
  form?.reset();
  const errorEl = document.getElementById("authErrorMsg");
  if (errorEl) {
    errorEl.textContent = "";
    errorEl.classList.add("hidden");
  }
}

function renderAuthHeader(user) {
  window.currentSessionUser = user || null;
  const guestActions = document.getElementById("guestAuthActions");
  const userActions = document.getElementById("userAuthActions");
  const avatarEl = document.getElementById("headerAvatar");
  const nameEl = document.getElementById("headerDisplayName");
  const adminLink = document.getElementById("headerAdminLink");

  if (user && user.username) {
    guestActions?.classList.add("hidden");
    userActions?.classList.remove("hidden");
    if (avatarEl && user.avatar_url) {
      avatarEl.src = user.avatar_url;
    }
    if (nameEl) {
      nameEl.textContent = user.display_name || user.username;
    }
    if (adminLink) {
      adminLink.classList.toggle("hidden", !user.is_admin);
    }
  } else {
    guestActions?.classList.remove("hidden");
    userActions?.classList.add("hidden");
    adminLink?.classList.add("hidden");
  }
}

async function fetchCurrentSessionUser() {
  try {
    const res = await fetch("/api/me", { credentials: "same-origin" });
    if (!res.ok) {
      renderAuthHeader(null);
      window.onAuthStateChanged?.(null);
      return null;
    }
    const user = await res.json();
    renderAuthHeader(user);
    window.onAuthStateChanged?.(user);
    return user;
  } catch (err) {
    renderAuthHeader(null);
    window.onAuthStateChanged?.(null);
    return null;
  }
}

async function handleAuthFormSubmit(e) {
  e.preventDefault();
  const usernameInput = document.getElementById("authUsername");
  const passwordInput = document.getElementById("authPassword");
  const errorEl = document.getElementById("authErrorMsg");
  const submitBtn = document.getElementById("authSubmitBtn");

  const username = (usernameInput?.value || "").trim();
  const password = passwordInput?.value || "";

  if (errorEl) {
    errorEl.textContent = "";
    errorEl.classList.add("hidden");
  }

  if (username.length < 3) {
    if (errorEl) {
      errorEl.textContent = "Username must be at least 3 characters long.";
      errorEl.classList.remove("hidden");
    }
    return;
  }

  if (password.length < 6) {
    if (errorEl) {
      errorEl.textContent = "Password must be at least 6 characters long.";
      errorEl.classList.remove("hidden");
    }
    return;
  }

  const endpoint = currentAuthMode === "signup" ? "/api/signup" : "/api/login";

  try {
    if (submitBtn) submitBtn.disabled = true;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) {
      if (errorEl) {
        errorEl.textContent = data.detail || "Authentication failed.";
        errorEl.classList.remove("hidden");
      }
      return;
    }

    renderAuthHeader(data);
    closeAuthModal();
    window.onAuthStateChanged?.(data);

    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") === "login") {
      params.delete("auth");
      const qs = params.toString();
      window.history.replaceState({}, document.title, window.location.pathname + (qs ? `?${qs}` : ""));
    }
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = "Could not connect to server.";
      errorEl.classList.remove("hidden");
    }
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function handleLogout() {
  try {
    await fetch("/api/logout", {
      method: "POST",
      credentials: "same-origin"
    });
  } finally {
    renderAuthHeader(null);
    window.onAuthStateChanged?.(null);
    if (window.location.pathname.endsWith("profile.html") || window.location.pathname.endsWith("admin.html")) {
      window.location.href = "lobby.html";
    }
  }
}

document.getElementById("openAuthModalBtn")?.addEventListener("click", () => openAuthModal("login"));
document.getElementById("closeAuthModalBtn")?.addEventListener("click", closeAuthModal);
document.getElementById("tabLoginBtn")?.addEventListener("click", () => setAuthMode("login"));
document.getElementById("tabSignupBtn")?.addEventListener("click", () => setAuthMode("signup"));
document.getElementById("authForm")?.addEventListener("submit", handleAuthFormSubmit);
document.getElementById("headerLogoutBtn")?.addEventListener("click", handleLogout);

document.getElementById("authModal")?.addEventListener("click", e => {
  if (e.target.id === "authModal") {
    closeAuthModal();
  }
});

// Initialize header auth state on page load
fetchCurrentSessionUser().then(user => {
  const params = new URLSearchParams(window.location.search);
  if (!user && (params.get("auth") === "login" || params.get("table"))) {
    openAuthModal("login");
  }
});

window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.handleLogout = handleLogout;
window.fetchCurrentSessionUser = fetchCurrentSessionUser;
