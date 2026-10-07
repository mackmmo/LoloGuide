el.communityFeedButton.addEventListener("click", async () => {
    showView("community");

    const result = await getCommunityFeed();

    const communityUpdates = result.data.map(ascent => {
        return  `<div class="community-ascent-row">
                    <span class="ascent-name"> ${ ascent.username }</span>
                    <span class="ascent-route"> ${ ascent.route_name }</span>
                    <span class="ascent-grade">${ ascent.grade }</span> 
                    <span class="ascent-style">${ ascent.send_style }</span>
                    <span class="ascent-date">${ ascent.date_sent }</span>
                </div>`;
});
    el.communityFeed.innerHTML = communityUpdates.join("");
});
