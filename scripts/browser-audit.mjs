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
    await capture(page, "desktop-profile-popover.png");
    await page.locator('#profilePop [data-lang="EN"]').click();
    assert.equal(await page.locator('#profilePop [data-lang="EN"]').getAttribute("aria-pressed"), "true");
    assert.match(await page.locator("#toast").textContent(), /Language switching is not connected/);
    await page.locator('#profilePop [data-lang="HL"]').click();
    assert.equal(await page.locator('#profilePop [data-lang="HL"]').getAttribute("aria-pressed"), "true");
    await page.locator('#profilePop [data-action="signout"]').click();
    await page.locator("#signin.show").waitFor();
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

    const footer = page.locator(".launcher-footer");
    assert.equal(await footer.isVisible(), true);
    const footerBottom = await footer.evaluate((node) => node.getBoundingClientRect().bottom);
    assert.ok(footerBottom <= 844, "launcher footer must remain inside the phone viewport");
    await assertNoHorizontalOverflow(page, "390px Score Menu");

    await page.locator("#assistantSearch").fill("Calendar");
    await capture(page, "mobile-search-local-match.png");
    assert.equal(await page.locator("#assistantResults").isVisible(), true);
    assert.equal(await page.locator(".assistant-result").count(), 1);
    await page.locator(".assistant-result").first().click();
    assert.equal(await page.locator("#view-calendar").evaluate((node) => node.classList.contains("active")), true);
    assert.equal(await page.locator("#launcher").getAttribute("aria-hidden"), "true");

    await page.locator('.mobile-bottom [data-action="launcher"]').click();
    await page.locator("#assistantSearch").fill("not-a-real-destination");
    await capture(page, "mobile-search-no-local-destination.png");
    assert.match(await page.locator("#assistantResults").textContent(), /No local destination/);
    await page.locator('[data-action="send-to-cyborg"]').click();
    assert.match(await page.locator("#toast").textContent(), /not connected/);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#launcher").getAttribute("aria-hidden"), "true");
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
    const passwordMetrics = await page.locator("#password").evaluate((input) => {
      const style = getComputedStyle(input);
      const available = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      context.font = style.font;
      return { available, placeholderWidth: context.measureText(input.placeholder).width };
    });
    assert.ok(passwordMetrics.available >= 130, "narrow SignIn password field must leave readable placeholder space");
    assert.ok(passwordMetrics.placeholderWidth <= passwordMetrics.available, "the full password placeholder must fit beside the Show control");
    await page.waitForFunction(() => document.activeElement?.id === "email");
    await capture(page, "mobile-signin-prototype.png");
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
