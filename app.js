const DEFAULT_API_BASE = "https://lolo-app-2.onrender.com";
const API_BASE_STORAGE_KEY = "lolo-api-base";

const state = {
  apiBase: DEFAULT_API_BASE,
  isLoading: false,
  loadErrors: {},
  mode: "routes",
  datasets: {
    sectors: [],
    areas: [],
    subareas: [],
    routes: []
  },
  filters: {
    search: "",
    sectorId: "",
    areaId: "",
    subareaId: "",
    type: "",
    sort: "default"
  },
  selected: null,
  contextRecord: null,
  contextMode: null,
  overlays: {
    sectors: true,
    areas: true
  },
  filtersCollapsed: false
};

const el = {
  statusBanner: document.querySelector("#status-banner"),
  statsGrid: document.querySelector("#stats-grid"),
  resetAll: document.querySelector("#reset-all"),
  toggleFilters: document.querySelector("#toggle-filters"),
  filtersPanelBody: document.querySelector("#filters-panel-body"),
  modeTabs: [...document.querySelectorAll(".mode-tab")],
  searchInput: document.querySelector("#search-input"),
  sectorFilter: document.querySelector("#sector-filter"),
  areaFilter: document.querySelector("#area-filter"),
  subareaFilter: document.querySelector("#subarea-filter"),
  typeFilter: document.querySelector("#type-filter"),
  sortFilter: document.querySelector("#sort-filter"),
  activeModeLabel: document.querySelector("#active-mode-label"),
  resultCount: document.querySelector("#result-count"),
  selectionLabel: document.querySelector("#selection-label"),
  listTitle: document.querySelector("#list-title"),
  listMeta: document.querySelector("#list-meta"),
  recordList: document.querySelector("#record-list"),
  detailTitle: document.querySelector("#detail-title"),
  detailSubtitle: document.querySelector("#detail-subtitle"),
  detailBreadcrumbs: document.querySelector("#detail-breadcrumbs"),
  subareaRouteStrip: document.querySelector("#subarea-route-strip"),
  detailFacts: document.querySelector("#detail-facts"),
  detailDescription: document.querySelector("#detail-description"),
  mapMeta: document.querySelector("#map-meta"),
  mapContextTitle: document.querySelector("#map-context-title"),
  mapContextBody: document.querySelector("#map-context-body"),
  toggleSectors: document.querySelector("#toggle-sectors"),
  toggleAreas: document.querySelector("#toggle-areas")
};

let map = null;
let marker = null;
let sectorLayerGroup = null;
let areaLayerGroup = null;
let sectorById = new Map();
let areaById = new Map();
let subareaById = new Map();

function init() {
  initMap();
  bindEvents();
  renderStats();
  renderFilters();
  render();
  loadAllData();
}

function initMap() {
  map = new maplibregl.Map({
    container: "map",
    style: {
      version: 8,
      glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
      sources: {},
      layers: [
        {
          id: "background",
          type: "background",
          paint: {
            "background-color": "#f5efdf"
          }
        }
      ]
    },
    center: [-114.56835793693313, 46.69852662439601],
    zoom: 11
  });

  map.addControl(new maplibregl.NavigationControl(), "top-left");

  map.on("load", () => {
    console.log("Map loaded");
    renderOverlayLayers();
  });

  map.on("error", (event) => {
    console.error("MapLibre error", event);
  });
}


