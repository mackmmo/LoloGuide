function render() {
  renderStatus();
  renderModeTabs();
  renderFilters();
  renderStats();
  renderList();
  renderDetail();
}

function showMobileGuidePanel(panel) {
  if (window.innerWidth > 760) return;

  el.appShell.classList.toggle(
    "mobile-guide-detail",
    panel === "detail"
  );
  window.scrollTo(0, 0);
}

function renderStatus() {
  if (!el.statusBanner) {
    return;
  }

  const failures = Object.entries(state.loadErrors);

  if (state.offlineMode) {
    el.statusBanner.textContent = LoloOffline.bundle?.settings.guide ? 'Using the guide saved on this device.' : 'Guide is not saved on this device. Enable Guide in Profile while connected.';
    return;
  }
  if (navigator.onLine === false) {
    el.statusBanner.textContent = 'Using saved information while disconnected.';
    return;
  }

  if (state.isLoading) {
    el.statusBanner.textContent = `Loading data from ${state.apiBase}...`;
    return;
  }

  if (!failures.length) {
    el.statusBanner.textContent = `Connected to ${state.apiBase}.`;
    return;
  }

  el.statusBanner.textContent = `Connected to ${state.apiBase} with load issues. ${failures.map(([key, value]) => `${key}: ${value}`).join(" ")}`;
}

function renderModeTabs() {
  return;
}

function renderFilters() {
  populateSelect(el.sectorFilter, "All sectors", state.datasets.sectors, "sector_id", "name", state.filters.sectorId);

  const areas = state.datasets.areas.filter((area) => {
    return !state.filters.sectorId || String(area.sector) === state.filters.sectorId;
  });
  populateSelect(el.areaFilter, "All areas", areas, "area_id", "name", state.filters.areaId);

  const subareas = state.datasets.subareas.filter((subarea) => {
    if (state.filters.areaId) {
      return String(subarea.area) === state.filters.areaId;
    }
    if (state.filters.sectorId) {
      const area = areaById.get(String(subarea.area));
      return area && String(area.sector) === state.filters.sectorId;
    }
    return true;
  });
  populateSelect(el.subareaFilter, "All subareas", subareas, "subarea_id", "name", state.filters.subareaId);

  const routeTypes = [...new Set(state.datasets.routes.map((route) => route.type).filter(Boolean))].sort();
  populatePrimitiveSelect(el.typeFilter, "All types", routeTypes, state.filters.type);

  el.searchInput.value = state.filters.search;
  el.sortFilter.value = state.filters.sort;
}

function populateSelect(select, emptyLabel, items, valueKey, labelKey, selectedValue) {
  const options = [`<option value="">${emptyLabel}</option>`].concat(
    items.map((item) => `<option value="${item[valueKey]}">${escapeHtml(item[labelKey])}</option>`)
  );
  select.innerHTML = options.join("");
  select.value = selectedValue;
}

function populatePrimitiveSelect(select, emptyLabel, values, selectedValue) {
  const options = [`<option value="">${emptyLabel}</option>`].concat(
    values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
  );
  select.innerHTML = options.join("");
  select.value = selectedValue;
}

function renderStats() {
  return;
}

function statCard(label, value) {
  return `<div class="stat-card"><small>${label}</small><strong>${value}</strong></div>`;
}

function getVisibleRecords() {
  return state.datasets.routes || [];
}

