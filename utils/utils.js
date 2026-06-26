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

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_API_BASE).trim().replace(/\/+$/, "") || DEFAULT_API_BASE;
}

function trackEvent(eventName, params = {}) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }

  window.gtag("event", eventName, params);
}

function aspectSunLabel(aspect) {
  const value = String(aspect || "").trim().toLowerCase();

  const labels = {
    north: "Shade most of the day",
    northeast: "Morning sun, afternoon shade",
    east: "Morning sun",
    southeast: "Morning sun into early afternoon sun",
    south: "All day sun",
    southwest: "Afternoon sun into evening sun",
    west: "Afternoon and evening sun",
    northwest: "Late afternoon and evening sun"
  };

  return labels[value] || (aspect ? capitalize(String(aspect)) : "-");
}
