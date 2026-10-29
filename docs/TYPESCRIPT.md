# TypeScript frontend

All browser application code and frontend tests under `src/` use TypeScript. React 17, existing UI behavior, browser storage keys and API routes are retained. No business-data migration is required. The Django backend remains Python; native already has its own TypeScript configuration.

`tsconfig.json` enables strict checking, includes tests, forbids JavaScript source and emits no files. `tsconfig.app.json` checks production source without test fixtures. `src/types/domain.ts` defines billing/account records; `src/types/data.ts` describes local and connected client contracts. Typed Redux hooks, actions and thunks are in `src/Redux`. Runtime validation still protects imported backups and API inputs. Type assertions at JSON and dynamically assembled client boundaries do not replace that validation.

```sh
yarn install --frozen-lockfile --non-interactive
yarn typecheck
yarn test --runInBand
yarn test:tooling
yarn build
yarn build:connected
yarn pdf:samples
```

The equivalent `npm run` scripts also work. Run commands inside this `app` directory, where `package.json` lives. `npm run dev` starts the connected local stack; `npm start` starts only Vite.

Vite and Babel transpile TypeScript. The separate `typecheck` command checks types, and production build scripts run that check before bundling. CI checks application and test types; Docker copies both TypeScript configs before building. The PDF fixture loader strips types before loading the actual renderer. Node orchestration, Jest/Babel config and Playwright harnesses remain JavaScript.

Migration validation: strict checking, 120 tests across 30 frontend suites, tooling check, local/connected builds, nine PDF fixtures, and connected billing/backup/sign-out flows at desktop, tablet and phone sizes. Builds retain the existing large-bundle warning.

## No-any policy

Application and test source in both web and native builds must not declare `any`. The compiler explicitly enables `noImplicitAny`, unknown catch variables, override/fallthrough checks and consistent file casing. Web source also checks side-effect imports. ESLint rejects explicit `any` and unsafe assignments, arguments, calls, member access and returns inherited from untyped APIs or dependencies. CommonJS `require` imports in TypeScript are rejected. The same rules apply to tests; mocks use typed signatures and complete fixtures.

Use `unknown` for untrusted values and narrow them before use. API/backup assertions remain documented contract boundaries and existing runtime validation remains necessary; static types do not validate JSON by themselves. External dependency declarations are outside this source policy. There are currently no `any` exceptions in application or test source. Inline ESLint suppression is disabled; `@ts-ignore` and `@ts-nocheck` are rejected. Described `@ts-expect-error` directives are reserved for deliberate negative type tests.

```sh
npm run check         # compiler plus typed web lint, including tests
npm run lint:native   # native app/client/tests, after npm ci --prefix native
npm run typecheck --prefix native
npm run test:tooling  # regression checks prove that forbidden examples fail
```

Production builds lint application source before typechecking and bundling. CI checks web types/lint/tests and native lint/types/tests. The Docker frontend stage copies the lint configuration along with the compiler configs. Node 22.13+ or 24 is required by the pinned lint tooling.
