import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};
const routes = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/telconet-ui.css", "telconet-ui.css"],
  ["/telconet-ui.js", "telconet-ui.js"]
]);

let server;
let browser;
let baseUrl;
const runtimeErrors = [];
const artifactDir = resolve(root, "test-results");

async function capture(page, filename) {
  await page.screenshot({
    path: resolve(artifactDir, filename),
    animations: "disabled",
    fullPage: false
  });
}

before(async () => {
  await mkdir(artifactDir, { recursive: true });
  server = createServer(async (request, response) => {
    const pathname = new URL(request.url || "/", "http://127.0.0.1").pathname;
    const relative = routes.get(pathname);
    if (!relative) {
      response.writeHead(404).end("Not found");
      return;
    }

    const filePath = resolve(root, relative);
    if (!filePath.startsWith(root + sep) && filePath !== resolve(root, "index.html")) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    try {
      const body = await readFile(filePath);
      response.writeHead(200, {
        "content-type": mime[extname(filePath)] || "application/octet-stream",
        "cache-control": "no-store"
      });
      response.end(body);
    } catch {
      response.writeHead(500).end("Unable to read prototype asset");
    }
  });

  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  baseUrl = "http://127.0.0.1:" + server.address().port;
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });
});

after(async () => {
  await browser?.close();
  await new Promise((resolveClose) => server?.close(resolveClose));
});

async function openPage(viewport) {
  const context = await browser.newContext({
    viewport,
    reducedMotion: "reduce"
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !/fonts\\.(googleapis|gstatic)\\.com/i.test(message.text())) {
      runtimeErrors.push(message.text());
    }
  });
  await page.route(/fonts\\.(googleapis|gstatic)\\.com/, (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() =>
    document.querySelector("#launcher")?.getAttribute("aria-hidden") === "true" &&
    document.querySelector("#assistantSearch")
  );
  return { context, page };
}

async function assertNoHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth
  }));
  assert.ok(
    Math.max(metrics.document, metrics.body) <= metrics.viewport + 1,
    label + " has horizontal overflow: " + JSON.stringify(metrics)
  );
}

async function waitForToastToClear(page) {
  await page.waitForFunction(() =>
    !document.querySelector("#toast")?.classList.contains("show")
  );
}

async function assertVisibleControlsHaveNames(page, label) {
  const missing = await page.evaluate(() => {
    const isVisible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" &&
        rect.width > 0 && rect.height > 0 && !element.closest("[hidden]");
    };
    const buttonName = (element) =>
      (element.getAttribute("aria-label") || element.getAttribute("title") ||
        element.innerText || "").trim();
    const inputName = (element) => {
      const explicit = element.getAttribute("aria-label") || element.getAttribute("title");
      const label = element.id
        ? document.querySelector('label[for="' + CSS.escape(element.id) + '"]')
        : element.closest("label");
      return (explicit || label?.innerText || "").trim();
    };
    return {
      buttons: [...document.querySelectorAll("button")].filter(isVisible)
        .filter((element) => !buttonName(element))
        .map((element) => element.outerHTML.slice(0, 180)),
      inputs: [...document.querySelectorAll("input,textarea,select")].filter(isVisible)
        .filter((element) => !inputName(element))
        .map((element) => ({ id: element.id, type: element.type, placeholder: element.placeholder }))
    };
  });
  assert.deepEqual(missing, { buttons: [], inputs: [] }, label + " contains unnamed visible controls");
}

async function visibleCount(locator) {
  return locator.evaluateAll((items) =>
    items.filter((item) => getComputedStyle(item).display !== "none" &&
      !item.closest("[hidden]")).length
  );
}

test("desktop and compact-desktop shells stay within the viewport", async (t) => {
  for (const width of [1512, 1440, 1280, 1180, 1100, 1024, 920, 851]) {
    await t.test(width + "px viewport", async () => {
      const { context, page } = await openPage({ width, height: 900 });
      try {
        assert.equal(await page.locator("#workspaceSidebar").isVisible(), true);
        assert.equal(await page.locator(".topbar").isVisible(), true);
        await assertNoHorizontalOverflow(page, width + "px desktop");
        const shell = await page.evaluate(() => ({
          sidebar: document.querySelector("#workspaceSidebar").getBoundingClientRect(),
          topbar: document.querySelector(".topbar").getBoundingClientRect(),
          main: document.querySelector("#mainContent").getBoundingClientRect()
        }));
        assert.ok(shell.sidebar.right <= shell.main.left + 1, "main content must clear the workspace sidebar");
        assert.ok(shell.topbar.right <= width + 1, "top navigation must remain inside the viewport");
      } finally {
        await context.close();
      }
    });
  }
});

