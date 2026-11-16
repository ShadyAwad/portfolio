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

The basic configurator still uses the original tier and add-on engine. The Advanced Engineering Estimate is an alternative development estimate. It does not add the basic price to engineering labor or write to any paid add-on. The version 1 draft stores a `commercial` group with hourly rate in USD cents, contingency in basis points of the multiplier (100 basis points = 1 percentage point), and three one-time expense inputs in USD cents (assets/licenses, setup, and other). Older drafts receive the documented defaults. The example rate is USD 7/hour and contingency is 15%. They are illustrative and do not represent the portfolio owner's confirmed commercial rates.

For each endpoint of the effort range, labor = hours × rate × (1 + contingency percentage ÷ 100). Indicative total = labor + sum of explicit one-time expenses. Contingency applies to labor only. The package contributions use the same factor. The pure model keeps exact millionths of a USD as integers and rounds half-up to cents for presentation. Package amounts may round differently from their exact aggregate. Display totals outside the safe cent range are unavailable. The rate and expenses accept nonnegative decimal values up to USD 1,000,000 with two decimal places; contingency accepts 0–100% with two decimal places. Empty rate or contingency makes labor unavailable; empty optional expenses mean zero. Invalid nonempty values make the affected result unavailable.

For 56–114 engineering hours, USD 7/hour and 15% contingency give USD 450.80–917.70 in labor (56 × 8.05 and 114 × 8.05). With USD 100 in assets and USD 25 in setup, the total is USD 575.80–1,042.70. For a rounding check, one hour at USD 1.01 with 50% contingency is exactly USD 1.515, displayed as USD 1.52. Two such packages total exactly USD 3.03 before presentation.

The estimator uses the existing Checkpoint 3 effort ranges and assumes a baseline for standard implementation and QA once per package. Increments represent only requirement-specific work. Engineering or priced RBAC triggers one permission-modeling increment, even if both are enabled. Queue demand and the jobs toggle share one processing increment; scheduling adds trigger-specific work. File volume and the upload feature share one integration increment for the workflow and storage. Tenant scoping is assigned to backend work; optional database row policies are separate incremental RLS work. Routine checks are baseline QA, while feature-specific checks are part of the relevant feature increment. The effort tables remain configurable through the existing model API. Whether hours overlap in a real statement of work still requires scope review.

Application and database hosting, object storage, a queue broker, email/external API usage, monitoring, and backups are separate operating-cost categories. They stay unpriced until relevant resource requirements, providers, regions, and billing assumptions are specified. The developer estimate excludes recurring costs, taxes, ongoing support, and expenses not entered. Checkpoint 6 can address final presentation and end-to-end polish without changing these formulas.

## Checkpoint 6: Integrated Studio and illustrative rate

The illustrative labor default is now USD 7/hour with 15% contingency. Explicit saved rates, including USD 15/hour in existing v1 drafts, are preserved. Reset restores USD 7/hour. The worked example above uses a factor of USD 8.05 per hour and retains the original fixed expenses. The Basic Project Configurator still uses its tier and add-on tables.

The unified hero holds the basic configurator and Advanced Architecture Mode. The Studio now links directly to workload and estimates, with a return link to preview and architecture. Advanced Mode keeps its workload and security inputs and uses the vetted capacity and commercial results in place of the earlier complexity score and delivery-days outputs. The original architecture model remains available to existing callers; its early heuristics are no longer rendered as a second estimate in the planner.

A headless Chrome production-preview profile at 1440 × 1000 sampled a stationary one-second window after startup. Before/after canvas clear calls were starfield 61/61, cursor trail 61/0, and offscreen engineering visualizer 61/0. The cursor trail now wakes on pointer activity and drains; the visualizer pauses outside the viewport. Reduced-motion mode uses a static starfield and renders only active or invalidated visualizer scenes. Resize callbacks avoid resetting unchanged canvas buffers. The same burst of 12 user-count input events replaced 48 full results sections before and none afterward. Direct child-list additions and removals in the results subtree were 48/48 before and 12/12 afterward, excluding descendant counts and character-data edits. Capacity cards, metric values, and formula disclosures retain their elements. Dispatch time in these individual runs was about 13.1 ms and 9.4 ms, respectively; these are local samples, not cross-device speed guarantees.

The startup sample requested only the small Performance card WebP in both builds, with no Planet GLB request. Browser checks loaded the GLB after scrolling to the viewer and decoded all twelve Stanza card and lightbox WebPs under the production base path. The contact dock already schedules work on pointer motion, Stanza pauses its timer offscreen, the live preview reconciles feature modules, and the SVG graph reuses stable nodes. Those paths did not require new animation loops.

## Checkpoint 7: System Universe