function searchableText(record) {
  return [
    record.name,
    record.grade,
    record.type,
    record.description,
    record.subarea_name,
    record.area_name,
    record.sector_name,
    record.aspect
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function sortRecords(records) {
  return records;
}

function syncSelectedRecord() {
  const records = getVisibleRecords();
  if (!records.length) {
    state.selected = null;
    return;
  }
  if (!state.selected) {
    return;
  }
  const selectedId = recordKey(state.selected);
  state.selected = records.find((item) => recordKey(item) === selectedId) || null;
}

function renderList() {
  const records = getVisibleRecords();

  if (el.resultsTitle) el.resultsTitle.textContent = "Routes";
  if (el.resultsMeta) el.resultsMeta.textContent = `${records.length} result${records.length === 1 ? "" : "s"}`;

  if (!records.length) {
    const message = state.offlineMode && !LoloOffline.bundle?.settings.guide
      ? 'Guide is not saved on this device. Enable Guide in Profile while connected. Your Log Book is still available from the menu.'
      : 'No routes match the current filters.';
    el.recordList.innerHTML = `<div class="description-card empty-state">${message}</div>`;
    return;
  }

  el.recordList.innerHTML = records.map(renderRecordCard).join("");
  document.querySelectorAll(".record-card").forEach((button, index) => {
    button.addEventListener("click", () => {
      state.selected = records[index];
      showMobileGuidePanel("detail");
      trackEvent("route_select", {
        route_id: String(records[index].route_id || ""),
        route_name: records[index].name || "",
        area_name: records[index].area_name || "",
        subarea_name: records[index].subarea_name || ""
      });
      renderDetail();
      renderList();
    });
  });
}

function renderRecordCard(record) {
  const active = state.selected && recordKey(state.selected) === recordKey(record) ? "active" : "";

  return `
    <button class="record-card ${active}" data-id="${recordKey(record)}">
      <strong>${escapeHtml(recordTitle(record))}</strong>
      <span>${escapeHtml(record.grade || "")}</span>
    </button>
  `;
}

function currentDetailRecord() {
  if (state.selected) {
    return { record: state.selected, mode: "routes" };
  }

  if (state.filters.subareaId) {
    const subarea = subareaById.get(String(state.filters.subareaId));
    if (subarea) {
      return { record: subarea, mode: "subareas" };
    }
  }

  if (state.filters.areaId) {
    const area = areaById.get(String(state.filters.areaId));
    if (area) {
      return { record: area, mode: "areas" };
    }
  }

  if (state.filters.sectorId) {
    const sector = sectorById.get(String(state.filters.sectorId));
    if (sector) {
      return { record: sector, mode: "sectors" };
    }
  }

  return null;
}

function detailSelectionLabel() {
  const current = currentDetailRecord();
  return current ? recordTitle(current.record) : "None";
}

function renderDetail() {
  const current = currentDetailRecord();

  console.log("Detail render:", {
    current,
    detailTab: state.detailTab
  });

  if (!current) {
    document.querySelector(".detail-panel")?.classList.remove("community-mode");
    el.detailDescription.classList.remove("community-full-panel");

    if (el.detailTitle) el.detailTitle.textContent = "Choose a route";
    el.detailSubtitle.textContent = "";
    if (el.detailNav) el.detailNav.innerHTML = "";
    el.detailDescription.innerHTML = "Use the filters or click a route to inspect details without leaving the page.";
    if (el.detailLog) el.detailLog.innerHTML = "";
    if (el.detailRelated) el.detailRelated.innerHTML = "";
    el.detailFacts.innerHTML = "";
    updateMap(null);
    return;
  }

  const { record, mode } = current;

if (mode === "routes") {
  el.detailTitle.innerHTML = `
    <button class="mobile-back-to-routes" type="button">
      ← Routes
    </button>

    <span class="route-title-row">
      <span class="route-name-text">${escapeHtml(recordTitle(record))}</span>
      ${buildCoordinateSection(record, true)}
    </span>`;
} else {
  el.detailTitle.innerHTML = `<button class="mobile-back-to-routes" type="button">← Browse routes</button><span>${escapeHtml(recordTitle(record))}</span>`;
}

document.querySelector(".mobile-back-to-routes")
  ?.addEventListener("click", () => {
    showMobileGuidePanel("browse");
  });

el.detailSubtitle.innerHTML = buildDetailNav(record, mode);
  el.detailSubtitle.querySelectorAll("[data-nav-mode]").forEach(button => {
    button.addEventListener("click", () => jumpTo(button.dataset.navMode, button.dataset.navId));
  });
  const mapArea = detailMapArea(record, mode);
  const mapTarget = mapArea && parsePoint(mapArea.centroid);
  const mapAction = mapTarget ? '<button type="button" class="ghost see-on-map">See on Map</button>' : '';

  if (mode === "routes") {
    el.detailNav.innerHTML = `
      ${mapAction}<div class="route-detail-tabs" role="tablist" aria-label="Route detail">
        <button type="button" class="route-detail-tab ${state.detailTab === "details" ? "is-active" : ""}" data-detail-tab="details">Details</button>
        <button type="button" class="route-detail-tab ${state.detailTab === "community" ? "is-active" : ""}" data-detail-tab="community">Community</button>
      </div>`;
    bindRouteDetailTabs(record);

    if (state.detailTab === "community") {
      renderCommunityPanel(record);
    } else {
      renderRouteDetailsPanel(record);
    }
  } else {
    document.querySelector(".detail-panel")?.classList.remove("community-mode");
    el.detailDescription.classList.remove("community-full-panel");
    if (el.detailNav) {
      el.detailNav.innerHTML = mapAction;
      bindDetailNav();
    }
    el.detailDescription.innerHTML = buildDetailDescription(record, mode);
    if (el.detailRelated) {
      el.detailRelated.innerHTML = buildDetailRelated(record, mode);
      bindDetailNav();
      bindSubareaRouteLinks();
    }
    el.detailFacts.innerHTML = detailFacts(record, mode).map(renderFact).join("");
    if (el.detailLog) el.detailLog.innerHTML = "";
  }

  el.detailNav.querySelector(".see-on-map")?.addEventListener("click", () => seeDetailOnMap(record, mode));
  bindCoordinateCopy(el.detailTitle);
  bindCoordinateCopy(el.detailDescription);
  updateMap(record, mode);
}

// API names match guide/models.py and guide/serializers.py; never infer aliases.
const ROUTE_EDIT_FIELDS = Object.freeze({
  name: {id: 'edit-route-name', selector: '.route-name-text', label: 'Name', maxLength: 100},
  description: {id: 'edit-route-description', selector: '.route-description-text', label: 'Description', multiline: true},
  pro: {id: 'edit-route-pro', selector: '.route-pro-text', label: 'Protection', maxLength: 50},
  grade: {id: 'edit-route-grade', selector: '.route-grade-text', label: 'Grade', maxLength: 50},
  type: {id: 'edit-route-type', selector: '.route-type-text', label: 'Type', maxLength: 50},
  star_rating: {id: 'edit-route-stars', selector: '.route-stars-text', label: 'Stars', min: 0, max: 5},
  height: {id: 'edit-route-height', selector: '.route-height-text', label: 'Height (ft)', min: 0, max: 2147483647},
  danger_rating: {id: 'edit-route-danger', selector: '.route-danger-text', label: 'Danger', maxLength: 50},
  first_ascencionist: {id: 'edit-route-fa', selector: '.route-fa-text', label: 'First ascent', maxLength: 100},
  fa_year: {id: 'edit-route-fa-year', selector: '.route-fa-year-text', label: 'FA year', min: 1, max: () => new Date().getFullYear()}
});

function routeEditorInput(config) {
  const inputs = document.querySelectorAll(`#${config.id}`);
  if (inputs.length !== 1) throw new Error(`Expected exactly one ${config.label} input; reload the route.`);
  return inputs[0];
}

function verifyRouteEditor(original) {
  for (const [field, config] of Object.entries(ROUTE_EDIT_FIELDS)) {
    if (!Object.hasOwn(original, field)) throw new Error(`API response missing ${field}; editing blocked. Check field names.`);
    if (routeEditorInput(config).value !== String(original[field] ?? '')) throw new Error(`${config.label} loaded incorrectly; editing blocked.`);
  }
}

function buildRouteChanges(original) {
  const changes = {};
  for (const [field, config] of Object.entries(ROUTE_EDIT_FIELDS)) {
    const raw = routeEditorInput(config).value;
    if (raw === String(original[field] ?? '')) continue;
    let value = raw;
    if (config.min !== undefined) {
      const max = typeof config.max === 'function' ? config.max() : config.max;
      if (!/^\d+$/.test(raw.trim())) throw new Error(`${config.label} must be a whole number and cannot be cleared.`);
      value = Number(raw);
      if (!Number.isSafeInteger(value) || value < config.min || value > max) throw new Error(`${config.label} must be between ${config.min} and ${max}.`);
      if (original[field] !== null && value === Number(original[field])) continue;
    } else {
      if (field !== 'description') value = raw.trim();
      if (config.maxLength && value.length > config.maxLength) throw new Error(`${config.label} exceeds ${config.maxLength} characters.`);
      if (['name', 'grade', 'type'].includes(field) && !value) throw new Error(`${config.label} cannot be empty.`);
      if (value === original[field]) continue;
    }
    changes[field] = value;
  }
  return changes;
}

function renderRouteDetailsPanel(record) {
  const isEditing = state.editor.canEdit && state.editor.enabled;
  const original = Object.freeze(Object.fromEntries(
    ['route_id', ...Object.keys(ROUTE_EDIT_FIELDS)].filter(field => Object.hasOwn(record, field)).map(field => [field, record[field]])
  ));
  document.querySelector('.detail-panel')?.classList.remove('community-mode');
  el.detailDescription.classList.remove('community-full-panel');
  el.detailDescription.innerHTML = buildDetailDescription(record, 'routes');
  el.detailFacts.innerHTML = detailFacts(record, 'routes').map(renderFact).join('');
  if (el.detailRelated) el.detailRelated.innerHTML = '';

  if (isEditing) {
    const message = document.createElement('p');
    message.setAttribute('role', 'status');
    message.setAttribute('aria-live', 'polite');
    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.id = 'save-route-changes';
    saveButton.className = 'auth-primary';
    saveButton.textContent = 'Save Changes';
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.textContent = 'Cancel editing';
    cancelButton.addEventListener('click', () => {
      if (state.editor.saving) return;
      state.editor.enabled = false;
      localStorage.setItem('editingMode', 'false');
      const toggle = document.querySelector('#editor-mode-toggle');
      if (toggle) toggle.checked = false;
      renderDetail();
    });
    el.detailFacts.append(saveButton, cancelButton, message);
    try {
      for (const [field, config] of Object.entries(ROUTE_EDIT_FIELDS)) {
        const container = field === 'name' ? el.detailTitle : ['description', 'pro'].includes(field) ? el.detailDescription : el.detailFacts;
        const target = container.querySelector(config.selector);
        if (!target) throw new Error(`Missing ${config.label} placeholder; editing blocked.`);
        const input = document.createElement(config.multiline ? 'textarea' : 'input');
        input.id = config.id;
        if (!config.multiline) input.type = config.min !== undefined ? 'number' : 'text';
        input.setAttribute('aria-label', config.label);
        if (config.min !== undefined) {
          input.min = config.min;
          input.max = typeof config.max === 'function' ? config.max() : config.max;
          input.step = '1';
        }
        if (config.maxLength) input.maxLength = config.maxLength;
        input.value = String(original[field] ?? '');
        target.replaceWith(input);
      }
      verifyRouteEditor(original);
      if (!Number.isSafeInteger(Number(original.route_id)) || Number(original.route_id) < 1) throw new Error('Invalid route ID; editing blocked.');
    } catch (error) {
      saveButton.disabled = true;
      message.textContent = error.message;
      return;
    }
    let writeAttempted = false;
    saveButton.addEventListener('click', async () => {
      if (state.editor.saving || writeAttempted) return;
      let requestStarted = false;
      try {
        if (!state.editor.canEdit || !state.editor.enabled) throw new Error('Editing is no longer enabled.');
        if (String(currentDetailRecord()?.record?.route_id) !== String(original.route_id)) throw new Error('Route selection changed; reopen the editor.');
        for (const field of Object.keys(original)) {
          if (record[field] !== original[field]) throw new Error('Route data changed while editing; reopen the editor.');
        }
        const changes = buildRouteChanges(original);
        if (!Object.keys(changes).length) {
          message.textContent = 'No changes to save.';
          return;
        }
        const summary = Object.entries(changes).map(([field, value]) =>
          `${ROUTE_EDIT_FIELDS[field].label}: ${JSON.stringify(original[field])} → ${JSON.stringify(value)}`
        ).join('\n');
        if (!confirm(`Save changes to ${original.name} (route ${original.route_id})?\n\n${summary}`)) return;
        state.editor.saving = true;
        saveButton.disabled = true;
        cancelButton.disabled = true;
        saveButton.textContent = 'Saving...';
        requestStarted = true;
        writeAttempted = true;
        const result = await updateRoute(original.route_id, changes);
        if (!result.ok) throw new Error(`Save failed: ${JSON.stringify(result.error || result.data || 'Unknown error')}`);
        if (String(result.data?.route_id) !== String(original.route_id)) throw new Error('Server returned a wrong or missing route ID.');
        // Validate the entire response before changing the cached record.
        for (const field of Object.keys(changes)) {
          if (!Object.hasOwn(result.data, field) || result.data[field] !== changes[field]) throw new Error(`Server did not confirm ${ROUTE_EDIT_FIELDS[field].label}.`);
        }
        for (const field of Object.keys(changes)) record[field] = result.data[field];
        renderList();
        renderDetail();
      } catch (error) {
        message.textContent = requestStarted
          ? `${error.message} The save may have reached the server. Reload and inspect the route before trying again.`
          : error.message;
      } finally {
        state.editor.saving = false;
        // A network failure does not prove that the server rejected the write.
        saveButton.disabled = requestStarted;
        cancelButton.disabled = false;
        saveButton.textContent = requestStarted ? 'Reload route before saving again' : 'Save Changes';
      }
    });
  }
  if (el.detailLog) {
    el.detailLog.innerHTML = buildRouteLogCard(record);
    bindRouteLogCard(record, 'routes');
    bindTodoToggle(record);
  }
}


function existingTodo(routeId) {
  return (state.todos || []).find((item) => String(item.route) === String(routeId)) || null;
}

async function bindTodoToggle(route) {
  document.querySelector("#route-todo-toggle")?.addEventListener("click", async () => {
    const existing = existingTodo(route.route_id);
    const result = existing ? await deleteTodo(existing.todo_id) : await createTodo(route.route_id);
    if (!result.ok) {
      alert(`Could not update To-Do: ${result.error}`);
      return;
    }
    await loadTodos();
    renderDetail();
  });
}

function bindRouteDetailTabs(route) {
  document.querySelectorAll("[data-detail-tab]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.detailTab = button.dataset.detailTab;
      renderDetail();
      if (state.detailTab === "community") await loadCommunity(route.route_id);
    });
  });
}

