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
  const register = mode === "register";
  const forgot = mode === "forgot";
  const reset = mode === "reset";

  el.loginForm.hidden = !login;
  el.registerForm.hidden = !register;
  el.forgotPasswordForm.hidden = !forgot;
  el.resetPasswordForm.hidden = !reset;

  const showTabs = login || register;
  document.querySelector(".auth-tabs").hidden = !showTabs;
  el.loginTab.classList.toggle("is-active", login);
  el.registerTab.classList.toggle("is-active", register);
  setAuthMessage();
}

function showLogin(message = "") {
  el.appShell.hidden = true;
  el.authScreen.hidden = false;
  showAuthMode("login");
  if (message) setAuthMessage(message, "error");
}

async function loadLogbook() {
  const result = await getLogbook();
  if (result.ok) state.logbook = Array.isArray(result.data) ? result.data : [];
  return result;
}

async function loadTodos() {
  const result = await getTodos();
  if (result.ok) state.todos = Array.isArray(result.data) ? result.data : [];
  return result;
}

async function openAccountView(view) {
  el.accountMenu.hidden = true;
  el.accountMenuButton.setAttribute("aria-expanded", "false");
  el.accountModal.hidden = false;
  if (view === "profile") {
    el.accountModalTitle.textContent = "Profile";
    el.accountModalBody.innerHTML = `<p class="muted">Loading profile…</p>`;
    const result = await getProfile();
    if (!result.ok) { el.accountModalBody.textContent = String(result.error); return; }
    state.profile = result.data;
    el.accountModalBody.innerHTML = `<div class="profile-summary"><strong>${escapeHtml(result.data.username || "")}</strong><span>${escapeHtml(result.data.email || "")}</span></div><form id="password-form" class="account-form"><h3>Change password</h3><label><span>Current password</span><input name="current_password" type="password" required></label><label><span>New password</span><input name="new_password" type="password" required></label><button class="auth-primary" type="submit">Change password</button><p id="password-message" class="route-log-message"></p></form>`;
    document.querySelector("#password-form")?.addEventListener("submit", async (event) => { event.preventDefault(); const fd=new FormData(event.currentTarget); const r=await changePassword(fd.get("current_password"),fd.get("new_password")); document.querySelector("#password-message").textContent=r.ok?"Password changed.":String(r.error); if(r.ok) event.currentTarget.reset(); });
  } else {
    el.accountModalTitle.textContent = "Log Book";
    el.accountModalBody.innerHTML = `<p class="muted">Loading Log Book…</p>`;
    await Promise.all([loadLogbook(), loadTodos()]);
    renderLogbookModal();
  }
}

function renderLogbookModal(activeTab = "todo") {
  const entries = state.logbook || [];
  const todos = state.todos || [];
  const projects = entries.filter((x) => x.status !== "sent");
  const sends = entries.filter((x) => x.status === "sent");

  const logCards = (items) => items.length ? items.map((x) => `
    <article class="logbook-entry">
      <div><strong>${escapeHtml(x.route_name || `Route ${x.route}`)}</strong><span>${escapeHtml(x.grade || "")} · ${Number(x.attempts || 0)} attempt${Number(x.attempts || 0) === 1 ? "" : "s"}</span></div>
      <span class="logbook-status">${escapeHtml(x.status === "sent" ? (x.send_style || "sent") : "project")}</span>
      ${x.date_sent ? `<small>${escapeHtml(x.date_sent)}</small>` : ""}
      ${x.beta ? `<p><strong>Beta</strong> ${escapeHtml(x.beta)}</p>` : ""}
    </article>`).join("") : `<p class="muted">None yet.</p>`;

  const todoCards = todos.length ? todos.map((x) => `
    <article class="logbook-entry logbook-todo-entry">
      <div><strong>${escapeHtml(x.route_name || `Route ${x.route}`)}</strong><span>${escapeHtml(x.grade || "")}</span></div>
      <span class="logbook-status">To-Do</span>
    </article>`).join("") : `<p class="muted">No routes in your To-Do list yet. Use the + beside a route name to add one.</p>`;

  const content = activeTab === "projects" ? logCards(projects)
    : activeTab === "sends" ? logCards(sends)
    : todoCards;

  el.accountModalBody.innerHTML = `
    <div class="logbook-tabs" role="tablist" aria-label="Log Book">
      <button type="button" class="logbook-tab ${activeTab === "todo" ? "is-active" : ""}" data-logbook-tab="todo">To-Do <span>${todos.length}</span></button>
      <button type="button" class="logbook-tab ${activeTab === "projects" ? "is-active" : ""}" data-logbook-tab="projects">Projects <span>${projects.length}</span></button>
      <button type="button" class="logbook-tab ${activeTab === "sends" ? "is-active" : ""}" data-logbook-tab="sends">Sends <span>${sends.length}</span></button>
    </div>
    <section class="logbook-section">${content}</section>
    <p class="muted logbook-hint">Open a route in the guide to edit its log or To-Do status.</p>`;

  el.accountModalBody.querySelectorAll("[data-logbook-tab]").forEach((button) => {
    button.addEventListener("click", () => renderLogbookModal(button.dataset.logbookTab));
  });
}

