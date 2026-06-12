// ==========================================================================
// SHADY AWAD | HIGH-PERFORMANCE NATIVE JS CORE SYSTEMS ENGINE
// ==========================================================================

// Global Parallax Starfield State
const bgCanvas = document.getElementById('starfield');
const bgCtx = bgCanvas ? bgCanvas.getContext('2d') : null;
let starfieldArray = [];
const STAR_COUNT = 240;
let lastFrameTime = performance.now();
let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Dynamic L10n & Theme States
const i18nElements = document.querySelectorAll('[data-i18n]');
const themeToggle = document.getElementById('theme-toggle');
const langToggle = document.getElementById('lang-toggle');
let activeTranslations = {};

// Provisioning Pricing Spec Variables
const tierSelect = document.getElementById('tier');
const threadsSlider = document.getElementById('threads');
const activeCoresVal = document.getElementById('active-cores-val');
const addons = document.querySelectorAll('.addon');
const priceDisplay = document.getElementById('price-display');
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
let tracerPulse = 0;
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

function resizeStarfield() {
    if (!bgCanvas || !bgCtx) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    bgCanvas.width = Math.floor(window.innerWidth * dpr);
    bgCanvas.height = Math.floor(window.innerHeight * dpr);
    bgCanvas.style.width = `${window.innerWidth}px`;
    bgCanvas.style.height = `${window.innerHeight}px`;
    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

function animateStarfield(currentTime = performance.now()) {
    if (!bgCanvas || !bgCtx) return;
    const delta = Math.min(1.5, (currentTime - lastFrameTime) / 16.6);
    lastFrameTime = currentTime;

    const driftCoef = prefersReducedMotion ? 0.3 : 0.85;
    const scrollStep = driftCoef * delta;
    
    const displayWidth = bgCanvas.clientWidth;
    const displayHeight = bgCanvas.clientHeight;
    
    bgCtx.clearRect(0, 0, displayWidth, displayHeight);
    const cx = displayWidth / 2;
    const cy = displayHeight / 2;
    
    const scaleX = (mouseX - cx) * 0.015;
    const scaleY = (mouseY - cy) * 0.015;

    starfieldArray.forEach(star => {
        star.z -= scrollStep;
        if (star.z <= 2) {
            star.z = window.innerWidth;
            star.x = Math.random() * window.innerWidth * 2 - window.innerWidth;
            star.y = Math.random() * window.innerHeight * 2 - window.innerHeight;
        }

        const projectScale = Math.max(0.001, window.innerWidth / star.z);
        const px = (star.x - scaleX * (1 + star.z / window.innerWidth * 0.25)) * projectScale + cx;
        const py = (star.y - scaleY * (1 + star.z / window.innerWidth * 0.25)) * projectScale + cy;

        const opacity = Math.max(0.1, Math.min(0.9, 1 - star.z / window.innerWidth));
        // Draw starry points
        bgCtx.fillStyle = `rgba(180, 215, 255, ${opacity})`;
        bgCtx.beginPath();
        bgCtx.arc(px, py, Math.max(0.4, star.baseDim * projectScale), 0, Math.PI * 2);
        bgCtx.fill();
    });

    requestAnimationFrame(animateStarfield);
}

// ==========================================================================
// 2. BIDIRECTIONAL SCHEMA L10N & CRYSTAL THEMING
// ==========================================================================
async function l10nFetch() {
    try {
        const res = await fetch('./translations.json');
        if (!res.ok) throw new Error("Faulty transaction headers");
        activeTranslations = await res.json();
    } catch {
        // Fallback structures if translations server is unresponsive
        activeTranslations = {
            en: {
                badgeOnline: "SYSTEM ACTIVE",
                name: "Shady Awad",
                title: "Lead Software Engineer & Systems Architect",
                description: "I am a 29-year-old Lead Software Engineer & Systems Architect focused on building high-performance, enterprise-grade progressive web applications (PWAs). I specialize in writing optimization-focused raw SQL over heavy, slow ORMs, leveraging Vanilla JavaScript for zero abstraction overhead, and enforcing rigid security policies such as Row-Level Security (RLS) deep in the database layer. My engineering philosophy prioritizes bare-metal performance, extreme rendering optimization, and bulletproof security systems.",
                projectEstimator: "Enterprise Provisioning & Estimator",
                solutionTier: "Arch Type & SLA Level",
                tier1: "Tier 1: High-Performance Standalone",
                tier2: "Tier 2: Multi-Tenant Enterprise Cluster",
                tier3: "Tier 3: Distributed High-Availability Grid",
                addons: "Custom System Integration Addons",
                checkbox3D: "Custom WebGL / Canvas Components",
                checkboxAI: "Embedded Security Audit Logging Modules",
                estInvestment: "Est. Monthly SLA Commitment:",
                tierEstimates: "Provisioning Baseline Cost (EGP)",
                systemTopology: "Systems Architecture & Topology",
                topologyDesc: "Interactive Database Schema & System Topology Map. Toggle between optimized Raw SQL execution paths and database Row-Level Security (RLS) policies. Rendering active query flows at 60 FPS.",
                viewSqlBtn: "View Recursive Query CTE",
                viewRlsBtn: "View RLS Security Rules",
                schemaVisualizer: "Database & Query Performance Visualizer",
                visualizerDesc: "Traverse a B+ Tree indexing pathway or compact memory block fragments. Watch low-abstraction systems logic execute at 60fps.",
                searchKeyLabel: "Search Index DB Key:",
                compactHeapLabel: "Execute Garbage Collection (GC)",
                terminalLogsLabel: "Systems Log Stream & Stack Frame Output",
                featuredProjects: "Micro-Architectural Showcase (Flagship Systems)",
                explore: "Explore System Repositories →",
                interstellar: "Low-Latency Simulation Asset",
                shipDesc: "This interactive asset was modeled and textured in Blender, utilizing a custom Fresnel shader to simulate atmospheric scattering. It was exported as a compressed glTF/GLB asset and integrated using a responsive web component to ensure 60fps performance without external cloud dependencies.",
                shipHint: "Interact directly with the local 3D rendering cache using swipe/pinch gestures.",
                about: "About",
                projects: "Projects",
                contact: "Contact",
                copyright: "© 2026 Shady Awad. Handcrafted in pure Vanilla JavaScript & CSS. No bloat, no overhead."
            },
            ar: {
                badgeOnline: "النظام نشط",
                name: "شادي عوض",
                title: "رئيس مهندسي البرمجيات ومعماري الأنظمة",
                description: "أنا رئيس مهندسي برمجيات ومعماري أنظمة أبلغ من العمر 29 عامًا، أعمل على بناء تطبيقات الويب التقدمية (PWAs) عالية الأداء والمخصصة للمؤسسات الكبرى. أتخصص في كتابة استعلامات SQL المنقحة لتحسين الأداء بدلاً من استخدام مخططات ORM الثقيلة والبطيئة، مع الاستفادة من لغة Vanilla JavaScript للتخلص من أعباء التجريد البرمجي، وفرض سياسات أمان صارمة مثل أمن مستوى الصف (RLS) في طبقة قواعد البيانات مباشرةً. ترتكز فلسفتي الهندسية على الأداء الخام والسرعة القصوى وبناء الأنظمة المحصنة والآمنة.",
                projectEstimator: "بوابة تسعير الموارد وحساب تكلفة البنية التحتية",
                solutionTier: "نوع الهيكل ومستوى اتفاقية الخدمة (SLA)",
                tier1: "المستوى 1: نظام مستقل عالي الأداء",
                tier2: "المستوى 2: تجميعة سحابية للمؤسسات متعددة المستأجرين",
                tier3: "المستوى 3: شبكة توزيع موزعة عالية التوافر والاستقرار",
                addons: "وحدات وتكاملات اختيارية إضافية",
                checkbox3D: "رسوم WebGL / مكونات تفاعلية خاصة",
                checkboxAI: "وحدات تدقيق الأمان المدمجة لتسجيل العمليات (Audit Log)",
                estInvestment: "التزام الخدمة الشهري المقدر (SLA):",
                tierEstimates: "التكلفة الأساسية للتهيئة (بالجنيه المصري EGP)",
                systemTopology: "هيكل الأنظمة والترابط الشبكي للشبكة",
                topologyDesc: "مخطط هيكل قاعدة البيانات وخريطة الترابط الشبكي للأنظمة. اختر بين استعراض مسار استعلام SQL المعقد وسياسات أمان مستوى الصف (RLS) لـ PostgreSQL. محاكاة معدل إطارات 60Hz.",
                viewSqlBtn: "عرض استعلام الـ CTE المتكرر",
                viewRlsBtn: "عرض سياسات أمان الـ RLS",
                schemaVisualizer: "أداة تتبع مسار الفهرسة ومخصص الذاكرة والعمليات",
                visualizerDesc: "تتبع مسار استعلام شجرة B+ أو قم بضغط كتل الذاكرة المجزأة. شاهد منطق الأنظمة منخفض التجريد يعمل بسرعة 60 إطارًا في الثانية.",
                searchKeyLabel: "البحث عن مفتاح قاعدة بيانات:",
                compactHeapLabel: "تشغيل مجمع المهملات وإخلاء الذاكرة (GC)",
                terminalLogsLabel: "منصة مخرجات النظام وسجلات استدعاء الدوال (Stack Frame)",
                featuredProjects: "معرض البنى والأنظمة الدقيقة (النظم الرئيسية)",
                explore: "تصفح مستودعات الكود للأنظمة ←",
                interstellar: "محاكاة ثلاثية الأبعاد منخفضة الاستجابة",
                shipDesc: "تم تصميم هذا المكون التفاعلي وتكوينه في Blender، باستخدام مظلل Fresnel مخصص لمحاكاة التشتت الجوي. تم تصديره كأصل glTF/GLB مضغوط ودمجه باستخدام مكون ويب متجاوب لضمان أداء 60 إطارًا في الثانية دون اعتمادات سحابية خارجية.",
                shipHint: "تفاعل بشكل مباشر مع ذاكرة العرض ثلاثية الأبعاد المحلية من خلال السحب والتكبير.",
                about: "حول",
                projects: "المشاريع",
                contact: "اتصل بنا",
                copyright: "© 2026 شادي عوض. مصمم بلغة Vanilla JS النقية وتنسيقات CSS المدمجة الأصيلة. أداء نقي بدون تضخم برمي."
            }
        };
    }
}

function updateLanguage(lang) {
    const dict = activeTranslations[lang] || activeTranslations.en;
    i18nElements.forEach(elem => {
        const key = elem.dataset.i18n;
        if (dict[key]) elem.textContent = dict[key];
    });

    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('awad-portfolio-lang', lang);
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
    langToggle.addEventListener('click', () => {
        const cur = document.documentElement.lang || 'en';
        const next = cur === 'en' ? 'ar' : 'en';
        updateLanguage(next);
        langToggle.textContent = next.toUpperCase();
    });
}

async function startL10nTheme() {
    await l10nFetch();
    const savedTheme = localStorage.getItem('awad-portfolio-theme') || 'dark';
    updateTheme(savedTheme);
    const savedLang = localStorage.getItem('awad-portfolio-lang') || 'en';
    updateLanguage(savedLang);
    if (langToggle) langToggle.textContent = savedLang.toUpperCase();
}

// ==========================================
// 3. SNAPPY INTERACTIVE SAAS PROVISION ESTIMATOR
// ==========================================
function formatEGP(val) {
    return val.toLocaleString('en-US');
}

function calculatePrice() {
    if (!tierSelect || !priceDisplay) return;
    const base = Number(tierSelect.value) || 12000;
    const coreCount = Number(threadsSlider ? threadsSlider.value : 4);
    
    // Core scaling factor (threads scale costs by a factor of 1200 EGP per core over baseline)
    const threadCost = (coreCount - 1) * 2300;
    
    // Addon checkboxes
    const addonCost = Array.from(addons).reduce((sum, box) => sum + (box.checked ? Number(box.value) : 0), 0);
    
    const targetPrice = base + threadCost + addonCost;
    const oldPrice = Number(priceDisplay.dataset.price || 12000);

    if (window.gsap) {
        gsap.to({ val: oldPrice }, {
            val: targetPrice,
            duration: 0.16, // Ultra fast ticks
            ease: 'none',
            onUpdate() {
                 const currentTickVal = Math.round(this.targets()[0].val);
                 priceDisplay.innerText = formatEGP(currentTickVal);
            },
            onComplete() {
                 priceDisplay.dataset.price = targetPrice;
                 priceDisplay.innerText = formatEGP(targetPrice);
            }
        });
    } else {
        priceDisplay.innerText = formatEGP(targetPrice);
        priceDisplay.dataset.price = targetPrice;
    }
}

// Baseline cost links presets triggers
baselineLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const tierValue = link.dataset.tierVal;
        if (tierSelect && tierValue) {
            tierSelect.value = tierValue;
            calculatePrice();
        }
    });
});

