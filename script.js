import './src/studio/preview-entry.js';
import { configuration } from './src/studio/configuration.js';
import { priceProject } from './src/studio/pricing.js';
import { bindArchitectureInputs, unbindArchitectureInputs } from './src/studio/architecture-inputs.js';

import { mountStanzaCardSwap } from './src/components/stanza-card-swap.js';
import { localizePortfolioControls, offerDesignStudio } from './src/components/portfolio-controls.js';
import { localizeArchitecturePlanner } from './src/components/architecture-planner.js';

// Global Parallax Starfield State
const bgCanvas = document.getElementById('starfield');
const bgCtx = bgCanvas ? bgCanvas.getContext('2d') : null;
let starfieldArray = [];
const STAR_COUNT = 240;
let lastFrameTime = performance.now();
let starfieldFrame = 0;
const starfieldMotion = matchMedia('(prefers-reduced-motion: reduce)');
let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;

// Dynamic L10n & Theme States
const i18nElements = document.querySelectorAll('[data-i18n]');
const themeToggle = document.getElementById('theme-toggle');
const langToggle = document.getElementById('lang-toggle');
let activeTranslations = {};

// Freelance Service Pricing Spec Variables
const tierSelect = document.getElementById('tier');
const activeTierVal = document.getElementById('active-tier-val');
const addons = document.querySelectorAll('.addon');
const priceDisplay = document.getElementById('price-display');
const tierSubtitle = document.getElementById('tier-subtitle');
const baselineLinks = document.querySelectorAll('.baseline-link');

// Systems Topology Interactive Map SVG State
const svgElement = document.getElementById('topology-svg');
const topologyNodeElements = document.querySelectorAll('.topology-node');
const pulsingTracer = document.getElementById('pulsing-tracer');

// Systems Code Viewer State Toggles
const tabBtnSql = document.getElementById('tab-btn-sql');
const tabBtnRls = document.getElementById('tab-btn-rls');
const codeBlockSql = document.getElementById('code-block-sql');
const codeBlockRls = document.getElementById('code-block-rls');

// Schematic Traversal Canvas State Variables
const visCanvas = document.getElementById('visualizer-canvas');
const visCtx = visCanvas ? visCanvas.getContext('2d') : null;
const garbageCollectBtn = document.getElementById('compact-heap-btn');
const searchKeyBtns = document.querySelectorAll('.search-key-btn');
const terminalLogs = document.getElementById('terminal-logs');

let visualizerLoopMode = "tree"; // "tree" or "heap"
let visWidth = 500;
let visHeight = 350;

// Traversal States
let querySearching = false;
let tracePathNodes = [];
let activeSearchIndex = 0;
let progressDelta = 0;
let targetQueryKey = null;

// Memory Compaction States
let garbageCollecting = false;
let ramBlocks = [];
const RAM_GRID_COLS = 8;
const RAM_GRID_ROWS = 8;
const TOTAL_RAM_BLOCKS = RAM_GRID_COLS * RAM_GRID_ROWS;

// Flagship Project Showcase Toggles
const projectSelectors = document.querySelectorAll('.flagship-selector');
const documentationPanes = document.querySelectorAll('.flagship-pane');
const stanzaShowcaseRoot = document.querySelector('[data-stanza-showcase]');
let stanzaShowcase;
if (import.meta.hot) import.meta.hot.dispose(() => stanzaShowcase?.destroy());

// ==========================================================================
// 1. DYNAMIC SYSTEM PARALLAX STARFIELD
// ==========================================================================
window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

window.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches[0]) {
        mouseX = e.touches[0].clientX;
        mouseY = e.touches[0].clientY;
    }
}, { passive: true });

let starfieldWidth = 0;
let starfieldHeight = 0;

function resizeStarfield() {
    if (!bgCanvas || !bgCtx) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    starfieldWidth = window.innerWidth;
    starfieldHeight = window.innerHeight;
    const width = Math.floor(starfieldWidth * dpr);
    const height = Math.floor(starfieldHeight * dpr);
    if (bgCanvas.width === width && bgCanvas.height === height && bgCanvas.style.width === `${starfieldWidth}px`) return;
    bgCanvas.width = width;
    bgCanvas.height = height;
    bgCanvas.style.width = `${starfieldWidth}px`;
    bgCanvas.style.height = `${starfieldHeight}px`;
    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (starfieldMotion.matches) drawStarfield();
}

function initStarfield() {
    starfieldArray = [];
    for (let i = 0; i < STAR_COUNT; i++) {
        starfieldArray.push({
            x: Math.random() * window.innerWidth * 2 - window.innerWidth,
            y: Math.random() * window.innerHeight * 2 - window.innerHeight,
            z: Math.random() * window.innerWidth + 0.001,
            baseDim: Math.random() * 1.5 + 0.4
        });
    }
}

function drawStarfield(currentTime = performance.now()) {
    if (!bgCanvas || !bgCtx) return;
    const delta = Math.min(2.5, (currentTime - lastFrameTime) / 16.6);
    lastFrameTime = currentTime;

    const driftCoef = starfieldMotion.matches ? 0 : 0.85;
    const scrollStep = driftCoef * delta;
    
    const displayWidth = starfieldWidth;
    const displayHeight = starfieldHeight;
    
    bgCtx.clearRect(0, 0, displayWidth, displayHeight);
    const cx = displayWidth / 2;
    const cy = displayHeight / 2;
    
    const scaleX = (mouseX - cx) * 0.015;
    const scaleY = (mouseY - cy) * 0.015;

    starfieldArray.forEach(star => {
        star.z -= scrollStep;
        if (star.z <= 2) {
            star.z = displayWidth;
            star.x = Math.random() * displayWidth * 2 - displayWidth;
            star.y = Math.random() * displayHeight * 2 - displayHeight;
        }

        const projectScale = Math.max(0.001, displayWidth / star.z);
        const px = (star.x - scaleX * (1 + star.z / displayWidth * 0.25)) * projectScale + cx;
        const py = (star.y - scaleY * (1 + star.z / displayWidth * 0.25)) * projectScale + cy;

        const opacity = Math.max(0.1, Math.min(0.9, 1 - star.z / displayWidth));
        // Draw starry points
        bgCtx.fillStyle = `rgba(180, 215, 255, ${opacity})`;
        bgCtx.beginPath();
        bgCtx.arc(px, py, Math.max(0.4, star.baseDim * projectScale), 0, Math.PI * 2);
        bgCtx.fill();
    });

}