System Universe is the third Studio view. The architecture explorer builds the same graph for both architecture views and owns their shared selection and inspector. The central core represents the browser and frontend component. Each surrounding body represents an existing graph node. The curved channels represent graph connections, and the dotted orbits provide spatial context. The technical diagram and its linear outline remain available for connection directions and trust boundaries.

- `universe/scene.js` maps graph IDs and relationships to presentation models and handles keyboard navigation targets.
- `universe/layout.js` assigns stable slots by component ID and routes channels between them. The responsive view scales the same coordinates in both reading directions.
- `universe/view.js` reconciles native node buttons and SVG channels by ID. Changes to workload metrics update the shared inspector without rebuilding the scene. Tab reaches the selected node, arrow keys move selection, and Home or Escape returns to the core.
- `universe/motion.js` batches mouse parallax updates to one frame at a time. The motion layer stops when the view leaves the viewport, becomes hidden, or reduced motion is enabled. The scene uses CSS and SVG with no additional media assets or runtime packages.

The graph remains a conceptual architecture. The spatial layout conveys neither latency nor physical distance, and the decorative channels do not simulate traffic.

## Checkpoint 8: Creation Engine

System Universe now opens in Create. The anchored core uses a glyph and accent for the chosen template, with a summary of enabled preview capabilities and a link to the existing live preview. Architect reveals nodes and then channels on the same coordinates. Challenge keeps those nodes and the shared selection, adding scenario inputs and separate model telemetry below the scene.

Challenge drafts are held in memory per scenario. Unedited values follow the project settings, and “Restore project assumptions” clears the current scenario's overrides. Moving among views, stages, or templates keeps the drafts until the page reloads. The conventional diagram and shared inspector use the project configuration. Changes in Challenge do not write to the configuration store, persistence, or pricing.

- API uses the active-user calculation even when the project has a daily override. Channel brightness is a visual encoding of modeled burst RPS. The scenario has no API throughput limit.
- Queue uses total arrivals, mean duration, effective slots and target utilization. The rate must correspond to a whole number of daily jobs for the existing queue model. With four slots and 0.5 seconds per job, capacity is 8 jobs/s. At 6 jobs/s, utilization is 75% and above the default 70% target. At 8 jobs/s, utilization is 100% and backlog growth is zero. At 10 jobs/s, utilization is 125% and backlog grows by 172,800 jobs/day under sustained assumptions.
- Storage uses the project's item sizes and overhead. Audit logging and semantic search enable their respective categories. The model projects growth without assuming a storage quota.

Scenarios remain available when their main component is absent. In that case telemetry stays below the graph without introducing a synthetic node. These are planning calculations. Checkpoint 9 can address final integration and visual polish.

## Checkpoint 9: Final Creation Engine integration

Studio can collapse and reopen without replacing its workspace. The application controls, three views, and engineering estimate link continue to use the shared configuration. The side rail places the Create summary, component inspector, and Challenge status next to the scene on desktop. On narrow screens they stack, with an Adjust workload button that focuses the scenario picker. Short celestial labels are shown on wide layouts and appear on hover or keyboard focus on narrow layouts. The technical graph and its linear outline remain available.

The Universe keeps the same scene coordinates across stages. Nodes reveal by graph depth and their channels follow. Queue saturation and overload add distinct outlines and explicit status text. Reduced motion disables the reveal. Numeric input events in the same browser task coalesce into a single telemetry update.

In one 1440px Chromium production-preview sample, Universe idle animations and DOM mutations were zero before and after. A synchronous burst of 20 queue inputs produced 87 Universe mutations before and 4 after coalescing. Synchronous dispatch alone took about 3.1 ms and 0.2 ms, respectively. The deferred render is included in the mutation count. The background starfield still schedules a frame while visible in standard motion, but paints about 30 times per second instead of every frame. It stops scheduling when the page is hidden or reduced motion is active.

The existing Model Viewer runtime now loads when its section enters the viewport. If loading or decoding fails, the section shows a localized static-illustration fallback. The font stack and existing GSAP fallbacks retain the portfolio text, pricing and navigation when network resources are blocked. All three CDN URLs returned HTTP 200 in the host-side probe. The sandbox browser blocked them, so the active 3D renderer was outside that browser run.

Run `npm test` for unit coverage. To include the production workflow test, point `STUDIO_PREVIEW_URL` at Vite preview under `/portfolio/`, and set `STUDIO_CHROME_DEBUG` to a Chrome DevTools HTTP address for a disposable Chromium profile. The test clears local storage for the preview origin.

## How It Works

How It Works replaces the System Universe interface with ordered, template-specific request journeys. Scenario definitions live in `flow/scenarios.js`. The flow model uses the configured architecture graph for component roles and engineering notes. When a scenario needs an absent component, it uses the same builder to produce a read-only reference and labels the step as a scenario component. Playback and workload selection stay local to the view.