test("desktop navigation, chart ranges, sidebar collapse, theme and SignIn remain functional", async () => {
  const { context, page } = await openPage({ width: 1440, height: 960 });
  try {
    await capture(page, "desktop-dashboard-dark.png");
    assert.equal(await page.locator(".updated").textContent(), "Demo snapshot");
    assert.match(await page.locator(".updated").getAttribute("title"), /Static sample data/);
    await page.locator('[data-action="chart-range"][data-range="7"]').click();
    assert.equal(await page.locator(".chart").getAttribute("data-sample-range"), "7");
    assert.equal(await page.locator('[data-action="chart-range"][data-range="7"]').getAttribute("aria-pressed"), "true");
    assert.deepEqual(await page.locator("#chartXAxis .axis-label").allTextContents(), ["01", "02", "03", "04", "05", "06", "07"]);
    assert.match(await page.locator(".chart").getAttribute("aria-label"), /normalized 0–100 sample index/);

    await page.locator('[data-action="chart-range"][data-range="30"]').click();
    assert.equal(await page.locator(".chart").getAttribute("data-sample-range"), "30");
    assert.deepEqual(await page.locator("#chartXAxis .axis-label").allTextContents(), ["01", "05", "10", "15", "20", "25", "30"]);

    await page.locator('[data-action="chart-range"][data-range="90"]').click();
    assert.equal(await page.locator(".chart").getAttribute("data-sample-range"), "90");
    assert.deepEqual(await page.locator("#chartXAxis .axis-label").allTextContents(), ["01", "15", "30", "45", "60", "75", "90"]);
    const chartGeometry = await page.locator(".chart").evaluate((svg) => {
      const bounds = svg.getBoundingClientRect();
      const labels = [...svg.querySelectorAll("#chartXAxis .axis-label")].map((node) => node.getBoundingClientRect());
      const highestBar = Math.min(...[...svg.querySelectorAll("#chartBars .bar")].map((node) => Number(node.getAttribute("y"))));
      return {
        labelsInside: labels.every((rect) => rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1 && rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1),
        highestBar
      };
    });
    assert.equal(chartGeometry.labelsInside, true, "day labels must remain inside the chart viewport");
    assert.equal(chartGeometry.highestBar, 25, "the maximum normalized bar must align with the 2.5M top gridline");

    await page.locator(".dock-theme").click();
    assert.equal(await page.locator("body").evaluate((body) => body.classList.contains("light")), true);
    await waitForToastToClear(page);
    await capture(page, "desktop-dashboard-light.png");
    await page.locator(".dock-theme").click();
    assert.equal(await page.locator("body").evaluate((body) => body.classList.contains("light")), false);

    const collapse = page.locator('.topbar [data-action="collapse"]');
    await collapse.click();
    assert.equal(await page.locator("body").evaluate((body) => body.classList.contains("sidebar-collapsed")), true);
    assert.equal(await page.locator("#workspaceSidebar").getAttribute("aria-hidden"), "true");
    assert.equal(await page.locator("#workspaceSidebar").evaluate((node) => node.inert), true);
    const collapsedMainLeft = await page.locator("#mainContent").evaluate((node) => node.getBoundingClientRect().left);
    assert.ok(collapsedMainLeft <= 70, "main content should reclaim the collapsed sidebar width");
    await collapse.click();
    assert.equal(await page.locator("#workspaceSidebar").getAttribute("aria-hidden"), "false");

    await page.locator("#searchDesktop").fill("calendar");
    await page.locator("#searchDesktop").press("Enter");
    assert.equal(await page.locator("#view-calendar").evaluate((node) => node.classList.contains("active")), true);
    await page.locator('.topnav [data-view="dashboard"]').click();
    await page.waitForFunction(() => !document.querySelector("#toast")?.classList.contains("show"));

    await page.locator(".avatar-btn").click();
    await page.locator("#profilePop.show").waitFor();
    const profileBounds = await page.locator("#profilePop").boundingBox();
    assert.equal(Math.round(profileBounds.width), 350);
    assert.ok(profileBounds.height >= 460, "desktop account popover should retain the supplied tall panel proportions");
    assert.match(await page.locator("#profilePop").textContent(), /Hi, Aliens!/);
    assert.doesNotMatch(await page.locator("#profilePop").textContent(), /Aliens TelcoNet workspace/);
    await capture(page, "desktop-profile-popover.png");
    await page.locator('#profilePop [data-lang="EN"]').click();
    assert.equal(await page.locator('#profilePop [data-lang="EN"]').getAttribute("aria-pressed"), "true");
    assert.match(await page.locator("#toast").textContent(), /Language switching is not connected/);
    await page.locator('#profilePop [data-lang="HL"]').click();
    assert.equal(await page.locator('#profilePop [data-lang="HL"]').getAttribute("aria-pressed"), "true");
    await page.locator('#profilePop [data-action="signout"]').click();
    await page.locator("#signin.show").waitFor();
    await waitForToastToClear(page);
    await capture(page, "desktop-signin-prototype.png");
    assert.match(await page.locator(".signin-note").textContent(), /Do not enter real credentials/);
    assert.equal(await page.locator("#signinForm input").count(), 2, "reference SignIn should contain only email and password fields");
    assert.equal(await page.locator("#email").getAttribute("type"), "email");
    assert.equal(await page.locator("#email").getAttribute("placeholder"), "you@company.com");
    assert.equal(await page.locator(".signin-field svg.icon-at-sign").count(), 1);
    assert.equal(await page.locator(".password-field svg.icon-lock").count(), 1);
    assert.equal(await page.locator("#keepSignedIn").count(), 0);
    assert.equal(await page.locator(".signin-google").count(), 0);
    assert.equal(await page.locator(".signin-create").count(), 0);

    const password = page.locator("#password");
    const visibility = page.locator('[data-action="password-visibility"]');
    assert.equal(await password.getAttribute("type"), "password");
    await visibility.click();
    assert.equal(await password.getAttribute("type"), "text");
    assert.equal(await visibility.getAttribute("aria-pressed"), "true");
    await visibility.click();
    assert.equal(await password.getAttribute("type"), "password");

    await page.locator("#email").fill("demo@example.invalid");
    await password.fill("prototype-only");
    await page.locator('#signinForm button[type="submit"]').click();
    assert.match(await page.locator("#toast").textContent(), /demo credentials cleared/);
    assert.equal(await page.locator("#email").inputValue(), "", "demo email must be cleared after submit");
    assert.equal(await password.inputValue(), "", "demo password must be cleared after submit");
    assert.equal(await password.getAttribute("type"), "password", "password must be hidden after submit");
    assert.equal(await visibility.textContent(), "Show");
    await page.locator('[data-action="back-home"]').click();
    assert.equal(await page.locator("#view-dashboard").evaluate((node) => node.classList.contains("active")), true);

    await page.locator(".avatar-btn").click();
    await page.locator("#profilePop.show").waitFor();
    await page.locator('#profilePop [data-action="signout"]').click();
    await page.locator("#signin.show").waitFor();
    await page.locator("#email").fill("demo-cancel@example.invalid");
    await password.fill("prototype-cancel-only");
    await visibility.click();
    await page.locator('[data-action="back-home"]').click();
    assert.equal(await page.locator("#email").inputValue(), "", "leaving SignIn must clear the email field");
    assert.equal(await password.inputValue(), "", "leaving SignIn must clear the password field");
    assert.equal(await password.getAttribute("type"), "password", "leaving SignIn must hide the password");
    assert.equal(await visibility.textContent(), "Show");
    assert.deepEqual(runtimeErrors, []);
  } finally {
    await context.close();
  }
});


