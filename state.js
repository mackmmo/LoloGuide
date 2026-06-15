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