function animateStarfield(currentTime) {
    if (currentTime - lastFrameTime >= 30) drawStarfield(currentTime);
    starfieldFrame = requestAnimationFrame(animateStarfield);
}

function syncStarfieldMotion() {
    cancelAnimationFrame(starfieldFrame);
    starfieldFrame = 0;
    if (document.hidden || !bgCtx) return;
    if (starfieldMotion.matches) drawStarfield();
    else {
        lastFrameTime = performance.now();
        starfieldFrame = requestAnimationFrame(animateStarfield);
    }
}
// =========================================================================
// 2. BIDIRECTIONAL SCHEMA L10N & CRYSTAL THEMING
// =========================================================================
const supportedLocales = new Set(['en', 'ar']);
let locale = 'en';

function normalizeLocale(value) {
    const normalized = String(value || '').toLowerCase().slice(0, 2);
    return supportedLocales.has(normalized) ? normalized : 'en';
}

function getPreferredLocale() {
    const params = new URLSearchParams(window.location.search);
    const requestedLocale = params.get('lang') || params.get('locale');
    const storedLocale = localStorage.getItem('user_language') || localStorage.getItem('awad-portfolio-lang');
    return normalizeLocale(requestedLocale || storedLocale || navigator.language || 'en');
}

async function loadLocale(nextLocale = getPreferredLocale()) {
    locale = normalizeLocale(nextLocale);

    try {
        // Dynamically load only the needed module over the wire
        const module = await import(`./translations/${locale}.js`);
        activeTranslations = module.lang;
    } catch (error) {
        console.error("Critical: Failed to resolve localization chunk", error);
        // Minimal emergency recovery layout if module fails
        activeTranslations = { badgeOnline: "Available", name: "Shady Awad" };
        locale = 'en';
    }
}

function renderLanguage(lang) {
    const dict = activeTranslations;

    i18nElements.forEach(elem => {
        const key = elem.dataset.i18n;
        if (!dict[key]) return;
        const value = dict[key];
        if (elem.hasAttribute('data-stanza-brand') && value.includes('Stanza')) {
            const index = value.indexOf('Stanza');
            const brand = document.createElement('span');
            brand.className = 'stanza-brand';
            brand.textContent = 'Stanza';
            elem.replaceChildren(value.slice(0, index), brand, value.slice(index + 6));
        } else {
            elem.textContent = value;
        }
    });

    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localizePortfolioControls(dict);
    localizeArchitecturePlanner(lang);
    if (tierSelect) renderTierCopy(getActiveServiceTier());

    if (stanzaShowcaseRoot && dict.stanzaGallery) {
        if (stanzaShowcase) stanzaShowcase.localize(dict.stanzaGallery, lang);
        else stanzaShowcase = mountStanzaCardSwap(stanzaShowcaseRoot, dict.stanzaGallery, lang);
    }

    if (langToggle) {
        langToggle.textContent = lang === 'en' ? 'AR' : 'EN';
    }

    localStorage.setItem('user_language', lang);
    localStorage.setItem('awad-portfolio-lang', lang);
}

async function updateLanguage(lang) {
    await loadLocale(lang);
    renderLanguage(locale);
}

function updateTheme(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem('awad-portfolio-theme', mode);
}

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = cur === 'dark' ? 'light' : 'dark';
        updateTheme(next);
    });
}

if (langToggle) {
    langToggle.addEventListener('click', async () => {
        const cur = locale || document.documentElement.lang || 'en';
        const next = cur === 'en' ? 'ar' : 'en';
        await updateLanguage(next);
    });
}

async function startL10nTheme() {
    const savedTheme = localStorage.getItem('awad-portfolio-theme') || 'dark';
    updateTheme(savedTheme);
    await loadLocale();
    renderLanguage(locale);
}

// ==========================================
// 3. INTERACTIVE FREELANCE SERVICE ESTIMATOR
// ==========================================
const serviceTiers = [
    {
        id: 1,
        name: "Tier 1: Static Blueprint",
        subtitle: "High-performance single-page layout or landing page.",
        color: "#38d5ff",
        glow: "0 0 14px rgba(56, 213, 255, 0.28)"
    },
    {
        id: 2,
        name: "Tier 2: Dynamic Multi-View",
        subtitle: "Multi-page architecture with localized routing and client-side global state.",
        color: "#2dd4bf",
        glow: "0 0 14px rgba(45, 212, 191, 0.28)"
    },
    {
        id: 3,
        name: "Tier 3: Full-Stack Core + AI",
        subtitle: "Database integrated MVP, user dashboards, and basic AI API integration (automated text/summarization).",
        color: "#39ff88",
        glow: "0 0 18px rgba(57, 255, 136, 0.38)"
    },
    {
        id: 4,
        name: "Tier 4: Enterprise Secure & Cognitive",
        subtitle: "Scale-ready app featuring multi-tenant isolation, advanced PostgreSQL RLS, and custom AI vector search/embeddings.",
        color: "#9dff6a",
        glow: "0 0 20px rgba(157, 255, 106, 0.36)"
    },
    {
        id: 5,
        name: "Tier 5: Bespoke Interactive Canvas",
        subtitle: "Premium mathematically reactive 3D rendering, custom Blender assets, and real-time data streaming.",
        color: "#d6a93a",
        glow: "0 0 24px rgba(214, 169, 58, 0.52)"
    }
];

