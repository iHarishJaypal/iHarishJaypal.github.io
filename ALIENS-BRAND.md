# Aliens Brand — UI Reference

Use **"Aliens Brand"** as the shorthand for this visual system and interaction pattern. The product is **TelcoNet**; the company brand is **ALIENS COMPANY**; the company switcher label is **Aliens TelcoNet**.

## Visual direction
- Naming hierarchy: product **TelcoNet**, company brand **ALIENS COMPANY**, company switcher **Aliens TelcoNet**. The supplied Aliens / base.software screens remain the layout and interaction reference, adapted to a telecom operations workspace.
- Premium, compact SaaS dashboard aesthetic; clear hierarchy and dense but readable navigation.
- Dark theme is the default: near-black page background, charcoal surfaces, subtle borders, muted secondary text.
- Light theme is also required and should preserve the same hierarchy and layout.
- Use blue-to-violet gradients for primary actions and active highlights; use restrained cyan/green for healthy status.
- Rounded cards, pill-shaped controls, soft shadows, subtle blur on floating navigation, and crisp typography.
- Use accessible contrast, visible focus states, semantic controls, and responsive spacing.

## Desktop shell
- Fixed slim icon rail on the far left.
- Secondary left workspace sidebar with company switcher, prominent gradient **New** action, grouped navigation sections, and a profile shortcut near the bottom.
- Fixed top navigation with search, pill-style primary destinations, activity/notification actions, and account avatar.
- Main content starts to the right of both sidebars and below the top navigation.

## Account and app navigation
- Account avatar opens a floating account popover with greeting, account-management link, language choices, add-account and sign-out actions.
- App launcher opens a full-screen or spacious app grid.
- Theme control switches between dark and light modes.
- Navigation controls should work on click and clearly indicate the active destination.

## Mobile behavior
- Replace the desktop rails and sidebars with a compact floating top brand bar.
- Provide a bottom navigation bar for primary destinations.
- Provide a separate app launcher/menu grid for the wider app collection.
- Keep the account popover usable on narrow screens and prevent horizontal overflow.

## Sign-in screen
- Separate, responsive sign-in layout.
- Desktop: large brand/message panel on the left and a compact sign-in card on the right.
- Mobile: prioritize the sign-in card and hide the large marketing panel.
- Never imply authentication is live unless a secure backend has actually been connected. Demo forms must clearly say they do not send or store credentials.

## Implementation rules
- Prefer responsive HTML/CSS/JavaScript or the project's existing stack.
- Keep navigation and controls functional; do not add decorative controls that do nothing without indicating they are placeholders.
- Use realistic sample data only when clearly labelled as sample/demo data.
- Preserve existing project files and conventions; do not replace unrelated content.
- Treat supplied screenshots and the supplied mobile-menu video as the visual reference for this brand system.

## Supplied mobile-menu video details
- The default mobile launcher is a compact overview: an **Ask Cyborg** search bar, a Grid/List switch, an **Aliens Apps** preview of the first eight apps, a **More Apps** action, and the **Score Menu** list with its visible count of 39.
- **More Apps** opens the full 26-app grid with a back control. Returning from that view restores the compact overview.
- **List** mode presents the 39 alphabetically grouped Score Menu destinations; **Grid** returns to the compact app preview.
- Search has three explicit prototype states: ready suggestions, local destination matches, and a no-local-destination state. Do not imply a live Cyborg/AI service where none is connected.
- Keep the mobile launcher footer actions visible, and preserve the four-column app grid on narrow phone screens.
- Modal menus must support Escape, keyboard focus containment, focus restoration, and background scroll locking.

## Desktop geometry from the final TelcoNet reference
- Keep the left icon rail at 68px.
- Keep the workspace sidebar at approximately 300px, beginning immediately after the rail.
- Align the desktop top bar and main content at 368px from the viewport's left edge.
- The company switcher label is **Aliens TelcoNet**; the wordmark hierarchy remains **TelcoNet** with **ALIENS COMPANY** beneath it.


## Mobile launcher detail confirmed from the supplied video
- Compact Grid mode shows the first eight Aliens Apps and one **Dashboard** preview card under **Score Menu**, while retaining the total count of **39**.
- Switching to **List** reveals all 39 alphabetically grouped Score Menu entries. The full 26-app grid remains behind **More Apps**.
- The compact preview is not the full list; do not display all 39 rows until List mode is selected.