if (tierSelect) {
    tierSelect.addEventListener('change', calculatePrice);
}

if (threadsSlider) {
    threadsSlider.addEventListener('input', () => {
        if (activeCoresVal) {
            const val = threadsSlider.value;
            activeCoresVal.textContent = `${val} Cores (${val == 4 ? 'Optimal' : val > 4 ? 'High Performance' : 'SaaS Constrained'})`;
        }
        calculatePrice();
    });
}

addons.forEach(box => {
    box.addEventListener('change', calculatePrice);
});

// ==========================================================================
// 4. SYSTEMS TOPOLOGY SVG INTERACTIVE FLOW ENGINE
// ==========================================================================
function triggerSvgTracerPulse(startSelector, endSelector) {
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
    
    visCanvas.width = Math.floor(visWidth * dpr);
    visCanvas.height = Math.floor(visHeight * dpr);
    visCanvas.style.width = `${visWidth}px`;
    visCanvas.style.height = `${visHeight}px`;
    visCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
    tracerPulse += 0.1;

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
        progressDelta += 0.05;
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
            b.x += deltaX * 0.14; // Acceleration slide factors
            b.y += deltaY * 0.14;
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

function systemVisualizerTickLoop() {
    if (!visCtx || !visCanvas) return;
    if (visualizerLoopMode === "tree") {
        drawTreeSimulation();
    } else {
        drawHeapGrid();
    }
    requestAnimationFrame(systemVisualizerTickLoop);
}

// Setup canvas metrics click listeners triggers
searchKeyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        if (querySearching || garbageCollecting) return;
        searchKeyBtns.forEach(b => b.classList.remove('active-key'));
        btn.classList.add('active-key');
        
        const coreKey = parseInt(btn.dataset.key);
        executeTreeSearch(coreKey);
    });
});