test("browser chrome theme color follows persisted theme and prototype SignIn", async () => {
  const { context, page } = await openPage({ width: 1440, height: 960 });
  try {
    const themeColor = page.locator('meta[name="theme-color"]');
    assert.equal(await themeColor.getAttribute("content"), "#08090d");

    await page.locator(".dock-theme").click();
    assert.equal(await page.locator("body").evaluate((body) => body.classList.contains("light")), true);
    assert.equal(await themeColor.getAttribute("content"), "#e8f4ff");

    await page.evaluate(() => localStorage.setItem("score-theme", "light"));
    await page.reload({ waitUntil: "domcontentloaded" });
    assert.equal(await page.locator("body").evaluate((body) => body.classList.contains("light")), true);
    assert.equal(await themeColor.getAttribute("content"), "#e8f4ff");

    await page.locator(".avatar-btn").click();
    await page.locator("#profilePop.show").waitFor();
    await page.locator('#profilePop [data-action="signout"]').click();
    await page.locator("#signin.show").waitFor();
    assert.equal(await themeColor.getAttribute("content"), "#07080b");

    await page.locator('[data-action="back-home"]').click();
    assert.equal(await themeColor.getAttribute("content"), "#e8f4ff");
  } finally {
    await context.close();
  }
});


test("mobile menu matches the 8-app preview, 26-app grid and 39-entry Score Menu flow", async () => {
  const { context, page } = await openPage({ width: 390, height: 844 });
  try {
    await page.locator(".mobile-brand [data-action='theme']").click();
    assert.equal(await page.locator("body").evaluate((body) => body.classList.contains("light")), true);
    assert.equal(await page.locator(".mobile-brand").isVisible(), true);
    assert.equal(await page.locator(".mobile-bottom").isVisible(), true);
    await assertNoHorizontalOverflow(page, "390px dashboard");

    await page.locator('.mobile-bottom [data-action="launcher"]').click();
    await page.locator("#launcher.show").waitFor();
    await capture(page, "mobile-compact-menu.png");
    assert.equal(await page.locator("#launcher").getAttribute("aria-hidden"), "false");
    assert.equal(await page.locator(".assistant-bot svg.icon-bot").count(), 1);
    assert.equal(await page.locator(".assistant-search [data-action='assistant-search'] svg.icon-send").count(), 1);
    assert.equal(await page.locator(".launcher-power svg.icon-power").count(), 1);
    const compactAppLabels = await page.locator("#appGrid .app-tile").evaluateAll((items) =>
      items.slice(0, 8).map((item) => item.dataset.appName)
    );
    assert.deepEqual(compactAppLabels, ["Base", "Score", "Project", "Code", "AI", "Drive", "Apps", "Admin"]);
    assert.deepEqual(
      await page.locator(".launcher-footer-actions button").evaluateAll((items) =>
        items.map((item) => item.getAttribute("aria-label"))
      ),
      ["Team", "Notifications", "Messages", "Sign out"],
      "mobile launcher footer must retain the four reference actions"
    );
    assert.equal(await visibleCount(page.locator("#appList .menu-list-item")), 1, "compact Grid mode must show only the Dashboard Score Menu preview");
    assert.equal(await page.locator("#appList .menu-list-item:visible").getAttribute("data-app-name"), "Dashboard");
    const compactDivider = await page.evaluate(() => ({
      appGridBottom: getComputedStyle(document.querySelector("#appGrid")).borderBottomWidth,
      scoreMenuTop: getComputedStyle(document.querySelector(".score-menu-head")).borderTopWidth
    }));
    assert.equal(compactDivider.appGridBottom, "1px", "the compact app preview should own the section divider");
    assert.equal(compactDivider.scoreMenuTop, "0px", "Score Menu must not add a second divider");
    await page.locator("#assistantSearch").click();
    await capture(page, "mobile-ask-cyborg-ready.png");
    assert.deepEqual(await page.locator(".assistant-suggestion").allTextContents(), [
      "Open Project", "Show Reports", "Go to Cyborgs"
    ]);
    assert.equal(await page.locator(".assistant-ready-icon svg.icon-bot").count(), 1);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("#launcher")?.classList.contains("searching"));
    assert.equal(await visibleCount(page.locator("#appGrid .app-tile")), 8);
    assert.equal(await page.locator("#appGrid .app-tile").count(), 26);

    await page.locator('[data-action="more-apps"]').click();
    await capture(page, "mobile-full-app-grid.png");
    assert.equal(await visibleCount(page.locator("#appGrid .app-tile")), 26);
    assert.equal(await page.locator("#launcher").evaluate((node) => node.classList.contains("all-apps")), true);
    await assertNoHorizontalOverflow(page, "390px full app grid");

    await page.locator('[data-action="back-to-menu"]').click();
    await page.locator('[data-action="app-mode"][data-mode="list"]').click();
    await capture(page, "mobile-score-menu-list.png");
    assert.equal(await visibleCount(page.locator("#appList .menu-list-item")), 39);
    assert.equal(await page.locator("#appGrid").isVisible(), false);

    const footer = page.locator(".launcher-footer");
    assert.equal(await footer.isVisible(), true);
    const footerTopBeforeScroll = await footer.evaluate((node) => node.getBoundingClientRect().top);
    const footerBottom = await footer.evaluate((node) => node.getBoundingClientRect().bottom);

    const content = page.locator("#launcherContent");
    const scrollMetrics = await content.evaluate((node) => ({
      clientHeight: node.clientHeight,
      scrollHeight: node.scrollHeight
    }));
    assert.ok(scrollMetrics.scrollHeight > scrollMetrics.clientHeight, "39-item list should scroll inside the launcher");
    await content.evaluate((node) => { node.scrollTop = node.scrollHeight; });
    await capture(page, "mobile-score-menu-list-bottom.png");
    const lastItemVisible = await page.locator("#appList .menu-list-item").last().evaluate((node) => {
      const item = node.getBoundingClientRect();
      const parent = document.querySelector("#launcherContent").getBoundingClientRect();
      return item.top >= parent.top - 1 && item.bottom <= parent.bottom + 1;
    });
    assert.equal(lastItemVisible, true, "the last Score Menu item must be reachable by scrolling");
    const footerTopAfterScroll = await footer.evaluate((node) => node.getBoundingClientRect().top);
    assert.equal(footerTopAfterScroll, footerTopBeforeScroll, "launcher footer must remain stationary while Score Menu content scrolls");
    assert.ok(footerBottom <= 844, "launcher footer must remain inside the phone viewport");
    await assertNoHorizontalOverflow(page, "390px Score Menu");

    await page.locator("#assistantSearch").fill("z");
    await page.locator('[data-action="assistant-search"]').click();
    await capture(page, "mobile-search-local-match.png");
    assert.equal(await page.locator("#assistantResults").isVisible(), true);
    assert.equal(await page.locator(".assistant-results-head").count(), 0);
    assert.equal(await page.locator(".assistant-ready").count(), 1);
    assert.equal(await page.locator(".assistant-ready-copy strong").textContent(), "Ask Cyborg");
    assert.equal(await page.locator(".assistant-ready-copy small").textContent(), "2 local matches");
    assert.deepEqual(await page.locator(".assistant-result-copy strong").allTextContents(), ["Amazon", "Company"]);
    assert.deepEqual(await page.locator(".assistant-result-copy small").allTextContents(), ["Aliens App", "Aliens App"]);
    await page.locator('[data-action="clear-search"]').click();
    assert.equal(await page.locator("#assistantSearch").inputValue(), "");
    assert.deepEqual(await page.locator(".assistant-suggestion").allTextContents(), [
      "Open Project", "Show Reports", "Go to Cyborgs"
    ]);
    assert.equal(await page.locator(".assistant-ready").count(), 1);
    await page.locator("#assistantSearch").fill("z");
    await page.locator('[data-action="assistant-search"]').click();
    assert.equal(await page.locator(".assistant-result").count(), 2);
    await page.locator(".assistant-result").nth(1).click();
    assert.equal(await page.locator("#view-aliens").evaluate((node) => node.classList.contains("active")), true);
    assert.equal(await page.locator("#launcher").getAttribute("aria-hidden"), "true");

    await page.locator('.mobile-bottom [data-action="launcher"]').click();
    await page.locator("#assistantSearch").fill("zz");
    await page.locator('[data-action="assistant-search"]').click();
    await capture(page, "mobile-search-no-local-destination.png");
    assert.match(await page.locator("#assistantResults").textContent(), /No local destination; Cyborg is not connected/);
    assert.equal(await page.locator(".assistant-ready").count(), 1);
    assert.equal(await page.locator(".assistant-suggestion").count(), 0);
    assert.equal(await page.locator('[data-action="send-to-cyborg"]').count(), 0);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#launcher").getAttribute("aria-hidden"), "true");
    assert.deepEqual(runtimeErrors, []);
  } finally {
    await context.close();
  }
});

