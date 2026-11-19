(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const launcher = $("#launcher");
  const launcherContent = $("#launcherContent");
  const searchInput = $("#assistantSearch");
  const searchClear = $(".assistant-clear");
  const searchButton = $('.assistant-search [data-action="assistant-search"]');
  const assistantResults = $("#assistantResults");
  const appGrid = $("#appGrid");
  const appList = $("#appList");
  const profilePop = $("#profilePop");
  const overlay = $("#overlay");
  const menuButton = $('.mobile-bottom [data-action="launcher"]');

  let menuReturnFocus = null;
  let profileReturnFocus = null;
  let menuWasOpen = false;
  let profileWasOpen = false;
  let previousMenuMode = "grid";
  let toastTimer = null;

  function notify(message) {
    const toast = $("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2400);
  }

  function focusable(container) {
    return $$('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])', container)
      .filter((element) => !element.closest("[hidden]") &&
        element.getAttribute("aria-hidden") !== "true" &&
        element.getClientRects().length > 0);
  }

  function trapTab(event, container) {
    const items = focusable(container);
    if (!items.length) {
      event.preventDefault();
      container.focus({ preventScroll: true });
      return;
    }

    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !container.contains(active))) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && (active === last || !container.contains(active))) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  }

  function isListMode() {
    return Boolean(launcher?.classList.contains("list-mode"));
  }

  function updateGroupHeadings() {
    if (!appList) return;
    let heading = null;
    let hasItems = false;

    const flush = () => {
      if (heading) heading.hidden = !hasItems;
    };

    Array.from(appList.children).forEach((node) => {
      if (node.classList.contains("list-letter")) {
        flush();
        heading = node;
        hasItems = false;
      } else if (node.classList.contains("menu-list-item") && !node.hidden) {
        hasItems = true;
      }
    });
    flush();
  }

  function setMode(mode) {
    const listMode = mode === "list";
    if (!launcher) return;

    launcher.classList.toggle("list-mode", listMode);
    launcher.classList.remove("all-apps");
    const allHead = $("#launcherAllHead");
    if (allHead) allHead.hidden = true;
    previousMenuMode = listMode ? "list" : "grid";

    $$('[data-action="app-mode"]').forEach((button) => {
      const active = button.dataset.mode === previousMenuMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });

    try {
      localStorage.setItem("telconet-app-view", previousMenuMode);
    } catch (_) {
      // The menu still works when browser storage is unavailable.
    }

    updateGroupHeadings();
  }

  function openAllApps() {
    if (!launcher) return;
    launcher.classList.remove("list-mode", "searching");
    launcher.classList.add("all-apps");
    const allHead = $("#launcherAllHead");
    if (allHead) allHead.hidden = false;
    if (searchInput) searchInput.value = "";
    if (searchClear) searchClear.hidden = true;
    if (assistantResults) assistantResults.hidden = true;
  }

  function backToSummary() {
    if (!launcher) return;
    setMode(previousMenuMode);
    launcher.classList.remove("all-apps");
    launcherContent?.scrollTo({ top: 0, behavior: "smooth" });
  }

  function buildSearchableItems() {
    const items = [];
    const seen = new Set();

    const collect = (selector, root, type) => {
      $$(selector, root || document).forEach((element) => {
        const name = (element.dataset.appName || element.textContent || "").trim();
        const key = name.toLocaleLowerCase();
        if (!key || seen.has(key)) return;
        seen.add(key);
        const icon = $(".app-icon,.list-icon", element)?.textContent?.trim() || "•";
        const subtitle = $("small", element)?.textContent?.trim() || (type === "app" ? "Aliens App" : "Workspace");
        items.push({ name, subtitle, icon, source: element, type });
      });
    };

    collect(".app-tile", appGrid, "app");
    collect(".menu-list-item", appList, "menu");
    return items;
  }

  function setSearchMode(active) {
    launcher?.classList.toggle("searching", active);
    if (searchButton) searchButton.setAttribute("aria-expanded", active ? "true" : "false");
    if (active) renderAssistantResults();
    else if (assistantResults) assistantResults.hidden = true;
  }

  function createElement(tag, className, textContent) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (textContent !== undefined) element.textContent = textContent;
    return element;
  }

  function renderAssistantResults() {
    if (!assistantResults) return;
    assistantResults.replaceChildren();
    assistantResults.hidden = false;

    const query = (searchInput?.value || "").trim().toLocaleLowerCase();
    const header = createElement("div", "assistant-results-head");
    header.append(
      createElement("strong", "", "Ask Cyborg"),
      createElement("span", "assistant-results-status", query ? "Searching local destinations" : "Ready")
    );
    assistantResults.append(header);

    if (!query) {
      const ready = createElement("div", "assistant-ready");
      ready.append(
        createElement("span", "assistant-ready-icon", "🤖"),
        createElement("div", "assistant-ready-copy")
      );
      $(".assistant-ready-copy", ready).append(
        createElement("strong", "", "Ask Cyborg"),
        createElement("small", "", "Ready")
      );

      const suggestions = createElement("div", "assistant-suggestions");
      [
        ["Open Project", "reports"],
        ["Show Reports", "reports"],
        ["Go to Cyborgs", "cyborgs"]
      ].forEach(([label, view]) => {
        const button = createElement("button", "assistant-suggestion", label);
        button.type = "button";
        button.dataset.view = view;
        suggestions.append(button);
      });

      assistantResults.append(ready, suggestions);
      return;
    }

    const allMatches = buildSearchableItems().filter((item) =>
      (item.name + " " + item.subtitle).toLocaleLowerCase().includes(query)
    );
    const status = $(".assistant-results-status", header);
    if (status) status.textContent = allMatches.length + " local " + (allMatches.length === 1 ? "match" : "matches");

    if (!allMatches.length) {
      const empty = createElement("div", "assistant-no-match");
      empty.append(
        createElement("strong", "", "No local destination"),
        createElement("p", "", "Send this request to Cyborg when the assistant service is connected.")
      );
      const send = createElement("button", "assistant-send", "Send to Cyborg");
      send.type = "button";
      send.dataset.action = "send-to-cyborg";
      empty.append(send);
      assistantResults.append(empty);
      return;
    }

    const results = createElement("div", "assistant-result-list");
    allMatches.slice(0, 10).forEach((item, index) => {
      const button = createElement("button", "assistant-result");
      button.type = "button";
      button.dataset.resultIndex = String(index);
      button.append(
        createElement("span", "assistant-result-icon", item.icon),
        createElement("span", "assistant-result-copy")
      );
      $(".assistant-result-copy", button).append(
        createElement("strong", "", item.name),
        createElement("small", "", item.subtitle)
      );
      button.append(createElement("span", "assistant-result-arrow", "›"));
      results.append(button);
    });
    assistantResults.append(results);
    assistantResults._matches = allMatches.slice(0, 10);
  }

  function runAssistantSearch() {
    if (!launcher?.classList.contains("searching")) setSearchMode(true);
    renderAssistantResults();

    const query = (searchInput?.value || "").trim();
    if (query && !buildSearchableItems().some((item) =>
      (item.name + " " + item.subtitle).toLocaleLowerCase().includes(query.toLocaleLowerCase())
    )) {
      notify("Cyborg service is not connected in this prototype.");
    }
  }

  function clearSearch() {
    if (searchInput) searchInput.value = "";
    if (searchClear) searchClear.hidden = true;
    setSearchMode(true);
    renderAssistantResults();
    searchInput?.focus({ preventScroll: true });
  }

  function enterSearch() {
    if (!launcher?.classList.contains("show")) openLauncher();
    if (launcher?.classList.contains("all-apps")) {
      launcher.classList.remove("all-apps");
      const allHead = $("#launcherAllHead");
      if (allHead) allHead.hidden = true;
    }
    setSearchMode(true);
    searchInput?.focus({ preventScroll: true });
  }

  function exitSearch() {
    if (searchInput) searchInput.value = "";
    if (searchClear) searchClear.hidden = true;
    setSearchMode(false);
    launcherContent?.scrollTo({ top: 0, behavior: "smooth" });
  }

  function syncLauncherState() {
    if (!launcher) return;
    const open = launcher.classList.contains("show");
    launcher.setAttribute("aria-hidden", open ? "false" : "true");
    document.body.classList.toggle("menu-open", open);
    if (menuButton) {
      menuButton.setAttribute("aria-expanded", open ? "true" : "false");
      menuButton.classList.toggle("active", open);
    }
    $$('[data-action="focus-menu-search"]').forEach((button) =>
      button.setAttribute("aria-expanded", open && launcher.classList.contains("searching") ? "true" : "false")
    );

    if (open && !menuWasOpen) {
      launcher.focus({ preventScroll: true });
    }
    if (!open && menuWasOpen) {
      if (menuReturnFocus && typeof menuReturnFocus.focus === "function") {
        menuReturnFocus.focus({ preventScroll: true });
      }
      menuReturnFocus = null;
    }
    menuWasOpen = open;
  }

  function openLauncher() {
    if (!launcher) return;
    if (!launcher.classList.contains("show")) {
      if (!menuReturnFocus) menuReturnFocus = document.activeElement;
      launcher.classList.add("show");
      syncLauncherState();
    }
  }

  function closeLauncher() {
    if (!launcher) return;
    launcher.classList.remove("show");
    syncLauncherState();
  }

  function syncProfileState() {
    if (!profilePop) return;
    const open = profilePop.classList.contains("show");
    profilePop.setAttribute("aria-hidden", open ? "false" : "true");
    overlay?.setAttribute("aria-hidden", open ? "false" : "true");
    document.body.classList.toggle("profile-open", open);
    $$('[data-action="profile"]').forEach((button) =>
      button.setAttribute("aria-expanded", open ? "true" : "false")
    );

    if (open && !profileWasOpen) {
      profileReturnFocus = document.activeElement;
      window.requestAnimationFrame(() => $(".close-pop", profilePop)?.focus({ preventScroll: true }));
    }
    if (!open && profileWasOpen) {
      if (profileReturnFocus && typeof profileReturnFocus.focus === "function") {
        profileReturnFocus.focus({ preventScroll: true });
      }
      profileReturnFocus = null;
    }
    profileWasOpen = open;
  }

  function togglePasswordVisibility(button) {
    const input = $("#password");
    if (!input) return;
    const visible = input.type === "password";
    input.type = visible ? "text" : "password";
    button.textContent = visible ? "Hide" : "Show";
    button.setAttribute("aria-pressed", visible ? "true" : "false");
  }

  // Capture the launcher trigger before the inline dashboard handler can change focus/state.
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest('[data-action="launcher"]');
    if (trigger && !launcher?.classList.contains("show")) {
      menuReturnFocus = trigger;
    }
  }, true);

  document.addEventListener("click", (event) => {
    const viewTarget = event.target.closest("#launcher [data-view]");
    if (viewTarget) menuReturnFocus = null;

    const resultButton = event.target.closest("[data-result-index]");
    if (resultButton) {
      const index = Number(resultButton.dataset.resultIndex);
      const match = assistantResults?._matches?.[index];
      if (match) {
        if (match.source.dataset.view) menuReturnFocus = null;
        match.source.click();
      }
      return;
    }

    const action = event.target.closest("[data-action]");
    if (!action) {
      if (event.target === launcher) closeLauncher();
      return;
    }

    switch (action.dataset.action) {
      case "launcher":
        openLauncher();
        break;
      case "focus-menu-search":
        openLauncher();
        enterSearch();
        break;
      case "close-launcher":
        closeLauncher();
        break;
      case "more-apps":
        openAllApps();
        break;
      case "back-to-menu":
        backToSummary();
        break;
      case "app-mode":
        setMode(action.dataset.mode);
        break;
      case "assistant-search":
        runAssistantSearch();
        break;
      case "clear-search":
        clearSearch();
        break;
      case "send-to-cyborg":
        notify("Cyborg service is not connected in this prototype.");
        break;
      case "password-visibility":
        togglePasswordVisibility(action);
        break;
      case "signout":
        profileReturnFocus = null;
        break;
    }
  });

  searchInput?.addEventListener("focus", () => {
    if (launcher?.classList.contains("show")) setSearchMode(true);
  });
  searchInput?.addEventListener("input", () => {
    if (searchClear) searchClear.hidden = !searchInput.value;
    if (!launcher?.classList.contains("searching")) setSearchMode(true);
    renderAssistantResults();
  });
  searchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runAssistantSearch();
    } else if (event.key === "Escape" && searchInput.value) {
      event.stopPropagation();
      clearSearch();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (profilePop?.classList.contains("show")) {
      if (event.key === "Escape") {
        event.preventDefault();
        $(".close-pop", profilePop)?.click();
      } else if (event.key === "Tab") {
        trapTab(event, profilePop);
      }
      return;
    }

    if (!launcher?.classList.contains("show")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      if (launcher.classList.contains("searching")) exitSearch();
      else if (launcher.classList.contains("all-apps")) backToSummary();
      else closeLauncher();
    } else if (event.key === "Tab") {
      trapTab(event, launcher);
    }
  });

  if (launcher && "MutationObserver" in window) {
    new MutationObserver(syncLauncherState).observe(launcher, {
      attributes: true,
      attributeFilter: ["class"]
    });
    syncLauncherState();
  }

  if (profilePop && "MutationObserver" in window) {
    new MutationObserver(syncProfileState).observe(profilePop, {
      attributes: true,
      attributeFilter: ["class"]
    });
    syncProfileState();
  }

  $$('[data-action="profile"]').forEach((button) => button.setAttribute("aria-expanded", "false"));
  $$('[data-action="focus-menu-search"]').forEach((button) => button.setAttribute("aria-expanded", "false"));
  if (menuButton) menuButton.setAttribute("aria-expanded", "false");

  try {
    previousMenuMode = localStorage.getItem("telconet-app-view") === "list" ? "list" : "grid";
  } catch (_) {
    previousMenuMode = "grid";
  }
  setMode(previousMenuMode);
  updateGroupHeadings();
  if (searchClear) searchClear.hidden = true;
})();