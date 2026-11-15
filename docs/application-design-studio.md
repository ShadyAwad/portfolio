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

## Checkpoint 3: Engineering capacity and effort

The canonical snapshot now has a flat `capacity` group. The existing v1 draft envelope remains compatible: older drafts receive defaults for absent fields and known fields are validated. Null capacity assumptions mean unavailable. Blank workload counts are now stored as null; the existing blank daily requests field still means use the per-user model, and explicit zero still means zero. The legacy Architecture Mode score, pricing, and previews keep their existing contracts.

All model metrics are structured as `{ value, unit, status, warnings, assumptions, intermediates }`. Status is `ok`, `warning`, or `unavailable`; unavailable metrics have null values and a reason. Individual metrics can remain valid when a related input is missing. Counts and byte totals that require exact integers are checked against Number.MAX_SAFE_INTEGER (9,007,199,254,740,991); larger exact sums or products become unavailable. Storage and effort use integer arithmetic internally, and queue slot thresholds use exact arithmetic for entered decimals. Display formatting rounds rates for readability.

### API workload

- Daily requests = daily active users × requests per active user per day, unless an explicit validated daily override is set.
- Average RPS = daily requests ÷ 86,400 seconds.
- Busiest-hour average RPS = daily requests × busiest-hour share ÷ 3,600 seconds. The share is between 1/24 (uniform traffic) and 1.
- Illustrative burst RPS = busiest-hour average RPS × the assumed burst multiplier. This is a scenario without a predicted duration or percentile.

Defaults are 10 requests per active user, a 15% busiest-hour share, and 2× burst. For 12,000 users × 18 requests, daily volume is 216,000. Dividing by 86,400 gives 2.5 average RPS. A 15% busiest hour has 32,400 requests or 9 RPS; at 2.5× the illustrative burst is 22.5 RPS. These rates do not predict database query latency or server counts.

### Background processing

- Arrival rate λ = (background jobs/day + notifications/day) ÷ 86,400. One notification is modeled as one additional job. Jobs already counted as notifications must be excluded from background jobs. Include reports and scheduled runs in the background jobs count; a schedule flag alone cannot determine their volumes.
- Effective slots C = worker processes × concurrent slots per process. A process can serve more than one concurrent task, subject to resource limits.
- Theoretical capacity = C ÷ mean service time S (jobs/s). Utilization = λ × S ÷ C. Zero capacity has undefined utilization even if arrivals are zero.
- Net backlog growth = max(0, λ − C/S) × 86,400 jobs/day under sustained load. Exactly 100% has zero net deterministic growth and no margin for variability.
- Minimum slots at target utilization u = ceil(λ × S ÷ u), where 0 < u < 1. The UI accepts 1% through 99%. This is a slot count, with no implied number of processes.

Defaults are 0.5 seconds/job, one process with four slots, and a 70% target. For 864,000 jobs/day, λ = 10 jobs/s. With four slots and 0.5 seconds/job, capacity is 8 jobs/s, utilization is 125%, and net backlog grows 2 × 86,400 = 172,800 jobs/day. The target needs ceil(5 ÷ .7) = 8 slots.

This fluid model assumes a stationary sustained arrival rate, a representative mean service time, homogeneous pooled slots, and enough CPU/I/O capacity. It excludes arrival burstiness, service-time tails, retries, scaling delays, contention, external rate limits, and priority effects. Utilization alone does not determine waiting time.

### Monthly database and storage growth

- Structured bytes = records × average record bytes. Audit bytes = audit records × average audit record bytes when audit is enabled. File bytes = uploads × average upload bytes.
- Raw vector bytes = monthly embedding count × dimensions × bytes per element when semantic search is enabled. Element widths of 2, 4, or 8 bytes describe raw encodings only; the selected storage engine may use a different representation.
- Raw application bytes = sum of those four components. Raw DB bytes = structured + audit + vectors.
- DB overhead and index overhead are independent percentages of raw DB bytes, each rounded up to a whole byte. Object metadata = uploads × metadata bytes per upload.
- Primary bytes = raw bytes + DB overhead + indexes + object metadata. Replica bytes and backup bytes are each primary bytes × their configured full-copy count. Estimated total = primary + replicas + backups. This deliberately models uniform full copies for both database and objects; set counts to zero if irrelevant or estimate those copies externally for more specific strategies.
- Bytes are exact within the safe integer range. GiB = bytes ÷ 2³⁰; MiB = bytes ÷ 2²⁰. No decimal GB/MB is implied.