test("mobile navigation, every Score Menu route, and placeholder actions remain functional", async () => {
  const { context, page } = await openPage({ width: 390, height: 844 });
  try {
    const mobileNav = page.locator(".mobile-bottom");
    for (const destination of ["aliens", "health", "dashboard"]) {
      await mobileNav.locator('[data-view="' + destination + '"]').click();
      assert.equal(await page.locator(".view.active").getAttribute("id"), "view-" + destination);
      assert.equal(await mobileNav.locator('[data-view="' + destination + '"]').getAttribute("aria-current"), "page");
    }

    const openListMenu = async () => {
      await mobileNav.locator('[data-action="launcher"]').click();
      await page.locator("#launcher.show").waitFor();
      await page.locator("#assistantSearch").click();
      await page.keyboard.press("Escape");
      await page.waitForFunction(() =>
        !document.querySelector("#launcher")?.classList.contains("searching")
      );
      const listMode = await page.locator("#launcher").evaluate((node) =>
        node.classList.contains("list-mode")
      );
      if (!listMode) {
        await page.locator('[data-action="app-mode"][data-mode="list"]').click();
      }
    };

    await openListMenu();
    const placeholderItems = await page.locator("#appList .menu-list-item[data-action='toast']").evaluateAll((items) =>
      items.map((item) => ({ name: item.dataset.appName, message: item.dataset.message }))
    );
    for (let index = 0; index < placeholderItems.length; index += 1) {
      await page.locator("#appList .menu-list-item[data-action='toast']").nth(index).click();
      await page.waitForFunction((expected) =>
        document.querySelector("#toast")?.textContent === expected,
      placeholderItems[index].message);
    }

    const destinations = await page.locator("#appList .menu-list-item[data-view]").evaluateAll((items) =>
      items.map((item) => ({ name: item.dataset.appName, view: item.dataset.view }))
    );
    assert.ok(destinations.length > 0, "Score Menu must expose navigable destinations");
    for (let index = 0; index < destinations.length; index += 1) {
      const destination = destinations[index];
      await page.locator("#appList .menu-list-item[data-view]").nth(index).click();
      assert.equal(
        await page.locator(".view.active").getAttribute("id"),
        "view-" + destination.view,
        "Score Menu destination should open its matching view: " + destination.name
      );
      const mobileLink = mobileNav.locator('[data-view="' + destination.view + '"]');
      if (await mobileLink.count()) {
        assert.equal(await mobileLink.getAttribute("aria-current"), "page");
      } else {
        assert.equal(await mobileNav.locator('[aria-current="page"]').count(), 0);
      }
      if (index < destinations.length - 1) await openListMenu();
    }

    await assertNoHorizontalOverflow(page, "390px after all Score Menu routes");
    assert.deepEqual(runtimeErrors, []);
  } finally {
    await context.close();
  }
});

