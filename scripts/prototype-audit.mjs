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
  assert.deepEqual(menuItems, [...menuItems].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })), "Score Menu labels must be alphabetically ordered");
  const listStart = html.indexOf('<div class="launcher-list" id="appList"');
  const listEnd = html.indexOf('<p class="launcher-empty"', listStart);
  const listMarkup = html.slice(listStart, listEnd);
  const listTokens = [...listMarkup.matchAll(/<div class="list-letter" data-list-group="([^"]+)">([^<]+)<\/div>|<button class="menu-list-item"[^>]*data-app-name="([^"]+)"/g)];
  let currentGroup = "";
  const groupedLabels = [];
  listTokens.forEach((token) => {
    if (token[1]) currentGroup = token[1];
    else {
      assert.equal(token[3][0].toUpperCase(), currentGroup, "menu item must be in its matching initial group: " + token[3]);
      groupedLabels.push(token[3]);
    }
  });
  assert.deepEqual(groupedLabels, menuItems, "alphabetical group headings must contain the expected entries in order");
  assert.ok(groups.length > 0, "Score Menu must have alphabetical group headings");
  assert.deepEqual(groups, [...groups].sort(), "Score Menu groups must be alphabetical");
  assert.equal(new Set(groups).size, groups.length, "Score Menu group headings must be unique");
  assert.match(css, /\.launcher-grid \.app-tile:nth-child\(n\+9\)\{display:none!important\}/);
  assert.match(css, /\.launcher\.all-apps \.launcher-grid \.app-tile:nth-child\(n\+9\)\{display:flex!important\}/);
});