function bindEvents() {
  el.resetAll.addEventListener("click", resetAll);
  el.toggleFilters.addEventListener("click", () => {
    state.filtersCollapsed = !state.filtersCollapsed;
    renderFilterCollapse();
  });

  el.modeTabs.forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      state.contextRecord = null;
      state.contextMode = null;
      if (button.dataset.mode === "routes") {
        state.filters.sectorId = "";
        state.filters.areaId = "";
        state.filters.subareaId = "";
        state.filters.type = "";
        state.filters.search = "";
      }
      if (button.dataset.mode === "subareas" || button.dataset.mode === "areas") {
        state.filters.subareaId = "";
      }
      state.selected = null;
      render();
    });
  });

  el.searchInput.addEventListener("input", (event) => {
    state.filters.search = event.target.value;
    syncSelectedRecord();
    render();
  });

  el.sectorFilter.addEventListener("change", (event) => {
    state.filters.sectorId = event.target.value;
    if (state.filters.sectorId && !areaMatchesSector(state.filters.areaId, state.filters.sectorId)) {
      state.filters.areaId = "";
      state.filters.subareaId = "";
    }
    syncSelectedRecord();
    render();
  });

  el.areaFilter.addEventListener("change", (event) => {
    state.filters.areaId = event.target.value;
    if (state.filters.areaId) {
      const area = areaById.get(state.filters.areaId);
      state.filters.sectorId = area ? String(area.sector) : state.filters.sectorId;
    }
    if (state.filters.subareaId && !subareaMatchesArea(state.filters.subareaId, state.filters.areaId)) {
      state.filters.subareaId = "";
    }
    syncSelectedRecord();
    render();
  });

  el.subareaFilter.addEventListener("change", (event) => {
    state.filters.subareaId = event.target.value;
    if (state.filters.subareaId) {
      const subarea = subareaById.get(state.filters.subareaId);
      if (subarea) {
        state.filters.areaId = String(subarea.area);
        const area = areaById.get(String(subarea.area));
        state.filters.sectorId = area ? String(area.sector) : state.filters.sectorId;
      }
    }
    syncSelectedRecord();
    render();
  });

  el.typeFilter.addEventListener("change", (event) => {
    state.filters.type = event.target.value;
    syncSelectedRecord();
    render();
  });

  el.sortFilter.addEventListener("change", (event) => {
    state.filters.sort = event.target.value;
    syncSelectedRecord();
    render();
  });

  el.toggleSectors.addEventListener("change", (event) => {
    state.overlays.sectors = event.target.checked;
    renderOverlayLayers();
  });

  el.toggleAreas.addEventListener("change", (event) => {
    state.overlays.areas = event.target.checked;
    renderOverlayLayers();
  });
}

async function loadAllData() {
  state.isLoading = true;
  state.loadErrors = {};
  renderStatus();

  try {
    const endpoints = ["sectors", "areas", "subareas", "routes"];
    const results = await Promise.all(
      endpoints.map(async (name) => {
        const response = await fetchJson(`${state.apiBase}/${name}/`);
        return [name, response];
      })
    );

    const nextDatasets = {
      sectors: [],
      areas: [],
      subareas: [],
      routes: []
    };
    const nextErrors = {};

    results.forEach(([name, result]) => {
      if (result.ok) {
        nextDatasets[name] = Array.isArray(result.data) ? result.data : [];
        return;
      }
      nextErrors[name] = result.error;
    });

    state.datasets.sectors = nextDatasets.sectors;
    state.datasets.areas = nextDatasets.areas;
    state.datasets.subareas = nextDatasets.subareas;
    state.datasets.routes = nextDatasets.routes;
    state.loadErrors = nextErrors;
    rebuildIndexes();
  } catch (error) {
    console.error("loadAllData error", error);
    state.loadErrors.general = error.message || String(error);
  } finally {
    state.isLoading = false;
    syncSelectedRecord();
    render();
    fitMapToOverview();
  }
}

async function fetchJson(url) {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `${response.status} ${response.statusText}`
      };
    }

    const data = await response.json();
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: friendlyFetchError(error)
    };
  }
}

function friendlyFetchError(error) {
  const message = error?.message || "Unknown fetch error";
  if (/failed to fetch/i.test(message)) {
    return "Failed to fetch. Direct browser calls usually need CORS enabled on the Django backend for this frontend origin.";
  }
  return message;
}

function rebuildIndexes() {
  sectorById = new Map(state.datasets.sectors.map((item) => [String(item.sector_id), item]));
  areaById = new Map(state.datasets.areas.map((item) => [String(item.area_id), item]));
  subareaById = new Map(state.datasets.subareas.map((item) => [String(item.subarea_id), item]));

  state.datasets.areas = state.datasets.areas.map(enrichArea);
  areaById = new Map(state.datasets.areas.map((item) => [String(item.area_id), item]));
  state.datasets.subareas = state.datasets.subareas.map(enrichSubarea);
  subareaById = new Map(state.datasets.subareas.map((item) => [String(item.subarea_id), item]));
  state.datasets.routes = state.datasets.routes.map(enrichRoute);

  renderOverlayLayers();
}

