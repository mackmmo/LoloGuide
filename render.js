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
    el.recordList.innerHTML = `<div class="description-card empty-state">No routes match the current filters.</div>`;
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

function renderRouteDetailsPanel(record) {
  const isEditing = state.editor.canEdit && state.editor.enabled;
  // Name Edits
  const nameHTML = isEditing
  ? `<input type="text" id="edit-route-name" value="${escapeHtml(record.name ?? "")}">`
  : `<span>${escapeHtml(record.name ?? "")}</span>`

  const nameElement = el.detailTitle.querySelector(".route-name-text");
  
  if (nameElement) {
    nameElement.outerHTML = nameHTML;
  }

  const nameInput = document.querySelector("#edit-route-name");

  // Description Edits
    //------------------------------------------------------------------------------------------
  const descriptionHTML = isEditing                                                            
  ? `<textarea id="edit-route-description">${escapeHtml(record.description ?? "")}</textarea>`
  : `<span>${escapeHtml(record.description ?? "")}</span>`;

  el.detailDescription.innerHTML = buildDetailDescription(record, "routes");
  const descriptionElement = el.detailDescription.querySelector(".route-description-text");
  
  if (descriptionElement) {
    descriptionElement.outerHTML = descriptionHTML;
  }

  const descriptionInput = document.querySelector("#edit-route-description");
  //---------------------------------------------------------------------------------------------

  document.querySelector(".detail-panel")?.classList.remove("community-mode");
  el.detailDescription.classList.remove("community-full-panel");

  if (el.detailRelated) el.detailRelated.innerHTML = "";
  
  el.detailFacts.innerHTML = detailFacts(record, "routes").map(renderFact).join("");

  // Grade Edits
  //------------------------------------------------------------------------------------
  const gradeHTML = isEditing
  ? `<input type="text" id="edit-route-grade" value="${escapeHtml(record.grade ?? "")}">`
  : `<span>${escapeHtml(record.grade ?? "")}</span>`

  const gradeElement = el.detailFacts.querySelector(".route-grade-text");
  console.log("Grade element:", gradeElement);
  console.log("Editing enabled:", isEditing);
  if (gradeElement) {
    gradeElement.outerHTML = gradeHTML;
  }
  //------------------------------------------------------------------------------------

  if (isEditing) {
    el.detailFacts.insertAdjacentHTML(
      "beforeend",
      `
        <button
          type="button"
          id="save-route-changes"
          class="auth-primary"
        >
          Save Changes
        </button>
      `
    );
  }

  const saveButton = document.querySelector("#save-route-changes");

  saveButton?.addEventListener("click", async () => {
    const nameInput = document.querySelector("#edit-route-name");
    const descriptionInput = document.querySelector("#edit-route-description");
    const gradeInput = document.querySelector("#edit-route-grade");
    const typeInput = document.querySelector("#edit-route-type");
    const starsInput = document.querySelector("#edit-route-stars");
    const heightInput = document.querySelector("#edit-route-height");
    const faInput = document.querySelector("#edit-route-fa");
    const faYearInput = document.querySelector("#edit-route-fa-year");
    const proInput = document.querySelector("#edit-route-pro");
    const dangerRateingInput = document.querySelector("#edit-route-danger");
  
    if (!nameInput) return;
  
    const updatedName = nameInput.value.trim();
    const updatedDescription = descriptionInput.value.trim()
    const updateGrade = gradeInput.value.trim()
  
    if (!updatedName) {
      alert("Route name cannot be empty.");
      return;
    }
  
    saveButton.disabled = true;
    saveButton.textContent = "Saving...";
  
    try {
      const result = await updateRoute(record.route_id, {
        name: updatedName,
        description: updatedDescription,
        grade: updateGrade
      });
  
      if (!result.ok) {
        console.error("Save failed:", result);
        alert("Could not save route changes.");
        return;
      }
  
      record.name = result.data.name;
      record.description = result.data.description
      record.grade = result.data.grade
      renderDetail();
  
      console.log("Route updated successfully:", result.data);
  
    } catch (error) {
      console.error("Save error:", error);
      alert("An error occurred while saving.");
  
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "Save Changes";
    }
  });

  if (el.detailLog) {
    el.detailLog.innerHTML = buildRouteLogCard(record);
    bindRouteLogCard(record, "routes");
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
  if (mode === "routes" && record.pro) {
    extra.push(`<p><strong>Protection</strong> ${escapeHtml(record.pro)}</p>`);
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
  const factClass = label === "Grade" ? "route-grade-text" : "";

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
  return `<div class="send-history">${routeSendHistory(route).map(x => `<div class="send-history-row"><span>${escapeHtml(x.date_sent)} · ${escapeHtml(x.send_style || "sent")}</span><button type="button" class="ghost" data-edit-annual="${Number(x.id)}">Edit send</button></div>`).join("")}</div>`;
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