## Current verification record — 2026-11-19
- The seven supplied reference screenshots and the mobile-menu video were reviewed. The screenshots remain the visual source of truth; the video defines the mobile launcher flow.
- The prototype retains the 26-app grid, 39 unique alphabetical Score Menu entries, compact eight-app preview, More Apps flow, Grid/List modes, and the three Ask Cyborg prototype states.
- Navigation, chart-range controls, language selection, theme icons, and prototype SignIn interactions received a source audit. The local SVG icon map covers every icon referenced in the page.
- Run `node scripts/prototype-audit.mjs` from the repository root for the dependency-free source checks. GitHub Actions runs this audit on relevant pushes and pull requests.
- The latest successful source-audit run passed all 10 checks. The GitHub Pages deployment workflow also completed successfully for the preceding audited revision.

## Reference asset provenance — 2026-11-19
The following Library assets were inspected as the visual source of truth:

- Desktop sidebar and workspace: `image(20261115-054556).png`
- Desktop top navigation: `image(20261115-054622).png`
- Dark profile popover: `image(20261115-054645).png`
- Light profile popover: `image(20261115-054719).png`
- Mobile header: `image(20261115-054755).png`
- Mobile primary navigation: `image(20261115-055306).png`
- SignIn: `image(20261115-072554).png`
- Mobile menu recording: `20261115-0726-43.4686777.mp4`

The 23.25-second mobile recording was sampled throughout its sequence. It confirms the eight-app compact preview, the 39-entry Score Menu, the More Apps 26-app grid, Grid/List switching, the ready state, local search matches, and the no-local-destination state.

## Latest refinement and verification record — 2026-11-19
- The SignIn prototype was simplified to match the supplied reference more closely: work email, password with Show/Hide, a return-to-dashboard control, and the clear no-real-credentials notice. Unsupported Forgot Password, keep-signed-in, Google sign-in, and account-creation controls were removed. No authentication backend or credential storage was added.
- Browser audit coverage now checks the compact mobile header and four-item navigation at 320, 360, 375, 414, and 430 CSS pixels, including header/nav geometry, theme switching, the header search entry point, and horizontal overflow. The desktop profile screenshot waits for transient toast feedback to clear.
- The dependency-free source audit passed on commit `461a8ac5aca2d4067365aa1306846e34193ba613`. The GitHub Pages build and deployment also succeeded for that commit.
- Responsive Chromium audit run `44489321992` completed successfully on commit `461a8ac5aca2d4067365aa1306846e34193ba613`; both static and browser jobs passed. Artifact `14513055550` contains 14 screenshots covering desktop dark/light dashboards, profile and SignIn, mobile dashboards, compact menu, full app grid, Score Menu, Ask Cyborg states, and mobile profile. Those screenshots were inspected.
- Responsive Chromium audit run `44491843499` completed successfully on commit `b29bbbb2c900c25631d55b9755f0c9b2f6d4ff10`; its artifact contains 15 screenshots, including the narrow-phone SignIn prototype.

## Known verification blockers
- `score.base.software` remains inaccessible through the currently available web access path. Do not claim pixel-perfect parity until a genuine access path is available.
- The connected browser extension context is unavailable. CI Playwright is the available real Chromium verification path; previous expanded runs passed.
- GitHub Pages deployment succeeded for commit `ef71a8c03296efdb62db682808243cf3c84a699f` (run `44492916737`). The published site could not be independently opened through the available web access tool.
- SignIn remains a local prototype only. It does not send or store credentials and does not connect to an authentication provider.

**Project status: IN PROGRESS.** Do not start the production WebApp, Dart app, or Python app as part of this prototype work.