function enrichArea(area) {
  const sector = sectorById.get(String(area.sector));
  return {
    ...area,
    sector_name: sector?.name || "Unknown sector"
  };
}

function enrichSubarea(subarea) {
  const area = areaById.get(String(subarea.area));
  return {
    ...subarea,
    area_name: area?.name || "Unknown area",
    sector: area?.sector ?? null,
    sector_name: area?.sector_name || "Unknown sector"
  };
}

function enrichRoute(route) {
  const subarea = route.subarea ? subareaById.get(String(route.subarea)) : null;
  const area =
    route.area
      ? areaById.get(String(route.area))
      : subarea
        ? areaById.get(String(subarea.area))
        : null;

  return {
    ...route,
    subarea_name: route.subarea_name || subarea?.name || "",
    area: route.area ?? subarea?.area ?? null,
    area_name: route.area_name || area?.name || "Unknown area",
    sector: area?.sector ?? null,
    sector_name: area?.sector_name || "Unknown sector"
  };
}

function resetAll() {
  state.mode = "routes";
  state.filters = {
    search: "",
    sectorId: "",
    areaId: "",
    subareaId: "",
    type: "",
    sort: "default"
  };
  state.contextRecord = null;
  state.contextMode = null;
  state.selected = null;
  render();
}

function render() {
  renderStatus();
  renderModeTabs();
  renderFilterCollapse();
  renderFilters();
  renderStats();
  renderMapToggles();
  renderList();
  renderDetail();
}

