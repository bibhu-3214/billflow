# Tailwind development

The web frontend uses Tailwind CSS 4.3.3 and `@tailwindcss/vite` 4.3.3. Material UI, its icon library, JSS theme and SweetAlert styles have been removed. React remains at version 17. React Native retains its platform-native styling.

- `vite.config.mjs` registers Tailwind before the React plugin. No PostCSS or JavaScript Tailwind configuration file is needed.
- `src/styles.css` imports Tailwind and defines CSS-first theme tokens, base styles, animation keyframes, reduced-motion behavior and quotation-print rules.
- `src/styles/recipes.ts` contains literal Tailwind class lists for shared layouts and semantic component hooks. Those hooks remain available to browser tests; their styling is generated from Tailwind utilities.
- `src/styles/ui.ts` expands recipe names and uses `tailwind-merge` for utility conflict resolution. Use `ui('surface-card', 'p-6', condition && 'border-primary')` for shared recipes; use literal utilities for simple elements.
- `src/components/ui/primitives.tsx` provides typed native buttons, fields, selects, switches, tables and pagination. Dialog focus/dismissal behavior comes from Radix; notifications use the same Tailwind dialog host. Icons come from Lucide.

Use complete class strings so Tailwind can find them at build time. Do not assemble utilities such as `h-${value}`. Runtime chart measurements and tooltip coordinates use inline values/custom properties; their appearance stays in utilities. Finite layouts and animation delays use literal utility lists.

The `dark:` variant follows `data-theme="dark"` on the document root. `AppearanceProvider` retains the existing system preference, browser preference and cross-tab behavior. Use theme tokens (`bg-field`, `bg-surface`, `text-ink`, `border-line`) for new controls. Financial previews and print pages retain an ink-on-white document palette.

Keep labels associated with controls, helper/error text linked by `aria-describedby`, button names meaningful, and focus styles visible. Native selects support browser keyboard navigation. Pass dismissal requests through the editor's dirty/busy guard.

Run `yarn check`, `yarn test --runInBand`, `yarn test:tooling`, `yarn build` and `yarn build:connected`. With the disposable acceptance API running, `yarn test:browser` covers connected financial workflows, responsive layouts, dark-mode persistence, dialog keyboard behavior and quotation printing. See [validation setup](VALIDATION.md). Review desktop, tablet and phone screenshots after shared utility changes.
