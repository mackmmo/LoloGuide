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

function buildRoutesQuery() {
  const params = new URLSearchParams();

  if (state.filters.search) params.set("search", state.filters.search);
  if (state.filters.sectorId) params.set("sector", state.filters.sectorId);
  if (state.filters.areaId) params.set("area", state.filters.areaId);
  if (state.filters.subareaId) params.set("subarea", state.filters.subareaId);
  if (state.filters.type) params.set("type", state.filters.type);

  const orderingMap = {
    name: "name",
    grade: "grade_index",
    stars: "star_rating",
    height: "height"
  };

  if (state.filters.sort && state.filters.sort !== "default") {
    params.set("ordering", orderingMap[state.filters.sort] || state.filters.sort);
  }

  return params.toString();
}

async function loadAllData() {
  state.isLoading = true;
  state.loadErrors = {};
  renderStatus();

  const endpoints = ["sectors", "areas", "subareas"];
  const results = await Promise.all(
    endpoints.map(async (name) => {
      const response = await fetchJson(`${state.apiBase}/${name}/`);
      return [name, response];
    })
  );

  const nextDatasets = {
    sectors: [],
    areas: [],
    subareas: []
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
  state.loadErrors = nextErrors;
  rebuildIndexes();

  state.isLoading = false;
  await loadRoutesFromBackend();
  fitMapToOverview();
}

async function loadRoutesFromBackend() {
  state.isLoading = true;
  renderStatus();

  const query = buildRoutesQuery();
  const url = `${state.apiBase}/routes/${query ? `?${query}` : ""}`;
  const result = await fetchJson(url);

  if (!result.ok) {
    state.datasets.routes = [];
    state.loadErrors.routes = result.error;
    state.isLoading = false;
    syncSelectedRecord();
    render();
    return;
  }

  state.datasets.routes = Array.isArray(result.data) ? result.data.map(enrichRoute) : [];
  delete state.loadErrors.routes;
  state.isLoading = false;
  syncSelectedRecord();
  render();
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