function renderMapToggles() {
  el.toggleSectors.checked = state.overlays.sectors;
  el.toggleAreas.checked = state.overlays.areas;
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

function renderFilterCollapse() {
  el.filtersPanelBody.classList.toggle("is-collapsed", state.filtersCollapsed);
  el.toggleFilters.textContent = state.filtersCollapsed ? "Show Filters" : "Hide Filters";
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
  const search = state.filters.search.toLowerCase();

  let records = source.filter((record) => {
    if (state.mode === "routes") {
      if (state.filters.sectorId && String(record.sector) !== state.filters.sectorId) {
        return false;
      }
      if (state.filters.areaId && String(record.area) !== state.filters.areaId) {
        return false;
      }
      if (state.filters.subareaId && String(record.subarea) !== state.filters.subareaId) {
        return false;
      }
      if (state.filters.type && String(record.type) !== state.filters.type) {
        return false;
      }
    }

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
  el.listTitle.textContent = capitalize(state.mode);
  el.listMeta.textContent = `${records.length} result${records.length === 1 ? "" : "s"}`;

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
  const record = state.contextRecord || state.selected;
  const detailMode = state.contextMode || state.mode;

  if (!record) {
    el.detailTitle.textContent = "Pick a record";
    el.detailSubtitle.textContent = "Details and location context appear here.";
    el.detailBreadcrumbs.innerHTML = "";
    el.subareaRouteStrip.innerHTML = "";
    el.detailFacts.innerHTML = "";
    el.detailDescription.innerHTML = `<strong>Description</strong><p>Select a route, subarea, area, or sector to explore its details.</p>`;
    el.mapMeta.textContent = "Overview of the Lolo climbing area with sectors and areas.";
    el.mapContextTitle.textContent = "Lolo Overview";
    el.mapContextBody.textContent = "Sectors and areas are visible by default so you can start by orienting yourself on the map.";
    updateMap(null);
    return;
  }

  el.detailTitle.textContent = recordTitle(record);
  el.detailSubtitle.textContent = recordMeta(record, detailMode);
  el.detailBreadcrumbs.innerHTML = buildBreadcrumbs(record).join("");
  bindBreadcrumbs();
  renderContextStrip(record, detailMode);
  el.detailFacts.innerHTML = detailFacts(record, detailMode).map(renderFact).join("");
  el.detailDescription.innerHTML = `<strong>Description</strong><p>${escapeHtml(record.description || "No description available.")}</p>`;
  updateMap(record);
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

function buildBreadcrumbs(record) {
  const crumbs = [];

  if (record.sector || record.sector_id) {
    const sector = record.sector_id ? record : sectorById.get(String(record.sector));
    if (sector) {
      crumbs.push(`<button class="crumb" data-mode="sectors" data-id="${sector.sector_id}">${escapeHtml(sector.name)}</button>`);
    }
  }
  if (record.area || record.area_id) {
    const area = record.area_id ? record : areaById.get(String(record.area));
    if (area) {
      crumbs.push(`<button class="crumb" data-mode="areas" data-id="${area.area_id}">${escapeHtml(area.name)}</button>`);
    }
  }
  if (record.subarea || record.subarea_id) {
    const subarea = record.subarea_id ? record : subareaById.get(String(record.subarea));
    if (subarea) {
      crumbs.push(`<button class="crumb" data-mode="subareas" data-id="${subarea.subarea_id}">${escapeHtml(subarea.name)}</button>`);
    }
  }

  return crumbs;
}

function bindBreadcrumbs() {
  document.querySelectorAll(".crumb").forEach((button) => {
    button.addEventListener("click", () => jumpTo(button.dataset.mode, button.dataset.id));
  });
}

function detailFacts(record, detailMode = state.contextMode || state.mode) {
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

function renderFact([label, value]) {
  return `<div class="fact-card"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(String(value))}</span></div>`;
}

function jumpTo(mode, id) {
  state.mode = mode;
  state.contextRecord = null;
  state.contextMode = null;
  state.selected = (state.datasets[mode] || []).find((item) => recordKey(item) === String(id)) || null;

  if (mode === "areas" && state.selected) {
    state.filters.sectorId = String(state.selected.sector || "");
    state.filters.areaId = String(state.selected.area_id || "");
    state.filters.subareaId = "";
  }

  if (mode === "subareas" && state.selected) {
    state.filters.areaId = String(state.selected.area || "");
    state.filters.subareaId = String(state.selected.subarea_id || "");
    const area = areaById.get(String(state.selected.area || ""));
    state.filters.sectorId = area ? String(area.sector) : state.filters.sectorId;
  }

  if (mode === "routes" && state.selected) {
    state.filters.subareaId = String(state.selected.subarea || "");
    state.filters.areaId = String(state.selected.area || "");
    state.filters.sectorId = String(state.selected.sector || "");
  }

  render();
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

function areaMatchesSector(areaId, sectorId) {
  if (!areaId || !sectorId) {
    return true;
  }
  const area = areaById.get(String(areaId));
  return area ? String(area.sector) === String(sectorId) : false;
}

function subareaMatchesArea(subareaId, areaId) {
  if (!subareaId || !areaId) {
    return true;
  }
  const subarea = subareaById.get(String(subareaId));
  return subarea ? String(subarea.area) === String(areaId) : false;
}

function updateMap(record) {}

function focusAreaFromMap(area) {
  state.filters.sectorId = String(area.sector);
  state.filters.areaId = String(area.area_id);
  state.filters.subareaId = "";
  state.filters.search = "";
  state.filters.type = "";
  state.mode = "routes";
  state.contextRecord = state.datasets.areas.find((item) => String(item.area_id) === String(area.area_id)) || null;
  state.contextMode = "areas";
  state.selected = null;

  const polygons = parseMultiPolygon(area.boundary);
  if (map && polygons.length) {
    const points = polygons.flat(2);
    const bounds = L.latLngBounds(points);
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }

  render();
}

function getRouteTypeCountsForArea(areaId) {
  const counts = {
    Sport: 0,
    Trad: 0,
    Mixed: 0,
    Other: 0
  };

  state.datasets.routes
    .filter((route) => String(route.area) === String(areaId))
    .forEach((route) => {
      const label = routeTypeLabel(route.type);
      if (label === "Sport" || label === "Trad" || label === "Mixed") {
        counts[label] += 1;
      } else {
        counts.Other += 1;
      }
    });

  return counts;
}

function buildAreaTypeSummary(areaId) {
  const counts = getRouteTypeCountsForArea(areaId);

  return [
    counts.Sport ? `${counts.Sport} sport` : "",
    counts.Trad ? `${counts.Trad} trad` : "",
    counts.Mixed ? `${counts.Mixed} mixed` : "",
    counts.Other ? `${counts.Other} other` : ""
  ]
    .filter(Boolean)
    .join(" | ");
}

function buildAreaPopupHtml(area) {
  const typeSummary = buildAreaTypeSummary(area.area_id);

  return `
    <div class="map-popup-card">
      <h3>${escapeHtml(area.name)}</h3>
      <p class="map-popup-description">
        ${escapeHtml(area.description || "No description available.")}
      </p>
      <div class="map-popup-facts">
        <span><strong>Drive</strong> ${escapeHtml(area.drive_time ? `${area.drive_time} min` : "-")}</span>
        <span><strong>Approach</strong> ${escapeHtml(area.approach_time ? `${area.approach_time} min` : "-")}</span>
        <span><strong>Aspect</strong> ${escapeHtml(area.aspect || "-")}</span>
      </div>
      ${typeSummary ? `<p class="map-popup-summary">${escapeHtml(typeSummary)}</p>` : ""}
    </div>
  `;
}

function renderOverlayLayers() {
  if (!map) {
    console.log("No map yet");
    return;
  }

  if (!map.isStyleLoaded()) {
    console.log("Map style not loaded yet");
    return;
  }

  console.log("Adding areas source/layers");

  try {
    if (!map.getSource("areas")) {
      map.addSource("areas", {
        type: "vector",
        tiles: [`${state.apiBase}/tiles/areas/{z}/{x}/{y}.mvt`],
        minzoom: 0,
        maxzoom: 14
      });
      console.log("Areas source added");
    }
    
    if (!map.getSource("area-labels")) {
      map.addSource("area-labels", {
        type: "vector",
        tiles: [`${state.apiBase}/tiles/area-labels/{z}/{x}/{y}.mvt`],
        minzoom: 0,
        maxzoom: 14
      });
  console.log("Area labels source added");
    }


    if (!map.getLayer("areas-fill")) {
      map.addLayer({
        id: "areas-fill",
        type: "fill",
        source: "areas",
        "source-layer": "areas",
        paint: {
          "fill-color": "#7570b3",
          "fill-opacity": 0.28
        }
      });
      console.log("Areas fill layer added");
    }

    if (!map.getLayer("areas-outline")) {
      map.addLayer({
        id: "areas-outline",
        type: "line",
        source: "areas",
        "source-layer": "areas",
        paint: {
          "line-color": "#7570b3",
          "line-width": 1.5
        }
      });
      console.log("Areas outline layer added");
    }

if (!map.getLayer("area-labels")) {
  map.addLayer({
    id: "area-labels",
    type: "symbol",
    source: "area-labels",
    "source-layer": "area_labels",
    minzoom: 8,
    layout: {
      "text-field": ["get", "name"],
      "text-size": 12,
      "text-allow-overlap": false,
      "text-ignore-placement": false
    },
    paint: {
      "text-color": "#173126",
      "text-halo-color": "rgba(255,255,255,0.95)",
      "text-halo-width": 1.5
    }
  });
  console.log("Areas labels layer added");
}
    if (!map.getSource("roads")) {
  map.addSource("roads", {
    type: "vector",
    tiles: [`${state.apiBase}/tiles/roads/{z}/{x}/{y}.mvt`],
    minzoom: 0,
    maxzoom: 14
  });
  console.log("Roads source added");
}

if (!map.getLayer("roads-line")) {
  map.addLayer({
    id: "roads-line",
    type: "line",
    source: "roads",
    "source-layer": "roads",
    minzoom: 11,
    paint: {
      "line-color": "#2f2c2c",
      "line-width": 1,
      "line-opacity": 1
    }
  });
}

if (!map.getLayer("roads-labels")) {
  map.addLayer({
    id: "roads-labels",
    type: "symbol",
    source: "roads",
    "source-layer": "roads",
    minzoom: 13,
    layout: {
      "symbol-placement": "line",
      "text-field": ["coalesce", ["get", "roadname"], ""],
      "text-size": 11,
      "text-allow-overlap": false,
      "text-ignore-placement": false
    },
    paint: {
      "text-color": "#5f5a50",
      "text-halo-color": "rgba(255,255,255,0.9)",
      "text-halo-width": 1
    }
  });
  console.log("Road labels layer added");
}

if (!map.getSource("trails")) {
  map.addSource("trails", {
    type: "vector",
    tiles: [`${state.apiBase}/tiles/trails/{z}/{x}/{y}.mvt`],
    minzoom: 0,
    maxzoom: 14
  });
  console.log("Trails source added");
}

if (!map.getLayer("trails-line")) {
  map.addLayer({
    id: "trails-line",
    type: "line",
    source: "trails",
    "source-layer": "trails",
    minzoom: 12,
    paint: {
      "line-color": "#7a5f2e",
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        12, 1,
        15, 2.5
      ],
      "line-dasharray": [2, 1],
      "line-opacity": 0.8
    }
  });
  console.log("Trails line layer added");
}

if (!map.getLayer("trails-labels")) {
  map.addLayer({
    id: "trails-labels",
    type: "symbol",
    source: "trails",
    "source-layer": "trails",
    minzoom: 13,
    layout: {
      "symbol-placement": "line",
      "text-field": ["coalesce", ["get", "approach"], ""],
      "text-size": 11,
      "text-allow-overlap": false,
      "text-ignore-placement": false
    },
    paint: {
      "text-color": "#6c5528",
      "text-halo-color": "rgba(255,255,255,0.9)",
      "text-halo-width": 1
    }
  });
  console.log("Trail labels layer added");
}

if (!map.getSource("pois")) {
  map.addSource("pois", {
    type: "vector",
    tiles: [`${state.apiBase}/tiles/pois/{z}/{x}/{y}.mvt`],
    minzoom: 0,
    maxzoom: 14
  });
  console.log("POIs source added");
}

if (!map.getLayer("pois-points")) {
  map.addLayer({
    id: "pois-points",
    type: "symbol",
    source: "pois",
    "source-layer": "poi",
    minzoom: 14,
    layout: {
      "text-field": "i",
      "text-size": 12
    },
    paint: {
      "text-color": "#b85c38",
      "text-halo-color": "#ffffff",
      "text-halo-width": 2
    }
  });
}

if (!map.getLayer("pois-labels")) {
  map.addLayer({
    id: "pois-labels",
    type: "symbol",
    source: "pois",
    "source-layer": "poi",
    minzoom: 15,
    layout: {
      "text-field": ["coalesce", ["get", "name"], ""],
      "text-size": 10,
      "text-offset": [0, 1.1],
      "text-anchor": "top",
      "text-allow-overlap": false,
      "text-ignore-placement": false
    },
    paint: {
      "text-color": "#5d2b1f",
      "text-halo-color": "rgba(255,255,255,0.95)",
      "text-halo-width": 1.2
    }
  });
  console.log("POIs labels layer added");
}

if (!map.getSource("trailheads")) {
  map.addSource("trailheads", {
    type: "vector",
    tiles: [`${state.apiBase}/tiles/trailheads/{z}/{x}/{y}.mvt`],
    minzoom: 0,
    maxzoom: 14
  });
  console.log("Trailheads source added");
}

if (!map.getLayer("trailheads-symbols")) {
  map.addLayer({
    id: "trailheads-symbols",
    type: "symbol",
    source: "trailheads",
    "source-layer": "trailheads",
    minzoom: 13,
    layout: {
      "text-field": "TH",
      "text-size": 11,
      "text-font": ["Open Sans Bold"]
    },
    paint: {
      "text-color": "#ffffff",
      "text-halo-color": "#2d8a5f",
      "text-halo-width": 4
    }
  });
}

if (!map.getLayer("trailheads-labels")) {
  map.addLayer({
    id: "trailheads-labels",
    type: "symbol",
    source: "trailheads",
    "source-layer": "trailheads",
    minzoom: 14,
    layout: {
      "text-field": ["coalesce", ["get", "name"], ""],
      "text-size": 11,
      "text-offset": [0, 1.2],
      "text-anchor": "top",
      "text-allow-overlap": false,
      "text-ignore-placement": false
    },
    paint: {
      "text-color": "#173126",
      "text-halo-color": "rgba(255,255,255,0.95)",
      "text-halo-width": 1.2
    }
  });
  console.log("Trailheads labels layer added");
}

if (!map.__areasPopupBound && map.getLayer("areas-fill")) {
  map.on("click", "areas-fill", (event) => {
    const feature = event.features && event.features[0];
    if (!feature) {
      return;
    }

    const props = feature.properties || {};
    const areaId = String(props.area_id || "");
    const area = state.datasets.areas.find((item) => String(item.area_id) === areaId);

    const popupArea = {
      ...(area || {}),
      ...props
    };

    new maplibregl.Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: "320px"
    })
      .setLngLat(event.lngLat)
      .setHTML(buildAreaPopupHtml(popupArea))
      .addTo(map);
  });

  map.__areasPopupBound = true;
}
  } catch (error) {
    console.error("renderOverlayLayers error", error);
  }
}

function fitMapToOverview() {}

function parsePoint(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const match = value.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
  if (!match) {
    return null;
  }

  const x = Number(match[1]);
  const y = Number(match[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return mercatorToLatLng(x, y);
}

function parseMultiPolygon(value) {
  if (!value || typeof value !== "string") {
    return [];
  }

  const wkt = value.replace(/^SRID=\d+;/i, "");
  if (!wkt.startsWith("MULTIPOLYGON")) {
    return [];
  }

  const body = wkt.replace(/^MULTIPOLYGON\s*/i, "").trim();
  const polygons = [];
  let depth = 0;
  let chunk = "";

  for (const char of body) {
    if (char === "(") {
      depth += 1;
    }
    if (depth > 0) {
      chunk += char;
    }
    if (char === ")") {
      depth -= 1;
      if (depth === 0 && chunk) {
        polygons.push(chunk);
        chunk = "";
      }
    }
  }

  return polygons
    .map((polygonText) => {
      const normalized = polygonText.replace(/^\(\(/, "").replace(/\)\)$/, "");
      const rings = normalized.split(/\)\s*,\s*\(/);
      return rings
        .map((ringText) =>
          ringText
            .replace(/[()]/g, "")
            .split(",")
            .map((pair) => pair.trim().split(/\s+/).map(Number))
            .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
            .map(([x, y]) => mercatorToLatLng(x, y))
        )
        .filter((ring) => ring.length);
    })
    .filter((polygon) => polygon.length);
}

function mercatorToLatLng(x, y) {
  const lon = (x / 20037508.34) * 180;
  let lat = (y / 20037508.34) * 180;
  lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
  return [lat, lon];
}

function sectorColor(index) {
  const colors = ["#0f8d61", "#cf8743", "#2b73b6", "#a45bd6", "#c04d64", "#2f8a8a", "#80993d", "#bc6431"];
  return colors[index % colors.length];
}

function areaColor(index) {
  const colors = ["#1fa177", "#e59a4e", "#4d88c8", "#b071dd", "#d26b82", "#54a8a8", "#91ab55", "#cf7846"];
  return colors[index % colors.length];
}

function mapContextDescription(record) {
  const detailMode = state.contextMode || state.mode;
  if (detailMode === "routes") {
    return `You are looking at the selected route near ${record.subarea_name || "its subarea"} in ${record.area_name || "its area"}.`;
  }
  if (detailMode === "subareas") {
    return `You are looking at the selected subarea and its route context inside ${record.area_name || "the current area"}.`;
  }
  if (detailMode === "areas") {
    return "You are looking at the selected area, while the browse panel lists routes inside it.";
  }
  return "You are looking at the selected sector and its broader climbing area context.";
}

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_API_BASE).trim().replace(/\/+$/, "") || DEFAULT_API_BASE;
}

function truncate(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1)}...`;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

init();
