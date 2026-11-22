(() => {
  // Lolo's off-season theme runs from November 15 through March 31.
  const today = new Date();
  const month = today.getMonth();
  const inSeason = month <= 2 || month === 11 || (month === 10 && today.getDate() >= 15);
  if (!inSeason) return;

  const header = document.querySelector("#app-header");
  if (!header) return;
  header.classList.add("is-winter");
  header.querySelectorAll("[data-winter-art]").forEach(art => art.removeAttribute("hidden"));

  const snow = header.querySelector(".winter-snow");
  const snowControl = header.querySelector("#winter-snow-control");
  if (snow && snowControl) {
    const flakes = document.createDocumentFragment();
    for (let i = 0; i < 32; i++) {
      const flake = document.createElement("span");
      flake.className = "winter-flake";
      flake.style.setProperty("--flake-x", `${(i * 37 + 3) % 100}%`);
      flake.style.setProperty("--flake-size", `${[2, 4, 3, 2, 5][i % 5]}px`);
      flake.style.setProperty("--flake-time", `${5 + (i * 7 % 9) / 2}s`);
      flake.style.setProperty("--flake-delay", `${-(i * .83)}s`);
      flake.style.setProperty("--flake-drift", `${(i % 7 - 3) * 5}px`);
      flakes.append(flake);
    }
    snow.append(flakes);
    snowControl.hidden = false;
    snowControl.addEventListener("click", () => {
      const paused = snow.classList.toggle("is-paused");
      snowControl.textContent = paused ? "Resume snowfall" : "Pause snowfall";
    });
  }

  /* Optional seasonal report template. Enable with the matching HTML and CSS blocks.
  const widget = document.querySelector("#winter-widget");
  if (!widget) return;
  const toggle = document.querySelector("#winter-toggle");
  const report = document.querySelector("#winter-report");
  const note = document.querySelector("#winter-note");
  const flake = toggle.querySelector("svg");
  const notes = [
    note.textContent,
    "Add a second seasonal note here.",
    "Add another note here."
  ];
  let currentNote = 0;

  widget.hidden = false;

  function setReportOpen(open) {
    report.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
  }

  function spinFlake() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    flake.animate?.([{transform: "rotate(0)"}, {transform: "rotate(120deg)"}], {duration: 350, easing: "ease-out"});
  }

  toggle.addEventListener("click", () => {
    const open = report.hidden;
    setReportOpen(open);
    if (open) spinFlake();
  });

  document.querySelector("#winter-next").addEventListener("click", () => {
    currentNote = (currentNote + 1) % notes.length;
    note.textContent = notes[currentNote];
    spinFlake();
  });

  document.addEventListener("click", (event) => {
    if (!report.hidden && !widget.contains(event.target)) setReportOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || report.hidden) return;
    const focusWasInside = widget.contains(document.activeElement);
    setReportOpen(false);
    if (focusWasInside) toggle.focus();
  });
  */
})();