async function loadCommunity(routeId) {
  const request = state.communityRequest = (state.communityRequest || 0) + 1;
  state.community = { routeId, loading: true, stats: null, comments: [], error: "" };
  renderCommunityPanel(currentDetailRecord()?.record);

  const [statsResult, commentsResult] = await Promise.all([
    getRouteCommunityStats(routeId),
    getRouteComments(routeId)
  ]);

  if (request !== state.communityRequest || String(currentDetailRecord()?.record?.route_id) !== String(routeId)) return;

  state.community = {
    routeId,
    loading: false,
    stats: statsResult.ok ? statsResult.data : null,
    comments: commentsResult.ok && Array.isArray(commentsResult.data) ? commentsResult.data : [],
    error: [!statsResult.ok ? statsResult.error : "", !commentsResult.ok ? commentsResult.error : ""].filter(Boolean).join(" ")
  };
  renderCommunityPanel(currentDetailRecord()?.record);
}

function renderCommunityPanel(route) {
  if (!route) return;

  document.querySelector(".detail-panel")?.classList.add("community-mode");

  // Hide the normal Details layout while Community is active.
  if (el.detailLog) el.detailLog.innerHTML = "";
  if (el.detailRelated) el.detailRelated.innerHTML = "";
  el.detailFacts.innerHTML = "";

  const community = state.community || {};

  // Make the description container become the full Community view.
  el.detailDescription.classList.add("community-full-panel");

  if (
    String(community.routeId) !== String(route.route_id) ||
    community.loading
  ) {
    el.detailDescription.innerHTML = `
      <div class="community-panel community-panel--full">
        <p class="muted">Loading community activity…</p>
      </div>
    `;

    if (String(community.routeId) !== String(route.route_id)) {
      loadCommunity(route.route_id);
    }

    return;
  }

  if (community.error && !community.stats) {
    el.detailDescription.innerHTML = `
      <div class="community-panel community-panel--full">
        <p class="route-log-message">${escapeHtml(community.error)}</p>
      </div>
    `;
    return;
  }

  const stats = community.stats || {};
  const comments = community.comments || [];

  el.detailDescription.innerHTML = `
    <div class="community-panel community-panel--full">

      <section class="community-send-section">
        <p class="eyebrow">Community sends</p>

        <div class="community-stats">
          <div>
            <strong>${Number(stats.total_sends || 0)}</strong>
            <span>Total sends</span>
          </div>

          <div>
            <strong>${Number(stats.onsight || 0)}</strong>
            <span>Onsights</span>
          </div>

          <div>
            <strong>${Number(stats.flash || 0)}</strong>
            <span>Flashes</span>
          </div>

          <div>
            <strong>${Number(stats.redpoint || 0)}</strong>
            <span>Redpoints</span>
          </div>
        </div>
      </section>

      <section class="community-comments">
        <div class="community-comments-head">
          <p class="eyebrow">Comments</p>
          <span class="muted">${comments.length}</span>
        </div>

        <form id="community-comment-form" class="community-comment-form">
          <textarea
            name="comment"
            rows="3"
            maxlength="2000"
            placeholder="Share route conditions, public beta, or a comment…"
            required
          ></textarea>

          <button class="auth-primary" type="submit">
            Post comment
          </button>

          <p
            class="route-log-message"
            id="community-comment-message"
          ></p>
        </form>

        <div class="community-comment-list">
          ${
            comments.length
              ? comments.map(renderCommunityComment).join("")
              : `<p class="muted">No comments yet.</p>`
          }
        </div>
      </section>

    </div>
  `;

  bindCommunityComments(route);
}

