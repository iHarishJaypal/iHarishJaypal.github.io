import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
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

before(async () => {
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
    await page.locator('[data-action="chart-range"][data-range="7"]').click();
    assert.equal(await page.locator(".chart").getAttribute("data-sample-range"), "7");
    assert.equal(await page.locator('[data-action="chart-range"][data-range="7"]').getAttribute("aria-pressed"), "true");

    await page.locator('[data-action="chart-range"][data-range="90"]').click();
    assert.equal(await page.locator(".chart").getAttribute("data-sample-range"), "90");

    await page.locator(".dock-theme").click();
    assert.equal(await page.locator("body").evaluate((body) => body.classList.contains("light")), true);
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

    await page.locator(".avatar-btn").click();
    await page.locator("#profilePop.show").waitFor();
    await page.locator('#profilePop [data-action="signout"]').click();
    await page.locator("#signin.show").waitFor();
    assert.match(await page.locator(".signin-note").textContent(), /Do not enter real credentials/);

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
    assert.match(await page.locator("#toast").textContent(), /Demo only/);
    await page.locator('[data-action="back-home"]').click();
    assert.equal(await page.locator("#view-dashboard").evaluate((node) => node.classList.contains("active")), true);
    assert.deepEqual(runtimeErrors, []);
  } finally {
    await context.close();
  }
});

test("mobile menu matches the 8-app preview, 26-app grid and 39-entry Score Menu flow", async () => {
  const { context, page } = await openPage({ width: 390, height: 844 });
  try {
    assert.equal(await page.locator(".mobile-brand").isVisible(), true);
    assert.equal(await page.locator(".mobile-bottom").isVisible(), true);
    await assertNoHorizontalOverflow(page, "390px dashboard");

    await page.locator('.mobile-bottom [data-action="launcher"]').click();
    await page.locator("#launcher.show").waitFor();
    assert.equal(await page.locator("#launcher").getAttribute("aria-hidden"), "false");
    assert.equal(await visibleCount(page.locator("#appGrid .app-tile")), 8);
    assert.equal(await page.locator("#appGrid .app-tile").count(), 26);

    await page.locator('[data-action="more-apps"]').click();
    assert.equal(await visibleCount(page.locator("#appGrid .app-tile")), 26);
    assert.equal(await page.locator("#launcher").evaluate((node) => node.classList.contains("all-apps")), true);
    await assertNoHorizontalOverflow(page, "390px full app grid");

    await page.locator('[data-action="back-to-menu"]').click();
    await page.locator('[data-action="app-mode"][data-mode="list"]').click();
    assert.equal(await visibleCount(page.locator("#appList .menu-list-item")), 39);
    assert.equal(await page.locator("#appGrid").isVisible(), false);

    const content = page.locator("#launcherContent");
    const scrollMetrics = await content.evaluate((node) => ({
      clientHeight: node.clientHeight,
      scrollHeight: node.scrollHeight
    }));
    assert.ok(scrollMetrics.scrollHeight > scrollMetrics.clientHeight, "39-item list should scroll inside the launcher");
    await content.evaluate((node) => { node.scrollTop = node.scrollHeight; });
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
    assert.equal(await page.locator("#assistantResults").isVisible(), true);
    assert.equal(await page.locator(".assistant-result").count(), 1);
    await page.locator(".assistant-result").first().click();
    assert.equal(await page.locator("#view-calendar").evaluate((node) => node.classList.contains("active")), true);
    assert.equal(await page.locator("#launcher").getAttribute("aria-hidden"), "true");

    await page.locator('.mobile-bottom [data-action="launcher"]').click();
    await page.locator("#assistantSearch").fill("not-a-real-destination");
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
    assert.deepEqual(runtimeErrors, []);
  } finally {
    await context.close();
  }
});