function showGuide() {
  showView("guide");
  
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
  loadLogbook();
  loadTodos();
  getProfile().then((result) => { if (result.ok) state.profile = result.data; });
  
}

function bindAuthEvents() {
  el.loginTab.addEventListener("click", () => showAuthMode("login"));
  el.registerTab.addEventListener("click", () => showAuthMode("register"));

  el.forgotPasswordButton.addEventListener("click", () => {
    showAuthMode("forgot");
    el.forgotPasswordEmail.focus();
  });

  el.forgotPasswordBack.addEventListener("click", () => {
    showAuthMode("login");
    el.loginUsername.focus();
  });

  el.forgotPasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = el.forgotPasswordForm.querySelector("button[type=submit]");
    button.disabled = true;
    button.textContent = "Sending…";
    setAuthMessage();

    const result = await requestPasswordReset(el.forgotPasswordEmail.value.trim());

    button.disabled = false;
    button.textContent = "Send reset link";

    if (!result.ok) {
      setAuthMessage(String(result.error), "error");
      return;
    }

    el.forgotPasswordForm.reset();
    setAuthMessage(
      result.data?.detail || "If an account exists for that email, a password reset link has been sent.",
      "success"
    );
  });

  el.resetPasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (el.resetPassword.value !== el.resetPasswordConfirm.value) {
      setAuthMessage("Passwords do not match.", "error");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const uid = params.get("reset_uid");
    const token = params.get("reset_token");

    if (!uid || !token) {
      setAuthMessage("This password reset link is invalid or incomplete.", "error");
      return;
    }

    const button = el.resetPasswordForm.querySelector("button[type=submit]");
    button.disabled = true;
    button.textContent = "Resetting…";
    setAuthMessage();

    const result = await confirmPasswordReset(uid, token, el.resetPassword.value);

    button.disabled = false;
    button.textContent = "Reset password";

    if (!result.ok) {
      setAuthMessage(String(result.error), "error");
      return;
    }

    el.resetPasswordForm.reset();
    window.history.replaceState({}, document.title, window.location.pathname);
    showAuthMode("login");
    setAuthMessage("Password reset successfully. You can log in now.", "success");
    el.loginUsername.focus();
  });

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

  el.accountMenuButton.addEventListener("click", () => {
    el.accountMenu.hidden = !el.accountMenu.hidden;
    el.accountMenuButton.setAttribute("aria-expanded", String(!el.accountMenu.hidden));
  });
  el.accountMenu.querySelectorAll("[data-account-view]").forEach((button) => button.addEventListener("click", () => openAccountView(button.dataset.accountView)));
  el.accountModalClose.addEventListener("click", () => { el.accountModal.hidden = true; });
  el.accountModal.addEventListener("click", (event) => { if (event.target === el.accountModal) el.accountModal.hidden = true; });
  document.addEventListener("click", (event) => { if (!event.target.closest(".account-menu-wrap")) { el.accountMenu.hidden = true; el.accountMenuButton.setAttribute("aria-expanded", "false"); } });

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

  const params = new URLSearchParams(window.location.search);
  const hasResetLink = params.has("reset_uid") && params.has("reset_token");

  if (hasResetLink) {
    clearAuthTokens();
    el.appShell.hidden = true;
    el.authScreen.hidden = false;
    showAuthMode("reset");
    el.resetPassword.focus();
    return;
  }

  if (state.auth.accessToken) showGuide();
  else showLogin();
}

init();