Queue presets use the existing capacity model at 4, 6, 8, and 10 arrivals per second with four slots, 0.5 seconds per job, and a 70% target. The view shows computed utilization, throughput capacity, and net backlog. The playback speed illustrates event order and is independent of the modeled throughput. No capacity thresholds are inferred for API or database steps.

### M1: Load Workspace interaction

The standalone baseline remains at `experiments/workspace-flow/`. Within How It Works, only the SaaS Load Workspace scenario uses the draggable route. `flow/request-motion.js` contains the capture radius, velocity projection, spring, path, and frame scheduling primitives. `flow/workspace.js` handles the browser presentation and emits launch intent. The existing flow reducer owns the active step and playback state. The readout advances on arrival, and pause keeps the last landed step. Reset and visibility changes cancel pending motion. Reduced motion skips automated travel and node pulses.

The workspace renderer consumes the same resolved scenario as the step list. The access socket represents session verification, tenant scope, or both according to the configured graph. It disappears when neither capability is present. All other scenarios keep their sequence and telemetry.

### M2 motion review

M1 used spring stiffness 365 and damping 27, with integration steps of at most 8 ms. Its magnetic radius was 103 px on desktop and 77 px on narrow layouts. Capture accepted a drop within 54 px or a recent velocity projection of 65 ms. The packet used cubic easing across 300–630 ms legs, a 305 ms curved handoff from drag, and 450 ms dwell at each arrival. Reduced motion stepped directly with a 950 ms dwell. Each arrival bounced its socket icon to 120% scale over 330 ms. The canvas repainted the whole route for each animated frame.

The M1 recording shows the route and readout clearly, but the magnet reads as a switch, the dragged packet loses its velocity at release, and each socket gives the same large pulse. The original step buttons seek directly but offer no continuous pointer target for scrubbing. The M2 motion pass starts from those observations.

M2 curves the magnetic falloff and uses distance to drive halo opacity. The drag handoff carries the spring's velocity into a bounded curve. Automated legs ease to rest at each socket, where the explanation advances and a damped reaction lights nearby connections. The static route is cached on a separate canvas from the short packet trail and arrival light. Quiet completed sockets and a mint response show where the request is in its journey.

The timeline is a native range with one stop per resolved scenario step. Scrubbing cancels ongoing travel and restores the packet, active socket, completed sockets, and readout at that stop. Play resumes from it. Previous, Next, Reset, and the timeline use the same reducer. Reduced motion preserves immediate step changes and omits travel and landing effects.

### M3: Checkout and Export Records

Checkout and Export Records use the same packet renderer, motion primitives, scrubber, and playback reducer as Load Workspace. Scenario steps identify the channel, any earlier branch origin, and the outcome reached at that step. The layout projects those steps onto sockets. Outcome badges are derived from the steps already reached, so scrubbing backwards removes confirmations and artifacts when appropriate.

Checkout commits the order in PostgreSQL and returns a frontend confirmation. With a configured queue, an amber fulfillment branch then starts at the API. The browser confirmation stays visible as that branch plays. Export queries records before generating a CSV, optionally through the configured queue and workers. A file-shaped socket represents the result, with configured storage used when present. Queue telemetry continues to use the existing illustrative capacity presets. The scene demonstrates event order and creates no actual order, export, or download.

### M4 — Preview action traces

The SaaS workspace button, a populated storefront cart, and the internal tool’s export control offer a contextual trace. The visitor chooses whether to open it. The preview passes a validated action, template, scenario ID, and optional fictional cart totals or record filter to the existing view controller. Those values label the trace. The configured architecture graph still decides which stages the request travels through.

Opening a trace selects its journey at step zero and focuses the scenario selector. The existing packet and playback controls launch and advance it. The preview reflects the workspace response, order confirmation, or export-ready stage when playback reaches it. Scrubbing back or resetting removes that feedback. Returning pauses playback, detaches the trace, and restores focus to the original control when it still exists. The returned preview retains the outcome from the last simulated step reached.

Each invitation has its own transient identity. A new action, cart or filter edit, template or language change, or Studio reset invalidates the previous invitation. Selecting a different journey or changing the active route’s component structure invalidates its playback callback. The bridge never writes to the configuration store, local storage, engineering models, or pricing.

### M5 — Interactive 3D content

`interactiveMedia` stores an enable flag, a registry asset ID, and a static, drag, or orbit mode. Version 1 drafts without these fields default to disabled. The 3D setting is a preview preference. It does not mutate paid add-ons, priced tiers, or commercial assumptions.

