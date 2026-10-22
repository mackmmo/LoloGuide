async function resetAll() {
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

  renderFilters();
  await loadRoutesFromBackend();
  trackEvent("reset_filters");
}

function bindEvents() {
  el.resetAll.addEventListener("click", resetAll);

  el.searchInput.addEventListener("input", async (event) => {
    state.filters.search = event.target.value;
    await loadRoutesFromBackend();
    trackEvent("filter_change", {
      filter_type: "search",
      value: state.filters.search || "blank"
    });
  });

  el.sectorFilter.addEventListener("change", async (event) => {
    state.filters.sectorId = event.target.value;
    state.selected = null;

    if (state.filters.sectorId && !areaMatchesSector(state.filters.areaId, state.filters.sectorId)) {
      state.filters.areaId = "";
      state.filters.subareaId = "";
    }

    renderFilters();
    await loadRoutesFromBackend();
    trackEvent("filter_change", {
      filter_type: "sector",
      value: state.filters.sectorId || "all"
    });
  });

  el.areaFilter.addEventListener("change", async (event) => {
    state.filters.areaId = event.target.value;
    state.selected = null;

    if (state.filters.areaId) {
      const area = areaById.get(state.filters.areaId);
      state.filters.sectorId = area ? String(area.sector) : state.filters.sectorId;
    }

    if (state.filters.subareaId && !subareaMatchesArea(state.filters.subareaId, state.filters.areaId)) {
      state.filters.subareaId = "";
    }

    renderFilters();
    await loadRoutesFromBackend();
    if (state.filters.areaId) updateMap(areaById.get(String(state.filters.areaId)), "areas");
    trackEvent("filter_change", {
      filter_type: "area",
      value: state.filters.areaId || "all"
    });
  });

  el.subareaFilter.addEventListener("change", async (event) => {
    state.filters.subareaId = event.target.value;
    state.selected = null;

    if (state.filters.subareaId) {
      const subarea = subareaById.get(state.filters.subareaId);
      if (subarea) {
        state.filters.areaId = String(subarea.area);
        const area = areaById.get(String(subarea.area));
        state.filters.sectorId = area ? String(area.sector) : state.filters.sectorId;
      }
    }

    renderFilters();
    await loadRoutesFromBackend();
    if (state.filters.subareaId) updateMap(subareaById.get(String(state.filters.subareaId)), "subareas");
    trackEvent("filter_change", {
      filter_type: "subarea",
      value: state.filters.subareaId || "all"
    });
  });

  el.typeFilter.addEventListener("change", async (event) => {
    state.filters.type = event.target.value;
    state.selected = null;
    await loadRoutesFromBackend();
    trackEvent("filter_change", {
      filter_type: "type",
      value: state.filters.type || "all"
    });
  });

  el.sortFilter.addEventListener("change", async (event) => {
    state.filters.sort = event.target.value;
    await loadRoutesFromBackend();
    trackEvent("sort_change", {
      sort: state.filters.sort || "default"
    });
  });
}

function jumpTo(mode, id) {
  showView("guide");
  showMobileGuidePanel("detail");
  state.filters.search = "";
  state.filters.type = "";
  state.mode = mode;
  state.contextRecord = null;
  state.contextMode = null;
  state.selected = null;

  if (mode === "areas") {
    const area = areaById.get(String(id));
    if (area) {
      state.filters.sectorId = String(area.sector || "");
      state.filters.areaId = String(area.area_id || "");
      state.filters.subareaId = "";
    }
  }

  if (mode === "subareas") {
    const subarea = subareaById.get(String(id));
    if (subarea) {
      state.filters.subareaId = String(subarea.subarea_id || "");
      state.filters.areaId = String(subarea.area || "");
      const area = areaById.get(String(subarea.area || ""));
      state.filters.sectorId = area ? String(area.sector) : state.filters.sectorId;
    }
  }

  renderFilters();
  loadRoutesFromBackend().then(() => {
    if (mode === "areas") updateMap(areaById.get(String(id)), "areas");
    if (mode === "subareas") updateMap(subareaById.get(String(id)), "subareas");
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

async function openRouteInGuide(routeId, routeName = "") {
  if (state.offlineMode && !LoloOffline.bundle?.settings.guide) {
    const hint = LoloOffline.bundle?.routeHints?.[routeId];
    if (hint) {
      state.selected = {route_id: Number(routeId), name: hint.name, grade: hint.grade};
      state.detailTab = 'details'; showView('guide'); showMobileGuidePanel('detail'); renderDetail(); return;
    }
  }
  let route = state.datasets.routes.find(item => routeId && String(item.route_id) === String(routeId));
  if (!route) {
    const result = await fetchJson(`${state.apiBase}/routes/${routeId ? "" : "?search=" + encodeURIComponent(routeName)}`);
    if (!result.ok) throw new Error(String(result.error || "Unable to load route"));
    const routes = Array.isArray(result.data) ? result.data : [];
    const matches = routes.filter(item => routeId ? String(item.route_id) === String(routeId) : item.name === routeName);
    if (matches.length !== 1) throw new Error(matches.length ? "Multiple routes share this name. Please find the route in the guide." : "This route is no longer available.");
    route = enrichRoute(matches[0]);
  }
  const subarea = subareaById.get(String(route.subarea));
  const area = areaById.get(String(route.area ?? subarea?.area));
  state.filters = { search: "", sectorId: String(area?.sector ?? ""), areaId: String(area?.area_id ?? ""), subareaId: String(subarea?.subarea_id ?? ""), type: "", sort: "default" };
  state.selected = null;
  state.contextRecord = null;
  state.contextMode = null;
  state.mode = "routes";
  state.detailTab = "details";
  await loadRoutesFromBackend();
  if (state.loadErrors.routes) throw new Error(String(state.loadErrors.routes));
  state.selected = state.datasets.routes.find(item => String(item.route_id) === String(route.route_id)) || route;
  showView("guide");
  showMobileGuidePanel("detail");
  render();
}

function detailMapArea(record, mode) {
  if (mode === "areas") return record;
  const subarea = mode === "routes" ? subareaById.get(String(record.subarea)) : null;
  return areaById.get(String(record.area ?? subarea?.area)) || null;
}

function seeDetailOnMap(record, mode) {
  const area = detailMapArea(record, mode);
  if (!area || !parsePoint(area.centroid)) return;
  showView("map");
  requestAnimationFrame(() => {
    map?.resize();
    updateMap(area, "areas", 16);
  });
}
