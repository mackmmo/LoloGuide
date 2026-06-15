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

init();
