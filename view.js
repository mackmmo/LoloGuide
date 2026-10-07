function showView(view) {

    el.appShell.classList.remove(
    "app-shell--guide",
    "app-shell--map",
    "app-shell--community"
    );

    if (view === "community") {

        el.appShell.classList.add("app-shell--community");

        el.communityFeedPage.hidden = false;
        //leaderBoard.hidden = true;
        el.appHeader.hidden = false;
        el.mapColumn.hidden = true;
        el.detailPanel.hidden = true;
        el.filtersPanel.hidden = true;
    }

    if (view === "map") {

        el.appShell.classList.add("app-shell--map");

        el.communityFeedPage.hidden = true;
        // leaderBoard.hidden = true;
        el.appHeader.hidden = false;
        el.mapColumn.hidden = false;
        el.detailPanel.hidden = true;
        el.filtersPanel.hidden = true;
    }

    if (view === "guide") {

        el.appShell.classList.add("app-shell--guide");

        el.communityFeedPage.hidden = true;
        // leaderBoard.hidden = true;
        el.appHeader.hidden = false;
        el.mapColumn.hidden = true;
        el.detailPanel.hidden = false;
        el.filtersPanel.hidden = false;
    }

}

el.guideViewButton.addEventListener("click", () => {
    showView("guide");
});

el.mapViewButton.addEventListener("click", () => {
    showView("map");
});

