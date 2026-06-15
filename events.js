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

  renderModeTabs();
  renderFilters();
  await loadRoutesFromBackend();
}

function bindEvents() {
  el.resetAll.addEventListener("click", resetAll);

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

  el.searchInput.addEventListener("input", async (event) => {
    state.filters.search = event.target.value;
    await loadRoutesFromBackend();
  });

  el.sectorFilter.addEventListener("change", async (event) => {
    state.filters.sectorId = event.target.value;

    if (state.filters.sectorId && !areaMatchesSector(state.filters.areaId, state.filters.sectorId)) {
      state.filters.areaId = "";
      state.filters.subareaId = "";
    }

    renderFilters();
    await loadRoutesFromBackend();
  });

  el.areaFilter.addEventListener("change", async (event) => {
    state.filters.areaId = event.target.value;

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