if (garbageCollectBtn) {
    garbageCollectBtn.addEventListener('click', () => {
        if (querySearching || garbageCollecting) return;
        triggerMemoryCompaction();
    });
}

// ==========================================================================
// 6. DYNAMIC FLAGSHIP PROJECT SHEETS SLIDER
// ==========================================================================
projectSelectors.forEach(selector => {
    selector.addEventListener('click', () => {
        const targetProj = selector.dataset.project;
        projectSelectors.forEach(s => s.classList.remove('active'));
        selector.classList.add('active');

        documentationPanes.forEach(pane => {
            if (pane.id === `pane-${targetProj}`) {
                pane.classList.add('active');
                if (window.gsap) {
                     gsap.fromTo(pane, { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" });
                }
            } else {
                pane.classList.remove('active');
            }
        });
        
        appendLog(`FLAGSHIP VIEWER: Mapped architectural blueprint document sheet for project '${targetProj}'`, "system-line");
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
const systemResizeObserver = new ResizeObserver(() => {
    resizeStarfield();
    resizeVisCanvas();
});
systemResizeObserver.observe(document.body);

function initializeCoreArchitecture() {
    // Pricing configurations initial triggers
    if (tierSelect) {
        tierSelect.value = "12000";
    }
    if (typeof calculatePrice === 'function') {
        calculatePrice();
    }

    // Spawn backdrop stars drift loop
    initStarfield();
    resizeStarfield();
    requestAnimationFrame(animateStarfield);

    // 🚀 ADDED: KICKSTART CELESTIAL PATH-SCROLL TRAILER
    initConstellationScrollPathing();

    // Spawn schematic JVM traversal states
    initMemoryGrid();
    resizeVisCanvas();
    requestAnimationFrame(systemVisualizerTickLoop);

    // Initial load translations, lang mappings and themes settings
    startL10nTheme();

    if (window.gsap) {
        // High quality snap staggered entry timelines
        gsap.from('.bento-item', {
            duration: 0.6,
            y: 30,
            opacity: 0,
            stagger: 0.08,
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

    // 3. Gracefully step out if the client OS layer enforces accessibility limits
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        canvas.style.display = 'none';
        return;
    }
    
    // 4. Setup a FIFO history collection array to track prior coordinate positions
    const pathHistoryPoints = [];
    const TRAIL_LENGTH_LIMIT = 24; // Limits tracking length frame calculations

    // 5. Scale buffer coordinate grids based on monitor hardware display pixel densities
    function resizeTrailCanvas() {
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        canvas.width = Math.floor(window.innerWidth * dpr);
        canvas.height = Math.floor(window.innerHeight * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // Locks 1:1 crisp display layout dimensions
    }
    
    resizeTrailCanvas();
    window.addEventListener('resize', resizeTrailCanvas, { passive: true });

    // 6. High frequency animation frame sequencing tick engine
    function renderTrailFrameSequence() {
        // 7. Clear the graphics buffer window right before calculating next steps
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

        // 8. Capture and append pre-existing global mouse metrics into local tracking cache
        pathHistoryPoints.push({ x: mouseX, y: mouseY });
        
        // 9. Trim excess records to preserve strict memory footprint allocation scales
        if (pathHistoryPoints.length > TRAIL_LENGTH_LIMIT) {
            pathHistoryPoints.shift();
        }

        const activePointsCount = pathHistoryPoints.length;

        // 10. Only compute interpolation physics if we have valid movement tracking chains
        if (activePointsCount > 1) {
            // 11. Activate premium visual blur drop-shadows matching your brand accents
            ctx.shadowBlur = 12;
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

            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.75 * lifetimeRatio})`;

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
        requestAnimationFrame(renderTrailFrameSequence);
    }

    if (typeof appendLog === 'function') {
        appendLog(`ORBITAL MONITOR: Kinetic ribbon trail engine successfully bound to active rendering canvas viewport.`, "system-line");
    }

    requestAnimationFrame(renderTrailFrameSequence);
}