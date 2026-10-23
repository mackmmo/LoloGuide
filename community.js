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
  if (state.offlineMode && !globalThis.LoloOffline?.bundle?.settings.community) {
    communityAscents = [];
    container.textContent = 'Community is not saved for offline use. Enable Community in Profile while connected.';
    return;
  }
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
      <button type="button" class="ascent-route feed-route-link" data-feed-route-id="${escapeHtml(String(ascent.route_id ?? ascent.route ?? ""))}" data-feed-route-name="${escapeHtml(ascent.route_name || "")}">${escapeHtml(ascent.route_name || "")}</button>
      <span class="ascent-grade">${escapeHtml(ascent.grade || "")}</span>
      <span class="ascent-style">${escapeHtml(ascent.send_style || "")}</span>
      <span class="ascent-date">${escapeHtml(ascent.date_sent || "")}</span>
    </div>`).join("");
}

// Delegation works even if the filter is inserted after this script runs.
document.addEventListener("change", event => {
  if (event.target?.id === "community-date-filter") renderCommunityFeed();
});

let communityTab = "feed";
let communityRequest = 0;
const competitionYear = () => Number(new Intl.DateTimeFormat("en-US", {timeZone: "America/Denver", year: "numeric"}).format(new Date()));
document.querySelector("#leaderboard-year").value = competitionYear();
document.querySelector("#leaderboard-year").max = competitionYear();

function renderStandings(entries, board = null, year = null) {
  if (!entries.length) return '<p class="muted">No eligible published sends yet. Enable leaderboard sharing in Profile to include your dated sends.</p>';
  return `<table class="leaderboard-table"><thead><tr><th>Rank</th><th>Climber</th><th>Points</th><th>Routes</th></tr></thead><tbody>${entries.map(x => `<tr><td>${Number(x.rank)}</td><td>${board && x.user_id ? `<button type="button" class="leaderboard-climber-link" data-leaderboard-user="${Number(x.user_id)}" data-leaderboard-board="${escapeHtml(board)}" data-leaderboard-year="${Number(year)}">${escapeHtml(x.username)}</button>` : escapeHtml(x.username)}</td><td>${Number(x.points)}</td><td>${Number(x.route_count)}</td></tr>`).join("")}</tbody></table>`;
}

async function refreshCommunityView() {
  const request = ++communityRequest;
  communityAscents = [];
  document.querySelectorAll("[data-community-tab]").forEach(button => {
    const active = button.dataset.communityTab === communityTab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.querySelector("#community-sends-panel").hidden = communityTab !== "feed";
  document.querySelector("#community-leaderboard-panel").hidden = communityTab !== "leaderboard";
  document.querySelector("#community-hall-panel").hidden = communityTab !== "hall";
  // Clear every cached public view when publication settings change.
  ["community-feed", "leaderboard-results", "hall-results"].forEach(id => document.getElementById(id).replaceChildren());
  const target = document.getElementById(communityTab === "feed" ? "community-feed" : communityTab === "hall" ? "hall-results" : "leaderboard-results");
  if (state.offlineMode && !globalThis.LoloOffline?.bundle?.settings.community) {
    target.textContent = 'Community is not saved for offline use. Enable Community in Profile while connected.';
    return;
  }
  target.innerHTML = '<p class="muted">Loading…</p>';
  let result;
  if (communityTab === "feed") result = await getCommunityFeed();
  else if (communityTab === "hall") result = await getHallOfFame();
  else {
    const board = document.querySelector("#leaderboard-board").value;
    const year = document.querySelector("#leaderboard-year").value;
    document.querySelector("#leaderboard-year-label").hidden = board === "alltime";
    document.querySelector("#leaderboard-rules").textContent = board === "juntmasters"
      ? "Grade index points. Each route counts once per climber per year. Date sent determines the year; backlogged sends count too. Enable leaderboard sharing in Profile to participate. Past-year routes can count again this year."
      : "Grade index points. Each dated route counts once per climber across all years.";
    result = await getLeaderboard(board, year);
  }
  if (request !== communityRequest) return;
  if (!result.ok) { target.textContent = String(result.error); return; }
  if (communityTab === "feed") {
    communityAscents = Array.isArray(result.data) ? result.data : (result.data?.results || []);
    renderCommunityFeed();
  } else if (communityTab === "leaderboard") target.innerHTML = renderStandings(result.data.entries || [], result.data.board || document.querySelector("#leaderboard-board").value, result.data.year || document.querySelector("#leaderboard-year").value);
  else {
    const seasons = (result.data.seasons || []).filter(season => season.year >= 2026 && season.year < competitionYear());
    target.innerHTML = seasons.length ? seasons.map(season => `<article class="hall-season"><h2>${Number(season.year)} JuntMasters</h2>${season.winners.length ? renderStandings(season.winners) : '<p class="muted">No published winner.</p>'}</article>`).join("") : '<p class="muted">The first JuntMasters season is 2026. Winners will appear after the season ends.</p>';
  }
}

el.communityFeedButton.addEventListener("click", () => { showView("community"); refreshCommunityView(); });
document.querySelectorAll("[data-community-tab]").forEach(button => button.addEventListener("click", () => { communityTab = button.dataset.communityTab; refreshCommunityView(); }));
["leaderboard-board", "leaderboard-year"].forEach(id => document.getElementById(id).addEventListener("change", refreshCommunityView));

document.querySelector("#community-feed-page")?.addEventListener("click", async event => {
  const button = event.target.closest("[data-feed-route-id]");
  if (!button || button.disabled) return;
  button.disabled = true;
  try {
    await openRouteInGuide(button.dataset.feedRouteId, button.dataset.feedRouteName);
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
  }
});

const communityRefreshButton = document.querySelector("#community-refresh");
communityRefreshButton.addEventListener("click", async () => {
  communityRefreshButton.disabled = true;
  communityRefreshButton.textContent = "Refreshing…";
  try { await refreshCommunityView(); }
  finally {
    communityRefreshButton.disabled = false;
    communityRefreshButton.textContent = "↻ Refresh";
  }
});

document.querySelector("#leaderboard-results").addEventListener("click", async event => {
  if (event.target.closest("[data-back-leaderboard]")) { refreshCommunityView(); return; }
  const button = event.target.closest("[data-leaderboard-user]");
  if (!button || button.disabled) return;
  const request = ++communityRequest;
  const board = button.dataset.leaderboardBoard;
  const year = button.dataset.leaderboardYear;
  const target = document.querySelector("#leaderboard-results");
  target.innerHTML = '<p class="muted">Loading scored routes…</p>';
  const result = await getLeaderboardRoutes(button.dataset.leaderboardUser, board, year);
  if (request !== communityRequest) return;
  const back = '<button type="button" class="ghost" data-back-leaderboard>← Leaderboard</button>';
  if (!result.ok) { target.innerHTML = back + `<p role="status">${escapeHtml(String(result.error))}</p>`; return; }
  const data = result.data;
  const routes = data.routes || [];
  target.innerHTML = `${back}<h2>${escapeHtml(data.username)}’s routes</h2>
    <p class="muted">${board === "juntmasters" ? `JuntMasters ${Number(year)}` : "All-Time"} · ${Number(data.points)} points · ${Number(data.route_count)} routes</p>
    <div class="leaderboard-route-list">${routes.length ? routes.map(route => `<article class="leaderboard-route-card">
      <button type="button" class="feed-route-link" data-feed-route-id="${Number(route.route_id)}" data-feed-route-name="${escapeHtml(route.route_name)}">${escapeHtml(route.route_name)}</button>
      <span>${escapeHtml(route.grade || "")} · ${Number(route.points)} points</span>
      <small>${escapeHtml(route.date_sent || "")} · ${escapeHtml(route.send_style || "sent")}</small>
    </article>`).join("") : '<p class="muted">No scored route details available.</p>'}</div>`;
});