let lastEstimatorLogSignature = "";

function formatUSD(val) {
    return val.toLocaleString('en-US');
}

function getActiveServiceTier(state = configuration.getState()) {
    return serviceTiers[state.pricingTier - 1];
}

function applyPriceMetricStyle(tier) {
    if (!priceDisplay) return;
    priceDisplay.style.color = tier.color;
    priceDisplay.style.textShadow = tier.glow;
    priceDisplay.style.transform = tier.id === 5 ? "scale(1.04)" : "scale(1)";
}

function injectEstimatorLogs(tier, hasAIAddon) {
    if (typeof appendLog !== 'function') return;

    const hasAITier = tier.id === 3 || tier.id === 4;
    const signature = `${tier.id}:${hasAIAddon}:${hasAITier}`;
    if (signature === lastEstimatorLogSignature) return;
    lastEstimatorLogSignature = signature;

    if (tier.id <= 2) {
        appendLog("[SYSTEM INFO] Instantiating high-performance static client engine.", "system-line");
    } else if (tier.id <= 4) {
        appendLog("[DATABASE MONITOR] Relational schema active. Row-Level Security listener attached.", "traversal-line");
    } else {
        appendLog("[ORBITAL MONITOR] 3D asset canvas loop rendering at 60FPS.", "system-line");
    }

    if (hasAITier || hasAIAddon) {
        appendLog("[AI CORE] Vector embedding pipeline initialized. Cognitive model latency: 12ms.", "system-line");
    }
}

function renderTierCopy(tier) {
    if (activeTierVal) {
        activeTierVal.textContent = activeTranslations[`tier${tier.id}`] ?? tier.name;
        activeTierVal.style.color = tier.color;
    }
    if (tierSubtitle) {
        tierSubtitle.textContent = activeTranslations.tierDetails?.[tier.id - 1] ?? tier.subtitle;
    }
}

let priceTween;

function renderPricing(state) {
    if (!tierSelect || !priceDisplay) return;
    const tier = getActiveServiceTier(state);
    const { base, total: targetPrice } = priceProject(state);
    const oldPrice = Number(priceDisplay.textContent.replaceAll(',', '')) || base;
    const hasAIAddon = state.features.ai;

    tierSelect.value = String(state.pricingTier);
    for (const box of addons) box.checked = state.features[box.id.slice(4)];

    renderTierCopy(tier);

    baselineLinks.forEach(link => {
        link.classList.toggle('active', Number(link.dataset.tierIndex) === tier.id);
    });

    applyPriceMetricStyle(tier);
    injectEstimatorLogs(tier, hasAIAddon);

    priceTween?.kill();
    priceDisplay.dataset.price = targetPrice;
    if (window.gsap && !starfieldMotion.matches && oldPrice !== targetPrice) {
        priceTween = gsap.to({ val: oldPrice }, {
            val: targetPrice,
            duration: 0.16, // Ultra fast ticks
            ease: 'none',
            onUpdate() {
                 const currentTickVal = Math.round(this.targets()[0].val);
                 const price = formatUSD(currentTickVal);
                 if (priceDisplay.textContent !== price) priceDisplay.textContent = price;
            },
            onComplete() {
                 priceDisplay.textContent = formatUSD(targetPrice);
            }
        });
    } else {
        priceDisplay.textContent = formatUSD(targetPrice);
    }
}

const pricingEvents = new AbortController();
const pricingOptions = { signal: pricingEvents.signal };
starfieldMotion.addEventListener('change', () => {
    if (!starfieldMotion.matches || !priceDisplay?.dataset.price) return;
    priceTween?.kill();
    priceDisplay.textContent = formatUSD(Number(priceDisplay.dataset.price));
}, pricingOptions);

baselineLinks.forEach(link => {
    link.addEventListener('click', event => {
        event.preventDefault();
        if (configuration.getState().pricingTier !== Number(link.dataset.tierIndex)) offerDesignStudio(event);
        configuration.update({ pricingTier: Number(link.dataset.tierIndex) });
    }, pricingOptions);
});

tierSelect?.addEventListener('input', event => {
    if (configuration.getState().pricingTier !== Number(tierSelect.value)) offerDesignStudio(event);
    configuration.update({ pricingTier: Number(tierSelect.value) });
}, pricingOptions);
addons.forEach(box => {
    box.addEventListener('change', event => {
        if (configuration.getState().features[box.id.slice(4)] !== box.checked) offerDesignStudio(event);
        configuration.update({ features: { [box.id.slice(4)]: box.checked } });
    }, pricingOptions);
});

const unsubscribePricing = configuration.subscribe((state, previous) => {
    if (state.pricingTier !== previous.pricingTier ||
        Object.keys(state.features).some(key => state.features[key] !== previous.features[key])) {
        renderPricing(state);
    }
});
const architectureInputs = document.getElementById('architecture-planner');
bindArchitectureInputs(architectureInputs);

if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        pricingEvents.abort();
        unsubscribePricing();
        unbindArchitectureInputs(architectureInputs);
        priceTween?.kill();
    });
}

