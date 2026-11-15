# Aliens Brand — UI Reference

Use **"Aliens Brand"** as the shorthand for this visual system and interaction pattern. For this project, the product name is **Aliens TelcoNet**.

## Visual direction
- Project brand identity: **Aliens TelcoNet**. The supplied Aliens TelcoNet / base.software screens remain the layout and interaction reference, adapted to a telecom operations workspace within Aliens Company.
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
