const MAPTILER_KEY = "izwnMfYAP1x5LDeYc4zb";
const MAP_STYLES = { custom: "https://api.maptiler.com/maps/019eb30f-c1f6-7d3b-b3b9-d2c198fb5d44/style.json?key=izwnMfYAP1x5LDeYc4zb", topo: "https://api.maptiler.com/maps/topo-v2/style.json?key=" + MAPTILER_KEY, satellite: "https://api.maptiler.com/maps/hybrid/style.json?key=" + MAPTILER_KEY };
let mapBasemap = "custom";
let mapDimension = "2d";
let mapStyleReady = false;
let mapOpenWidget = "";
let mapSearchVersion = 0;
let mapSearchMatches = [];
let mapSearchTimer = null;

let highlightedAreaId = "";
const floatingAreaPins = new Map();
let floatingAreaPopup = null;

function initMap() {
  map = new maplibregl.Map({
    container: "map",
    style: MAP_STYLES[mapBasemap],
    maxPitch: 75,
    center: [-114.56835793693313, 46.69852662439601],
    zoom: 11
  });

  map.addControl(new maplibregl.NavigationControl(), "top-left");

  map.on("style.load", () => {
    mapStyleReady = true;
    // Enable terrain before adding the layers that must be draped over it.
    applyMapDimension();
    renderOverlayLayers(true);
    bringGuideLayersToFront();
    renderFloatingAreaPins();
    setMapControlStatus("");
  });
  bindMapDisplayControls();
  bindMapCameraControls();
  bindMapTools();
  map.on("move", syncMapCameraControls);

  map.on("error", (event) => {
    console.error("MapLibre error", event);
    setMapControlStatus("Map imagery or terrain could not load. Try another view.");
  });
}