// ==========================================================================
// 4. SYSTEMS TOPOLOGY SVG INTERACTIVE FLOW ENGINE
// ==========================================================================
function triggerSvgTracerPulse(startSelector, endSelector) {
    if (starfieldMotion.matches) return;
    const startNode = document.querySelector(startSelector);
    const endNode = document.querySelector(endSelector);
    if (!startNode || !endNode || !pulsingTracer || !svgElement) return;
    
    // 1. Create native SVG points for transformation matrix math
    const ptStart = svgElement.createSVGPoint();
    const ptEnd = svgElement.createSVGPoint();
    
    // 2. Map to your actual classes (.node-header / .node-rect) or fallback to the parent <g>
    const startRect = startNode.querySelector('.node-header') || startNode.querySelector('.node-rect') || startNode;
    const endRect = endNode.querySelector('.node-header') || endNode.querySelector('.node-rect') || endNode;
    
    const startBox = startRect.getBoundingClientRect();
    const endBox = endRect.getBoundingClientRect();
    
    // Calculate center screen coordinates
    ptStart.x = startBox.left + (startBox.width / 2);
    ptStart.y = startBox.top + (startBox.height / 2);
    
    ptEnd.x = endBox.left + (endBox.width / 2);
    ptEnd.y = endBox.top + (endBox.height / 2);
    
    // 3. Perfect pixel-to-SVG viewbox conversion using Inverse CTM Matrix
    const svgInverseMatrix = svgElement.getScreenCTM().inverse();
    const localStart = ptStart.matrixTransform(svgInverseMatrix);
    const localEnd = ptEnd.matrixTransform(svgInverseMatrix);
    
    // 4. Anchor tracer to start position
    pulsingTracer.setAttribute('cx', localStart.x);
    pulsingTracer.setAttribute('cy', localStart.y);
    pulsingTracer.style.display = 'block';

    // 5. Fire GSAP animation
    if (window.gsap) {
        gsap.to(pulsingTracer, {
            attr: {
                cx: localEnd.x,
                cy: localEnd.y
            },
            duration: 0.6,
            ease: "power2.inOut",
            onComplete() {
                pulsingTracer.style.display = 'none';
                
                // Set the transform-origin directly on the <g> block so it scales gracefully from its center
                gsap.fromTo(endNode, 
                    { transformOrigin: "50% 50%", scale: 1 }, 
                    { scale: 1.04, duration: 0.15, yoyo: true, repeat: 1, ease: "power1.inOut" }
                );
            }
        });
    } else {
        pulsingTracer.setAttribute('cx', localEnd.x);
        pulsingTracer.setAttribute('cy', localEnd.y);
        setTimeout(() => { pulsingTracer.style.display = 'none'; }, 200);
    }
}

// Mouse click probes triggers log messages inside the console stream
topologyNodeElements.forEach(node => {
    node.addEventListener('click', () => {
        topologyNodeElements.forEach(n => n.classList.remove('active-node'));
        node.classList.add('active-node');
        
        const nodeId = node.id;
        if (nodeId === 'node-orgs-elem') {
            appendLog(`AUDIT PROBE: Running hierarchy recursion validation over 'tbl_organizations'`, "system-line");
            triggerSvgTracerPulse('#node-orgs-elem', '#node-tenants-elem');
        } else if (nodeId === 'node-tenants-elem') {
            appendLog(`AUDIT PROBE: Shifting connection endpoints. Verification parsing for tenant isolation keys...`, "traversal-line");
            triggerSvgTracerPulse('#node-tenants-elem', '#node-users-elem');
        } else if (nodeId === 'node-users-elem') {
            appendLog(`AUDIT PROBE: Asserting integrity check for Argon2id hashing algorithms inside credentials tree`, "traversal-line");
            triggerSvgTracerPulse('#node-users-elem', '#node-transactions-elem');
        } else if (nodeId === 'node-transactions-elem') {
            appendLog(`AUDIT PROBE: Row-Level Security assertion validated! Row isolation verified at kernel boundary.`, "system-line");
            triggerSvgTracerPulse('#node-transactions-elem', '#node-tenants-elem');
        }
    });
});

// Systems architecture layout code togglers
if (tabBtnSql && tabBtnRls) {
    tabBtnSql.addEventListener('click', () => {
        tabBtnSql.classList.add('active');
        tabBtnRls.classList.remove('active');
        codeBlockSql.classList.add('active');
        codeBlockRls.classList.remove('active');
        appendLog(`CODE DISPATCHER: SQL query buffer mapping view refreshed.`, "system-line");
    });
    
    tabBtnRls.addEventListener('click', () => {
        tabBtnRls.classList.add('active');
        tabBtnSql.classList.remove('active');
        codeBlockRls.classList.add('active');
        codeBlockSql.classList.remove('active');
        appendLog(`CODE DISPATCHER: PostgreSQL engine active RLS rule parameters loaded.`, "system-line");
    });
}

// ==========================================================================
// 5. DIAGRAM TRAVERSAL & MEMORY ALLOCATOR SCHEMATICS
// ==========================================================================
function appendLog(msg, typeClass = "") {
    if (!terminalLogs) return;
    const lLine = document.createElement('li');
    lLine.className = 'terminal-log-line ' + typeClass;
    const timestamp = new Date();
    const formattedTs = `[${timestamp.getHours().toString().padStart(2,'0')}:${timestamp.getMinutes().toString().padStart(2,'0')}:${timestamp.getSeconds().toString().padStart(2,'0')}]`;
    lLine.innerText = `${formattedTs} ${msg}`;
    terminalLogs.appendChild(lLine);
    terminalLogs.parentElement.scrollTop = terminalLogs.parentElement.scrollHeight;
}

// Traversal tree dataset coordinates
const traversalTree = {
    root: { keys: [40], children: ["b_L", "b_R"], id: "root", tag: "Index Prt 0x01", depth: 0 },
    b_L: { keys: [20], children: ["l_1", "l_2"], id: "b_L", tag: "Branch Latencies L", depth: 1 },
    b_R: { keys: [60], children: ["l_3", "l_4"], id: "b_R", tag: "Branch Latencies R", depth: 1 },
    l_1: { keys: [10, 15], id: "l_1", tag: "Leaf Offset A1", offset: "0x12FA", depth: 2 },
    l_2: { keys: [25, 32], id: "l_2", tag: "Leaf Offset B2", offset: "0x34C8", depth: 2 },
    l_3: { keys: [45, 52], id: "l_3", tag: "Leaf Offset C3", offset: "0x56E2", depth: 2 },
    l_4: { keys: [78, 82], id: "l_4", tag: "Leaf Offset D4", offset: "0x78F6", depth: 2 }
};

