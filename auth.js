let currentAuthMode = "login";

function showAuthError(message) {
  const errorEl = document.getElementById("authErrorMsg");
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
}

function hideAuthError() {
  const errorEl = document.getElementById("authErrorMsg");
  if (!errorEl) return;
  errorEl.textContent = "";
  errorEl.classList.add("hidden");
}

function setAuthMode(mode) {
  currentAuthMode = mode === "signup" ? "signup" : "login";

  const titleEl = document.getElementById("authModalTitle");
  const submitBtn = document.getElementById("authSubmitBtn");
  const tabLoginBtn = document.getElementById("tabLoginBtn");
  const tabSignupBtn = document.getElementById("tabSignupBtn");
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
  hideAuthError();
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
  hideAuthError();
}

function renderAuthHeader(user) {
  const guestActions = document.getElementById("guestAuthActions");
  const userActions = document.getElementById("userAuthActions");
  const avatarEl = document.getElementById("headerAvatar");
  const nameEl = document.getElementById("headerDisplayName");

  if (user && user.username) {
    guestActions?.classList.add("hidden");
    userActions?.classList.remove("hidden");
    if (avatarEl && user.avatar_url) {
      avatarEl.src = user.avatar_url;
    }
    if (nameEl) {
      nameEl.textContent = user.display_name || user.username;
    }
  } else {
    guestActions?.classList.remove("hidden");
    userActions?.classList.add("hidden");
  }
}

async function fetchCurrentSessionUser() {
  try {
    const res = await fetch("/api/me", { credentials: "same-origin" });
    if (!res.ok) {
      renderAuthHeader(null);
      return null;
    }
    const user = await res.json();
    renderAuthHeader(user);
    return user;
  } catch (err) {
    renderAuthHeader(null);
    return null;
  }
}

async function handleAuthFormSubmit(e) {
  e.preventDefault();
  const usernameInput = document.getElementById("authUsername");
  const passwordInput = document.getElementById("authPassword");
  const submitBtn = document.getElementById("authSubmitBtn");

  const username = (usernameInput?.value || "").trim();
  const password = passwordInput?.value || "";

  hideAuthError();

  if (currentAuthMode === "signup") {
    if (username.length < 3) {
      showAuthError("Username must be at least 3 characters long.");
      return;
    }
    if (password.length < 6) {
      showAuthError("Password must be at least 6 characters long.");
      return;
    }
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
      showAuthError(data.detail || "Authentication failed.");
      return;
    }

    renderAuthHeader(data);
    closeAuthModal();

    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") === "login") {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  } catch (err) {
    showAuthError("Could not connect to server.");
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
  if (!user && params.get("auth") === "login") {
    openAuthModal("login");
  }
});

window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.handleLogout = handleLogout;
