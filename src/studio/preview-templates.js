export const translations = {
    title: ['Application Design Studio', 'استوديو تصميم التطبيقات'],
    intro: ['Choose a template, try features, and see how the interface changes.', 'اختر قالبًا وجرّب الميزات وشاهد كيف تتغير الواجهة.'],
    controls: ['Preview settings', 'إعدادات المعاينة'],
    template: ['Application type', 'نوع التطبيق'],
    theme: ['Preview theme', 'مظهر المعاينة'],
    system: ['System', 'حسب الجهاز'],
    light: ['Light', 'فاتح'],
    dark: ['Dark', 'داكن'],
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

function saas(label) {
    return `<div class="mock-saas">
        <aside class="mock-sidebar"><strong>Pulse</strong>
            <span>${label(['Overview','نظرة عامة'])}</span><span>${label(['Analytics','التحليلات'])}</span><span>${label(['Team','الفريق'])}</span>
        </aside>
        <div class="mock-saas-content">
            <h4>${label(['Workspace overview','نظرة عامة على مساحة العمل'])}</h4>
            ${metrics([[['Active users','المستخدمون النشطون'],'1,284'],[['New accounts','الحسابات الجديدة'],'208'],[['Retention','الاحتفاظ'],'91%']],label)}
            <div class="mock-card"><strong>${label(['Weekly activity','النشاط الأسبوعي'])}</strong>
                ${bars(label(['Activity peaks on Friday','ذروة النشاط يوم الجمعة']),[36,48,44,62,84,58,64])}
            </div>
            <div class="mock-section-title"><strong>${label(['Team members','أعضاء الفريق'])}</strong>${badge(label(['Invite member','دعوة عضو']))}</div>
            ${table([['Name','الاسم'],['Status','الحالة']], [['Samir Noor',['Active','نشط']],['Lina Reed',['Invited','تمت الدعوة']]], label)}
        </div>
    </div>`;
}

function ecommerce(label) {
    const products = [
        ['lamp', ['Arc Lamp','مصباح آرك'], '64'],
        ['chair', ['Fold Chair','كرسي فولد'], '120'],
        ['clock', ['Dial Clock','ساعة دَيل'], '38']
    ];
    return `<div class="mock-store">
        <div class="mock-store-header"><strong>Form &amp; Field</strong><span>${label(['Shop · Home edit','المتجر · مختارات المنزل'])}</span>${badge(label(['Bag · 1','السلة · 1']))}</div>
        <header><p>${label(['THE HOME EDIT','مختارات المنزل'])}</p><h4>${label(['Objects for everyday living','قطع للحياة اليومية'])}</h4></header>
        <div class="mock-products">${products.map(([shape, name, price]) => `<article class="mock-product">
            <div class="mock-product-art" data-product="${shape}" aria-hidden="true"><i></i></div>
            <strong>${label(name)}</strong><span dir="ltr">$${price}</span></article>`).join('')}</div>
        <div class="mock-store-cart"><strong>${label(['Your bag','سلتك'])}</strong><span>${label(['Arc Lamp × 1','مصباح آرك × 1'])}</span><b dir="ltr">$64</b></div>
    </div>`;
}

function landing(label) {
    const points = [
        ['01',['Start with a clear brief','ابدأ بموجز واضح']],
        ['02',['Share milestones','شارك مراحل العمل']],
        ['03',['Deliver together','أنجز العمل مع فريقك']]
    ];
    return `<div class="mock-landing">
        <div class="mock-landing-nav"><strong>Linearise</strong><span>${label(['Product · About','المنتج · نبذة'])}</span></div>
        <header class="mock-landing-hero">
            <p>${label(['A calmer way to launch','طريقة أبسط للإطلاق'])}</p>
            <h4>${label(['Give every launch a clear path.','امنح كل إطلاق مسارًا واضحًا.'])}</h4>
            <p>${label(['One workspace for briefs, milestones and delivery.','مساحة واحدة للموجز ومراحل العمل والتسليم.'])}</p>
            ${badge(label(['Explore the product →','استكشف المنتج ←']))}
        </header>
        <div class="mock-benefits">${points.map(([num,title]) => `<div><span>${num}</span><strong>${label(title)}</strong></div>`).join('')}</div>
    </div>`;
}

function internalTool(label) {
    return `<div class="mock-ops">
        <div class="mock-ops-header"><strong>Relay / ${label(['Operations','العمليات'])}</strong>${badge(label(['New record','سجل جديد']))}</div>
        <div class="mock-ops-toolbar"><span>${label(['Records','السجلات'])}</span><span>${label(['Workflow queue','قائمة سير العمل'])}</span><span>${label(['This week','هذا الأسبوع'])}</span></div>
        ${metrics([[['Open','مفتوحة'],'24'],[['Awaiting review','بانتظار المراجعة'],'8'],[['Completed','مكتملة'],'63']],label)}
        ${table([['Record','السجل'],['Owner','المسؤول'],['Status','الحالة']],[
            ['REQ-201','Lina',['Review','مراجعة']],['REQ-202','Samir',['Approved','موافق عليه']],['REQ-203','Noor',['Pending','معلق']]
        ],label)}
        <div class="mock-workflow"><strong>${label(['Selected record · REQ-201','السجل المحدد · REQ-201'])}</strong>${badge(label(['Assign','تعيين']))}${badge(label(['Move to review','نقل للمراجعة']))}</div>
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
        conversion: `<strong>${label(['Request a demo','اطلب عرضًا تجريبيًا'])}</strong><div class="mock-inline"><span class="mock-field">you@example.test</span>${badge(label(['Request demo','اطلب عرضًا']))}</div>`,
        roles: `<strong>${label(['Roles &amp; permissions','الأدوار والصلاحيات'])}</strong>${table([['Role','الدور'],['Permission','الصلاحية']], [[['Administrator','مسؤول'],['Manage workspace','إدارة مساحة العمل']],[['Viewer','مشاهد'],['Read only','القراءة فقط']]],label)}`
    };
}