test("narrow phone layout preserves the menu footer, profile focus and safe-area padding", async () => {
  const { context, page } = await openPage({ width: 320, height: 740 });
  try {
    await assertNoHorizontalOverflow(page, "320px dashboard");
    await page.locator(".mobile-brand [data-action='theme']").click();
    assert.equal(await page.locator("body").evaluate((body) => body.classList.contains("light")), true);
    assert.equal(await page.locator(".mobile-brand [data-action='theme']").getAttribute("aria-pressed"), "true");

    await page.locator('.mobile-bottom [data-action="launcher"]').click();
    await page.locator("#launcher.show").waitFor();
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "assistantSearch");
    await page.keyboard.press("Shift+Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.classList.contains("launcher-power")), true);
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "assistantSearch");

    const launcherFooterTop = await page.locator(".launcher-footer").evaluate((node) => node.getBoundingClientRect().top);
    await page.locator("#assistantSearch").fill("z");
    await page.locator('[data-action="assistant-search"]').click();
    assert.deepEqual(await page.locator(".assistant-result-copy strong").allTextContents(), ["Amazon", "Company"]);
    await assertNoHorizontalOverflow(page, "320px Ask Cyborg local matches");
    await page.locator("#assistantSearch").fill("zz");
    await page.locator('[data-action="assistant-search"]').click();
    assert.match(await page.locator("#assistantResults").textContent(), /No local destination; Cyborg is not connected/);
    await capture(page, "mobile-search-no-local-destination-320.png");
    await assertNoHorizontalOverflow(page, "320px Ask Cyborg no local destination");
    assert.equal(
      await page.locator(".launcher-footer").evaluate((node) => node.getBoundingClientRect().top),
      launcherFooterTop,
      "launcher footer must remain stationary while Ask Cyborg results change"
    );
    await page.locator("#assistantSearch").fill("");

    await page.locator(".launcher-avatar").click();
    await page.locator("#profilePop.show").waitFor();
    await page.waitForFunction(() => document.activeElement?.classList.contains("close-pop"));
    await capture(page, "mobile-profile-popover.png");
    assert.equal(await page.locator("#profilePop").getAttribute("aria-hidden"), "false");
    await page.keyboard.press("Shift+Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.action), "signout");
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.classList.contains("close-pop")), true);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.querySelector("#profilePop")?.getAttribute("aria-hidden") === "true");
    assert.equal(await page.evaluate(() => document.activeElement?.classList.contains("launcher-avatar")), true);

    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("#launcher")?.classList.contains("searching"));
    assert.equal(await page.locator("#launcher").getAttribute("aria-hidden"), "false");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#launcher").getAttribute("aria-hidden"), "true");
    await assertNoHorizontalOverflow(page, "320px after dialogs");

    await page.locator(".mobile-brand [data-action='profile']").click();
    await page.locator("#profilePop.show").waitFor();
    await page.locator('#profilePop [data-action="signout"]').click();
    await page.locator("#signin.show").waitFor();
    assert.equal(await page.locator(".signin-copy").isVisible(), false, "mobile SignIn should prioritize the form card");
    assert.equal(await page.locator(".signin-card").isVisible(), true);
    assert.equal(await page.locator("body").evaluate((body) => body.classList.contains("light")), true);
    assert.equal(await page.locator(".signin-card h2").evaluate((node) => getComputedStyle(node).color), "rgb(245, 246, 250)");
    await page.waitForFunction(() => document.activeElement?.id === "email");
    await capture(page, "mobile-signin-prototype.png");
    const passwordMetrics = await page.locator("#password").evaluate((input) => {
      const style = getComputedStyle(input);
      const rect = input.getBoundingClientRect();
      const available = rect.width
        - parseFloat(style.borderLeftWidth)
        - parseFloat(style.borderRightWidth)
        - parseFloat(style.paddingLeft)
        - parseFloat(style.paddingRight);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      context.font = style.font;
      return {
        available,
        placeholderWidth: context.measureText(input.placeholder).width,
        rectWidth: rect.width,
        clientWidth: input.clientWidth,
        paddingLeft: style.paddingLeft,
        paddingRight: style.paddingRight
      };
    });
    console.log("320px SignIn password metrics:", JSON.stringify(passwordMetrics));
    assert.ok(
      passwordMetrics.placeholderWidth <= passwordMetrics.available,
      "the full password placeholder must fit beside the Show control: " + JSON.stringify(passwordMetrics)
    );
    assert.equal(await page.locator(".signin-field svg.icon-at-sign").count(), 1);
    assert.equal(await page.locator(".password-field svg.icon-lock").count(), 1);
    await assertNoHorizontalOverflow(page, "320px SignIn");
    await page.locator('[data-action="back-home"]').click();
    assert.equal(await page.locator("#view-dashboard").evaluate((node) => node.classList.contains("active")), true);
    assert.deepEqual(runtimeErrors, []);
  } finally {
    await context.close();
  }
});