The asset registry currently contains `public/assets/Planet.glb`, a 1,634,372-byte glTF 2.0 binary with an embedded texture. The repo has no smaller variant or dedicated poster image. The preview uses a CSS illustration during loading or when WebGL or the existing Model Viewer CDN is unavailable. The planet appears in the landing hero, storefront product collection, SaaS media card, and internal tool asset inspection panel.

Studio and the standalone card share the pinned Model Viewer loader and lifecycle. The CDN script and local GLB load only when a viewer comes into view. The viewer disconnects when it leaves the viewport, the preview is hidden, the tab is hidden, or the template changes. Model Viewer unregisters the scene and can reuse the cached GLB when a viewer returns. Reduced motion suppresses auto orbit while retaining explicit camera input. The standalone wrapper also exposes Model Viewer's AR affordance on supported devices.

Additional assets belong in the registry with a verified local GLB path, translated name, category, and camera defaults. Review framing and asset weight at all preview widths. Add an appropriate fallback visual for the new asset type.

### M6 — Motion consolidation

The standalone card and its AR launch were retired. Studio remains the entry point for the shared Model Viewer, local asset registry, and static fallback. The viewer replaces the unused pan marker so a swipe can start at the center of the model. New configurations default to Drag to rotate with 3D disabled. Version 1 drafts retain valid saved preferences, and preview media settings stay separate from the quote.

Trace entry and return focus the destination control before scrolling it into the nearest visible position. The source and destination share an accent and use brief local feedback. The request routes, timing, and controls remain in the existing playback controller. Hidden views release the 3D element and finish pending graph or gallery transitions.

The architecture view coalesces same-task settings updates before redrawing. The request scene measures its geometry before resizing its canvases and avoids hidden measurements. The database visualizer draws once when it comes into view or changes size, then runs only for a search or compaction. The starfield reads its visual dimensions on resize. The cursor trail clears when input moves into a Studio, Stanza, or contact interaction.

### V1 — Load Workspace choreography

The SaaS preview keeps a compact request strip immediately below Load Workspace. On activation, the control compresses and releases while a cyan token drops from its lower edge into the UI socket. The token follows curved paths with a short fading tail. The API and database sockets spring briefly on arrival. The return is mint and follows a separate arc back through the API to the UI, which settles into the ready state.

For the default route, the UI receives the token at 240 ms, the API at 710 ms, and the database at 1,200 ms. The return reaches the API at 1,660 ms and the UI at 2,160 ms. The final pulse settles by about 2,400 ms. These are presentation timings for a simulated request. The strip only shows components present in the configured graph and shortens the route if a component is absent.

The existing trace invitation remains available throughout. A second activation cancels the first run and launches a fresh token. Leaving the preview, changing template or workspace, or hiding the tab cancels an unfinished run. Reduced motion resolves the interaction immediately and shows the same ready state. The prototype uses bounded element animations and the current fictional preview feedback, with no ambient animation or changes to pricing or saved state.

### V2 — Configuration-reactive workspace choreography

Load Workspace keeps the 2.4-second baseline. The preview reads the same resolved scenario as How It Works. Authentication or WebAuthn adds a Session checkpoint between API and database. Tenancy or row-level security adds a Scope checkpoint. When both checks apply, Access represents them in one socket, while the detailed trace presents each check individually. The token pauses briefly for a spring and a checkmark at that socket, then continues. These variants finish in about 2.7 seconds.

When a setting changes the route, the strip redraws the affected stage and gives it one restrained emphasis pulse. It does not launch a request. A route change cancels an in-flight run and clears its completion feedback. The trace invitation stays available. Reduced motion shows the changed label and route immediately, then resolves a launched request without motion.

Load Workspace has no modeled background step, so Background jobs does not add a branch even when the configuration includes a queue and workers. Theme, pricing and unrelated capabilities do not change the route.

### V3 — Interactive request field choreography

Load Workspace opens an in-dashboard layer from the compact route summary. It expands beneath the button over the dashboard cards, within the width of the mock application. The Studio controls and page layout stay in place. The token begins docked at UI and the next socket is highlighted.

Drag toward the highlighted socket to feel magnetic pull. Off-route motion has soft resistance. Release near the socket or flick toward it to carry momentum into the capture. A miss springs back to the last socket. Clicking, tapping, or activating the focused token with Enter or Space advances one hop. Run request continues from the current socket. Once the result is ready at the last request socket, the response follows the mint return path automatically. The existing access check remains between the API and database where configured.

Close or Escape dismisses the field. A completed trip shows Workspace ready for about one second before the field closes, and focus returns to the launch control if it was in the field. Opening again starts a fresh request. Reduced motion expands instantly and advances without animated travel. The layer closes on view, route, template, or layout changes and releases the pointer and any scheduled motion.
