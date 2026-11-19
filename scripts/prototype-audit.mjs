import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Script } from "node:vm";
import test from "node:test";

const [html, css, appScript] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../telconet-ui.css", import.meta.url), "utf8"),
  readFile(new URL("../telconet-ui.js", import.meta.url), "utf8")
]);

const inlineScripts = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .filter((source) => source.trim());

test("inline and external JavaScript parse", () => {
  assert.ok(inlineScripts.length > 0, "expected an inline dashboard script");
  inlineScripts.forEach((source, index) => new Script(source, { filename: "index.html:inline-" + (index + 1) }));
  new Script(appScript, { filename: "telconet-ui.js" });
});

test("the compact launcher and full Score Menu retain their reference counts", () => {
  const gridItems = [...html.matchAll(/class="app-tile"/g)];
  const menuItems = [...html.matchAll(/<button class="menu-list-item"[^>]*data-app-name="([^"]+)"/g)]
    .map((match) => match[1]);
  const groups = [...html.matchAll(/class="list-letter"[^>]*>([^<]+)<\/div>/g)]
    .map((match) => match[1]);

  assert.equal(gridItems.length, 26, "full Aliens Apps grid must contain 26 entries");
  assert.equal(menuItems.length, 39, "Score Menu must contain 39 entries");
  assert.equal(new Set(menuItems).size, 39, "Score Menu labels must be unique");
  assert.ok(groups.length > 0, "Score Menu must have alphabetical group headings");
  assert.deepEqual(groups, [...groups].sort(), "Score Menu groups must be alphabetical");
  assert.equal(new Set(groups).size, groups.length, "Score Menu group headings must be unique");
  assert.match(css, /\.launcher-grid \.app-tile:nth-child\(n\+9\)\{display:none!important\}/);
  assert.match(css, /\.launcher\.all-apps \.launcher-grid \.app-tile:nth-child\(n\+9\)\{display:flex!important\}/);
});

test("every navigation destination has a real prototype view", () => {
  const destinations = [...new Set([...html.matchAll(/data-view="([^"]+)"/g)].map((match) => match[1]))];
  destinations.forEach((destination) => {
    assert.ok(html.includes('id="view-' + destination + '"'), "missing view target: " + destination);
  });
});

test("every declared action has a handler and toast placeholders explain their state", () => {
  const actions = [...new Set([...html.matchAll(/data-action="([^"]+)"/g)].map((match) => match[1]))];
  const handled = new Set([
    "profile", "close-pop", "theme", "collapse", "toast", "signout", "back-home", "chart-range",
    "launcher", "focus-menu-search", "close-launcher", "more-apps", "back-to-menu", "app-mode",
    "assistant-search", "clear-search", "send-to-cyborg", "password-visibility"
  ]);
  actions.forEach((action) => assert.ok(handled.has(action), "unhandled action: " + action));

  const toastControls = [...html.matchAll(/<[^>]*data-action="toast"[^>]*>/g)].map((match) => match[0]);
  assert.ok(toastControls.length > 0);
  toastControls.forEach((tag) => assert.match(tag, /data-message="[^"]+"/, "toast action needs a clear message"));
});

test("all referenced SVG icons exist in the local icon map", () => {
  const map = html.match(/const ICONS=\{([\s\S]*?)\n \};/);
  assert.ok(map, "missing local SVG icon map");
  const defined = new Set([...map[1].matchAll(/^\s*"([^"]+)":/gm)].map((match) => match[1]));
  const used = new Set([...html.matchAll(/data-lucide="([^"]+)"/g)].map((match) => match[1]));
  used.forEach((name) => assert.ok(defined.has(name), "missing icon definition: " + name));
});

test("theme, menu and profile controls keep keyboard and dialog affordances", () => {
  assert.match(html, /role="dialog" aria-modal="true"/);
  assert.match(appScript, /function trapTab/);
  assert.match(appScript, /function focusable/);
  assert.match(appScript, /menuReturnFocus/);
  assert.match(appScript, /profileReturnFocus/);
  assert.match(css, /body\.menu-open/);
  assert.match(appScript, /aria-expanded/);
});

test("desktop search, chart ranges and selector collections are safe", () => {
  assert.match(html, /Type a destination to search/);
  assert.match(html, /chartSamples=\{/);
  assert.match(html, /drawChart\(\[7,30,90\]\.includes\(range\)\?range:30\)/);
  assert.doesNotMatch(html, /(?<!\$)\$\(['"][^'"]+['"]\)\.forEach/, "single-node querySelector must not be used as a collection");
  assert.match(html, /\$\$\('\.view'\)\.forEach/);
  assert.match(html, /\$\$\('\[data-view\]'\)\.forEach/);
  assert.match(html, /\$\$\('\[data-lang\]'\)\.forEach/);
});

test("product, company, switcher and prototype SignIn labels stay distinct", () => {
  assert.match(html, /<title>TelcoNet — Network Operations Workspace \| ALIENS COMPANY<\/title>/);
  assert.match(html, /TelcoNet<small>ALIENS COMPANY<\/small>/);
  assert.match(html, /<strong>Aliens TelcoNet<\/strong>/);
  assert.match(html, /<b>TelcoNet<\/b><small style="display:block;color:#999;font-size:11px">ALIENS COMPANY<\/small>/);
  assert.match(html, /placeholder="Search TelcoNet"/);
  assert.match(html, /Do not enter real credentials\. Nothing is sent or stored\./);
  assert.match(html, /autocomplete="off"/);
  assert.match(html, /autocomplete="new-password"/);
  assert.doesNotMatch(html, /Knowledge space selected|No new notifications/);
  assert.match(html, /Notifications are not connected in this prototype\./);
});

test("responsive rules include phone columns, safe areas and compact desktop breakpoints", () => {
  assert.match(css, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /safe-area-inset-top/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /max-width:1500px/);
  assert.match(css, /max-width:920px/);
  assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length, "CSS braces must balance");
});

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
test("HTML IDs remain unique", () => {
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  assert.deepEqual(duplicates, []);
});