function initMemoryGrid() {
    ramBlocks = [];
    const reservedSize = 6;
    for (let i = 0; i < TOTAL_RAM_BLOCKS; i++) {
        let type = "free";
        if (i < reservedSize) {
            type = "reserved";
        } else {
            type = Math.random() < 0.42 ? "allocated" : "free";
        }
        
        ramBlocks.push({
            orig: i,
            curr: i,
            x: 0,
            y: 0,
            type: type,
            address: "PAGE_0x" + (i * 128).toString(16).toUpperCase().padStart(4, "0")
        });
    }
}

function resizeVisCanvas() {
    if (!visCanvas || !visCtx) return;
    const p = visCanvas.parentElement;
    if (!p) return;
    
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    visWidth = p.clientWidth;
    visHeight = p.clientHeight || 350;
    
    const width = Math.floor(visWidth * dpr);
    const height = Math.floor(visHeight * dpr);
    if (visCanvas.width === width && visCanvas.height === height && visCanvas.style.width === `${visWidth}px`) return;
    visCanvas.width = width;
    visCanvas.height = height;
    visCanvas.style.width = `${visWidth}px`;
    visCanvas.style.height = `${visHeight}px`;
    visCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (visualizerInView) scheduleVisualizer();
}

function resolveCoords(nodeId) {
    const rx = visWidth / 2;
    const ry = visHeight * 0.16;
    const by = visHeight * 0.48;
    const ly = visHeight * 0.80;

    const bLX = visWidth * 0.28;
    const bRX = visWidth * 0.72;

    const l1X = visWidth * 0.14;
    const l2X = visWidth * 0.38;
    const l3X = visWidth * 0.62;
    const l4X = visWidth * 0.86;

    switch (nodeId) {
        case "root": return { x: rx, y: ry };
        case "b_L": return { x: bLX, y: by };
        case "b_R": return { x: bRX, y: by };
        case "l_1": return { x: l1X, y: ly };
        case "l_2": return { x: l2X, y: ly };
        case "l_3": return { x: l3X, y: ly };
        case "l_4": return { x: l4X, y: ly };
    }
    return { x: 0, y: 0 };
}

function drawSchemaNode(node, highlight) {
    const c = resolveCoords(node.id);
    const w = 74;
    const h = 34;
    const x = c.x - w / 2;
    const y = c.y - h / 2;

    visCtx.beginPath();
    visCtx.roundRect(x, y, w, h, 8);
    if (highlight) {
        visCtx.strokeStyle = "var(--accent)";
        visCtx.lineWidth = 2;
        visCtx.fillStyle = "rgba(0, 212, 255, 0.12)";
        visCtx.shadowBlur = 10;
        visCtx.shadowColor = "var(--accent)";
    } else {
        visCtx.strokeStyle = "var(--border)";
        visCtx.lineWidth = 1;
        visCtx.fillStyle = "rgba(12, 16, 29, 0.88)";
        visCtx.shadowBlur = 0;
    }
    visCtx.fill();
    visCtx.stroke();
    visCtx.shadowBlur = 0;

    // Node Key text
    visCtx.fillStyle = highlight ? "#ffffff" : "var(--text)";
    visCtx.font = "bold 10px 'JetBrains Mono', monospace";
    visCtx.textAlign = "center";
    visCtx.textBaseline = "middle";
    visCtx.fillText(`[ ${node.keys.join(" | ")} ]`, c.x, c.y);

    // Node memory partition indexes indicators
    visCtx.fillStyle = highlight ? "var(--accent)" : "var(--muted)";
    visCtx.font = "7px 'JetBrains Mono', monospace";
    visCtx.fillText(node.tag, c.x, c.y - 22);
}

