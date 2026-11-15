# Application Design Studio checkpoint 1

The Studio has one in-memory, validated configuration. UI adapters write patches and render immutable snapshots. Calculations are pure functions of a snapshot. Prices, scores, recommendations, and rendered text are derived values and are never stored in the configuration.

| Field | Allowed values and defaults |
| --- | --- |
| `applicationType` | `unspecified` (default), `web`, `pwa`, `internal-tool`, `api`. These are provisional schema values with no pricing effect. |
| `pricingTier` | Integer 1 through 5. Defaults to 1. |
| `features` | Booleans `pwa`, `l10n`, `rbac`, and `ai`. All default to false. These are existing priced add-ons. |
| `usage` | Counts `tenants` (5), `users` (250), `requests` (null), `records` (10,000), `uploads` (100), `jobs` (0), `notifications` (0). Requests, jobs, and notifications are daily; records and uploads are monthly. Null requests mean automatic estimation; zero is explicit. |
| `visual` | `theme` is `system` (default), `light`, or `dark`. `density` is `comfortable` (default) or `compact`. These describe the planned application, independent of the portfolio theme. |
| `engineering` | Booleans `semantic`, `schedules`, `rbac`, `audit`, `webauthn`, and `rls`. All default to false. Planning RBAC and the priced RBAC add-on are distinct inputs in this checkpoint. |

Counts accept finite numbers, round down and clamp to 0–1 billion. Unknown fields and invalid values retain the last valid value. Numeric strings and truthy values are not implicitly converted by the store. DOM inputs translate browser values at the boundary.

`configuration.getState()` returns the current frozen snapshot. `update(patch)` merges known fields one level deep and publishes once per effective change. `reset()` restores schema defaults. `subscribe(fn)` registers a synchronous callback receiving `(next, previous)` and returns an unsubscribe function. Read the current snapshot separately when mounting. Subscribers render or observe snapshots and must not dispatch updates while being notified. The application uses the exported singleton, while tests use independent instances.

## Module boundaries

- `configuration.js` owns defaults, validation, transitions, and subscriptions. It has no DOM, storage, or calculation dependencies.
- `pricing.js` is the pricing engine boundary. It derives the existing tier, add-on, and total amounts from validated inputs. The site entry point handles labels, formatting, and the existing number animation.
- `architecture-model.js` owns the existing planning formulas. It returns numeric results and recommendation flags. The current planner view handles translations and formatting. `architecture-inputs.js` binds the optional planner form once and synchronizes inputs after changes or reset.
- A future live preview should subscribe to application type, features, and visual preferences and render independently of price, without owning configuration.
- A future architecture diagram should consume a derived graph from a dedicated model. The diagram renderer should own layout and interaction, while the model maps validated inputs to nodes and dependencies.

## Decisions before checkpoint 2

- Confirm the supported application types and which features or visual settings each type should expose.
- Decide whether drafts are session-only, saved locally, or shareable. Persistence would need explicit schema versioning and migrations.
- Decide whether priced and engineering RBAC should be linked automatically, and how incompatible features should be represented.
- Agree on the preview and diagram contracts before implementing either renderer. Any change to the existing pricing table or planning assumptions should be reviewed separately.

## Checkpoint 2

Application types are now `saas` (default), `ecommerce`, `landing`, and `internal-tool`. Earlier provisional values are unsupported and normalize to the default when loading a draft. The new `previewFeatures` group holds independent boolean prototype flags for authentication, analytics, tenancy, storage, background jobs, order management, and conversion forms. All default to false. Orders render only in E-commerce and conversion forms render only in Landing Page. Selections are retained across templates. Engineering RBAC supplies the roles preview and never enables the priced add-on. Authentication recommendations are advisory.

- `preview-model.js` derives a read-only template, theme, feature availability, and recommendations from the validated snapshot. Pricing and usage estimates are outside this view model.
- `preview-templates.js` holds localized, fictional UI samples. `preview-renderer.js` binds a single form and updates only affected modules. It rebuilds the sample template on type or language changes and reuses it for feature changes.
- `persistence.js` reads and writes a version 1 envelope under `awad-portfolio-studio`. It persists validated configuration only. Reset applies the store defaults and removes that key. Invalid envelopes are ignored, known fields are validated, and storage failures leave the Studio usable for the session. Shareable URLs and cross-tab synchronization are outside this checkpoint.
- `preview-entry.js` restores state before the estimator initializes and mounts the builder independently of the hero markup. The preview theme follows its explicit setting or the device scheme and does not change the portfolio theme.
