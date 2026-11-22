# GameNet — ALIENS COMPANY Brand & Product Charter

## Product definition
**GameNet** is an ALIENS COMPANY product for **Gaming Industry Operations**. It is an enterprise workspace for coordinating game studios, game portfolios, development teams, player operations, esports, tournaments, live operations, analytics and commercial performance.

## Mandatory brand hierarchy
- Parent company / master brand: **ALIENS COMPANY**
- Product: **GameNet**
- Product descriptor: **Gaming Operations Workspace**
- Brand attribution must remain visible in the desktop shell, mobile shell, page identity and product documentation.
- Never replace ALIENS COMPANY with GameNet as the parent company. GameNet is the product; ALIENS COMPANY owns the product identity.

## Visual direction — supplied ALIENS reference is the source of truth
- Do not invent a new visual identity or substitute a generic gaming dashboard theme. Reproduce the user's supplied ALIENS/Cyborg reference system as closely as technically possible, screen by screen and component by component.
- Reference set recorded by the user: seven original screenshots and a 23.25-second mobile-menu recording. It includes desktop sidebar and top navigation, dark/light profile popovers, mobile header and bottom navigation, SignIn, and the mobile launcher flow. The supplied images/video—not this initial scaffold—are the visual source of truth.
- Preserve the reference's brand hierarchy: product name GameNet; parent/master brand ALIENS COMPANY; company/workspace label must use the appropriate ALIENS + GameNet hierarchy. Do not replace or dilute the ALIENS identity.
- Match the reference geometry, typography, icon treatment, spacing, borders, radii, gradients, shadows, menus, responsive behavior and interaction states. Avoid adding unrelated neon/gamer styling.
- Reference shell measurements and behavior should be carried across where applicable: 68px desktop icon rail, approximately 300px workspace sidebar, top navigation, dark and light themes, mobile floating brand header, mobile bottom navigation, and usable account/profile popover.
- Reuse the supplied reference assets and any user-provided ALIENS brand materials; do not approximate from memory when the original assets are available. If an asset is inaccessible, record that blocker and do not claim pixel-perfect parity.
- The initial GameNet scaffold's visual choices are provisional and must be revised against the exact ALIENS reference before visual sign-off.

## Product scope — complete Gaming Industry Operations ecosystem
1. Executive operations overview
2. Game studios and studio portfolio
3. Game portfolio, production lifecycle and release management
4. Teams, developers, roles and capacity
5. Player operations, community support and safety workflows
6. Esports organizations, circuits and competitive operations
7. Tournaments, registrations, schedules and results
8. Live operations, events, updates and incident coordination
9. Gaming analytics, portfolio intelligence and reporting
10. Commercial operations, monetization and finance reporting
11. Partners, publishers, platforms and distribution operations
12. Quality assurance, testing and release readiness
13. Content pipelines and localization operations
14. Support, moderation and trust/safety operations
15. Workspace administration, permissions, notifications and audit history

The ecosystem is an operations platform for the gaming industry, not merely a decorative dashboard or consumer game launcher. Build complete page-level workflows for each module in a staged manner.

## Data integrity
- Prototype data must be clearly labelled illustrative/demo data.
- Do not imply live game telemetry, player accounts, payments, authentication, studio integrations or operational APIs are connected unless they are actually implemented and verified.
- A placeholder must be visibly described as not connected; do not style a dead control as a working feature.
- Export actions must state exactly what they export.

## Engineering rules
- GameNet lives in `/gamenet/` in the existing repository.
- Preserve the existing TelcoNet root files and behavior. Do not rename, overwrite or refactor TelcoNet as part of GameNet work.
- Keep GameNet CSS and JavaScript in separate files.
- Every navigation link, card action, tab, menu item, breadcrumb, search result and CTA must lead to the correct working destination or perform its advertised action. No dead links, `href="#"` placeholders, fake buttons, broken routes or silent no-op controls.
- Build and verify a route/page inventory. Every destination must have a real page, consistent ALIENS shell, useful content, empty/loading/error states where relevant, and working back/breadcrumb navigation.
- Test every link and control in browser automation, including direct URL loading, refresh, browser back/forward, and mobile navigation. Keep a link-check report with the final audit.
- Do not claim a page or feature is complete merely because a shell, card, static metric or navigation label exists.
- Test desktop, tablet and mobile layouts, keyboard navigation, dark/light themes and overflow before declaring completion.
- Do not begin WebApp, DartApp or PyApp production work until the GameNet prototype has been reviewed and approved.

## Current status
Phase 1 scaffold created on the `gamenet-development` branch. Dashboard and operational module shells are implemented with clearly labelled sample data. This is an initial development milestone, not a completed product.

## User acceptance criteria — binding
- The user explicitly selected the **operations** direction: GameNet must serve as a complete gaming-industry operations ecosystem, with end-to-end workflows across the modules above.
- The user's exact ALIENS reference designs and supplied brand assets are mandatory. Match them "same to same" as closely as possible; do not redesign the brand independently.
- Every link and interactive control must work correctly. Verify all destinations and interactions before any completion claim.
- Preserve TelcoNet in the root of the same repository. GameNet remains isolated under `/gamenet/` and is developed on `gamenet-development` until the user approves release.
- No live deployment or merge to the production branch until the user reviews and approves the GameNet prototype.