function drawTreeSimulation() {
    visCtx.clearRect(0, 0, visWidth, visHeight);

    // Connect node lines
    visCtx.lineWidth = 1;
    visCtx.strokeStyle = "rgba(125, 187, 255, 0.12)";
    
    const rootC = resolveCoords("root");
    const bLC = resolveCoords("b_L");
    const bRC = resolveCoords("b_R");
    
    visCtx.beginPath();
    visCtx.moveTo(rootC.x, rootC.y + 17);
    visCtx.lineTo(bLC.x, bLC.y - 17);
    visCtx.moveTo(rootC.x, rootC.y + 17);
    visCtx.lineTo(bRC.x, bRC.y - 17);
    visCtx.stroke();

    const l1C = resolveCoords("l_1");
    const l2C = resolveCoords("l_2");
    visCtx.beginPath();
    visCtx.moveTo(bLC.x, bLC.y + 17);
    visCtx.lineTo(l1C.x, l1C.y - 17);
    visCtx.moveTo(bLC.x, bLC.y + 17);
    visCtx.lineTo(l2C.x, l2C.y - 17);
    visCtx.stroke();

    const l3C = resolveCoords("l_4");
    const l4C = resolveCoords("l_3");
    visCtx.beginPath();
    visCtx.moveTo(bRC.x, bRC.y + 17);
    visCtx.lineTo(l4C.x, l4C.y - 17);
    visCtx.moveTo(bRC.x, bRC.y + 17);
    visCtx.lineTo(l3C.x, l3C.y - 17);
    visCtx.stroke();

    // Render nodes
    Object.keys(traversalTree).forEach(id => {
        const node = traversalTree[id];
        const isVisited = tracePathNodes.slice(0, activeSearchIndex + 1).some(n => n.id === node.id);
        drawSchemaNode(node, isVisited);
    });

    // Tracer simulation ticks pulse
    if (querySearching && tracePathNodes.length > 0) {
        progressDelta += starfieldMotion.matches ? 1 : 0.05;
        if (progressDelta >= 1) {
            progressDelta = 0;
            activeSearchIndex++;
            
            if (activeSearchIndex < tracePathNodes.length) {
                const stepNode = tracePathNodes[activeSearchIndex];
                if (stepNode.depth === 1) {
                    appendLog(`B-TREE SCAN: Branch matching validated. Route target ${targetQueryKey} vs key [${stepNode.keys.join(',')}].`, "traversal-line");
                } else if (stepNode.depth === 2) {
                    appendLog(`B-TREE LEAF MATCH: Compiling offset page records traversal scans...`, "traversal-line");
                }
            } else {
                querySearching = false;
                const endLeaf = tracePathNodes[tracePathNodes.length - 1];
                appendLog(`QUERY COMPLETE: Resolved key ${targetQueryKey} mapped at Page ${endLeaf.id.toUpperCase()} (Index Address Offset: ${endLeaf.offset}).`, "system-line");
                searchKeyBtns.forEach(b => b.classList.remove('active-key'));
            }
        }

        if (querySearching && activeSearchIndex < tracePathNodes.length - 1) {
            const nodeA = tracePathNodes[activeSearchIndex];
            const nodeB = tracePathNodes[activeSearchIndex + 1];
            const coordA = resolveCoords(nodeA.id);
            const coordB = resolveCoords(nodeB.id);

            const tracerX = coordA.x + (coordB.x - coordA.x) * progressDelta;
            const tracerY = coordA.y + 17 + (coordB.y - 17 - (coordA.y + 17)) * progressDelta;

            visCtx.beginPath();
            visCtx.arc(tracerX, tracerY, 4.5, 0, Math.PI * 2);
            visCtx.fillStyle = "#eb4899";
            visCtx.shadowBlur = 8;
            visCtx.shadowColor = "#eb4899";
            visCtx.fill();
            visCtx.shadowBlur = 0;
        }
    }
}

function executeTreeSearch(targetKey) {
    if (querySearching) return;
    targetQueryKey = targetKey;
    querySearching = true;
    activeSearchIndex = 0;
    progressDelta = 0;
    visualizerLoopMode = "tree";

    tracePathNodes = [traversalTree.root];
    appendLog(`QUERY INITIATE: scanning index pointers for target key ${targetKey}`, "system-line");
    appendLog(`B-TREE SCAN: Comparative root scan. Key ${targetKey} vs Anchor Key [${traversalTree.root.keys[0]}].`, "traversal-line");

    if (targetKey < 40) {
        tracePathNodes.push(traversalTree.b_L);
        if (targetKey < 20) {
            tracePathNodes.push(traversalTree.l_1);
        } else {
            tracePathNodes.push(traversalTree.l_2);
        }
    } else {
        tracePathNodes.push(traversalTree.b_R);
        if (targetKey < 60) {
            tracePathNodes.push(traversalTree.l_3);
        } else {
            tracePathNodes.push(traversalTree.l_4);
        }
    }
}

function drawHeapGrid() {
    visCtx.clearRect(0, 0, visWidth, visHeight);
    
    const spacing = 6;
    const maxSquare = Math.min(visWidth * 0.82, visHeight * 0.85);
    const boxSize = Math.floor((maxSquare - spacing * 8) / 8);
    const finalGridSize = (boxSize + spacing) * 8;
    const sx = (visWidth - finalGridSize) / 2;
    const sy = (visHeight - finalGridSize) / 2;

    let defragmentationComplete = true;

    ramBlocks.forEach((b) => {
        const row = Math.floor(b.curr / RAM_GRID_COLS);
        const col = b.curr % RAM_GRID_COLS;
        const targetXCoord = sx + col * (boxSize + spacing);
        const targetYCoord = sy + row * (boxSize + spacing);

        if (b.x === 0 && b.y === 0) {
            b.x = targetXCoord;
            b.y = targetYCoord;
        }

        const deltaX = targetXCoord - b.x;
        const deltaY = targetYCoord - b.y;

        if (Math.abs(deltaX) > 0.1 || Math.abs(deltaY) > 0.1) {
            b.x += deltaX * (starfieldMotion.matches ? 1 : 0.14);
            b.y += deltaY * (starfieldMotion.matches ? 1 : 0.14);
            defragmentationComplete = false;
        } else {
            b.x = targetXCoord;
            b.y = targetYCoord;
        }

        // Palette selector mapping
        if (b.type === "reserved") {
            visCtx.fillStyle = "rgba(56, 189, 248, 0.15)";
            visCtx.strokeStyle = "rgba(56, 189, 248, 0.45)";
        } else if (b.type === "allocated") {
            visCtx.fillStyle = "rgba(0, 212, 255, 0.72)";
            visCtx.strokeStyle = "rgba(0, 212, 255, 0.95)";
        } else {
            visCtx.fillStyle = "rgba(10, 14, 28, 0.82)";
            visCtx.strokeStyle = "rgba(125, 187, 255, 0.08)";
        }

        visCtx.lineWidth = 1;
        visCtx.beginPath();
        visCtx.roundRect(b.x, b.y, boxSize, boxSize, 5);
        visCtx.fill();
        visCtx.stroke();
    });

    if (garbageCollecting && defragmentationComplete) {
        garbageCollecting = false;
        appendLog("GARBAGE COLLECTOR SUCCESS: Heap defragmented. Memory maps consolidated with zero page failures.", "system-line");
    }
}

