# GameNet — ALIENS COMPANY Brand & Product Charter

## Product definition
**GameNet** is an ALIENS COMPANY product for **Gaming Industry Operations**. It is an enterprise workspace for coordinating game studios, game portfolios, development teams, player operations, esports, tournaments, live operations, analytics and commercial performance.

## Mandatory brand hierarchy
- Parent company / master brand: **ALIENS COMPANY**
- Product: **GameNet**
- Product descriptor: **Gaming Operations Workspace**
- Brand attribution must remain visible in the desktop shell, mobile shell, page identity and product documentation.
- Never replace ALIENS COMPANY with GameNet as the parent company. GameNet is the product; ALIENS COMPANY owns the product identity.

## Visual direction
- Premium, precise enterprise SaaS interface with a gaming-industry character; avoid generic gamer neon overload.
- Dark theme default with deep navy/near-black backgrounds, charcoal-blue surfaces, subtle cool borders and clear typography.
- Light theme must preserve the same hierarchy and accessibility.
- Cyan/blue/violet gradients are reserved for primary actions and brand marks. Green indicates healthy states; amber indicates review/planning; red indicates paused or critical states.
- Use Space Grotesk for display headings and DM Sans for interface text.
- Consistent rounded cards, compact navigation, restrained shadows and visible keyboard focus.

## Product modules
1. Overview dashboard
2. Game studios
3. Game portfolio
4. Teams and developers
5. Player operations
6. Esports operations
7. Tournaments
8. Live operations
9. Gaming intelligence / analytics
10. Commercial operations
11. Workspace settings

## Data integrity
- Prototype data must be clearly labelled illustrative/demo data.
- Do not imply live game telemetry, player accounts, payments, authentication, studio integrations or operational APIs are connected unless they are actually implemented and verified.
- A placeholder must be visibly described as not connected; do not style a dead control as a working feature.
- Export actions must state exactly what they export.

## Engineering rules
- GameNet lives in `/gamenet/` in the existing repository.
- Preserve the existing TelcoNet root files and behavior. Do not rename, overwrite or refactor TelcoNet as part of GameNet work.
- Keep GameNet CSS and JavaScript in separate files.
- Every navigation destination must render a real page state. Every visible control must work or clearly explain its prototype limitation.
- Test desktop, tablet and mobile layouts, keyboard navigation, dark/light themes and overflow before declaring completion.
- Do not begin WebApp, DartApp or PyApp production work until the GameNet prototype has been reviewed and approved.

## Current status
Phase 1 scaffold created on the `gamenet-development` branch. Dashboard and operational module shells are implemented with clearly labelled sample data. This is an initial development milestone, not a completed product.