## Run 7 refinements — 2026-11-19
- Replaced the static top-bar `37 min ago` label with `Demo snapshot` and a tooltip explaining that live refresh is not connected.
- The language selector now explicitly says language switching is not connected; EN/HL/HI selection is only a visual preview, not a translated interface.
- Added the reference SignIn field icons (`@` and lock) using the local SVG icon map.
- SignIn submission clears both fields and restores the password to hidden. Leaving SignIn without submitting also clears both fields, so demo values do not remain in the page.
- Fixed SignIn text contrast when the workspace is in light mode; the reference SignIn surface remains dark and legible. Reduced mobile card padding at narrow widths so the password placeholder retains readable space.
- Expanded browser checks for the demo snapshot label, language-preview feedback, SignIn icon presence, submit/cancel field cleanup, 320px SignIn contrast and input width, focus, and horizontal overflow.
- Audit run `44492116894` completed successfully on commit `4ed9b5bbc2abc679133aef3666a22dab3731a7be`; both static and responsive Chromium jobs passed. Artifact `14513915687` contains 15 screenshots, including the light-mode 320px SignIn state after the contrast and spacing fix.
- The narrow-phone SignIn field now reserves 64px for the Show control and uses a 13px input font at widths up to 420px. The browser audit measures the actual placeholder text width and asserts that the complete `Enter your password` placeholder fits.
- Source and responsive Chromium audit run `44492760241` completed successfully on code commit `ee16ecfd579d1011bece82cbe93815dc770ab247`; both jobs passed. Its 15-image artifact was reviewed during the next audit.

## Run 8 refinements — 2026-11-19
- Reviewed the latest main branch (`ef71a8c03296efdb62db682808243cf3c84a699f`), the ten most recent commits, the source files, and the latest GitHub Actions results before making changes.
- Inspected the successful Chromium artifact from run `44492760241` (desktop dark/light dashboards, desktop profile popover, compact mobile menu, full app grid, Score Menu bottom scroll, and SignIn). The compact mobile screenshot exposed two adjacent one-pixel borders between the eight-app preview and the Score Menu.
- Removed the redundant Score Menu top border. The app-grid bottom border remains the single separator, while the existing spacing is preserved.
- Added a dependency-free source regression check and a Playwright browser assertion that verify the compact menu has exactly one divider.
- Preserved all 26 app tiles, all 39 Score Menu entries, the existing Ask Cyborg states, SignIn behavior, and the product/company naming hierarchy.
- Static audit run `44508076305` passed all 12 checks, including the new single-divider regression test. The responsive Chromium job in the same run also completed successfully; both jobs passed. Pages deployment run `44508302156` succeeded for documentation commit `dada94ec1a6c6026783ea8b89832aacf374907dd`.
- The reference label `Which tool, model and effort finish work b…` remains abbreviated in the existing source. Its unseen continuation was not guessed.
- `score.base.software` and the connected browser extension remain unavailable; visual parity is not claimed.

**Project status: IN PROGRESS.**

## Run 9 refinements — 2026-11-19
- Re-inspected the current main branch, recent commits, source files, and workflow results before editing. The latest existing responsive Chromium run 44508076305 had completed successfully in both static and browser jobs; its 15 screenshots were downloaded and reviewed.
- Re-opened the seven original Library screenshots and sampled the 23.25-second mobile-menu recording. The current desktop shell, top navigation, profile popover, mobile launcher states, footer controls, and simplified SignIn presentation remain aligned with the supplied references. The current compact menu still shows eight app tiles, the Dashboard preview, and the 39 count; the full 26-app grid and 39-entry list remain intact.
- The dashboard chart had no visible horizontal/day axis labels, while the reference chart shows angled period labels. Added short day-number ticks for 7-, 30-, and 90-day sample ranges. Generic day numbers are used rather than fabricated calendar dates.
- Corrected the normalized sample bar scale so a 100/100 bar reaches the chart's 2.5M top gridline. Added SVG titles and an accessible description clarifying that the chart uses illustrative normalized sample values, not live telemetry.
- Extended static and Playwright browser audits to verify tick labels for 7 and 90 days, chart accessibility text, label bounds, and top-gridline alignment. The 30-day tick set is also guarded by the static renderer check.
- Static source audit and responsive Chromium checks both passed on commit `4c7d0be3914f8d298fc346745472c341da75493d` in workflow run `44514114935`. The 7-day and 90-day axis-label assertions, in-view label geometry, and 2.5M top-gridline alignment all passed. Artifact `14523623786` contains 15 screenshots; the updated desktop dashboard chart and compact mobile menu screenshots were inspected. GitHub Pages deployment run `44514114281` also succeeded for this commit.
- score.base.software remains inaccessible through the available access path. No connected browser extension is available; CI Playwright remains the real-browser verification route.

**Project status: IN PROGRESS.** The prototype is not approved complete; production WebApp, Dart app, Python app, and production authentication remain out of scope.