test("desktop workspace sidebar exposes a named navigation landmark", async () => {
  const { context, page } = await openPage({ width: 1440, height: 900 });
  try {
    const navigation = page.getByRole("navigation", { name: "Workspace navigation" });
    assert.equal(await navigation.count(), 1, "workspace sidebar should expose one named navigation landmark");
    assert.equal(await navigation.getByRole("link").count(), 9, "workspace navigation should retain all nine links");
    assert.equal(await navigation.getByRole("link", { name: /Dashboard/ }).getAttribute("aria-current"), "page");
    assert.deepEqual(runtimeErrors, []);
  } finally {
    await context.close();
  }
});

test("all sidebar and top navigation destinations open their matching views", async () => {
  const { context, page } = await openPage({ width: 1440, height: 900 });
  try {
    const sidebarDestinations = ["dashboard", "health", "reports"];
    for (const destination of sidebarDestinations) {
      const link = page.locator('#workspaceSidebar [data-view="' + destination + '"]');
      assert.equal(await link.count(), 1, "expected one sidebar link for " + destination);
      await link.click();
      assert.equal(await page.locator(".view.active").count(), 1, "exactly one view should be active");
      assert.equal(await page.locator(".view.active").getAttribute("id"), "view-" + destination);
      assert.equal(await link.getAttribute("class").then((value) => value.includes("active")), true);
      assert.equal(await link.getAttribute("aria-current"), "page", "active sidebar link should expose aria-current");
      await assertNoHorizontalOverflow(page, destination + " view");
    }

    for (const destination of ["dashboard", "cyborgs", "aliens", "salary", "calendar"]) {
      await page.locator('.topnav [data-view="' + destination + '"]').click();
      assert.equal(await page.locator(".view.active").getAttribute("id"), "view-" + destination);
      assert.equal(await page.locator('.topnav [data-view="' + destination + '"]').getAttribute("aria-current"), "page", "active top navigation item should expose aria-current");
    }
    assert.deepEqual(runtimeErrors, []);
  } finally {
    await context.close();
  }
});

test("visible controls have accessible names and reduced motion is respected", async () => {
  const { context, page } = await openPage({ width: 390, height: 844 });
  try {
    await assertVisibleControlsHaveNames(page, "mobile dashboard");
    const motion = await page.locator(".metric").first().evaluate((element) => ({
      transition: getComputedStyle(element).transitionDuration,
      animation: getComputedStyle(document.querySelector(".view.active")).animationName
    }));
    assert.equal(motion.transition, "0s", "reduced-motion preference should disable transitions");
    assert.equal(motion.animation, "none", "reduced-motion preference should disable page animations");

    await page.locator('.mobile-bottom [data-action="launcher"]').click();
    await assertVisibleControlsHaveNames(page, "mobile launcher");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#launcher").getAttribute("aria-hidden"), "true");

    await page.locator(".mobile-brand [data-action='profile']").click();
    await page.locator("#profilePop.show").waitFor();
    await assertVisibleControlsHaveNames(page, "mobile profile popover");
    await page.locator('#profilePop [data-action="signout"]').click();
    await page.locator("#signin.show").waitFor();
    await assertVisibleControlsHaveNames(page, "mobile SignIn");
    assert.deepEqual(runtimeErrors, []);
  } finally {
    await context.close();
  }
});

