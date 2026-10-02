const DEFAULT_API_BASE = "https://lolo-app-2.onrender.com";
const API_BASE_STORAGE_KEY = "lolo-api-base";
const ACCESS_TOKEN_STORAGE_KEY = "lolo-access-token";
const REFRESH_TOKEN_STORAGE_KEY = "lolo-refresh-token";

const state = {
  apiBase: DEFAULT_API_BASE,
  isLoading: false,
  loadErrors: {},
  auth: {
    accessToken: sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) || "",
    refreshToken: sessionStorage.getItem(REFRESH_TOKEN_STORAGE_KEY) || ""
  },
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
  filtersCollapsed: false,
  profile: null,
  logbook: []
};