function renderCommunityComment(comment) {
  const mine = state.profile?.username && state.profile.username === comment.username;
  return `
    <article class="community-comment" data-comment-id="${comment.comment_id}">
      <div class="community-comment-meta">
        <strong>${escapeHtml(comment.username || "Climber")}</strong>
        <span>${formatCommunityDate(comment.created_at)}</span>
      </div>
      <p>${escapeHtml(comment.comment || "")}</p>
      ${mine ? `<div class="community-comment-actions"><button type="button" data-comment-edit="${comment.comment_id}">Edit</button><button type="button" data-comment-delete="${comment.comment_id}">Delete</button></div>` : ""}
    </article>`;
}

function formatCommunityDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function bindCommunityComments(route) {
  const form = document.querySelector("#community-comment-form");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const textarea = form.elements.comment;
    const message = document.querySelector("#community-comment-message");
    const text = textarea.value.trim();
    if (!text) return;
    const result = await createRouteComment(route.route_id, text);
    if (!result.ok) { if (message) message.textContent = String(result.error); return; }
    textarea.value = "";
    await loadCommunity(route.route_id);
  });

  document.querySelectorAll("[data-comment-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Delete this public comment?")) return;
      const result = await deleteRouteComment(button.dataset.commentDelete);
      if (result.ok) await loadCommunity(route.route_id);
    });
  });

  document.querySelectorAll("[data-comment-edit]").forEach((button) => {
    button.addEventListener("click", async () => {
      const item = (state.community.comments || []).find((x) => String(x.comment_id) === String(button.dataset.commentEdit));
      if (!item) return;
      const next = prompt("Edit comment:", item.comment || "");
      if (next === null || !next.trim()) return;
      const result = await updateRouteComment(item.comment_id, next.trim());
      if (result.ok) await loadCommunity(route.route_id);
    });
  });
}