Defaults: 2,048 bytes/record, 512 bytes/audit record, 5 MiB/upload, 1,536 vector dimensions at 4 bytes each, 25% database overhead, 30% index overhead, 1,024 bytes/file metadata, and zero additional replicas/backups. Enabled audit/vector components require their own counts, with no assumed counts or implied audit events per request.

For 100 records × 2,000 B, 20 audit records × 500 B, 2 uploads × 1,000,000 B, and 10 vectors × 768 × 4 B, raw bytes are 2,240,720. The DB subtotal is 240,720 B. With 25% and 30% overhead, the additions are 60,180 B and 72,216 B. With 100 B per upload, primary storage is 2,373,316 B. One extra replica and one backup give 7,119,948 B/month, about 6.7901 MiB. This is gross monthly growth before deletions or retention, and cannot reproduce PostgreSQL page, tuple, TOAST, WAL, index, compression or vector index behavior.

### Development effort

The effort model accepts explicit baseline and feature range tables, in whole engineering hours. It adds selected feature ranges within each package, then independently sums lower and upper bounds. Missing, reversed, or unsafe ranges make the affected package and total unavailable. The current view uses the documented default tables. There is no complexity-to-hours multiplier or change to pricing. Work is additive person-hours with no calendar or parallelism assumptions. Integration uncertainty, QA depth, accessibility targets and scope changes still need human review.

| Work package | Baseline hours | Additional hours if selected |
| --- | ---: | --- |
| Frontend | 12–24 | Analytics 4–8, conversion 3–6, PWA 4–8, localization 4–10 |
| Backend/API | 10–20 | Orders 8–16, tenancy 6–12 |
| Database/queries | 6–12 | Semantic search 6–14, audit 4–8 |
| Authentication/authorization | 0–0 | Sign-in 6–12, RBAC 4–10, WebAuthn 4–8, RLS 6–12 |
| Background processing | 0–0 | Jobs 6–12, schedules 3–6 |
| Integrations | 0–0 | File storage 4–8, AI integration 6–14 |
| Testing/validation | 8–16 | Included in baseline |
| Deployment | 4–8 | Included in baseline |

Jobs or notifications above zero and uploads above zero can imply their respective work packages even if the visual prototype flags are off. Order and conversion work obey template compatibility. Paid and engineering RBAC can express the same work but are counted once here; the model does not toggle either flag. With a 40–80 hour base, sign-in adds 6–12, RBAC 4–10, and jobs 6–12, producing 56–114 engineering hours with no file integration. It is a planning range, not a delivery promise.

### Boundaries

`src/studio/capacity/` contains independently testable workload, queue, storage, effort, assumption validation, and result modules. The browser panel only binds assumption inputs and renders the results with formulas and intermediate quantities. The optional existing planner receives the panel; a compact Advanced Architecture Mode shell is provided when that earlier uncommitted UI is absent. Pricing and the four frontend previews retain their separate model boundaries. Architecture graph design and commercial pricing changes remain future checkpoints.

## Checkpoint 4: Dynamic architecture explorer

The Studio view switch keeps the same configuration form and store for the Live Application Preview and System Architecture. The switch and node selection are view state, not part of the saved product configuration.

