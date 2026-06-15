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
}

function bindEvents() {
  el.resetAll.addEventListener("click", resetAll);

  el.searchInput.addEventListener("input", async (event) => {
    state.filters.search = event.target.value;
    await loadRoutesFromBackend();
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
  });

  el.typeFilter.addEventListener("change", async (event) => {
    state.filters.type = event.target.value;
    state.selected = null;
    await loadRoutesFromBackend();
  });

  el.sortFilter.addEventListener("change", async (event) => {
    state.filters.sort = event.target.value;
    await loadRoutesFromBackend();
  });
}

function jumpTo(mode, id) {
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

  loadRoutesFromBackend();
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