function buildDetailDescription(record, mode) {
  const extra = [];
  if (mode === "areas" && record.directions) {
    extra.push(`<p><strong>Directions</strong> ${escapeHtml(record.directions)}</p>`);
  }
  if (mode === "routes" && (record.pro || (state.editor.canEdit && state.editor.enabled))) {
    extra.push(`<p><strong>Protection</strong> <span class="route-pro-text">${escapeHtml(record.pro ?? "")}</span></p>`);
  }

  const description = record.description || "No description available.";
  return `<strong>Description</strong><p class = "route-description-text">${escapeHtml(description)}</p>${extra.join("")}${mode === "routes" ? "" : buildCoordinateSection(record)}`;
}

function buildDetailRelated(record, mode) {
  if (mode === "subareas") {
    const routes = state.datasets.routes.filter(route => String(route.subarea) === String(record.subarea_id));
    const message = state.loadErrors.routes ? "Unable to load routes. Please try again." : "No routes match the current filters.";
    return '<section class="mobile-subarea-routes" aria-label="Routes in this subarea"><h3>Routes (' + routes.length + ')</h3><div class="subarea-route-list">' +
      (routes.length ? routes.map(route => '<button type="button" class="record-card" data-related-route-id="' + escapeHtml(String(route.route_id)) + '"><strong>' + escapeHtml(recordTitle(route)) + '</strong><span>' + escapeHtml(route.grade || "") + '</span></button>').join("") : '<p class="muted">' + message + '</p>') + '</div></section>';
  }
  if (mode !== "areas") {
    return "";
  }

  const subareas = state.datasets.subareas
    .filter((subarea) => String(subarea.area) === String(record.area_id))
    .sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")));

  if (!subareas.length) {
    return "";
  }

  return `
    <div class="description-card">
      <strong>Subareas</strong>
      <div class="related-list">
        ${subareas.map((subarea) => `
          <button class="related-chip" type="button" data-nav-mode="subareas" data-nav-id="${subarea.subarea_id}">
            <span class="related-chip-name">${escapeHtml(subarea.name)}</span>
            <span class="related-chip-meta">${escapeHtml(aspectSunLabel(subarea.aspect))}</span>
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function buildDetailNav(record, mode) {
  const items = [];
  const subarea = mode === "routes" ? subareaById.get(String(record.subarea)) : null;
  const area = mode === "areas" ? null : areaById.get(String(record.area ?? subarea?.area));
  const link = (item, kind, id) => `<button class="breadcrumb-link" type="button" data-nav-mode="${kind}" data-nav-id="${escapeHtml(String(id))}">${escapeHtml(item.name)}</button>`;
  if (area) items.push(link(area, "areas", area.area_id));
  if (subarea) items.push(link(subarea, "subareas", subarea.subarea_id));
  items.push(`<span aria-current="page">${escapeHtml(recordTitle(record))}</span>`);
  return `<span class="guide-breadcrumbs" role="navigation" aria-label="Guide path">${items.join('<span class="breadcrumb-separator" aria-hidden="true"> &gt; </span>')}</span>`;
}

function bindDetailNav() {
  document.querySelectorAll("[data-nav-mode][data-nav-id]").forEach((button) => {
    button.onclick = () => {
      jumpTo(button.dataset.navMode, button.dataset.navId);
    };
  });
}

function detailFacts(record, detailMode = "routes") {
  const facts = [];

  if (detailMode === "routes") {
    facts.push(["Grade", record.grade || "-"]);
    facts.push(["Type", routeTypeLabel(record.type) || record.type || "-"]);
    facts.push(["Stars", record.star_rating ?? "-"]);
    facts.push(["Height", record.height ? `${record.height} ft` : "-"]);
    facts.push(["Danger", record.danger_rating || "-"]);
    facts.push(["Sun", aspectSunLabel(record.aspect)]);
    facts.push(["First ascent", record.first_ascencionist || "-"]);
    facts.push(["FA year", record.fa_year ?? "-"]);
  } else if (detailMode === "subareas") {
    facts.push(["Area", record.area_name || "-"]);
    facts.push(["Sector", record.sector_name || "-"]);
    facts.push(["Sun", aspectSunLabel(record.aspect)]);
    facts.push(["Routes", countRoutesForSubarea(record.subarea_id)]);
  } else if (detailMode === "areas") {
    facts.push(["Sector", record.sector_name || "-"]);
    facts.push(["Approach", record.approach_time ? `${record.approach_time} min` : "-"]);
    facts.push(["Drive", record.drive_time ? `${record.drive_time} min` : "-"]);
    facts.push(["Sun", aspectSunLabel(record.aspect)]);
    facts.push(["Subareas", countSubareasForArea(record.area_id)]);
    facts.push(["Routes", countRoutesForArea(record.area_id)]);
  } else {
    facts.push(["Areas", countAreasForSector(record.sector_id)]);
    facts.push(["Subareas", countSubareasForSector(record.sector_id)]);
    facts.push(["Routes", countRoutesForSector(record.sector_id)]);
  }

  return facts;
}

function recordTitle(record) {
  return record.name || `Record ${recordKey(record)}`;
}

function recordMeta(record, detailMode = "routes") {
  if (detailMode === "routes") {
    return [record.grade, routeTypeLabel(record.type), record.subarea_name, record.area_name].filter(Boolean).join(" | ");
  }
  if (detailMode === "subareas") {
    return [record.area_name, record.sector_name, aspectSunLabel(record.aspect)].filter(Boolean).join(" | ");
  }
  if (detailMode === "areas") {
    return [record.sector_name, aspectSunLabel(record.aspect), record.approach_time ? `${record.approach_time} min approach` : ""].filter(Boolean).join(" | ");
  }
  return `${countRoutesForSector(record.sector_id)} routes`;
}

function recordSnippet(record) {
  if (record.description) {
    return truncate(record.description, 140);
  }
  return "No description available.";
}

function routeTypeLabel(value) {
  const labels = {
    S: "Sport",
    T: "Trad",
    M: "Mixed"
  };
  return labels[value] || value || "";
}

function renderFact([label, value]) {
  const factClasses = {
    "Grade": "route-grade-text",
    "Type": "route-type-text",
    "Stars": "route-stars-text",
    "Height": "route-height-text",
    "Danger": "route-danger-text",
    "First ascent": "route-fa-text",
    "FA year": "route-fa-year-text",
  }

  const factClass = factClasses[label] || "";

  return `<div class="fact-card">
            <strong>${escapeHtml(label)}</strong>
            <span class="${factClass}">${escapeHtml(String(value))}</span>
          </div>`;
}

function recordKey(record) {
  return String(record.route_id ?? record.subarea_id ?? record.area_id ?? record.sector_id ?? "");
}

function countRoutesForSubarea(subareaId) {
  return state.datasets.routes.filter((route) => String(route.subarea) === String(subareaId)).length;
}

function countRoutesForArea(areaId) {
  return state.datasets.routes.filter((route) => String(route.area) === String(areaId)).length;
}

function countAreasForSector(sectorId) {
  return state.datasets.areas.filter((area) => String(area.sector) === String(sectorId)).length;
}

function countSubareasForArea(areaId) {
  return state.datasets.subareas.filter((subarea) => String(subarea.area) === String(areaId)).length;
}

function countSubareasForSector(sectorId) {
  return state.datasets.subareas.filter((subarea) => String(subarea.sector) === String(sectorId)).length;
}

function countRoutesForSector(sectorId) {
  return state.datasets.routes.filter((route) => String(route.sector) === String(sectorId)).length;
}

function routesForSubarea(subareaId) {
  return state.datasets.routes
    .filter((route) => String(route.subarea) === String(subareaId))
    .sort((left, right) => {
      const leftOrder = Number.isFinite(Number(left.crag_order)) ? Number(left.crag_order) : Number.MAX_SAFE_INTEGER;
      const rightOrder = Number.isFinite(Number(right.crag_order)) ? Number(right.crag_order) : Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
      return String(left.name || "").localeCompare(String(right.name || ""));
    });
}


function existingRouteLog(routeId) {
  return (state.logbook || []).find((entry) => String(entry.route) === String(routeId)) || null;
}

function formatLogSummary(log) {
  if (!log) return "";
  if (log.status !== "sent") {
    const attempts = Number(log.attempts || 0);
    return `Project${attempts ? ` · ${attempts} attempt${attempts === 1 ? "" : "s"}` : ""}`;
  }
  const style = log.send_style ? log.send_style[0].toUpperCase() + log.send_style.slice(1) : "Sent";
  const attempts = Number(log.attempts || 0);
  const date = log.date_sent ? new Date(`${log.date_sent}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
  return [style, attempts ? `${attempts} attempt${attempts === 1 ? "" : "s"}` : "", date].filter(Boolean).join(" · ");
}

function buildRouteLogCard(route) {
  const todo = existingTodo(route.route_id);
  const hasSend = existingRouteLog(route.route_id) || routeSendHistory(route).length;
  return `<div class="route-log-overview route-log-overview--compact">
    <button id="route-log-open" class="route-log-open route-log-open--compact" type="button">${hasSend ? "Edit Send" : "Add Send"}</button>
    <button id="route-todo-toggle" class="ghost" type="button" aria-pressed="${Boolean(todo)}">${todo ? "Remove To Do" : "Add to Do"}</button>
  </div>`;
}

function routeSendHistory(route) {
  return (state.competitionSends || []).filter(x => String(x.route) === String(route.route_id)).sort((a,b) => String(b.date_sent).localeCompare(String(a.date_sent)));
}

function buildSendHistory(route) {
  return `<div class="send-history">${routeSendHistory(route).map(x => `<div class="send-history-row"><span>${escapeHtml(x.date_sent)} · ${escapeHtml(x.send_style || "sent")}</span><button type="button" class="ghost" data-edit-annual="${escapeHtml(String(x.id))}">Edit send</button></div>`).join("")}</div>`;
}

function closeRouteLogModal() {
  document.querySelector("#route-log-modal")?.remove();
}

function openRouteLogModal(route, repeatSend = false, annualSend = null) {
  closeRouteLogModal();
  const log = annualSend ? {...annualSend, status: "sent"} : repeatSend ? null : existingRouteLog(route.route_id);
  const sent = repeatSend || !log || log?.status === "sent";
  const modal = document.createElement("div");
  modal.id = "route-log-modal";
  modal.className = "route-log-modal";
  modal.innerHTML = `
    <div class="route-log-modal-card" role="dialog" aria-modal="true" aria-labelledby="route-log-modal-title">
      <div class="route-log-modal-head">
        <div><p class="eyebrow">${log ? "Your log" : "Log route"}</p><h2 id="route-log-modal-title">${escapeHtml(route.name || "Route")}</h2></div>
        <button id="route-log-modal-close" class="route-log-modal-close" type="button" aria-label="Close">×</button>
      </div>
      ${log ? `<p class="route-log-current">${escapeHtml(formatLogSummary(log))}</p>` : ""}
      ${!repeatSend ? buildSendHistory(route) : ""}
      <form id="route-log-form" class="route-log-form">
        <label><span>Status</span><select name="status" ${repeatSend || annualSend ? "disabled" : ""}><option value="project" ${!sent ? "selected" : ""}>Project</option><option value="sent" ${sent ? "selected" : ""}>Sent</option></select></label>
        <label class="route-log-send-field"><span>Send style</span><select name="send_style"><option value="">—</option>${["onsight","flash","redpoint","pinkpoint","repeat"].map(v => `<option value="${v}" ${log?.send_style === v ? "selected" : ""}>${v[0].toUpperCase()+v.slice(1)}</option>`).join("")}</select></label>
        <label ${repeatSend || annualSend ? "hidden" : ""}><span>Attempts</span><input name="attempts" type="number" min="0" value="${Number(log?.attempts) > 0 ? Number(log.attempts) : ""}" placeholder="Optional" /></label>
        <label class="route-log-date-field"><span>Date sent</span><input name="date_sent" type="date" value="${escapeHtml(log?.date_sent || "")}" ${repeatSend || annualSend ? "required" : ""} /></label>
        <p class="muted">Date sent is required for leaderboard points. JuntMasters counts a route once in its Date sent year, including backlogged sends. Enable leaderboard publication in Profile to participate.</p>
        <label class="route-log-beta" ${repeatSend || annualSend ? "hidden" : ""}><span>Private beta</span><textarea name="beta" rows="4" placeholder="Your private beta…">${escapeHtml(log?.beta || "")}</textarea></label>
        <div class="route-log-actions"><button class="auth-primary" type="submit">${log ? "Update Log" : "Save Log"}</button>${log ? `<button id="route-log-delete" class="ghost" type="button">Remove</button>` : ""}</div>
        ${!repeatSend && log ? `<button id="route-repeat-open" class="ghost" type="button">Log another send</button>` : ""}
        <p id="route-log-message" class="route-log-message"></p>
      </form>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelectorAll("[data-edit-annual]").forEach(button => button.addEventListener("click", () => {
    const send = routeSendHistory(route).find(x => String(x.id) === button.dataset.editAnnual);
    if (send) openRouteLogModal(route, false, send);
  }));

  const form = modal.querySelector("#route-log-form");
  const status = form.elements.status;
  if (repeatSend) modal.querySelector(".eyebrow").textContent = "Log another send";
  const dateInput = form.elements.date_sent;
  dateInput.max = new Intl.DateTimeFormat("en-CA", {timeZone:"America/Denver", year:"numeric", month:"2-digit", day:"2-digit"}).format(new Date());
  if (repeatSend) dateInput.value = dateInput.max;
  if (repeatSend) form.elements.send_style.value = "repeat";
  const sendField = modal.querySelector(".route-log-send-field");
  const dateField = modal.querySelector(".route-log-date-field");
  const syncStatusFields = () => {
    const isSent = status.value === "sent";
    sendField.hidden = !isSent;
    dateField.hidden = !isSent;
  };
  status.addEventListener("change", syncStatusFields);
  syncStatusFields();

  modal.querySelector("#route-log-modal-close").addEventListener("click", closeRouteLogModal);
  modal.querySelector("#route-repeat-open")?.addEventListener("click", () => openRouteLogModal(route, true));
  modal.addEventListener("click", (event) => { if (event.target === modal) closeRouteLogModal(); });

  const escapeHandler = (event) => {
    if (event.key === "Escape" && document.querySelector("#route-log-modal")) {
      closeRouteLogModal();
      document.removeEventListener("keydown", escapeHandler);
    }
  };
  document.addEventListener("keydown", escapeHandler);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fd = new FormData(form);
    const payload = { route: route.route_id, status: fd.get("status"), send_style: fd.get("send_style") || null, attempts: Number(fd.get("attempts") || 0), date_sent: fd.get("date_sent") || null, beta: fd.get("beta") || null };
    if (repeatSend || annualSend) payload.status = "sent";
    if (payload.status !== "sent") { payload.send_style = null; payload.date_sent = null; }
    const existing = existingRouteLog(route.route_id);
    const result = annualSend ? await updateCompetitionSend(annualSend.id, {date_sent: payload.date_sent, send_style: payload.send_style})
      : repeatSend ? await createCompetitionSend({route: route.route_id, date_sent: payload.date_sent, send_style: payload.send_style})
      : existing ? await updateRouteLog(existing.log_id, payload) : await createRouteLog(payload);
    const msg = modal.querySelector("#route-log-message");
    if (!result.ok) { if (msg) msg.textContent = String(result.error); return; }
    await loadLogbook();
    closeRouteLogModal();
    renderDetail();
  });

  modal.querySelector("#route-log-delete")?.addEventListener("click", async () => {
    const existing = existingRouteLog(route.route_id);
    if ((!existing && !annualSend) || !confirm("Remove this send or log from your Log Book?")) return;
    const result = annualSend ? await deleteCompetitionSend(annualSend.id) : await deleteRouteLog(existing.log_id);
    if (result.ok) { await loadLogbook(); closeRouteLogModal(); renderDetail(); }
  });
}

