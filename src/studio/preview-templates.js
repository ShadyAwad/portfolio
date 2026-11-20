import { previewMediaSlot } from './preview-media.js';

export const translations = {
    title: ['Application Design Studio', 'استوديو تصميم التطبيقات'],
    intro: ['Choose an application and try its actions in the live preview.', 'اختر تطبيقًا وجرّب إجراءاته في المعاينة المباشرة.'],
    plan: ['Engineering & cost estimates','التقديرات الهندسية والتكلفة'],
    backToStudio: ['Return to Application Design Studio','العودة إلى استوديو تصميم التطبيقات'],
    controls: ['Application settings', 'إعدادات التطبيق'],
    template: ['Application type', 'نوع التطبيق'],
    theme: ['Preview theme', 'مظهر المعاينة'],
    system: ['System', 'حسب الجهاز'],
    light: ['Light', 'فاتح'],
    dark: ['Dark', 'داكن'],
    desktop: ['Desktop', 'سطح المكتب'],
    tablet: ['Tablet', 'جهاز لوحي'],
    mobile: ['Mobile', 'هاتف'],
    viewport: ['Preview viewport', 'حجم نافذة المعاينة'],
    useDark: ['Switch preview to dark mode', 'حوّل المعاينة إلى الوضع الداكن'],
    useLight: ['Switch preview to light mode', 'حوّل المعاينة إلى الوضع الفاتح'],
    featureSettings: ['Features and 3D', 'الميزات والمحتوى ثلاثي الأبعاد'],
    features: ['Prototype features', 'ميزات النموذج'],
    saas: ['SaaS Dashboard', 'لوحة تحكم SaaS'],
    ecommerce: ['E-commerce', 'متجر إلكتروني'],
    landing: ['Landing Page', 'صفحة هبوط'],
    'internal-tool': ['Internal Business Tool', 'أداة أعمال داخلية'],
    auth: ['Authentication', 'تسجيل الدخول'],
    analytics: ['Analytics', 'التحليلات'],
    tenancy: ['Multi-tenancy', 'تعدد المستأجرين'],
    storage: ['File storage', 'تخزين الملفات'],
    jobs: ['Background jobs', 'مهام الخلفية'],
    orders: ['Order management', 'إدارة الطلبات'],
    conversion: ['Conversion form', 'نموذج طلب التواصل'],
    roles: ['Engineering RBAC', 'صلاحيات الأدوار التقنية'],
    ordersNote: ['Shown in E-commerce.', 'تظهر في المتجر الإلكتروني.'],
    conversionNote: ['Shown in Landing Page.', 'يظهر في صفحة الهبوط.'],
    rolesNote: ['Separate from the paid RBAC add-on.', 'مستقلة عن إضافة صلاحيات الأدوار المدفوعة.'],
    reset: ['Reset saved configuration', 'إعادة ضبط الإعدادات المحفوظة'],
    resetDone: ['Configuration reset to defaults.', 'أُعيدت الإعدادات إلى القيم الافتراضية.'],
    preview: ['Fictional prototype · sample data only', 'نموذج توضيحي · بيانات تجريبية فقط'],
    signFirst: ['Consider sign-in before using roles or workspaces in production.', 'يُنصح بتسجيل الدخول قبل استخدام الأدوار أو مساحات العمل في الإنتاج.']
};

const bars = (name, values) => `<div class="studio-bars" role="img" aria-label="${name}">${values
    .map(value => `<span style="--bar:${value}%"></span>`).join('')}</div>`;
const badge = content => `<span class="mock-badge">${content}</span>`;
const metrics = (items, label) => `<dl class="mock-metrics">${items
    .map(([title, value]) => `<div><dt>${label(title)}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
