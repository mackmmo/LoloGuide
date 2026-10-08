// Community Feed — latest sends first, date-range filtering.
let communityAscents = [];

function parseAscentDate(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1]) &&
    date.getMonth() === Number(match[2]) - 1 &&
    date.getDate() === Number(match[3]) ? date : null;
}

function getCommunityStartDate(range, today = new Date()) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  switch (range) {
    case "mtd": return new Date(today.getFullYear(), today.getMonth(), 1);
    case "7d": start.setDate(start.getDate() - 6); return start;
    case "30d": start.setDate(start.getDate() - 29); return start;
    case "ytd": return new Date(today.getFullYear(), 0, 1);
    default: return null;
  }
}

function renderCommunityFeed() {
  const container = document.querySelector("#community-feed");
  if (!container) return;
  const range = document.querySelector("#community-date-filter")?.value || "mtd";
  const today = new Date();
  const start = getCommunityStartDate(range, today);
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const visible = communityAscents.filter(ascent => {
    if (range === "all") return true;
    const date = parseAscentDate(ascent.date_sent);
    return date !== null && date >= start && date < tomorrow;
  }).sort((a, b) => {
    const aTime = parseAscentDate(a.date_sent)?.getTime() || 0;
    const bTime = parseAscentDate(b.date_sent)?.getTime() || 0;
    return bTime - aTime;
  });

  if (!visible.length) {
    container.innerHTML = '<p class="muted">No sends found for this date range.</p>';
    return;
  }
  container.innerHTML = visible.map(ascent => `
    <div class="community-ascent-row">
      <span class="ascent-name">${escapeHtml(ascent.username || "")}</span>
      <span class="ascent-route">${escapeHtml(ascent.route_name || "")}</span>
      <span class="ascent-grade">${escapeHtml(ascent.grade || "")}</span>
      <span class="ascent-style">${escapeHtml(ascent.send_style || "")}</span>
      <span class="ascent-date">${escapeHtml(ascent.date_sent || "")}</span>
    </div>`).join("");
}

// Delegation works even if the filter is inserted after this script runs.
document.addEventListener("change", event => {
  if (event.target?.id === "community-date-filter") renderCommunityFeed();
});

el.communityFeedButton.addEventListener("click", async () => {
  showView("community");
  el.communityFeed.innerHTML = '<p class="muted">Loading sends…</p>';
  const result = await getCommunityFeed();
  if (!result.ok) {
    el.communityFeed.textContent = `Unable to load community sends: ${result.error || "Unknown error"}`;
    return;
  }
  const data = result.data;
  communityAscents = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
  renderCommunityFeed();
});
