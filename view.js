function syncBottomNavigation() {
    let active = el.appShell.classList.contains("app-shell--map") ? "map"
        : el.appShell.classList.contains("app-shell--community") ? "community" : "guide";
    if (!el.accountModal.hidden && el.accountModal.dataset.accountView === "logbook") active = "logbook";
    document.querySelectorAll("[data-bottom-nav]").forEach(button => {
        const selected = button.dataset.bottomNav === active;
        button.classList.toggle("is-active", selected);
        if (selected) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
    });
}

function showView(view) {
    el.accountModal.hidden = true;
    el.accountMenu.hidden = true;
    el.accountMenuButton.setAttribute("aria-expanded", "false");

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
        requestAnimationFrame(() => map?.resize());
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

    syncBottomNavigation();
}

el.guideViewButton.addEventListener("click", () => {
    showView("guide");
});

el.mapViewButton.addEventListener("click", () => {
    showView("map");
});


document.querySelector("#map-back-to-guide").addEventListener("click", () => {
    showView("guide");
});

document.querySelectorAll("[data-bottom-nav]").forEach(button => button.addEventListener("click", () => {
    const view = button.dataset.bottomNav;
    if (view === "logbook") openAccountView("logbook");
    else if (view === "community") el.communityFeedButton.click();
    else showView(view);
}));