test("mobile header, brand hierarchy and primary navigation fit common phone widths", async (t) => {
  for (const width of [320, 360, 375, 414, 430]) {
    await t.test(width + "px mobile shell", async () => {
      const { context, page } = await openPage({ width, height: 844 });
      try {
        const header = page.locator(".mobile-brand");
        const nav = page.locator(".mobile-bottom");
        assert.equal(await header.isVisible(), true);
        assert.equal(await nav.isVisible(), true);
        assert.match(await header.textContent(), /TelcoNet/);
        assert.match(await header.textContent(), /ALIENS COMPANY/);
        assert.equal(await header.locator("button").count(), 3);
        assert.equal(await header.locator('[data-action="theme"]').getAttribute("aria-label"), "Switch to light theme");
        assert.equal(await header.locator('[data-action="focus-menu-search"]').getAttribute("aria-label"), "Search apps");
        assert.equal(await header.locator('[data-action="profile"]').getAttribute("aria-label"), "Open profile");
        assert.equal(await nav.locator("button").count(), 4);
        assert.equal(await nav.locator('[data-view="dashboard"]').getAttribute("aria-current"), "page", "mobile dashboard should expose the current page");

        const geometry = await page.evaluate(() => {
          const headerRect = document.querySelector(".mobile-brand").getBoundingClientRect();
          const navRect = document.querySelector(".mobile-bottom").getBoundingClientRect();
          const mainStyle = getComputedStyle(document.querySelector("#mainContent"));
          return {
            viewportWidth: document.documentElement.clientWidth,
            viewportHeight: document.documentElement.clientHeight,
            header: { left: headerRect.left, right: headerRect.right, top: headerRect.top, bottom: headerRect.bottom },
            nav: { left: navRect.left, right: navRect.right, top: navRect.top, bottom: navRect.bottom, height: navRect.height },
            mainPaddingBottom: parseFloat(mainStyle.paddingBottom)
          };
        });
        assert.ok(geometry.header.left >= 0 && geometry.header.right <= width + 1, "mobile header must stay within the viewport");
        assert.ok(geometry.header.top >= 0 && geometry.header.bottom < geometry.nav.top, "header and bottom navigation must not overlap");
        assert.ok(geometry.nav.left >= 0 && geometry.nav.right <= width + 1, "bottom navigation must stay within the viewport");
        assert.ok(geometry.nav.bottom <= geometry.viewportHeight + 1, "bottom navigation must respect the viewport and safe area");
        assert.ok(geometry.mainPaddingBottom >= geometry.nav.height + 20, "main content must reserve room above the bottom navigation");
        await assertNoHorizontalOverflow(page, width + "px mobile shell");

        if (width === 360) await capture(page, "mobile-dashboard-360-dark.png");
        await header.locator('[data-action="theme"]').click();
        assert.equal(await page.locator("body").evaluate((body) => body.classList.contains("light")), true);
        assert.equal(await header.locator('[data-action="theme"]').getAttribute("aria-pressed"), "true");
        if (width === 360) await capture(page, "mobile-dashboard-360-light.png");

        await header.locator('[data-action="focus-menu-search"]').click();
        await page.locator("#launcher.show.searching").waitFor();
        assert.equal(await page.evaluate(() => document.activeElement?.id), "assistantSearch");
        assert.equal(await page.locator("#assistantResults").isVisible(), true);
        assert.match(await page.locator("#assistantResults").textContent(), /Ready/);
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => !document.querySelector("#launcher")?.classList.contains("searching"));
        assert.equal(await page.locator("#launcher").getAttribute("aria-hidden"), "false");
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("#launcher").getAttribute("aria-hidden"), "true");
        assert.deepEqual(runtimeErrors, []);
      } finally {
        await context.close();
      }
    });
  }
});

test("desktop and mobile search fields show a visible ring when focused", async () => {
  const desktop = await openPage({ width: 1440, height: 900 });
  try {
    await desktop.page.locator("#searchDesktop").focus();
    const state = await desktop.page.locator(".search").evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        focused: element.contains(document.activeElement),
        borderColor: style.borderTopColor,
        boxShadow: style.boxShadow
      };
    });
    assert.equal(state.focused, true, "desktop search input should receive focus");
    assert.notEqual(state.boxShadow, "none", "desktop search wrapper should show a focus ring");
    assert.match(state.boxShadow, /0px 0px 0px 3px/, "desktop search focus ring should be three pixels");
    await capture(desktop.page, "desktop-search-keyboard-focus.png");
  } finally {
    await desktop.context.close();
  }

  const mobile = await openPage({ width: 390, height: 844 });
  try {
    await mobile.page.locator(".mobile-brand [data-action='theme']").click();
    assert.equal(await mobile.page.locator("body").evaluate((body) => body.classList.contains("light")), true);
    await mobile.page.locator('.mobile-bottom [data-action="launcher"]').click();
    await mobile.page.keyboard.press("Tab");
    assert.equal(await mobile.page.evaluate(() => document.activeElement?.id), "assistantSearch");
    const state = await mobile.page.locator(".assistant-search").evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        focused: element.contains(document.activeElement),
        focusVisible: document.activeElement.matches(":focus-visible"),
        borderColor: style.borderTopColor,
        boxShadow: style.boxShadow
      };
    });
    assert.equal(state.focused, true, "Ask Cyborg search input should receive keyboard focus");
    assert.equal(state.focusVisible, true, "Ask Cyborg search input should expose keyboard modality");
    assert.notEqual(state.boxShadow, "none", "Ask Cyborg search wrapper should show a focus ring");
    assert.match(state.boxShadow, /0px 0px 0px 3px/, "Ask Cyborg search focus ring should be three pixels");
    await assertNoHorizontalOverflow(mobile.page, "390px focused Ask Cyborg search");
    await capture(mobile.page, "mobile-ask-cyborg-keyboard-focus.png");
    assert.deepEqual(runtimeErrors, []);
  } finally {
    await mobile.context.close();
  }
});


