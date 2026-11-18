
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const launcher = $("#launcher");
  const searchInput = $("#assistantSearch");
  const appGrid = $("#appGrid");
  const appList = $("#appList");
  const emptyState = $("#launcherEmpty");
  const menuButton = $('.mobile-bottom [data-action="launcher"]');
  let toastTimer = null;

  function notify(message) {
    const toast = $("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2400);
  }

  function setMode(mode) {
    const listMode = mode === "list";
    if (appGrid) appGrid.hidden = listMode;
    if (appList) appList.hidden = !listMode;
    $$('[data-action="app-mode"]').forEach((button) => {
      const active = button.dataset.mode === (listMode ? "list" : "grid");
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    try { localStorage.setItem("telconet-app-view", listMode ? "list" : "grid"); } catch (_) {}
    filterApps();
  }

  function filterApps() {
    const query = (searchInput?.value || "").trim().toLowerCase();
    const tiles = $$(".app-tile", appGrid || document);
    const rows = $$(".menu-list-item", appList || document);
    let visible = 0;
    tiles.forEach((item) => {
      const haystack = (item.dataset.appName || item.textContent).toLowerCase();
      const match = !query || haystack.includes(query);
      item.hidden = !match;
      if (match) visible += 1;
    });
    rows.forEach((item) => {
      const haystack = (item.dataset.appName || item.textContent).toLowerCase();
      const match = !query || haystack.includes(query);
      item.hidden = !match;
      if (match && appList && !appList.hidden) visible += 1;
    });
    if (emptyState) emptyState.hidden = visible > 0;
    return visible;
  }

  function routeFor(query) {
    const q = query.toLowerCase().replace(/\s+/g, " ").trim();
    const routes = [
      ["dashboard", "dashboard"], ["score", "dashboard"], ["home", "dashboard"],
      ["health", "health"], ["heartbeat", "health"], ["everything running", "health"],
      ["report", "reports"], ["leaderboard", "reports"], ["workflow", "reports"], ["project", "reports"],
      ["cyborg", "cyborgs"], ["activity", "cyborgs"], ["friend", "cyborgs"],
      ["alien", "aliens"], ["company", "aliens"], ["learning", "aliens"], ["ecosystem", "aliens"],
      ["salary", "salary"], ["finance", "salary"], ["calendar", "calendar"], ["clock", "calendar"]
    ];
    const match = routes.find(([key]) => q === key || q.includes(key));
    return match ? match[1] : null;
  }

  function runAssistantSearch() {
    const query = (searchInput?.value || "").trim();
    if (!query) {
      notify("Type an app or workspace destination to search.");
      searchInput?.focus();
      return;
    }
    const route = routeFor(query);
    if (route) {
      const target = $('[data-view="' + route + '"]');
      if (target) {
        target.click();
        return;
      }
    }
    const visible = filterApps();
    if (visible > 1) notify(visible + " matching apps — choose one to continue.");
    else if (visible === 1) notify("One matching app found. Select it to continue.");
    else notify("No matching app or workspace destination was found.");
  }

  function syncLauncherState() {
    if (!launcher) return;
    const open = launcher.classList.contains("show");
    launcher.setAttribute("aria-hidden", open ? "false" : "true");
    document.body.classList.toggle("menu-open", open);
    if (menuButton) menuButton.classList.toggle("active", open);
  }

  if (launcher && "MutationObserver" in window) {
    new MutationObserver(syncLauncherState).observe(launcher, {attributes:true, attributeFilter:["class"]});
    syncLauncherState();
  }

  document.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]");
    if (!action) {
      if (event.target === launcher) {
        const close = $('[data-action="close-launcher"]');
        close?.click();
      }
      return;
    }
    switch (action.dataset.action) {
      case "focus-menu-search":
        launcher?.classList.add("show");
        syncLauncherState();
        window.setTimeout(() => searchInput?.focus({preventScroll:true}), 60);
        break;
      case "app-mode":
        setMode(action.dataset.mode);
        break;
      case "assistant-search":
        runAssistantSearch();
        break;
    }
  });

  searchInput?.addEventListener("input", filterApps);
  searchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runAssistantSearch();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (launcher?.classList.contains("show")) {
      $('[data-action="close-launcher"]')?.click();
    }
    const profile = $("#profilePop");
    if (profile?.classList.contains("show")) {
      $('[data-action="close-pop"]')?.click();
    }
  });

  try {
    setMode(localStorage.getItem("telconet-app-view") === "list" ? "list" : "grid");
  } catch (_) {
    setMode("grid");
  }
})();
