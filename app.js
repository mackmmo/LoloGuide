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
  const [result, sends] = await Promise.all([getLogbook(), getCompetitionSends()]);
  if (result.ok) state.logbook = Array.isArray(result.data) ? result.data : [];
  if (sends.ok) state.competitionSends = Array.isArray(sends.data) ? sends.data : (sends.data?.results || []);
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
  el.accountModal.dataset.accountView = view;
  syncBottomNavigation();
  if (view === "profile") {
    el.accountModalTitle.textContent = "Profile";
    el.accountModalBody.innerHTML = `<p class="muted">Loading profile…</p>`;
    const result = await getProfile();
    if (!result.ok) { el.accountModalBody.textContent = String(result.error); return; }
    state.profile = result.data;
    el.accountModalBody.innerHTML = 
    `
      <div class="profile-summary">
        <strong>${escapeHtml(result.data.username || "")}</strong>
          <span>${escapeHtml(result.data.email || "")}</span>
            </div>
              <form id="password-form" class="account-form">
              <h3>Change password</h3>
                <label>
                  <span>Current password</span>
                  <input name="current_password" 
                  type="password" required>
                </label>
                <label>
                  <span>New password</span>
                  <input name="new_password" 
                  type="password" 
                  required
                  >
                </label>
                  <button class="auth-primary" 
                  type="submit"
                  >
                Change password
                </button>
                  <p id="password-message" class="route-log-message">
                </p>
              </form>
      `;

    await LoloOffline.mountPreferences(el.accountModalBody);

    if (state.editor.canEdit) {
      const editorToggleHTML = `
        <label>
          <input type="checkbox" 
          id="editor-mode-toggle"
          ${state.editor.enabled ? "checked" : ""}>
          Editing Mode
        </label>
      `;

    el.accountModalBody.insertAdjacentHTML(
      "beforeend",
      editorToggleHTML
    );
    const toggle = document.querySelector("#editor-mode-toggle");

    toggle.addEventListener("change", (event) => {
      console.log("TOGGLE FIRED")

      state.editor.enabled = event.target.checked;

      localStorage.setItem("editingMode", String(state.editor.enabled));
      console.log("Calling renderDetail()");

      renderDetail();
    });
  }


    el.accountModalBody.querySelector(".profile-summary").insertAdjacentHTML("afterend", `
      <form id="username-form" class="account-form"><h3>Change username</h3>
        <label><span>Username</span><input name="username" autocomplete="username" maxlength="150" required value="${escapeHtml(result.data.username || "")}"></label>
        <p class="muted">Use your new username the next time you log in.</p>
        <button type="submit" class="auth-primary">Save username</button>
        <p id="username-message" class="route-log-message" role="status"></p>
      </form>`);
    const usernameForm = el.accountModalBody.querySelector("#username-form");
    usernameForm.addEventListener("submit", async event => {
      event.preventDefault();
      const button = usernameForm.querySelector("button");
      const message = usernameForm.querySelector("#username-message");
      button.disabled = true;
      message.textContent = "Saving…";
      try {
        const previousUsername = state.profile?.username;
        const requestedUsername = usernameForm.elements.username.value.trim();
        const saved = await updateUsername(requestedUsername);
        if (!saved.ok) { message.textContent = String(saved.error); return; }
        if (saved.data?.username !== requestedUsername) {
          message.textContent = "The server did not save your new username. Your entry is kept; please try again later.";
          return;
        }
        const confirmed = await getProfile();
        if (!confirmed.ok || confirmed.data?.username !== requestedUsername) {
          message.textContent = "Could not verify your saved username. Your entry is kept; please try again.";
          return;
        }
        state.profile = confirmed.data;
        usernameForm.elements.username.value = saved.data.username;
        el.accountModalBody.querySelector(".profile-summary strong").textContent = saved.data.username;
        message.textContent = "Username saved. Use it the next time you log in.";
        await refreshCommunityAfterUsernameChange(previousUsername, confirmed.data.username);
      } finally { button.disabled = false; }
    });
    const permissions = result.data.data_permissions || {};
    document.querySelector("#password-form").insertAdjacentHTML("beforebegin", `
      <section class="data-permissions"><h3>Data permissions</h3>
        <label><input type="checkbox" data-publication="publish_feed" ${permissions.publish_feed ? "checked" : ""}><span>Publish my sends to Community</span></label>
        <label><input type="checkbox" data-publication="publish_leaderboards" ${permissions.publish_leaderboards ? "checked" : ""}><span>Include my sends in leaderboards and Junts Hall of Fame</span></label>
        <p class="muted">Turning a setting off removes your published entries from that view. Your private Log Book is kept. Private beta is never published.</p>
        <p id="publication-message" role="status"></p>
      </section>`);
    el.accountModalBody.querySelectorAll("[data-publication]").forEach(toggle => toggle.addEventListener("change", async () => {
      const key = toggle.dataset.publication;
      const previous = Boolean(state.profile.data_permissions?.[key]);
      el.accountModalBody.querySelectorAll("[data-publication]").forEach(input => input.disabled = true);
      const saved = await updateDataPermissions({[key]: toggle.checked});
      if (saved.ok) {
        state.profile = saved.data;
        document.querySelector("#publication-message").textContent = "Saved. Publication settings apply to existing and future sends.";
        if (typeof refreshCommunityView === "function") refreshCommunityView();
        if (state.mode === "routes") renderDetail();
      } else {
        toggle.checked = previous;
        document.querySelector("#publication-message").textContent = String(saved.error);
      }
      el.accountModalBody.querySelectorAll("[data-publication]").forEach(input => input.disabled = false);
    }));
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
  const annual = state.competitionSends || [];
  const sends = [...annual.map(x => ({...entries.find(log => String(log.route) === String(x.route) && Number(log.date_sent?.slice(0,4)) === x.year), ...x, status: "sent"})), ...entries.filter(x => x.status === "sent" && !annual.some(a => String(a.route) === String(x.route) && a.year === Number(x.date_sent?.slice(0,4))))];

  const logCards = (items) => items.length ? items.map((x) => `
    <article class="logbook-entry">
      <div><button type="button" class="logbook-route-link" data-logbook-route="${escapeHtml(String(x.route))}">${escapeHtml(x.route_name || `Route ${x.route}`)}</button><span>${escapeHtml(x.grade || "")}${Number(x.attempts) > 0 ? ` · ${Number(x.attempts)} attempt${Number(x.attempts) === 1 ? "" : "s"}` : ""}</span></div>
      <span class="logbook-status">${escapeHtml(x.status === "sent" ? (x.send_style || "sent") : "project")}</span>
      ${x.date_sent ? `<small>${escapeHtml(x.date_sent)}</small>` : ""}
      ${x.beta ? `<p><strong>Beta</strong> ${escapeHtml(x.beta)}</p>` : ""}
    </article>`).join("") : `<p class="muted">None yet.</p>`;

  const todoCards = todos.length ? todos.map((x) => `
    <article class="logbook-entry logbook-todo-entry">
      <div><button type="button" class="logbook-route-link" data-logbook-route="${escapeHtml(String(x.route))}">${escapeHtml(x.route_name || `Route ${x.route}`)}</button><span>${escapeHtml(x.grade || "")}</span></div>
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
  bindLogbookRouteLinks();
}

function bindLogbookRouteLinks() {
  el.accountModalBody.querySelectorAll("[data-logbook-route]").forEach(button => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await openRouteInGuide(button.dataset.logbookRoute);
        el.accountModal.hidden = true;
      } catch (error) { alert(error.message); }
      finally { button.disabled = false; }
    });
  });
}

function showGuide() {
  showView("guide");
  
  el.authScreen.hidden = true;
  el.appShell.hidden = false;

  if (!guideStarted) {
    if (typeof maplibregl !== 'undefined') initMap();
    bindEvents();
    renderStats();
    renderFilters();
    render();
    guideStarted = true;
  } else {
    setTimeout(() => map?.resize(), 0);
  }
  if (state.offlineMode && map) {
    mapStyleReady = false;
    mapDimension = '2d';
    map.setStyle(offlineMapStyle());
    map.jumpTo({pitch: 0, bearing: 0});
  }
  loadAllData();
  loadLogbook();
  loadTodos();
  getProfile().then((result) => { if (result.ok) state.profile = result.data; });
  getEditorStatus().then((result) => {
    state.editor.canEdit =
      result.ok && result.data?.is_staff === true;

    renderDetail();
  });
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

    const editorResult = await getEditorStatus()
  
    state.editor.canEdit = 
      editorResult.ok && editorResult.data?.is_staff === true;

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
  el.accountModalClose.addEventListener("click", () => { el.accountModal.hidden = true; syncBottomNavigation(); });
  el.accountModal.addEventListener("click", (event) => { if (event.target === el.accountModal) { el.accountModal.hidden = true; syncBottomNavigation(); } });
  document.addEventListener("click", (event) => { if (!event.target.closest(".account-menu-wrap")) { el.accountMenu.hidden = true; el.accountMenuButton.setAttribute("aria-expanded", "false"); } });

  el.logoutButton.addEventListener("click", () => {
    clearAuthTokens();
    showLogin();
  });

  window.addEventListener("lolo:auth-expired", () => {
    showLogin("Your session expired. Please log in again.");
  });
}

async function init() {
  bindAuthEvents();
  await LoloOffline.init();

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

  if (state.auth.accessToken || (state.offlineMode && LoloOffline.bundle)) showGuide();
  else showLogin();
}

init();

async function refreshCommunityAfterUsernameChange(previousUsername, username) {
  // Invalidate responses started before the username was saved.
  state.communityRequest = (state.communityRequest || 0) + 1;
  if (state.community?.comments) {
    state.community.comments = state.community.comments.map(comment =>
      comment.username === previousUsername ? {...comment, username} : comment);
  }
  const requests = [];
  if (typeof refreshCommunityView === "function") requests.push(refreshCommunityView());
  const current = currentDetailRecord();
  if (current?.mode === "routes" && state.detailTab === "community") {
    requests.push(loadCommunity(current.record.route_id));
  } else if (state.community) {
    state.community.loading = false;
  }
  await Promise.allSettled(requests);
}