test("keyboard skip link moves focus directly to main content on desktop and mobile", async () => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const { context, page } = await openPage(viewport);
    try {
      await page.keyboard.press("Tab");
      assert.equal(
        await page.locator(".skip-link").evaluate((element) => element === document.activeElement),
        true,
        viewport.width + "px: the first Tab stop should be Skip to main content"
      );
      const skipBounds = await page.locator(".skip-link").boundingBox();
      assert.ok(skipBounds && skipBounds.y >= 0 && skipBounds.y < 80,
        viewport.width + "px: focused skip link should be visible near the top edge");
      if (viewport.width === 390) await capture(page, "mobile-skip-link-focused.png");
      await page.keyboard.press("Enter");
      assert.equal(await page.evaluate(() => document.activeElement?.id), "mainContent",
        viewport.width + "px: activating the skip link should focus main content");
      assert.equal(await page.evaluate(() => location.hash), "#mainContent");
      await assertNoHorizontalOverflow(page, viewport.width + "px skip navigation");
      assert.deepEqual(runtimeErrors, []);
    } finally {
      await context.close();
    }
  }
});


test("desktop and mobile disclosure triggers expose their controlled regions", async () => {
  const desktop = await openPage({ width: 1440, height: 900 });
  try {
    const launcherTrigger = desktop.page.locator('.rail [data-action="launcher"]');
    assert.equal(await launcherTrigger.getAttribute("aria-controls"), "launcher");
    assert.equal(await launcherTrigger.getAttribute("aria-expanded"), "false");
    await launcherTrigger.click();
    await desktop.page.locator("#launcher.show").waitFor();
    assert.equal(await launcherTrigger.getAttribute("aria-expanded"), "true",
      "desktop rail launcher must expose its expanded state");
    assert.equal(await desktop.page.locator("#assistantResults").getAttribute("role"), "region");
    assert.equal(await desktop.page.getByRole("region", { name: "Cyborg search results" }).count(), 1);

    await desktop.page.keyboard.press("Escape");
    await desktop.page.waitForFunction(() =>
      document.querySelector('.rail [data-action="launcher"]')?.getAttribute("aria-expanded") === "false"
    );

    const profileTrigger = desktop.page.locator('.topbar [data-action="profile"]');
    assert.equal(await profileTrigger.getAttribute("aria-controls"), "profilePop");
    assert.equal(await profileTrigger.getAttribute("aria-expanded"), "false");
    await profileTrigger.click();
    await desktop.page.locator("#profilePop.show").waitFor();
    assert.equal(await profileTrigger.getAttribute("aria-expanded"), "true");
    await desktop.page.locator('#profilePop [data-action="close-pop"]').click();
    await desktop.page.waitForFunction(() =>
      document.querySelector('.topbar [data-action="profile"]')?.getAttribute("aria-expanded") === "false"
    );
    assert.deepEqual(runtimeErrors, []);
  } finally {
    await desktop.context.close();
  }

  const mobile = await openPage({ width: 390, height: 844 });
  try {
    const searchTrigger = mobile.page.locator('.mobile-brand [data-action="focus-menu-search"]');
    assert.equal(await searchTrigger.getAttribute("aria-controls"), "launcher");
    assert.equal(await searchTrigger.getAttribute("aria-expanded"), "false");
    await searchTrigger.click();
    await mobile.page.locator("#launcher.show.searching").waitFor();
    assert.equal(await searchTrigger.getAttribute("aria-expanded"), "true");
    assert.equal(await mobile.page.locator("#assistantSearch").getAttribute("aria-controls"), "assistantResults");

    const searchButton = mobile.page.locator('.assistant-search [data-action="assistant-search"]');
    assert.equal(await searchButton.getAttribute("aria-controls"), "assistantResults");
    assert.equal(await searchButton.getAttribute("aria-expanded"), "true");
    await mobile.page.locator("#assistantSearch").fill("zz");
    assert.match(await mobile.page.getByRole("region", { name: "Cyborg search results" }).textContent(),
      /No local destination; Cyborg is not connected/);
    assert.equal(await mobile.page.locator("#assistantResults").getAttribute("aria-live"), "polite");
    await mobile.page.keyboard.press("Escape");
    await mobile.page.keyboard.press("Escape");
    await mobile.page.keyboard.press("Escape");
    await mobile.page.waitForFunction(() =>
      document.querySelector('.mobile-brand [data-action="focus-menu-search"]')?.getAttribute("aria-expanded") === "false"
    );
    assert.deepEqual(runtimeErrors, []);
  } finally {
    await mobile.context.close();
  }
});