- `architecture/graph.js` combines compatible preview capabilities, explicit engineering choices, and existing capacity results into a directed graph. Stable component IDs, relationship labels, trust boundaries, warning codes, and model metrics are shared by the SVG and the linear text alternative. The model does not mutate the configuration or recalculate engineering results.
- SaaS, E-commerce, and Internal Business Tool start with an illustrative browser, API, and relational store. A landing page can be browser-only. Analytics, conversion, identity and other data-bearing requirements can introduce services. SaaS, commerce and operations can legitimately share backend components.
- Queues are justified by the background jobs choice, schedules, or known positive work volume. Redis is only an illustrative broker on that branch. Object storage follows the file storage choice; the upload volume is an estimate and does not select a provider. Semantic search adds a logical vector branch to the data layer. Tenant scoping and RLS use the shared PostgreSQL node, never a database per tenant. Engineering roles and the paid RBAC add-on remain independent.
- API, queue, relational, file and vector nodes show their matching Checkpoint 3 values and retain unavailable and warning states. Static explanatory cautions about theoretical capacity and bursts remain in node details. The diagram carries no estimates for server count, wait time, cost, or resource usage.
- `architecture/layout.js` lays out a deterministic preorder tree with one component per row and branches routed through depth-specific rails. Each node's second line labels the incoming arrow. Narrow screens use a compact vertically organized graph within a contained scroll region. The linear outline lists the connections and trust boundaries and can also select nodes. When a node disappears the selection returns to the browser; otherwise selection and focus are retained.
- The explorer reconciles SVG elements by ID. Transition timers only remove exiting elements; there is no frame loop. Reduced motion removes entry, exit, movement and metric animation. No new runtime dependencies are used.

The graph is conceptual and deliberately omits reverse responses, multi-parent paths, infrastructure redundancy, regions and vendor assignments. Checkpoint 5 can consume the separate effort ranges for a pricing model after its assumptions and commercial rules are agreed. This checkpoint neither uses the graph to set a price nor alters the current calculator.

## Checkpoint 5: Commercial estimate

The basic configurator still uses the original tier and add-on engine. The Advanced Engineering Estimate is an alternative development estimate. It does not add the basic price to engineering labor or write to any paid add-on. The version 1 draft stores a `commercial` group with hourly rate in USD cents, contingency in basis points of the multiplier (100 basis points = 1 percentage point), and three one-time expense inputs in USD cents (assets/licenses, setup, and other). Older drafts receive the documented defaults. The example rate is USD 15/hour and contingency is 15%. They are illustrative and do not represent the portfolio owner's confirmed commercial rates.

For each endpoint of the effort range, labor = hours × rate × (1 + contingency percentage ÷ 100). Indicative total = labor + sum of explicit one-time expenses. Contingency applies to labor only. The package contributions use the same factor. The pure model keeps exact millionths of a USD as integers and rounds half-up to cents for presentation. Package amounts may round differently from their exact aggregate. Display totals outside the safe cent range are unavailable. The rate and expenses accept nonnegative decimal values up to USD 1,000,000 with two decimal places; contingency accepts 0–100% with two decimal places. Empty rate or contingency makes labor unavailable; empty optional expenses mean zero. Invalid nonempty values make the affected result unavailable.

For 56–114 engineering hours, USD 15/hour and 15% contingency give USD 966.00–1,966.50 in labor (56 × 17.25 and 114 × 17.25). With USD 100 in assets and USD 25 in setup, the total is USD 1,091.00–2,091.50. For a rounding check, one hour at USD 1.01 with 50% contingency is exactly USD 1.515, displayed as USD 1.52. Two such packages total exactly USD 3.03 before presentation.

The estimator uses the existing Checkpoint 3 effort ranges and assumes a baseline for standard implementation and QA once per package. Increments represent only requirement-specific work. Engineering or priced RBAC triggers one permission-modeling increment, even if both are enabled. Queue demand and the jobs toggle share one processing increment; scheduling adds trigger-specific work. File volume and the upload feature share one integration increment for the workflow and storage. Tenant scoping is assigned to backend work; optional database row policies are separate incremental RLS work. Routine checks are baseline QA, while feature-specific checks are part of the relevant feature increment. The effort tables remain configurable through the existing model API. Whether hours overlap in a real statement of work still requires scope review.

Application and database hosting, object storage, a queue broker, email/external API usage, monitoring, and backups are separate operating-cost categories. They stay unpriced until relevant resource requirements, providers, regions, and billing assumptions are specified. The developer estimate excludes recurring costs, taxes, ongoing support, and expenses not entered. Checkpoint 6 can address final presentation and end-to-end polish without changing these formulas.
