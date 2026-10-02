let map = null;
let marker = null;
let sectorLayerGroup = null;
let areaLayerGroup = null;
let sectorById = new Map();
let areaById = new Map();
let subareaById = new Map();
let guideStarted = false;

function setAuthMessage(message = "", kind = "") {
  el.authMessage.textContent = message;
  el.authMessage.className = `auth-message${kind ? ` auth-message--${kind}` : ""}`;
}

function showAuthMode(mode) {
  const login = mode === "login";
  el.loginForm.hidden = !login;
  el.registerForm.hidden = login;
  el.loginTab.classList.toggle("is-active", login);
  el.registerTab.classList.toggle("is-active", !login);
  setAuthMessage();
}

function showLogin(message = "") {
  el.appShell.hidden = true;
  el.authScreen.hidden = false;
  showAuthMode("login");
  if (message) setAuthMessage(message, "error");
}

function showGuide() {
  el.authScreen.hidden = true;
  el.appShell.hidden = false;

  if (!guideStarted) {
    initMap();
    bindEvents();
    renderStats();
    renderFilters();
    render();
    guideStarted = true;
  } else {
    setTimeout(() => map?.resize(), 0);
  }
  loadAllData();
}

function bindAuthEvents() {
  el.loginTab.addEventListener("click", () => showAuthMode("login"));
  el.registerTab.addEventListener("click", () => showAuthMode("register"));

  el.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = el.loginForm.querySelector("button[type=submit]");
    button.disabled = true;
    button.textContent = "Logging in…";
    setAuthMessage();

    const result = await loginUser(el.loginUsername.value.trim(), el.loginPassword.value);
    button.disabled = false;
    button.textContent = "Log in";

    if (!result.ok) {
      setAuthMessage(String(result.error), "error");
      return;
    }
    el.loginPassword.value = "";
    showGuide();
  });

  el.registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (el.registerPassword.value !== el.registerPasswordConfirm.value) {
      setAuthMessage("Passwords do not match.", "error");
      return;
    }

    const button = el.registerForm.querySelector("button[type=submit]");
    button.disabled = true;
    button.textContent = "Creating account…";
    setAuthMessage();

    const result = await registerUser(
      el.registerUsername.value.trim(),
      el.registerEmail.value.trim(),
      el.registerPassword.value,
      el.registerPasswordConfirm.value
    );

    button.disabled = false;
    button.textContent = "Create account";
    if (!result.ok) {
      setAuthMessage(String(result.error), "error");
      return;
    }

    const username = el.registerUsername.value.trim();
    el.registerForm.reset();
    showAuthMode("login");
    el.loginUsername.value = username;
    setAuthMessage("Account created. Log in to open the guide.", "success");
    el.loginPassword.focus();
  });

  el.logoutButton.addEventListener("click", () => {
    clearAuthTokens();
    showLogin();
  });

  window.addEventListener("lolo:auth-expired", () => {
    showLogin("Your session expired. Please log in again.");
  });
}

function init() {
  bindAuthEvents();
  if (state.auth.accessToken) showGuide();
  else showLogin();
}

init();
