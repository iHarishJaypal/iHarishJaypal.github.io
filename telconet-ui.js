(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const launcher = $("#launcher");
  const searchInput = $("#assistantSearch");
  const appGrid = $("#appGrid");
  const appList = $("#appList");
  const emptyState = $("#launcherEmpty");
  const menuButton = $('.mobile-bottom [data-action="launcher"]');
  let toastTimer = null;
  let returnFocus = null;

  function notify(message) {
    const toast = $("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2400);
  }

  function isListMode() {
    return Boolean(appList && !appList.hidden);
  }

  function updateGroupHeadings() {
    if (!appList) return;
    const children = Array.from(appList.children);
    let groupHead = null;
    let groupHasVisibleItem = false;

    const flush = () => {
      if (groupHead) groupHead.hidden = !groupHasVisibleItem;
    };

    children.forEach((node) => {
      if (node.classList.contains("list-letter")) {
        flush();
        groupHead = node;
        groupHasVisibleItem = false;
      } else if (node.classList.contains("menu-list-item") && !node.hidden) {
        groupHasVisibleItem = true;
      }
    });
    flush();
  }

  function filterApps() {
    const query = (searchInput?.value || "").trim().toLocaleLowerCase();
    const listMode = isListMode();
    const tiles = $$(".app-tile", appGrid || document);
    const rows = $$(".menu-list-item", appList || document);
    let visible = 0;

    tiles.forEach((item) => {
      const haystack = (item.dataset.appName || item.textContent || "").toLocaleLowerCase();
      const match = !query || haystack.includes(query);
      item.hidden = !match;
      if (match) visible += 1;
    });

    rows.forEach((item) => {
      const haystack = (item.dataset.appName || item.textContent || "").toLocaleLowerCase();
      const match = !query || haystack.includes(query);
      item.hidden = !match;
      if (listMode && match) visible += 1;
    });

    if (emptyState) emptyState.hidden = visible > 0;
    updateGroupHeadings();

    const count = $("#launcherCount");
    if (count) {
      const total = listMode ? rows.length : tiles.length;
      const unit = listMode ? "shortcuts" : "apps";
      count.textContent = query ? visible + " of " + total + " " + unit : total + " " + unit;
    }
    return visible;
  }

  function setMode(mode) {
    const listMode = mode === "list";
    if (appGrid) appGrid.hidden = listMode;
    if (appList) appList.hidden = !listMode;

    const title = $("#launcherTitle");
    if (title) title.textContent = listMode ? "TelcoNet Menu" : "Aliens Apps";

    $$('[data-action="app-mode"]').forEach((button) => {
      const active = button.dataset.mode === (listMode ? "list" : "grid");
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });

    try {
      localStorage.setItem("telconet-app-view", listMode ? "list" : "grid");
    } catch (_) {
      // The menu remains usable when storage is unavailable.
    }
    filterApps();
  }

  function routeFor(query) {
    const q = query.toLocaleLowerCase().replace(/\s+/g, " ").trim();
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
    if (visible > 1) notify(visible + " matching items — choose one to continue.");
    else if (visible === 1) notify("One matching item found. Select it to continue.");
    else notify("No matching app or workspace destination was found.");
  }

  function syncLauncherState() {
    if (!launcher) return;
    const open = launcher.classList.contains("show");
    launcher.setAttribute("aria-hidden", open ? "false" : "true");
    document.body.classList.toggle("menu-open", open);
    if (menuButton) menuButton.classList.toggle("active", open);
    if (open) {
      window.requestAnimationFrame(() => searchInput?.focus({ preventScroll: true }));
    }
  }

  function openLauncher() {
    if (!launcher) return;
    if (!launcher.classList.contains("show")) returnFocus = document.activeElement;
    launcher.classList.add("show");
    syncLauncherState();
  }

  function closeLauncher() {
    if (!launcher) return;
    launcher.classList.remove("show");
    syncLauncherState();
    if (returnFocus && typeof returnFocus.focus === "function") {
      returnFocus.focus({ preventScroll: true });
    }
  }

  if (launcher && "MutationObserver" in window) {
    new MutationObserver(syncLauncherState).observe(launcher, {
      attributes: true,
      attributeFilter: ["class"]
    });
    syncLauncherState();
  }

  document.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]");
    if (!action) {
      if (event.target === launcher) closeLauncher();
      return;
    }

    switch (action.dataset.action) {
      case "launcher":
      case "focus-menu-search":
        openLauncher();
        break;
      case "close-launcher":
        closeLauncher();
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
    if (event.key === "Escape" && searchInput.value) {
      searchInput.value = "";
      filterApps();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !launcher?.classList.contains("show")) return;
    closeLauncher();
  });

  try {
    setMode(localStorage.getItem("telconet-app-view") === "list" ? "list" : "grid");
  } catch (_) {
    setMode("grid");
  }
})();