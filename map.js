function initMap() {
  map = new maplibregl.Map({
    container: "map",
    style: "https://api.maptiler.com/maps/019eb30f-c1f6-7d3b-b3b9-d2c198fb5d44/style.json?key=izwnMfYAP1x5LDeYc4zb",
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

    const popup = new maplibregl.Popup({
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
  } catch (error) {
    console.error("renderOverlayLayers error", error);
  }
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
      <button class="map-popup-action" type="button" data-area-id="${escapeHtml(String(area.area_id || ""))}">
        View Area
      </button>
    </div>
  `;
}

function bindAreaPopupActions(popup, areaId) {
  const popupElement = popup.getElement();
  if (!popupElement) {
    return;
  }

  const button = popupElement.querySelector("[data-area-id]");
  if (!button) {
    return;
  }

  button.addEventListener("click", async () => {
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

  renderFilters();
  await loadRoutesFromBackend();
}

function fitMapToOverview() {}

function updateMap(record) {}

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

