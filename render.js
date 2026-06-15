function render() {
  renderStatus();
  renderModeTabs();
  renderFilters();
  renderStats();
  renderList();
  renderDetail();
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

  if (el.activeModeLabel) el.activeModeLabel.textContent = "Routes";
  if (el.resultCount) el.resultCount.textContent = String(records.length);
  if (el.selectionLabel) el.selectionLabel.textContent = state.selected ? recordTitle(state.selected) : detailSelectionLabel();
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
      <small>${escapeHtml(recordMeta(record, "routes"))}</small>
      <p>${escapeHtml(recordSnippet(record))}</p>
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

  if (!current) {
    el.detailTitle.textContent = "Choose a route";
    el.detailSubtitle.textContent = "Area and subarea details will appear here when filters are applied.";
    el.detailDescription.innerHTML = "Use the filters or click a route to inspect details without leaving the page.";
    el.detailFacts.innerHTML = "";
    updateMap(null);
    return;
  }

  const { record, mode } = current;
  el.detailTitle.textContent = recordTitle(record);
  el.detailSubtitle.textContent = recordMeta(record, mode);
  el.detailDescription.innerHTML = buildDetailDescription(record, mode);
  el.detailFacts.innerHTML = detailFacts(record, mode).map(renderFact).join("");
  updateMap(mode === "routes" ? record : null);
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
  return `<strong>Description</strong><p>${escapeHtml(description)}</p>${extra.join("")}`;
}

function detailFacts(record, detailMode = "routes") {
  const facts = [];

  if (detailMode === "routes") {
    facts.push(["Grade", record.grade || "-"]);
    facts.push(["Type", routeTypeLabel(record.type) || record.type || "-"]);
    facts.push(["Stars", record.star_rating ?? "-"]);
    facts.push(["Height", record.height ? `${record.height} ft` : "-"]);
    facts.push(["Danger", record.danger_rating || "-"]);
    facts.push(["First ascent", record.first_ascencionist || "-"]);
    facts.push(["FA year", record.fa_year ?? "-"]);
  } else if (detailMode === "subareas") {
    facts.push(["Area", record.area_name || "-"]);
    facts.push(["Sector", record.sector_name || "-"]);
    facts.push(["Aspect", record.aspect || "-"]);
    facts.push(["Routes", countRoutesForSubarea(record.subarea_id)]);
  } else if (detailMode === "areas") {
    facts.push(["Sector", record.sector_name || "-"]);
    facts.push(["Approach", record.approach_time ? `${record.approach_time} min` : "-"]);
    facts.push(["Drive", record.drive_time ? `${record.drive_time} min` : "-"]);
    facts.push(["Aspect", record.aspect || "-"]);
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