function triggerMemoryCompaction() {
    if (garbageCollecting) return;
    visualizerLoopMode = "heap";
    garbageCollecting = true;
    appendLog("GARBAGE COLLECTION: Purging dead heap space and shifting reference registers...", "system-line");

    const reservedGroup = ramBlocks.filter(b => b.type === "reserved");
    const allocatedGroup = ramBlocks.filter(b => b.type === "allocated");
    const freeGroup = ramBlocks.filter(b => b.type === "free");

    appendLog(`MEM STATISTICS: active_allocations=${allocatedGroup.length} reserved_sys_blocks=${reservedGroup.length} freed_blocks=${freeGroup.length}`, "traversal-line");

    let counter = 0;
    reservedGroup.forEach(b => { b.curr = counter++; });
    allocatedGroup.forEach(b => { b.curr = counter++; });
    freeGroup.forEach(b => { b.curr = counter++; });
}

let visualizerInView = false;
let visualizerFrame = 0;

function scheduleVisualizer() {
    if (!visualizerFrame && visualizerInView && !document.hidden) {
        visualizerFrame = requestAnimationFrame(systemVisualizerTickLoop);
    }
}

function systemVisualizerTickLoop() {
    visualizerFrame = 0;
    if (!visualizerInView || document.hidden || !visCtx) return;
    if (visualizerLoopMode === "tree") drawTreeSimulation();
    else drawHeapGrid();
    if (querySearching || garbageCollecting) scheduleVisualizer();
}

function observeVisualizer() {
    if (!visCanvas) return;
    const events = new AbortController();
    const size = new ResizeObserver(resizeVisCanvas);
    size.observe(visCanvas.parentElement);
    const observer = new IntersectionObserver(([entry]) => {
        visualizerInView = entry.isIntersecting;
        if (visualizerInView) scheduleVisualizer();
        else {
            cancelAnimationFrame(visualizerFrame);
            visualizerFrame = 0;
        }
    });
    observer.observe(visCanvas);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            cancelAnimationFrame(visualizerFrame);
            visualizerFrame = 0;
        } else scheduleVisualizer();
    }, { signal: events.signal });
    return () => {
        events.abort();
        size.disconnect();
        observer.disconnect();
        cancelAnimationFrame(visualizerFrame);
        visualizerFrame = 0;
    };
}

// Setup canvas metrics click listeners triggers
searchKeyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        if (querySearching || garbageCollecting) return;
        searchKeyBtns.forEach(b => b.classList.remove('active-key'));
        btn.classList.add('active-key');
        
        const coreKey = parseInt(btn.dataset.key);
        executeTreeSearch(coreKey);
        scheduleVisualizer();
    });
});

if (garbageCollectBtn) {
    garbageCollectBtn.addEventListener('click', () => {
        if (querySearching || garbageCollecting) return;
        triggerMemoryCompaction();
        scheduleVisualizer();
    });
}

// ==========================================================================
// 6. DYNAMIC FLAGSHIP PROJECT SHEETS SLIDER
// ==========================================================================
const repoLink = document.getElementById('explore-repositories-trigger');

document.querySelectorAll('[data-project-repository]').forEach(link => {
    link.addEventListener('click', () => {
        appendLog(
            `SYSTEM REDIRECT: Resolving remote secure VCS repository link.`,
            "system-line"
        );
    });
});

projectSelectors.forEach(selector => {
    selector.addEventListener('click', () => {
        const targetProj = selector.dataset.project;

        projectSelectors.forEach(s => s.classList.remove('active'));
        selector.classList.add('active');

        documentationPanes.forEach(pane => {
            if (pane.id === `pane-${targetProj}`) {
                pane.classList.add('active');

                if (window.gsap && !starfieldMotion.matches) {
                    gsap.fromTo(
                        pane,
                        { opacity: 0, y: 15 },
                        { opacity: 1, y: 0, duration: 0.24, ease: "power2.out", clearProps: 'transform,opacity', overwrite: true }
                    );
                }
            } else {
                pane.classList.remove('active');
            }
        });

        if (repoLink) {
            repoLink.hidden = targetProj !== 'p2';
        }

        appendLog(
            `FLAGSHIP VIEWER: Mapped architectural blueprint document sheet for project '${targetProj}'`,
            "system-line"
        );
    });
});
// Explore system repositories anchor animation
const exploreTrigger = document.getElementById('explore-repositories-trigger');
if (exploreTrigger) {
    exploreTrigger.addEventListener('click', () => {
        appendLog(`SYSTEM REDIRECT: Resolving remote secure VCS repositories links.`, "system-line");
    });
}

// ==========================================================================
// 7. HARMONIOUS FRAME SYSTEM INITIALIZER
// ==========================================================================
function initializeCoreArchitecture() {
    renderPricing(configuration.getState());

    // Spawn backdrop stars drift loop
    initStarfield();
    resizeStarfield();
    syncStarfieldMotion();
    window.addEventListener('resize', resizeStarfield, { passive: true });
    document.addEventListener('visibilitychange', syncStarfieldMotion);
    starfieldMotion.addEventListener('change', syncStarfieldMotion);
    if (import.meta.hot) import.meta.hot.dispose(() => {
        cancelAnimationFrame(starfieldFrame);
        window.removeEventListener('resize', resizeStarfield);
        document.removeEventListener('visibilitychange', syncStarfieldMotion);
        starfieldMotion.removeEventListener('change', syncStarfieldMotion);
    });

    // 🚀 ADDED: KICKSTART CELESTIAL PATH-SCROLL TRAILER
    const stopTrail = initConstellationScrollPathing();
    if (import.meta.hot) import.meta.hot.dispose(() => stopTrail?.());

    // Spawn schematic JVM traversal states
    initMemoryGrid();
    resizeVisCanvas();
    const stopVisualizer = observeVisualizer();
    if (import.meta.hot) import.meta.hot.dispose(() => stopVisualizer?.());

    // Initial load translations, lang mappings and themes settings
    startL10nTheme();

    if (window.gsap && !starfieldMotion.matches) {
        // Start the shared top row together and restore the stylesheet after the entrance.
        gsap.fromTo('.bento-item', { y: 30, opacity: 0 }, {
            duration: 0.6,
            y: 0,
            opacity: 1,
            stagger: index => Math.max(0, index - 1) * 0.08,
            clearProps: 'transform,opacity',
            ease: 'power3.out'
        });
    }
}

