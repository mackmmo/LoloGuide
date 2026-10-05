const communityFeed = document.querySelector("#community-feed-page");
const appShell = document.querySelector("#app-shell");
const communityFeedButton = document.querySelector("#community-feed-button");
const mapColumn = document.querySelector(".map-column");
const detailPanel = document.querySelector(".detail-panel");
const filtersPanel = document.querySelector(".filters-panel");
const appHeader = document.querySelector("#app-header");
const communityFeedElement = document.querySelector("#community-feed");

communityFeedButton.addEventListener("click", async () => {
    communityFeed.hidden = false;
    appHeader.hidden = false;
    mapColumn.hidden = true;
    detailPanel.hidden = true;
    filtersPanel.hidden = true; 

    const result = await getCommunityFeed();

    const communityUpdates = result.data.map(ascent => {
        return  `<div class="community-ascent-row">
                    <span class="ascent-name"> ${ ascent.username }</span>
                    <span class="ascent-route"> ${ ascent.route_name }</span>
                    <span class="ascent-grade">${ ascent.grade }</span> 
                    <span class="ascent-style">${ ascent.style }</span>
                    <span class="ascent-date">${ ascent.sent_date }</span>
                </div>`;
});
communityFeedElement.innerHTML = communityUpdates.join("");
});