function bindRouteLogCard(route, mode) {
  if (mode !== "routes" || !route) return;
  document.querySelector("#route-log-open")?.addEventListener("click", () => {
    const annual = existingRouteLog(route.route_id) ? null : routeSendHistory(route)[0];
    openRouteLogModal(route, false, annual || null);
  });
}

function bindSubareaRouteLinks() {
  el.detailRelated.querySelectorAll("[data-related-route-id]").forEach(button => {
    button.addEventListener("click", () => {
      const route = state.datasets.routes.find(item => String(item.route_id) === button.dataset.relatedRouteId);
      if (!route) return;
      state.selected = route;
      state.detailTab = "details";
      showMobileGuidePanel("detail");
      renderDetail();
      renderList();
    });
  });
}

function buildCoordinateSection(record, compact = false) {
  const point = parsePoint(record.centroid);
  if (!point || !point.every(Number.isFinite) || Math.abs(point[0]) > 90 || Math.abs(point[1]) > 180) return "";
  const coordinates = `${point[0].toFixed(6)}, ${point[1].toFixed(6)}`;
  if (compact) return `<span class="guide-coordinates route-title-coordinates">
    <span class="guide-coordinate-actions"><span class="coordinate-value" tabindex="0" aria-label="Route latitude and longitude" title="Lat/Lon">${escapeHtml(coordinates)}</span><button type="button" class="ghost" data-copy-coordinates aria-label="Copy route coordinates">Copy</button></span>
    <span class="coordinate-copy-status" role="status" aria-live="polite"></span></span>`;
  return `<section class="guide-coordinates" aria-label="Coordinates"><h3>Lat/Lon</h3>
    <div class="guide-coordinate-actions"><span class="coordinate-value" tabindex="0" aria-label="Latitude and longitude">${escapeHtml(coordinates)}</span><button type="button" class="ghost" data-copy-coordinates>Copy</button></div>
    <p class="coordinate-copy-status" role="status" aria-live="polite"></p></section>`;
}

function bindCoordinateCopy(container) {
  container.querySelectorAll("[data-copy-coordinates]").forEach(button => {
    const section = button.closest(".guide-coordinates");
    const value = section.querySelector(".coordinate-value");
    const selectCoordinates = () => {
      value.focus();
      const range = document.createRange();
      range.selectNodeContents(value);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    };
    const status = section.querySelector(".coordinate-copy-status");
    value.addEventListener("click", selectCoordinates);
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(value.textContent);
        status.textContent = "Coordinates copied.";
      } catch {
        selectCoordinates();
        let copied = false;
        try { copied = document.execCommand("copy"); } catch {}
        status.textContent = copied ? "Coordinates copied." : "Select and copy the coordinates above.";
      } finally { button.disabled = false; }
    });
  });
}