const table = (headers, rows, label) => `<table class="mock-table"><thead><tr>${headers
    .map(header => `<th scope="col">${label(header)}</th>`).join('')}</tr></thead><tbody>${rows
    .map(row => `<tr>${row.map(cell => `<td>${Array.isArray(cell) ? label(cell) : cell}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

const nav = (name, links, label) => `<nav class="mock-nav" aria-label="${label(name)}">${links.map(([target, text]) =>
    `<button type="button" data-preview-jump="${target}"${target === 'overview' ? ' aria-current="location"' : ''}>${label(text)}</button>`).join('')}</nav>`;
const account = (label, initials, name, subtitle) => `<details class="mock-account">
    <summary><span class="mock-avatar" aria-hidden="true">${initials}</span><span>${name}</span></summary>
    <div><strong>${name}</strong><p>${label(subtitle)}</p></div></details>`;

function flowAction(label, action, title, disabled = false) {
    return `<div class="mock-flow">
        <button class="mock-action" type="button" data-preview-action="${action}"${disabled ? ' disabled' : ''}>${label(title)}</button>
        ${flowFeedback()}
    </div>`;
}

function flowFeedback() {
    return '<div class="mock-flow-feedback"><p role="status" class="mock-flow-status"></p><ol class="mock-flow-steps" hidden></ol></div>';
}

function saas(label) {
    return `<div class="mock-saas">
        <aside class="mock-sidebar"><strong><span class="mock-brand-mark" aria-hidden="true">◈</span> Pulse</strong>
            ${nav(['Workspace navigation','التنقل في مساحة العمل'], [
                ['overview',['Overview','نظرة عامة']], ['activity',['Activity','النشاط']], ['team',['Team','الفريق']]
            ], label)}
            <p data-workspace-name>Northstar Studio</p>
        </aside>
        <div class="mock-saas-content">
            <div class="mock-appbar" data-preview-workspace><span>${label(['Workspace / Overview','مساحة العمل / نظرة عامة'])}</span>
                ${account(label, 'MR', 'Maya Reed', ['Workspace administrator','مسؤولة مساحة العمل'])}</div>
            <div class="mock-page-content" data-preview-modules>
                <header class="mock-page-heading" data-preview-section="overview" tabindex="-1">
                    <div><h4>${label(['Workspace overview','نظرة عامة على مساحة العمل'])}</h4>
                    <p>${label(['Here’s how your workspace performed this week.','إليك أداء مساحة عملك هذا الأسبوع.'])}</p></div>
                    ${badge(label(['Last 7 days','آخر 7 أيام']))}</header>
                ${flowAction(label, 'workspace', ['Load workspace','تحميل مساحة العمل'])}
                ${metrics([[['Active users','المستخدمون النشطون'],'1,284'],[['New accounts','الحسابات الجديدة'],'208'],[['Retention','الاحتفاظ'],'91%']],label)}
                ${previewMediaSlot('saas', label)}
                <section class="mock-card mock-activity" data-preview-section="activity" tabindex="-1">
                    <div class="mock-section-title"><strong>${label(['Weekly activity','النشاط الأسبوعي'])}</strong>
                    <span class="mock-trend">↑ 12.4%</span></div>
                    <p>${label(['Daily active members compared with last week','الأعضاء النشطون يوميًا مقارنة بالأسبوع الماضي'])}</p>
                    ${bars(label(['Activity peaks on Friday','ذروة النشاط يوم الجمعة']),[36,48,44,62,84,58,64])}
                    <div class="mock-chart-days" aria-hidden="true">${label(['Mon Tue Wed Thu Fri Sat Sun','إثن ثلا أرب خمي جمع سبت أحد']).split(' ').map(day => `<span>${day}</span>`).join('')}</div>
                </section>
                <section class="mock-card mock-team" data-preview-section="team" tabindex="-1">
                    <div class="mock-section-title"><strong>${label(['Team members','أعضاء الفريق'])}</strong><span>${label(['3 members','3 أعضاء'])}</span></div>
                    ${table([['Member','العضو'],['Role','الدور'],['Status','الحالة']], [
                        ['Maya Reed',['Administrator','مسؤولة'],badge(label(['Active','نشط']))],
                        ['Samir Noor',['Analyst','محلل'],badge(label(['Active','نشط']))],
                        ['Lina Park',['Editor','محررة'],badge(label(['Invited','تمت الدعوة']))]
                    ], label)}
                </section>
            </div>
        </div>
    </div>`;
}

const products = [
    ['lamp','lighting',['Arc Table Lamp','مصباح آرك'],['Brushed brass · linen shade','نحاس مصقول · غطاء كتاني'],64],
    ['chair','furniture',['Fold Lounge Chair','كرسي فولد'],['Solid oak · olive upholstery','خشب البلوط · قماش زيتوني'],120],
    ['clock','decor',['Dial Wall Clock','ساعة دَيل'],['Warm walnut · silent sweep','خشب الجوز · حركة هادئة'],38]
];

const productDetails = {
    lamp: ['A linen shade softens the light for a reading corner or bedside table.','يخفّف الغطاء الكتاني الضوء ليناسب ركن القراءة أو الطاولة بجانب السرير.'],
    chair: ['A low seat with a solid oak frame and an upholstered cushion.','مقعد منخفض بإطار من خشب البلوط المصمت ووسادة منجّدة.'],
    clock: ['The quiet movement suits shared rooms and workspaces.','تناسب الحركة الهادئة الغرف المشتركة ومساحات العمل.']
};

const filterButtons = (attribute, items, label) => items.map(([value, caption], index) =>
    `<button type="button" ${attribute}="${value}" aria-pressed="${index === 0}">${label(caption)}</button>`).join('');

function ecommerce(label) {
    return `<div class="mock-store">
        <div class="mock-store-header" data-preview-workspace><strong>Form &amp; Field</strong>
            ${nav(['Store navigation','التنقل في المتجر'], [
                ['collection',['Shop','تسوّق']],['store-story',['The Home Edit','مختارات المنزل']]
            ], label)}
            <button class="mock-bag" type="button" data-preview-jump="cart">
                <span class="mock-bag-icon" aria-hidden="true"></span> ${label(['Bag','السلة'])} <b data-cart-count>0</b></button></div>
        <header class="mock-store-hero" data-preview-section="store-story" tabindex="-1"><div>
            <p>${label(['The Home Edit','مختارات المنزل'])}</p>
            <h4><span class="mock-product-title">${label(['Good design. Better days.','تصميم جميل لأيام أجمل.'])}</span>
                <span class="mock-catalog-title">${label(['Browse the collection','تصفّح المجموعة'])}</span></h4>
            <div>${label(['Thoughtful objects for the spaces you live in.','قطع مدروسة للمساحات التي تعيش فيها.'])}</div>
        </div><div class="mock-product-art mock-store-feature" data-product="lamp" aria-hidden="true"><i></i></div></header>
        <section class="mock-collection" data-preview-section="collection" tabindex="-1">
            <div class="mock-section-title"><strong>${label(['Shop the collection','تسوّق المجموعة'])}</strong></div>
            <div class="mock-filters" role="group" aria-label="${label(['Product categories','فئات المنتجات'])}">
                ${filterButtons('data-store-category', [['all',['All items','كل القطع']], ['lighting',['Lighting','الإضاءة']],
                    ['furniture',['Furniture','الأثاث']], ['decor',['Decor','الديكور']]], label)}
            </div>
            <div class="mock-products">${products.map(([shape, category, name, material, price]) => `<article class="mock-product" data-category="${category}">
                <div class="mock-product-art" data-product="${shape}" aria-hidden="true"><i></i></div>
                <div class="mock-product-info"><strong>${label(name)}</strong><p>${label(material)}</p>
                    <div><bdi>$${price}</bdi><button type="button" class="mock-action" data-cart-add="${price}" aria-label="${label(['Add to bag','أضف إلى السلة'])} · ${label(name)}">${label(['Add','أضف'])}</button></div>
                    <details class="mock-product-details"><summary aria-label="${label(['Details','التفاصيل'])} · ${label(name)}">${label(['Details','التفاصيل'])}</summary>
                        <p>${label(productDetails[shape])}</p></details>
                </div></article>`).join('')}</div>
            ${previewMediaSlot('ecommerce', label)}
        </section>
        <section class="mock-store-cart" data-preview-section="cart" tabindex="-1">
            <strong>${label(['Your bag','سلتك'])}</strong>
            <span role="status"><b data-cart-total dir="ltr">$0</b></span>
            <button type="button" data-cart-clear disabled>${label(['Empty bag','إفراغ السلة'])}</button>
            ${flowAction(label, 'checkout', ['Mock checkout','إتمام طلب تجريبي'], true)}
        </section>
    </div>`;
}

function landing(label) {
    const points = [
        ['◇',['Plan with clarity','خطّط بوضوح'],['Turn a rough idea into a brief with owners and clear next steps.','حوّل فكرة أولية إلى موجز يحدد المسؤوليات والخطوات التالية.']],
        ['↗',['See what’s moving','تابع المستجدات'],['Track milestones, decisions, and changes in one place.','تابع المراحل والقرارات والتغييرات في مكان واحد.']],
        ['✓',['Launch together','أطلق مع فريقك'],['Keep design, engineering, and stakeholders in sync.','نسّق بين فرق التصميم والهندسة وأصحاب المصلحة.']]
    ];
    return `<div class="mock-landing">
        <div class="mock-landing-nav" data-preview-workspace><strong><span class="mock-brand-mark" aria-hidden="true">✳</span> Linearise</strong>
            ${nav(['Marketing navigation','التنقل في موقع المنتج'], [
                ['features',['Product','المنتج']],['about',['About','نبذة']]
            ], label)}
            <button type="button" data-preview-start>${label(['Get started','ابدأ الآن'])}</button></div>
        <header class="mock-landing-hero">
            <div><h4>${label(['Give every launch a clear path.','امنح كل إطلاق مسارًا واضحًا.'])}</h4>
                <p>${label(['Plan the work, share progress, and bring your whole team to launch day with one workspace.','خطّط للعمل وشارك التقدم واصطحب فريقك إلى يوم الإطلاق في مساحة عمل واحدة.'])}</p>
                <button type="button" class="mock-action" data-preview-start>${label(['Explore the workspace','استكشف مساحة العمل'])}</button></div>
            <div class="mock-hero-visual"><div class="mock-launch-art" aria-hidden="true">
                <span>${label(['SUMMER LAUNCH','إطلاق الصيف'])}</span>
                <strong>${label(['Launch plan','خطة الإطلاق'])}</strong>
                ${[['Brief approved','اعتُمد الموجز'],['Design review','مراجعة التصميم'],['Launch day','يوم الإطلاق']].map((step, index) =>
                    `<div><i>${['✓','◒','○'][index]}</i>${label(step)}</div>`).join('')}
            </div>${previewMediaSlot('landing', label)}</div>
        </header>
        <section class="mock-feature-section" data-preview-section="features" tabindex="-1">
            <h5>${label(['From first brief to launch day','من أول موجز إلى يوم الإطلاق'])}</h5>
            <div class="mock-benefits">${points.map(([icon,title,body]) => `<div><span aria-hidden="true">${icon}</span><strong>${label(title)}</strong><p>${label(body)}</p></div>`).join('')}</div>
        </section>
        <footer class="mock-landing-footer" data-preview-section="about" data-preview-footer tabindex="-1">
            <strong>Linearise</strong><span>${label(['A workspace for teams that ship together.','مساحة عمل للفرق التي تطلق منتجاتها معًا.'])}</span>
        </footer>
    </div>`;
}

function internalTool(label) {
    const records = [
        ['review','REQ-201',['Printer replacement','استبدال طابعة'],'Lina Park',['In review','قيد المراجعة']],
        ['approved','REQ-202',['Warehouse access','دخول المستودع'],'Samir Noor',['Approved','معتمد']],
        ['pending','REQ-203',['Vendor onboarding','تهيئة مورد'],'Noor Ali',['Pending','معلق']],
        ['review','REQ-204',['Equipment renewal','تجديد المعدات'],'Maya Reed',['In review','قيد المراجعة']]
    ];
    return `<div class="mock-ops">
        <div class="mock-ops-header" data-preview-workspace><strong><span class="mock-brand-mark" aria-hidden="true">▣</span> Relay</strong>
            ${nav(['Operations navigation','التنقل في العمليات'], [
                ['records',['Records','السجلات']],['workflow',['Workflow','سير العمل']]
            ], label)}
            ${account(label,'LP','Lina Park',['Operations coordinator','منسقة العمليات'])}</div>
        <div class="mock-page-content" data-preview-modules>
            <header class="mock-page-heading"><div><h4><span class="mock-table-title">${label(['Operations inbox','صندوق العمليات'])}</span>
                <span class="mock-overview-title">${label(['Operations overview','نظرة عامة على العمليات'])}</span></h4>
                <p>${label(['Track service requests and approvals across your team.','تابع طلبات الخدمة والموافقات عبر فريقك.'])}</p></div></header>
            ${metrics([[['Open requests','طلبات مفتوحة'],'24'],[['Awaiting review','بانتظار المراجعة'],'8'],[['Completed this week','المكتملة هذا الأسبوع'],'63']],label)}
            <section class="mock-card mock-records" data-preview-section="records" tabindex="-1">
                <div class="mock-section-title"><strong>${label(['Service requests','طلبات الخدمة'])}</strong>
                    <label>${label(['Status','الحالة'])} <select data-record-filter>
                        ${[['all',['All statuses','كل الحالات']],['review',['In review','قيد المراجعة']],
                            ['approved',['Approved','معتمد']],['pending',['Pending','معلق']]].map(([value, text]) =>
                            `<option value="${value}">${label(text)}</option>`).join('')}
                    </select></label>
                </div>
                <table class="mock-table"><thead><tr>${[['Request','الطلب'],['Owner','المسؤول'],['Status','الحالة']].map(text =>
                    `<th scope="col">${label(text)}</th>`).join('')}</tr></thead><tbody>
                    ${records.map(([status,id,title,owner,text]) => `<tr data-record-status="${status}"><td><strong>${label(title)}</strong>
                        <small dir="ltr">${id}</small></td><td>${owner}</td><td>${badge(label(text))}</td></tr>`).join('')}
                </tbody></table>
                ${flowAction(label, 'export', ['Prepare export','إعداد التصدير'])}
            </section>
            ${previewMediaSlot('internal-tool', label)}
            <section class="mock-workflow" data-preview-section="workflow" tabindex="-1">
                <div><strong>${label(['Approval workflow','مسار الموافقة'])}</strong><p>${label(['Requests move from intake to review before approval.','تنتقل الطلبات من الاستلام إلى المراجعة قبل الموافقة.'])}</p></div>
                <div class="mock-workflow-steps">${badge(label(['Intake','الاستلام']))}${badge(label(['Review','المراجعة']))}${badge(label(['Approved','الموافقة']))}</div>
            </section>
        </div>
    </div>`;
}

export const templates = Object.freeze({ saas, ecommerce, landing, 'internal-tool': internalTool });

export function featureModules(label) {
    return {
        auth: `<strong>${label(['Account access','الوصول إلى الحساب'])}</strong><div class="mock-inline">${badge(label(['Sign in','تسجيل الدخول']))}<span>${label(['Account · guest','الحساب · ضيف'])}</span></div>`,
        analytics: `<strong>${label(['Traffic by day','الزيارات حسب اليوم'])}</strong>${bars(label(['Traffic peaks midweek','ذروة الزيارات منتصف الأسبوع']),[24,48,73,62,54,31,39])}`,
        storage: `<strong>${label(['File library','مكتبة الملفات'])}</strong><div class="mock-drop">${label(['Drop files here · Browse','أفلت الملفات هنا · تصفح'])}</div><span>brief.pdf · 340 KB</span>`,
        jobs: `<strong>${label(['Processing queue','قائمة المعالجة'])}</strong><div class="mock-inline"><span>${label(['Export report','تصدير التقرير'])}</span>${badge(label(['Processing · 64%','قيد المعالجة · 64%']))}</div><progress max="100" value="64" aria-label="${label(['Report progress','تقدم التقرير'])}"></progress>`,
        orders: `<strong>${label(['Recent orders','الطلبات الأخيرة'])}</strong>${table([['Order','الطلب'],['Status','الحالة']], [['#1042',['Ready to ship','جاهز للشحن']],['#1041',['Paid','مدفوع']]],label)}`,
        conversion: `<strong>${label(['Request a demo','اطلب عرضًا تجريبيًا'])}</strong>
            <form class="mock-demo-form" data-preview-demo>
                <label>${label(['Sample email','بريد إلكتروني تجريبي'])}
                    <input type="email" value="maya@example.test" required></label>
                <button type="submit" class="mock-action">${label(['Request demo','اطلب عرضًا'])}</button>
                ${flowFeedback()}
            </form>`,
        roles: `<strong>${label(['Roles &amp; permissions','الأدوار والصلاحيات'])}</strong>${table([['Role','الدور'],['Permission','الصلاحية']], [[['Administrator','مسؤول'],['Manage workspace','إدارة مساحة العمل']],[['Viewer','مشاهد'],['Read only','القراءة فقط']]],label)}`
    };
}