function renderOverlayLayers(styleReady = false) {
  if (!map) {
    console.log("No map yet");
    return;
  }

  if (!styleReady && !mapStyleReady) {
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

    if (!map.getLayer("areas-hit")) {
      map.addLayer({
        id: "areas-hit",
        type: "line",
        source: "areas",
        "source-layer": "areas",
        paint: {
          "line-color": "#000000",
          "line-width": 18,
          "line-opacity": 0
        }
      });
      console.log("Areas hit layer added");
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

renderSelectedAreaHighlight(styleReady);

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
      "line-width": 2,
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

if (!map.__areasPopupBound && map.getLayer("areas-hit")) {
  map.on("click", "areas-hit", (event) => {
    const feature = event.features && event.features[0];
    if (!feature) {
      return;
    }

    const props = feature.properties || {};
    const areaId = String(props.area_id || "");
    highlightArea(areaId);
    const area = state.datasets.areas.find((item) => String(item.area_id) === areaId);

    const popupArea = {
      ...(area || {}),
      ...props
    };

    trackEvent("popup_open", {
      popup_type: "area",
      area_id: areaId,
      area_name: popupArea.name || ""
    });

    floatingAreaPopup?.remove();
    const popup = floatingAreaPopup = new maplibregl.Popup({ anchor: "bottom", className: "area-map-popup",
      closeButton: true,
      closeOnClick: true,
      maxWidth: "320px"
    })
      .setLngLat(event.lngLat)
      .setHTML(buildAreaPopupHtml(popupArea))
      .addTo(map);

    bindAreaPopupActions(popup, areaId);
  });

  map.__areasPopupBound = true;
}

if (!map.__areaLabelsClickBound && map.getLayer("area-labels")) {
  map.on("click", "area-labels", async (event) => {
    const feature = event.features && event.features[0];
    if (!feature) {
      return;
    }

    const areaId = String((feature.properties || {}).area_id || "");
    if (!areaId) {
      return;
    }

    const area = state.datasets.areas.find((item) => String(item.area_id) === areaId);
    if (!area) {
      return;
    }

    trackEvent("view_area_from_label", {
      area_id: areaId,
      area_name: area.name || ""
    });

    floatingAreaPopup?.remove();
    const popup = floatingAreaPopup = new maplibregl.Popup({ anchor: "bottom", className: "area-map-popup", closeButton: true, closeOnClick: true, maxWidth: "320px" })
      .setLngLat(event.lngLat)
      .setHTML(buildAreaPopupHtml(area))
      .addTo(map);
    highlightArea(areaId);
    bindAreaPopupActions(popup, areaId);
  });

  map.__areaLabelsClickBound = true;
}
  } catch (error) {
    console.error("renderOverlayLayers error", error);
  }
  renderFloatingAreaPins();
  syncMapTools();
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
      <h3>${escapeHtml(area.name || "Area")}</h3>
      <p class="map-popup-description">
        ${escapeHtml(area.description || "No description available.")}
      </p>
      <div class="map-popup-facts">
        <span><strong>Drive</strong> ${escapeHtml(area.drive_time ? `${area.drive_time} min` : "-")}</span>
        <span><strong>Approach</strong> ${escapeHtml(area.approach_time ? `${area.approach_time} min` : "-")}</span>
        <span><strong>Aspect</strong> ${escapeHtml(area.aspect || "-")}</span>
      </div>
      ${typeSummary ? `<p class="map-popup-summary">${escapeHtml(typeSummary)}</p>` : ""}
      ${buildCoordinateSection(area)}
      <button class="map-popup-action" type="button" data-area-id="${escapeHtml(String(area.area_id || ""))}">
        See Area
      </button>
    </div>
  `;
}

function bindAreaPopupActions(popup, areaId) {
  if (!popup?.getElement) return;
  keepAreaPopupVisible(popup);
  const popupElement = popup.getElement();
  if (!popupElement) {
    return;
  }

  bindCoordinateCopy(popupElement);
  const button = popupElement.querySelector("[data-area-id]");
  if (!button) {
    return;
  }

  button.addEventListener("click", async () => {
    trackEvent("view_area_from_map", {
      area_id: areaId
    });
    popup.remove();
    await focusAreaFromMap(areaId);
  });
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

async function focusAreaFromMap(areaOrId) {
  const area =
    typeof areaOrId === "object" && areaOrId
      ? areaOrId
      : areaById.get(String(areaOrId));

  if (!area) {
    return;
  }

  state.filters.sectorId = String(area.sector);
  state.filters.areaId = String(area.area_id);
  state.filters.subareaId = "";
  state.filters.search = "";
  state.filters.type = "";
  state.mode = "routes";
  state.contextRecord = state.datasets.areas.find((item) => String(item.area_id) === String(area.area_id)) || null;
  state.contextMode = "areas";
  state.selected = null;

  showView("guide");
  showMobileGuidePanel("detail");
  renderFilters();
  await loadRoutesFromBackend();
}

function fitMapToOverview() {
  if (!map) return;
  const points = state.datasets.areas.map((area) => parsePoint(area.centroid)).filter(Boolean);
  if (!points.length) return;
  const bounds = new maplibregl.LngLatBounds();
  points.forEach(([lat, lon]) => bounds.extend([lon, lat]));
  map.fitBounds(bounds, { padding: 70, maxZoom: 11.5, duration: 700 });
}

function updateMap(record, mode = "routes", zoom = null) {
  if (!map) return;
  const area = record ? detailMapArea(record, mode) : null;
  highlightArea(area?.area_id ?? "");
  if (!record) return;
  const point = parsePoint(record.centroid);
  if (!point) return;
  const [lat, lon] = point;
  const zoomByMode = { routes: 16, subareas: 14.5, areas: 13, sectors: 11.5 };
  map.easeTo({ center: [lon, lat], zoom: zoom ?? (zoomByMode[mode] || 13), duration: 750, essential: true });
}

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

function areaColor(index) {
  const colors = ["#1fa177", "#e59a4e", "#4d88c8", "#b071dd", "#d26b82", "#54a8a8", "#91ab55", "#cf7846"];
  return colors[index % colors.length];
}


function highlightArea(areaId) {
  highlightedAreaId = String(areaId ?? "");
  renderSelectedAreaHighlight();
  renderFloatingAreaPins();
  syncMapTools();
}

function renderSelectedAreaHighlight(styleReady = false) {
  if (!map || (!styleReady && !mapStyleReady) || !map.getSource("areas")) return;
  const filter = ["==", ["to-string", ["get", "area_id"]], highlightedAreaId];
  const layers = [
    { id: "selected-area-outline", type: "line", paint: { "line-color": "#ffca28", "line-width": 3, "line-opacity": 1 } }
  ];
  layers.forEach(layer => {
    if (!map.getLayer(layer.id)) {
      map.addLayer({ ...layer, source: "areas", "source-layer": "areas", filter }, map.getLayer("area-labels") ? "area-labels" : undefined);
    } else {
      map.setFilter(layer.id, filter);
    }
  });
}

function setMapControlStatus(message) {
  const status = document.querySelector("#map-display-status");
  if (status) { status.textContent = message; status.hidden = !message; }
}

function applyMapDimension(styleReady = false) {
  syncMapCameraControls();
  if (!map || (!styleReady && !mapStyleReady)) return;
  if (mapDimension === "3d") {
    if (!map.getSource("guide-terrain")) {
      map.addSource("guide-terrain", {
        type: "raster-dem",
        url: "https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=" + MAPTILER_KEY,
        tileSize: 256,
        encoding: "mapbox"
      });
    }
    // Elevation may not have loaded yet. Pull back while flat before enabling terrain.
    const zoom = terrainOverviewZoom();
    map.stop();
    map.jumpTo({ zoom, pitch: 0 });
    map.setTerrain({ source: "guide-terrain", exaggeration: 1.3 });
    map.easeTo({ zoom, pitch: 60, duration: 900 });
  } else {
    map.setTerrain(null);
    map.easeTo({ pitch: 0, bearing: 0, duration: 650 });
  }
  bringGuideLayersToFront();
  renderFloatingAreaPins();
  syncMapTools();
}

function bindMapDisplayControls() {
  document.querySelector("#map-basemap").addEventListener("change", event => {
    const choice = event.target.value;
    if (!MAP_STYLES[choice] || choice === mapBasemap) return;
    mapBasemap = choice;
    setMapControlStatus("Loading map…");
    // Reload overlays after the new style loads; camera and selection are preserved.
    // Stop the previous camera animation and release terrain before its DEM source.
    map.stop();
    if (mapStyleReady) map.setTerrain(null);
    mapStyleReady = false;
    syncMapCameraControls();
    map.setStyle(MAP_STYLES[choice], { diff: false });
  });
  document.querySelectorAll("[data-map-dimension]").forEach(button => {
    button.addEventListener("click", () => {
      mapDimension = button.dataset.mapDimension;
      document.querySelectorAll("[data-map-dimension]").forEach(item => {
        item.setAttribute("aria-pressed", String(item.dataset.mapDimension === mapDimension));
      });
      setMapControlStatus(mapStyleReady ? "" : "Loading map…");
      applyMapDimension();
    });
  });
}

function bringGuideLayersToFront() {
  if (!map || !mapStyleReady) return;
  // Keep our draped geometry above basemap raster/fill layers, then draw labels last.
  const ids = ["areas-fill", "areas-hit", "areas-outline", "roads-line", "trails-line", "selected-area-outline", "area-labels", "roads-labels", "trails-labels", "pois-points", "pois-labels", "trailheads-symbols", "trailheads-labels"];
  ids.forEach(id => { if (map.getLayer(id)) map.moveLayer(id); });
}

function terrainOverviewZoom(desiredZoom = map.getZoom()) {
  const currentZoom = desiredZoom;
  const center = map.getCenter();
  const height = Math.max(1, map.getCanvas().clientHeight);
  // Allow 5.5 km of camera height above sea level while DEM tiles are still loading.
  // At 60 degrees pitch and MapLibre's default FOV, vertical clearance is
  // approximately 0.75 * viewport height * ground meters per pixel.
  const metersPerWorld = 40075016.686 * Math.cos(center.lat * Math.PI / 180);
  const clearanceZoom = Math.log2(0.75 * height * metersPerWorld / (512 * 5500));
  return Math.min(currentZoom, Math.max(map.getMinZoom(), Math.min(12, clearanceZoom)));
}

function renderFloatingAreaPins() {
  if (!map || !mapStyleReady) return;
  const visibleAreas = mapDimension === "3d" ? state.datasets.areas : [];
  const activeIds = new Set();
  visibleAreas.forEach(area => {
    const point = parsePoint(area.centroid);
    if (!point) return;
    const id = String(area.area_id);
    activeIds.add(id);
    let pin = floatingAreaPins.get(id);
    if (!pin) {
      const element = document.createElement("div");
      element.className = "floating-area-pin";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "floating-area-pin-label";
      const stem = document.createElement("span");
      stem.className = "floating-area-pin-stem";
      stem.setAttribute("aria-hidden", "true");
      const dot = document.createElement("span");
      dot.className = "floating-area-pin-dot";
      dot.setAttribute("aria-hidden", "true");
      element.append(button, stem, dot);
      button.addEventListener("click", event => {
        event.stopPropagation();
        const currentArea = state.datasets.areas.find(item => String(item.area_id) === id);
        const currentPoint = currentArea && parsePoint(currentArea.centroid);
        if (!currentPoint) return;
        floatingAreaPopup?.remove();
        const popup = floatingAreaPopup = new maplibregl.Popup({ anchor: "bottom", className: "area-map-popup", closeButton: true, closeOnClick: true, maxWidth: "320px", offset: [0, -66] })
          .setLngLat([currentPoint[1], currentPoint[0]])
          .setHTML(buildAreaPopupHtml(currentArea))
          .addTo(map);
        highlightArea(id);
        bindAreaPopupActions(popup, id);
      });
      const marker = new maplibregl.Marker({ element, anchor: "bottom", offset: [0, 4], pitchAlignment: "viewport", rotationAlignment: "viewport" });
      pin = { marker, element, button };
      floatingAreaPins.set(id, pin);
      marker.setLngLat([point[1], point[0]]).addTo(map);
    } else {
      pin.marker.setLngLat([point[1], point[0]]);
    }
    pin.button.textContent = area.name || "Unnamed area";
    pin.button.setAttribute("aria-label", "Show details for " + (area.name || "area"));
    pin.element.classList.toggle("is-selected", id === highlightedAreaId);
  });
  floatingAreaPins.forEach((pin, id) => {
    if (!activeIds.has(id)) {
      pin.marker.remove();
      floatingAreaPins.delete(id);
    }
  });
  if (map.getLayer("area-labels")) {
    map.setLayoutProperty("area-labels", "visibility", mapDimension === "3d" ? "none" : "visible");
  }
}

function syncMapCameraControls() {
  const controls = document.querySelector("#map-3d-controls");
  if (!controls || !map) return;
  controls.hidden = mapDimension !== "3d" || mapOpenWidget !== "camera";
  syncMapTools();
  const pitch = map.getPitch();
  const value = document.querySelector("#map-pitch-value");
  if (value) value.textContent = Math.round(pitch) + "° tilt";
  document.querySelectorAll("[data-map-camera]").forEach(button => {
    button.disabled = !mapStyleReady ||
      (button.dataset.mapCamera === "tilt-down" && pitch <= 0) ||
      (button.dataset.mapCamera === "tilt-up" && pitch >= 60);
  });
}

function bindMapCameraControls() {
  document.querySelectorAll("[data-map-camera]").forEach(button => {
    button.addEventListener("click", () => moveMapCamera(button.dataset.mapCamera));
  });
  syncMapCameraControls();
}

function moveMapCamera(action) {
  if (!map || !mapStyleReady || mapDimension !== "3d") return;
  const options = { duration: 350 };
  switch (action) {
    case "tilt-down": options.pitch = Math.max(0, map.getPitch() - 10); break;
    case "tilt-up": options.pitch = Math.min(60, map.getPitch() + 10); break;
    case "rotate-left": options.bearing = map.getBearing() - 30; break;
    case "rotate-right": options.bearing = map.getBearing() + 30; break;
    case "north": options.bearing = 0; break;
    case "reset": Object.assign(options, { zoom: terrainOverviewZoom(), pitch: 60, bearing: 0, duration: 650 }); break;
    default: return;
  }
  map.stop();
  map.easeTo(options);
}

function syncMapTools() {
  const cameraButton = document.querySelector("#map-camera-widget");
  if (cameraButton) cameraButton.hidden = mapDimension !== "3d";
  if (mapDimension !== "3d" && mapOpenWidget === "camera") mapOpenWidget = "";
  const panels = { search: "map-search-panel", layers: "map-display-controls", camera: "map-3d-controls" };
  Object.entries(panels).forEach(([name, id]) => {
    const panel = document.getElementById(id);
    if (panel) panel.hidden = mapOpenWidget !== name;
  });
  document.querySelectorAll("[data-map-widget]").forEach(button => button.setAttribute("aria-expanded", String(mapOpenWidget === button.dataset.mapWidget)));
  ["map-zoom-selection", "map-clear-selection"].forEach(id => {
    const button = document.getElementById(id);
    if (button) button.disabled = !highlightedAreaId;
  });
}

function zoomToMapSelection() {
  const area = areaById.get(highlightedAreaId);
  if (!area || !mapStyleReady) return;
  updateMap(area, "areas", mapDimension === "3d" ? terrainOverviewZoom(14) : 16);
}

function bindMapTools() {
  document.querySelectorAll("[data-map-widget]").forEach(button => {
    button.addEventListener("click", () => {
      mapOpenWidget = mapOpenWidget === button.dataset.mapWidget ? "" : button.dataset.mapWidget;
      syncMapTools();
      if (mapOpenWidget === "search") document.getElementById("map-search-input").focus();
    });
  });
  document.getElementById("map-home").addEventListener("click", () => { if (mapStyleReady) fitMapToOverview(); });
  document.getElementById("map-zoom-selection").addEventListener("click", zoomToMapSelection);
  document.getElementById("map-clear-selection").addEventListener("click", () => {
    floatingAreaPopup?.remove();
    floatingAreaPopup = null;
    highlightArea("");
  });
  document.getElementById("map-search-input").addEventListener("input", () => {
    const version = ++mapSearchVersion;
    clearTimeout(mapSearchTimer);
    mapSearchTimer = setTimeout(() => searchMapRecords(version), 250);
  });
  document.getElementById("map-search-results").addEventListener("click", event => {
    const button = event.target.closest("[data-map-search-index]");
    if (!button) return;
    const match = mapSearchMatches[Number(button.dataset.mapSearchIndex)];
    if (!match) return;
    const area = detailMapArea(match.record, match.mode);
    const target = parsePoint(match.record.centroid) ? match.record : area;
    if (!target) return;
    const mode = target === match.record ? match.mode : "areas";
    updateMap(target, mode, mapDimension === "3d" ? terrainOverviewZoom(14) : mode === "areas" ? 16 : undefined);
    highlightArea(area?.area_id ?? "");
    mapOpenWidget = "";
    syncMapTools();
  });
  syncMapTools();
}

async function searchMapRecords(version) {
  const query = document.getElementById("map-search-input").value.trim();
  const results = document.getElementById("map-search-results");
  mapSearchMatches = [];
  if (query.length < 2) { results.textContent = "Type at least two characters."; return; }
  const term = query.toLowerCase();
  const local = [
    ...state.datasets.areas.filter(item => String(item.name || "").toLowerCase().includes(term)).map(record => ({ record, mode: "areas", label: "Area" })),
    ...state.datasets.subareas.filter(item => String(item.name || "").toLowerCase().includes(term)).map(record => ({ record, mode: "subareas", label: "Subarea" }))
  ];
  results.textContent = "Searching…";
  const response = await fetchJson(state.apiBase + "/routes/?search=" + encodeURIComponent(query));
  if (version !== mapSearchVersion) return;
  const routes = response.ok && Array.isArray(response.data) ? response.data.map(enrichRoute).map(record => ({ record, mode: "routes", label: "Route" })) : [];
  mapSearchMatches = [...local, ...routes].filter(match => {
    const area = detailMapArea(match.record, match.mode);
    return parsePoint(match.record.centroid) || (area && parsePoint(area.centroid));
  }).slice(0, 12);
  results.innerHTML = mapSearchMatches.length ? mapSearchMatches.map((match, index) => '<button type="button" class="map-search-result" data-map-search-index="' + index + '"><strong>' + escapeHtml(match.record.name || "Unnamed") + '</strong><span>' + match.label + (match.record.grade ? " · " + escapeHtml(match.record.grade) : "") + '</span></button>').join("") : response.ok ? '<p class="muted">No mapped areas or routes found.</p>' : '<p class="muted">Unable to search routes. Try again.</p>';
  if (!response.ok && mapSearchMatches.length) results.innerHTML += '<p class="muted">Route search unavailable. Showing areas and subareas.</p>';
}

function keepAreaPopupVisible(popup, remainingPans = 2) {
  if (!popup?.getElement || !map?.getContainer || !map.panBy) return;
  requestAnimationFrame(() => {
    const element = popup.getElement();
    if (!element || element.isConnected === false) return;
    const container = map.getContainer();
    const bounds = container.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const toolbar = container.querySelector(".map-tools") || container.parentElement?.querySelector(".map-tools");
    const toolbarWidth = toolbar && toolbar.getBoundingClientRect().width;
    const rightInset = toolbarWidth ? toolbarWidth + 24 : 16;
    const width = Math.min(280, Math.max(160, bounds.width - rightInset - 16));
    const content = element.querySelector(".maplibregl-popup-content");
    element.style.maxWidth = `${width}px`;
    if (content) content.style.maxHeight = "none";
    element.classList.toggle("area-map-popup--short", bounds.height < 450);
    element.classList.toggle("area-map-popup--tiny", bounds.height < 300);
    const box = element.getBoundingClientRect();
    const left = bounds.left + 16;
    const right = bounds.right - rightInset;
    const top = bounds.top + 16;
    const bottom = bounds.bottom - 28;
    const dx = box.left < left ? box.left - left : box.right > right ? box.right - right : 0;
    const dy = box.top < top ? box.top - top : box.bottom > bottom ? box.bottom - bottom : 0;
    if (remainingPans > 0 && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
      map.once?.("moveend", () => keepAreaPopupVisible(popup, remainingPans - 1));
      map.panBy([dx, dy], { duration: 350 });
    }
  });
}