test("compact mobile launcher uses one separator between app preview and Score Menu", () => {
  assert.match(css, /\.launcher:not\(\.list-mode\):not\(\.all-apps\):not\(\.searching\) #appGrid\{[^}]*border-bottom:1px solid var\(--line\)/);
  assert.doesNotMatch(css, /\.launcher:not\(\.list-mode\):not\(\.all-apps\):not\(\.searching\) \.score-menu-head\{[^}]*border-top:/);
});


test("active navigation exposes the current destination to assistive technology", () => {
  assert.match(html, /class="rail-btn active dock-workspace"[^>]*aria-current="page"/);
  assert.match(html, /class="side-link active"[^>]*aria-current="page"/);
  assert.match(html, /class="active" data-view="dashboard" aria-current="page"/);
  assert.match(html, /setAttribute\('aria-current','page'\)/);
  assert.match(html, /removeAttribute\('aria-current'\)/);
  assert.match(html, /\$\$\('\[data-view\]'\)\.forEach/);
  const mobileNavStart = html.indexOf('<nav class="mobile-bottom"');
  const mobileNavEnd = html.indexOf("</nav>", mobileNavStart);
  assert.match(html.slice(mobileNavStart, mobileNavEnd), /data-view="dashboard" aria-current="page"/);
});

test("desktop workspace links use a named navigation landmark", () => {
  const navStart = html.indexOf('<nav class="side-scroll" aria-label="Workspace navigation">');
  assert.ok(navStart >= 0, "workspace links must be inside a named navigation landmark");
  const navEnd = html.indexOf("</nav>", navStart);
  assert.ok(navEnd > navStart, "workspace navigation landmark must close");
  const navMarkup = html.slice(navStart, navEnd);
  assert.equal((navMarkup.match(/class="side-link/g) || []).length, 9,
    "workspace navigation should retain all nine reference links");
  assert.match(navMarkup, /aria-current="page"/,
    "workspace navigation should expose the current destination");
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
    "assistant-search", "clear-search", "password-visibility"
  ]);
  actions.forEach((action) => assert.ok(handled.has(action), "unhandled action: " + action));

  const toastControls = [...html.matchAll(/<[^>]*data-action="toast"[^>]*>/g)].map((match) => match[0]);
  assert.ok(toastControls.length > 0);
  toastControls.forEach((tag) => assert.match(tag, /data-message="[^"]+"/, "toast action needs a clear message"));
});

test("every declared data-action has a real delegated handler", () => {
  const handlerCases = new Set(
    [...inlineScripts, appScript].flatMap((source) =>
      [...source.matchAll(/case\s*["']([^"']+)["']\s*:/g)].map((match) => match[1])
    )
  );
  const declaredActions = [...new Set(
    [...html.matchAll(/data-action="([^"]+)"/g)].map((match) => match[1])
  )];

  declaredActions.forEach((action) => {
    assert.ok(handlerCases.has(action), "data-action has no switch handler: " + action);
  });
  assert.match(html, /\$\$\('\[data-lang\]'\)\.forEach/, "language preview buttons must keep their explicit click handler");
});

test("all referenced SVG icons exist in the local icon map", () => {
  const map = html.match(/const ICONS=\{([\s\S]*?)\n \};/);
  assert.ok(map, "missing local SVG icon map");
  const defined = new Set([...map[1].matchAll(/^\s*"([^"]+)":/gm)].map((match) => match[1]));
  const used = new Set([...html.matchAll(/data-lucide="([^"]+)"/g)].map((match) => match[1]));
  used.forEach((name) => assert.ok(defined.has(name), "missing icon definition: " + name));
});

test("company switcher and account popover follow the reference naming hierarchy", () => {
  const profileStart = html.indexOf('<aside class="profile-pop"');
  const profileEnd = html.indexOf("</aside>", profileStart);
  assert.ok(profileStart >= 0 && profileEnd > profileStart, "profile popover markup must exist");
  const profile = html.slice(profileStart, profileEnd);
  assert.ok(html.includes('<small>ALIENS COMPANY</small><strong>Aliens TelcoNet</strong>'), "company switcher must expose ALIENS COMPANY and retain Aliens TelcoNet");
  assert.ok(profile.includes("Hi, Aliens!"), "account greeting must match the supplied reference");
  assert.doesNotMatch(profile, /Aliens TelcoNet workspace/, "profile popover must not add an unreferenced workspace subtitle");
  assert.match(css, /@media\(min-width:851px\)\{\.profile-pop\{min-height:460px\}\}/);
});

test("mobile Ask Cyborg and footer icons match the supplied menu reference", () => {
  assert.ok(html.includes('class="assistant-bot" aria-hidden="true"><i data-lucide="bot"></i></span>'));
  assert.ok(html.includes('<i data-lucide="send"></i></button>'));
  assert.ok(html.includes('class="launcher-power" data-action="signout" aria-label="Sign out"><i data-lucide="power"></i></button>'));
});

test("Ask Cyborg mirrors the recorded app-search result states", () => {
  assert.ok(appScript.includes('collect(".app-tile", appGrid, "app");'));
  assert.doesNotMatch(appScript, /collect\("\.menu-list-item"/);
  assert.match(appScript, /const searchText = \[name, element\.dataset\.searchTerms \|\| ""\]/);
  assert.match(appScript, /\$\$\(selector, root \|\| document\)\.forEach/);
  assert.doesNotMatch(appScript, /(?<!\$)\$\([^)]*\)\.forEach/);
  assert.match(appScript, /item\.searchText\.includes\(query\)/);
  assert.match(html, /data-app-subtitle="Aliens App" data-search-terms="Aliens App organization business"/);
  assert.match(appScript, /No local destination; Cyborg is not connected\./);
  assert.doesNotMatch(appScript, /send-to-cyborg|assistant-results-head|assistant-no-match/);
  assert.match(css, /@media\(max-width:850px\)\{[\s\S]*?\.assistant-ready\{[^}]*border-bottom:1px solid var\(--line\)/);
});

test("theme, menu and profile controls keep keyboard and dialog affordances", () => {
  assert.match(html, /role="dialog" aria-modal="true"/);
  assert.match(appScript, /function trapTab/);
  assert.match(appScript, /function focusable/);
  assert.match(appScript, /const searchButton = \$\('\.assistant-search \[data-action="assistant-search"\]'\)/);
  assert.match(appScript, /searchButton\.setAttribute\("aria-expanded"/);
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

test("activity chart renders day-axis ticks and aligns normalized bars with the sample scale", () => {
  assert.ok(html.includes('<g id="chartXAxis" aria-hidden="true"></g>'));
  assert.ok(html.includes("const plotLeft=35,plotWidth=955,baseline=220,scale=1.95;"));
  assert.ok(html.includes("const dayTicks=range===7?[1,2,3,4,5,6,7]:range===30?[1,5,10,15,20,25,30]:[1,15,30,45,60,75,90];"));
  assert.ok(html.includes("padStart(2,"));
  assert.ok(html.includes("Illustrative sample activity index:"));
  assert.ok(css.includes(".chart .axis-label{font-size:8px"));
});

test("product, company, switcher and prototype SignIn labels stay distinct", () => {
  assert.match(html, /<title>TelcoNet — Network Operations Workspace \| ALIENS COMPANY<\/title>/);
  assert.match(html, /TelcoNet<small>ALIENS COMPANY<\/small>/);
  assert.match(html, /<strong>Aliens TelcoNet<\/strong>/);
  assert.match(html, /<b>TelcoNet<\/b><small class="brand-company">ALIENS COMPANY<\/small>/);
  assert.match(html, /placeholder="Search Aliens TelcoNet"/);
  assert.match(html, /Do not enter real credentials\. Nothing is sent or stored\./);
  assert.match(html, /<h2>Sign in<\/h2>/);
  assert.match(html, /Use your work email and password\./);
  assert.match(html, /<label for="email">Email<\/label>/);
  assert.match(html, /id="email" type="email" placeholder="you@company\.com"/);
  assert.match(html, /data-action="password-visibility"/);
  assert.doesNotMatch(html, /Forgot Password\?|Keep me signed in|Continue with Google|Create an account/);
  assert.match(css, /body\.light \.wordmark/);
  assert.match(css, /#appList \.menu-list-item:not\(\[data-app-name="Dashboard"\]\)/);
  assert.match(html, /autocomplete="off"/);
  assert.match(html, /autocomplete="new-password"/);
  assert.doesNotMatch(html, /Knowledge space selected|No new notifications/);
  assert.match(html, /Notifications are not connected in this prototype\./);
  assert.match(html, /Language switching is not connected in this prototype\. Selected preview:/);
  assert.match(html, /class="lang-options" role="group" aria-label="Language preview"/);
  assert.match(html, /class="updated" title="Static sample data; live refresh is not connected\." aria-label="Demo snapshot"/);
  assert.match(html, /demo credentials cleared; no sign-in request was sent/);
  assert.match(html, /if\(email\)email\.value='';/);
  assert.match(html, /if\(password\)\{password\.value='';password\.type='password';\}/);
});

test("responsive rules include phone columns, safe areas and compact desktop breakpoints", () => {
  assert.match(css, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /safe-area-inset-top/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /body\.light \.rail\{background:#ebf7fd/);
  assert.match(css, /max-width:1500px/);
  assert.match(css, /max-width:920px/);
  assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length, "CSS braces must balance");
});

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
test("HTML IDs remain unique", () => {
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  assert.deepEqual(duplicates, []);
});



test("mobile header and primary navigation preserve TelcoNet identity and controls", () => {
  const headerStart = html.indexOf('<header class="mobile-brand"');
  const headerEnd = html.indexOf("</header>", headerStart);
  const navStart = html.indexOf('<nav class="mobile-bottom"');
  const navEnd = html.indexOf("</nav>", navStart);
  const mobileHeader = headerStart >= 0 && headerEnd >= 0 ? html.slice(headerStart, headerEnd + 9) : "";
  const mobileNav = navStart >= 0 && navEnd >= 0 ? html.slice(navStart, navEnd + 6) : "";

  assert.ok(mobileHeader, "expected the compact mobile header");
  assert.match(mobileHeader, /TelcoNet/);
  assert.match(mobileHeader, /ALIENS COMPANY/);
  assert.match(mobileHeader, /data-action="theme"/);
  assert.match(mobileHeader, /data-action="focus-menu-search"/);
  assert.match(mobileHeader, /data-action="profile"/);
  assert.equal((mobileHeader.match(/<button\b/g) || []).length, 3, "mobile header should expose theme, search and account controls");

  assert.ok(mobileNav, "expected the primary mobile navigation");
  assert.equal((mobileNav.match(/<button\b/g) || []).length, 4, "mobile navigation should contain Menu, Dashboard, Aliens and Health");
  assert.match(mobileNav, /data-action="launcher"/);
  ["dashboard", "aliens", "health"].forEach((view) => {
    assert.ok(mobileNav.includes('data-view="' + view + '"'), "missing mobile navigation view: " + view);
  });
  assert.match(css, /safe-area-inset-top/);
  assert.match(css, /safe-area-inset-bottom/);
});

 
test("browser chrome theme color follows the active dashboard and SignIn surface", () => {
  assert.match(html, /<meta name="theme-color" content="#08090d">/);
  const syncStart = html.indexOf("function syncThemeColor()");
  const controlsStart = html.indexOf("function syncThemeControls()");
  const toggleStart = html.indexOf("function toggleTheme()");
  const signinStart = html.indexOf("function showSignin()");
  const backHomeStart = html.indexOf("function backHome()");
  const showLauncherStart = html.indexOf("function showLauncher()");
  assert.ok(syncStart >= 0 && controlsStart > syncStart && toggleStart > controlsStart);
  assert.match(html.slice(syncStart, controlsStart), /meta\[name="theme-color"\]/);
  assert.match(html.slice(syncStart, controlsStart), /signinVisible\?'#07080b'/);
  assert.match(html.slice(syncStart, controlsStart), /classList\.contains\('light'\)\?'#e8f4ff':'#08090d'/);
  assert.match(html.slice(controlsStart, toggleStart), /\$\$\('\[data-action="theme"\]'\)\.forEach/);
  assert.match(html.slice(controlsStart, toggleStart), /syncThemeColor\(\)/);
  assert.match(html.slice(signinStart, backHomeStart), /syncThemeColor\(\)/);
  assert.match(html.slice(backHomeStart, showLauncherStart), /syncThemeColor\(\)/);
});



test("muted theme text meets WCAG AA contrast on dashboard surfaces", () => {
  const tokenBlock = (selector) => {
    const match = html.match(new RegExp(selector + "\\s*\\{([^}]*)\\}"));
    assert.ok(match, "missing theme token block: " + selector);
    return match[1];
  };
  const token = (declarations, name) => {
    const match = declarations.match(new RegExp(name + "\\s*:\\s*(#(?:[0-9a-f]{6}|[0-9a-f]{3}))", "i"));
    assert.ok(match, "missing color token: " + name);
    return match[1];
  };
  const luminance = (hex) => {
    const normalized = hex.length === 4
      ? "#" + [...hex.slice(1)].map((channel) => channel + channel).join("")
      : hex;
    const channels = [1, 3, 5].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16) / 255);
    const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const contrast = (foreground, background) => {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  };
  const dark = tokenBlock(":root");
  const light = tokenBlock("body\\.light");
  const gradient = css.match(/body\.light\{background:linear-gradient\([^}]+\)\}/)?.[0] ?? "";
  const gradientStops = [...gradient.matchAll(/#[0-9a-f]{6}/gi)].map((match) => match[0]);
  assert.ok(gradientStops.length >= 3, "light workspace gradient stops must be available for contrast checks");
  const lightBackgrounds = [
    ...gradientStops,
    token(light, "--surface"),
    token(light, "--surface2"),
    token(light, "--surface3")
  ];
  const darkBackgrounds = [
    token(dark, "--bg"),
    token(dark, "--surface"),
    token(dark, "--surface2"),
    token(dark, "--surface3")
  ];
  const lightMuted = token(light, "--muted");
  const darkMuted = token(dark, "--muted");
  lightBackgrounds.forEach((background) => {
    assert.ok(contrast(lightMuted, background) >= 4.5,
      "light muted text must meet 4.5:1 contrast on " + background);
  });
  darkBackgrounds.forEach((background) => {
    assert.ok(contrast(darkMuted, background) >= 4.5,
      "dark muted text must meet 4.5:1 contrast on " + background);
  });
});

test("desktop and mobile search fields retain visible focus-within affordances", () => {
  const focusStart = css.indexOf(".search:focus-within,");
  assert.ok(focusStart >= 0, "desktop and mobile search wrappers must define a focus state");
  const focusStyles = css.slice(focusStart);
  assert.ok(focusStyles.includes("border-color: var(--blue);"), "focused search wrappers must use the active theme accent");
  assert.ok(focusStyles.includes("box-shadow: 0 0 0 3px color-mix(in srgb, var(--blue) 32%, transparent);"));
  assert.ok(focusStyles.includes("box-shadow: var(--shadow), 0 0 0 3px color-mix(in srgb, var(--blue) 32%, transparent);"));
});


test("keyboard skip link is first in the app shell and targets main content", () => {
  const skipMarkup = '<a class="skip-link" href="#mainContent">Skip to main content</a>';
  const appStart = html.indexOf('<div class="app" id="app">');
  const skipStart = html.indexOf(skipMarkup);
  const railStart = html.indexOf('<aside class="rail"');
  assert.ok(appStart >= 0 && skipStart > appStart && skipStart < railStart,
    "skip link must be the first app-shell control");
  assert.match(html, /<main class="main" id="mainContent" tabindex="-1">/);
  assert.match(css, /\.skip-link\s*\{[^}]*position:\s*fixed/);
  assert.match(css, /\.skip-link:focus\s*\{[^}]*transform:\s*translateY\(0\)/);
});


test("launcher, profile and Ask Cyborg triggers expose their controlled regions", () => {
  const buttonTags = html.match(/<button[^>]*>/g) || [];
  const checkTriggers = (action, target) => {
    const triggers = buttonTags.filter((tag) => tag.includes('data-action="' + action + '"'));
    assert.ok(triggers.length > 0, "expected " + action + " trigger");
    triggers.forEach((tag) => {
      assert.ok(tag.includes('aria-controls="' + target + '"'), action + " must identify its controlled region");
      assert.ok(tag.includes('aria-expanded="false"'), action + " must start collapsed");
    });
  };
  checkTriggers("launcher", "launcher");
  checkTriggers("focus-menu-search", "launcher");
  checkTriggers("profile", "profilePop");
  checkTriggers("assistant-search", "assistantResults");
  assert.match(html, /id="assistantSearch"[^>]*aria-controls="assistantResults"/);
  assert.match(html, /id="assistantResults" role="region" aria-label="Cyborg search results" aria-live="polite"/);
  const syncStart = appScript.indexOf("function syncLauncherState()");
  const syncEnd = appScript.indexOf("function openLauncher()", syncStart);
  const syncState = appScript.slice(syncStart, syncEnd);
  assert.doesNotMatch(appScript, /\$\$\$\(/, "selector helper must use exactly two dollar signs");
  assert.ok(syncState.includes("$(") && syncState.includes('data-action="launcher"') && syncState.includes("aria-expanded"),
    "all launcher triggers must receive the current expanded state");
});


test("buttons and navigation links define a theme-aware keyboard focus ring", () => {
  const rule = css.match(/button:focus-visible,\s*a:focus-visible\s*\{([^}]*)\}/);
  assert.ok(rule, "buttons and links must have an authored focus-visible rule");
  assert.match(rule[1], /outline:\s*2px solid var\(--blue\)/);
  assert.match(rule[1], /outline-offset:\s*2px/);
});


test("Ask Cyborg local results preserve source app icon tones and concise accessible names", () => {
  assert.ok(appScript.includes('const iconTone = Array.from(iconElement?.classList || []).find((className) => className.startsWith("tone-")) || "";'));
  assert.ok(appScript.includes('button.setAttribute("aria-label", item.name + ", " + item.subtitle);'));
  assert.ok(appScript.includes('icon.setAttribute("aria-hidden", "true");'));
  assert.ok(appScript.includes('arrow.setAttribute("aria-hidden", "true");'));
  ["purple", "violet", "blue", "green", "orange", "red", "cyan", "pink"].forEach((tone) => {
    assert.ok(css.includes(".assistant-result-icon.tone-" + tone + "{"), "result icon must preserve the " + tone + " tone");
  });
});


test("Ask Cyborg exposes one custom clear control without browser-native search decoration", () => {
  assert.match(css, /\.assistant-search input\[type="search"\]\s*\{[^}]*appearance:\s*none;[^}]*-webkit-appearance:\s*none;/);
  assert.match(css, /::-webkit-search-cancel-button[\s\S]*?display:\s*none;/);
  assert.match(css, /::-webkit-search-results-decoration[\s\S]*?display:\s*none;/);
});



test("SignIn safety notice is associated with both credential fields", () => {
  assert.ok(html.includes('<div class="signin-note" id="signinSafetyNote" role="note">Prototype only · Do not enter real credentials. Nothing is sent or stored.</div>'));
  const fieldTag = (id) => {
    const start = html.indexOf('id="' + id + '"');
    const end = html.indexOf(">", start);
    assert.ok(start >= 0 && end > start, "missing SignIn field: " + id);
    return html.slice(start, end + 1);
  };
  assert.ok(fieldTag("email").includes('aria-describedby="signinSafetyNote"'));
  assert.ok(fieldTag("password").includes('aria-describedby="signinSafetyNote"'));
  const noteRuleStart = css.lastIndexOf(".signin-card .signin-note{");
  const noteRuleEnd = css.indexOf("}", noteRuleStart);
  const noteRule = css.slice(noteRuleStart, noteRuleEnd);
  assert.ok(noteRuleStart >= 0 && noteRuleEnd > noteRuleStart, "missing SignIn safety-note style");
  assert.ok(noteRule.includes("color:#aeb8c8;"));
  assert.ok(noteRule.includes("font-size:11px;"));
  assert.ok(noteRule.includes("line-height:1.55;"));
});



test("reference-visible app tiles use the supplied icon artwork and Ask Cyborg preserves it", () => {
  const gridStart = html.indexOf('<div class="launcher-grid" id="appGrid">');
  const gridEnd = html.indexOf('<div class="launcher-list"', gridStart);
  const grid = html.slice(gridStart, gridEnd);
  const expected = {
    Base: "list-check",
    Apps: "wallet-dollar",
    Assistant: "percent",
    Clock: "trash-2",
    School: "list-minus",
    Shopping: "shopping-bag",
    Amazon: "venus-and-mars",
    OTT: "message-circle-clock",
    ID: "id-card",
    AirDrop: "smartphone-alert",
    Messages: "message-square",
    Friends: "users",
    Notifications: "bell",
    Company: "house",
    Git: "lock",
    Store: "shopping-bag",
    Task: "calendar-star"
  };
  for (const [name, icon] of Object.entries(expected)) {
    const nameIndex = grid.indexOf('data-app-name="' + name + '"');
    const buttonStart = grid.lastIndexOf('<button class="app-tile"', nameIndex);
    const buttonEnd = grid.indexOf("</button>", nameIndex);
    const tile = nameIndex >= 0 && buttonStart >= 0 && buttonEnd > nameIndex ? grid.slice(buttonStart, buttonEnd) : "";
    assert.ok(tile.includes('data-lucide="' + icon + '"'), name + " must use its reference-matched icon");
  }
  const schoolIndex = grid.indexOf('data-app-name="School"');
  const schoolStart = grid.lastIndexOf('<button class="app-tile"', schoolIndex);
  const schoolEnd = grid.indexOf("</button>", schoolIndex);
  assert.ok(grid.slice(schoolStart, schoolEnd).includes('class="app-icon tone-red"'), "School keeps the reference red icon tile");
  assert.match(appScript, /const iconMarkup = iconElement\?\.innerHTML\?\.trim\(\) \|\| "";/);
  assert.ok(appScript.includes("items.push({ name, subtitle, searchText, icon, iconMarkup, iconTone, source: element, type });"));
  assert.ok(appScript.includes("if (item.iconMarkup) icon.innerHTML = item.iconMarkup;"));
});

test("theme toggle keeps a stable accessible name and reports the active theme", () => {
  assert.match(html, /<button class="rail-btn dock-theme"[^>]*aria-label="Toggle light and dark theme"[^>]*aria-pressed="false"/);
  assert.match(html, /<button data-action="theme" aria-label="Toggle light and dark theme" aria-pressed="false"/);
  const syncStart = html.indexOf("function syncThemeControls()");
  const syncEnd = html.indexOf("function toggleTheme()", syncStart);
  const sync = html.slice(syncStart, syncEnd);
  assert.ok(syncStart >= 0 && syncEnd > syncStart, "theme control synchronization must be present");
  assert.ok(sync.includes("b.setAttribute('aria-label','Toggle light and dark theme')"),
    "theme toggle accessible name must remain stable");
  assert.ok(sync.includes("b.setAttribute('aria-pressed',light?'true':'false')"),
    "pressed state must represent the active light theme");
  assert.ok(sync.includes("b.setAttribute('title',label)"),
    "hover title may describe the next theme action");
});


test("Aliens Company identity is visibly applied across desktop, mobile and SignIn", () => {
  assert.ok(html.includes('<div class="rail-logo" role="img" aria-label="TelcoNet product mark">T</div>'));
  assert.ok(html.includes('<div class="wordmark">TelcoNet<small>ALIENS COMPANY</small></div>'));
  assert.ok(html.includes('<small>ALIENS COMPANY</small><strong>Aliens TelcoNet</strong>'));
  assert.ok(html.includes('class="workspace-signature">Aliens TelcoNet workspace</span>'));
  assert.ok(html.includes('class="brandmark" aria-hidden="true">T</span>'));
  const brandCss = css.slice(css.lastIndexOf("/* Aliens Company identity:"));
  assert.ok(brandCss.includes(".rail-logo{") && brandCss.includes("display:grid;"));
  assert.ok(brandCss.includes(".wordmark,") && brandCss.includes("color:var(--text);"));
  assert.ok(brandCss.includes(".company-select small,") && brandCss.includes("color:var(--blue);"));
  assert.ok(brandCss.includes(".signin-logo .brandmark") && brandCss.includes("border-radius:12px;"));
  assert.ok(brandCss.includes(".mobile-brand .brandmark"));
});