// Safe check for ES Modules where DOMContentLoaded might have already fired
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCoreArchitecture);
} else {
    initializeCoreArchitecture();
}


// ==========================================================================
// 8. HIGH-PERFORMANCE KINETIC NEBULA TRAIL ENGINE
// ==========================================================================
function initConstellationScrollPathing() {
    // 1. Grab the clean HTML5 Canvas component from the DOM context
    const canvas = document.getElementById('cursor-trail-canvas');
    if (!canvas) return;

    // 2. Extract the high-performance 2D drawing rendering pipeline interface
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const events = new AbortController();
    // 4. Setup a FIFO history collection array to track prior coordinate positions
    const pathHistoryPoints = [];
    const TRAIL_LENGTH_LIMIT = 16;
    let trailFrame = 0;
    let lastMove = -Infinity;
    let nextPoint;

    // 5. Scale buffer coordinate grids based on monitor hardware display pixel densities
    function resizeTrailCanvas() {
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        canvas.width = Math.floor(window.innerWidth * dpr);
        canvas.height = Math.floor(window.innerHeight * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // Locks 1:1 crisp display layout dimensions
    }
    
    resizeTrailCanvas();
    window.addEventListener('resize', resizeTrailCanvas, { passive: true, signal: events.signal });

    // 6. High frequency animation frame sequencing tick engine
    function renderTrailFrameSequence(now) {
        trailFrame = 0;
        // 7. Clear the graphics buffer window right before calculating next steps
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

        // 8. Capture and append pre-existing global mouse metrics into local tracking cache
        if (nextPoint) {
            pathHistoryPoints.push(nextPoint);
            nextPoint = undefined;
        } else if (now - lastMove > 45) {
            pathHistoryPoints.shift();
        }
        if (!pathHistoryPoints.length) return;
        
        // 9. Trim excess records to preserve strict memory footprint allocation scales
        if (pathHistoryPoints.length > TRAIL_LENGTH_LIMIT) {
            pathHistoryPoints.shift();
        }

        const activePointsCount = pathHistoryPoints.length;

        // 10. Only compute interpolation physics if we have valid movement tracking chains
        if (activePointsCount > 1) {
            // 11. Activate premium visual blur drop-shadows matching your brand accents
            ctx.shadowBlur = 7;
            ctx.shadowColor = '#4863fb'; // Magenta vector glow trail
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // 12. Traverse path queues, building midpoints for smooth curve geometry mapping
            for (let i = 1; i < activePointsCount - 1; i++) {
                const startNode = pathHistoryPoints[i];
                const endNode = pathHistoryPoints[i + 1];
                
                // 13. Map out exact vector center coordinates to prevent jagged path joins
                const midPointX = (startNode.x + endNode.x) / 2;
                const midPointY = (startNode.y + endNode.y) / 2;

                // 14. Scale stroke thickness variables based on historical item depth age weights
                const lifetimeRatio = i / activePointsCount;
                const r = Math.round(255 - (255 - 59) * lifetimeRatio);
                const g = Math.round(72 + (130 - 72) * lifetimeRatio);
                const b = Math.round(196 + (246 - 196) * lifetimeRatio);

                ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.56 * lifetimeRatio})`;

                // 15. Apply native hardware quadratic curves through coordinate intersections
                ctx.beginPath();
                ctx.moveTo(startNode.x, startNode.y);
                ctx.quadraticCurveTo(startNode.x, startNode.y, midPointX, midPointY);
                ctx.stroke();
            }

            // 16. Overlay a sharp, bright high-contrast white stardust core right on the cursor node
            const leadingCoreNode = pathHistoryPoints[activePointsCount - 1];
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#00d4ff'; // Cyber cyan leading core aura profile
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(leadingCoreNode.x, leadingCoreNode.y, 3.5, 0, Math.PI * 2);
            ctx.fill();

            // 17. Safe state teardown: wipe shadows to protect background starfield rendering pipelines
            ctx.shadowBlur = 0;
        }

        // 18. Queue up calculations cleanly for the next hardware display cycle sweep
        trailFrame = requestAnimationFrame(renderTrailFrameSequence);
    }

    if (typeof appendLog === 'function') {
        appendLog(`ORBITAL MONITOR: Kinetic ribbon trail engine successfully bound to active rendering canvas viewport.`, "system-line");
    }

    function resetTrail() {
        if (!trailFrame && !nextPoint && pathHistoryPoints.length === 0) return;
        cancelAnimationFrame(trailFrame);
        trailFrame = 0;
        nextPoint = undefined;
        pathHistoryPoints.length = 0;
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }

    window.addEventListener('pointermove', event => {
        if (event.pointerType !== 'mouse' || starfieldMotion.matches || document.hidden ||
            event.target.closest?.('.design-studio, .stanza-showcase, .contact-composer, #contact-dock')) {
            resetTrail();
            return;
        }
        nextPoint = { x: event.clientX, y: event.clientY };
        lastMove = performance.now();
        if (!trailFrame) trailFrame = requestAnimationFrame(renderTrailFrameSequence);
    }, { passive: true, signal: events.signal });
    starfieldMotion.addEventListener('change', resetTrail, { signal: events.signal });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) resetTrail();
    }, { signal: events.signal });
    return () => { resetTrail(); events.abort(); };
}
