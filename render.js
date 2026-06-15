function render() {
  renderStatus();
  renderModeTabs();
  renderFilters();
  renderStats();
  renderList();
}

function renderStatus() {
  const failures = Object.entries(state.loadErrors);

  if (state.isLoading) {
    el.statusBanner.textContent = `Loading data from ${state.apiBase}...`;
    return;
  }

  if (!failures.length) {
    el.statusBanner.textContent = `Connected to ${state.apiBase}. Loaded ${state.datasets.routes.length} routes across ${state.datasets.subareas.length} subareas, ${state.datasets.areas.length} areas, and ${state.datasets.sectors.length} sectors.`;
    return;
  }

  el.statusBanner.textContent = `Connected to ${state.apiBase} with load issues. ${failures.map(([key, value]) => `${key}: ${value}`).join(" ")}`;
}

function renderModeTabs() {
  el.modeTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.mode);
  });
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
  if (!el.statsGrid) {
    return;
  }

  el.statsGrid.innerHTML = [
    statCard("Routes", state.datasets.routes.length),
    statCard("Subareas", state.datasets.subareas.length),
    statCard("Areas", state.datasets.areas.length),
    statCard("Sectors", state.datasets.sectors.length)
  ].join("");
}

function statCard(label, value) {
  return `<div class="stat-card"><small>${label}</small><strong>${value}</strong></div>`;
}

function getVisibleRecords() {
  const source = state.datasets[state.mode] || [];

  if (state.mode === "routes") {
    return source;
  }

  const search = state.filters.search.toLowerCase();

  const records = source.filter((record) => {
    if (state.mode === "subareas") {
      if (state.filters.sectorId && String(record.sector) !== state.filters.sectorId) {
        return false;
      }
      if (state.filters.areaId && String(record.area) !== state.filters.areaId) {
        return false;
      }
    }

    if (state.mode === "areas") {
      if (state.filters.sectorId && String(record.sector) !== state.filters.sectorId) {
        return false;
      }
    }

    return !search || searchableText(record).includes(search);
  });

  return sortRecords(records);
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
  const sort = state.filters.sort;
  if (sort === "default") {
    return records;
  }

  return [...records].sort((left, right) => {
    if (sort === "stars") {
      return Number(right.star_rating || 0) - Number(left.star_rating || 0);
    }
    if (sort === "height") {
      return Number(right.height || 0) - Number(left.height || 0);
    }
    const leftValue = String(left[sort] ?? "");
    const rightValue = String(right[sort] ?? "");
    return leftValue.localeCompare(rightValue, undefined, { numeric: true });
  });
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

  el.activeModeLabel.textContent = capitalize(state.mode);
  el.resultCount.textContent = String(records.length);
  el.selectionLabel.textContent = state.contextRecord ? recordTitle(state.contextRecord) : state.selected ? recordTitle(state.selected) : "None";
  el.detailTitle.textContent = capitalize(state.mode);
  el.detailSubtitle.textContent = `${records.length} result${records.length === 1 ? "" : "s"}`;

  if (!records.length) {
    el.recordList.innerHTML = `<div class="description-card empty-state">No ${state.mode} match the current filters.</div>`;
    return;
  }

  el.recordList.innerHTML = records.map(renderRecordCard).join("");
  document.querySelectorAll(".record-card").forEach((button, index) => {
    button.addEventListener("click", () => {
      state.contextRecord = null;
      state.contextMode = null;
      state.selected = records[index];
      render();
    });
  });
}

function renderRecordCard(record) {
  const active = state.selected && recordKey(state.selected) === recordKey(record) ? "active" : "";
  return `
    <button class="record-card ${active}" data-id="${recordKey(record)}">
      <strong>${escapeHtml(recordTitle(record))}</strong>
      <small>${escapeHtml(recordMeta(record))}</small>
      <p>${escapeHtml(recordSnippet(record))}</p>
    </button>
  `;
}

function renderDetail() {
  return;
}

function renderContextStrip(record, detailMode = state.mode) {
  if (detailMode === "areas") {
    renderAreaSubareaStrip(record);
    return;
  }

  renderSubareaRouteStrip(record, detailMode);
}

function renderAreaSubareaStrip(record) {
  const subareas = state.datasets.subareas
    .filter((subarea) => String(subarea.area) === String(record.area_id))
    .sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")));

  if (!subareas.length) {
    el.subareaRouteStrip.innerHTML = "";
    return;
  }

  el.subareaRouteStrip.innerHTML =
    `
      <div class="description-card">
        Subareas in this area. Choose one to move into its route overview.
      </div>
    ` +
    subareas
      .map((subarea) => {
        const routeCount = countRoutesForSubarea(subarea.subarea_id);
        return `
          <button class="subarea-route-card" data-subarea-id="${subarea.subarea_id}">
            <small>${escapeHtml(subarea.aspect || "Subarea")}</small>
            <strong>${escapeHtml(subarea.name)}</strong>
            <small>${escapeHtml(`${routeCount} route${routeCount === 1 ? "" : "s"}`)}</small>
          </button>
        `;
      })
      .join("");

  document.querySelectorAll(".subarea-route-card[data-subarea-id]").forEach((button) => {
    button.addEventListener("click", () => {
      jumpTo("subareas", button.dataset.subareaId);
    });
  });
}

function renderSubareaRouteStrip(record, detailMode = state.mode) {
  const subareaId =
    detailMode === "routes" ? record.subarea :
    detailMode === "subareas" ? record.subarea_id :
    null;

  if (!subareaId) {
    el.subareaRouteStrip.innerHTML = "";
    return;
  }

  const routes = routesForSubarea(subareaId);
  if (!routes.length) {
    el.subareaRouteStrip.innerHTML = "";
    return;
  }

  el.subareaRouteStrip.innerHTML =
    `
      <div class="description-card">
        Routes in this subarea are ordered left to right.
      </div>
    ` +
    routes
      .map((route) => {
        const active =
          state.mode === "routes" && state.selected && String(state.selected.route_id) === String(route.route_id)
            ? "active"
            : "";
        return `
          <button class="subarea-route-card ${active}" data-route-id="${route.route_id}">
            <small>${escapeHtml(routeTypeLabel(route.type) || "Route")}</small>
            <strong>${escapeHtml(route.name)}</strong>
            <small>${escapeHtml([route.grade, route.height ? `${route.height} ft` : ""].filter(Boolean).join(" | "))}</small>
          </button>
        `;
      })
      .join("");

  document.querySelectorAll(".subarea-route-card[data-route-id]").forEach((button) => {
    button.addEventListener("click", () => {
      jumpTo("routes", button.dataset.routeId);
    });
  });
}

function recordTitle(record) {
  return record.name || `Record ${recordKey(record)}`;
}

function recordMeta(record, detailMode = state.mode) {
  if (detailMode === "routes") {
    return [record.grade, routeTypeLabel(record.type), record.subarea_name, record.area_name].filter(Boolean).join(" | ");
  }
  if (detailMode === "subareas") {
    return [record.area_name, record.sector_name, record.aspect].filter(Boolean).join(" | ");
  }
  if (detailMode === "areas") {
    return [record.sector_name, record.aspect, record.approach_time ? `${record.approach_time} min approach` : ""].filter(Boolean).join(" | ");
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
  return `<div class="fact-card"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(String(value))}</span></div>`;
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
