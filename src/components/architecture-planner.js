import { configuration } from '../studio/configuration.js';
import { modelArchitecture } from '../studio/architecture-model.js';

const planner = document.getElementById('architecture-planner');
const fields = Object.fromEntries([...planner.querySelectorAll('input')].map(input => [input.name, input]));
const labels = planner.querySelectorAll('[data-plan-label]');
const outputs = Object.fromEntries([...planner.querySelectorAll('[data-plan-result]')]
    .map(output => [output.dataset.planResult, output]));

const copy = {
    en: {
        title: 'Advanced Architecture Mode',
        intro: 'Explore how workload and security choices affect system design. These planning estimates are separate from the project price.',
        scale: 'Scale', tenants: 'Tenants', users: 'Active users', requests: 'Requests per day',
        requestHint: 'Blank estimates 2 sessions × 5 actions per active user daily.',
        data: 'Data', records: 'Records per month', uploads: 'File uploads per month', semantic: 'Semantic search',
        automation: 'Automation', jobs: 'Background jobs per day', schedules: 'Scheduled workflows', notifications: 'Notifications per day',
        security: 'Security', rbac: 'Role-based access (RBAC)', audit: 'Audit logs', webauthn: 'WebAuthn', rls: 'Tenant isolation (RLS)',
        score: 'Complexity score', stack: 'Recommended stack', queue: 'Queue need', db: 'Database / indexing risk',
        growth: 'Monthly data growth', delivery: 'Estimated delivery impact', auto: 'Auto',
        method: 'How these estimates are calculated',
        formula1: 'Blank requests = active users × 2 sessions × 5 actions. Queue load = background jobs + notifications, assuming one job per notification. Include scheduled runs and reports in the background jobs input.',
        formula2: 'Score out of 100: scale 30 (8 tenants / 100, 8 users / 10,000, 14 requests / 100,000); data 20 (12 records / 100,000, 8 uploads / 10,000); automation 20 (15 queue jobs / 5,000, 5 for schedules); security 20 (5 per control); semantic search 10. For each volume, points = weight × min(volume ÷ reference, 1). References are planning benchmarks, not service limits.',
        formula3: 'Storage growth = records × 2 KiB + uploads × 5 MiB. The result excludes indexes, vector embeddings, audit data and backups.',
        formula4: 'Index review starts at 100,000 monthly records or 100,000 daily requests, or when semantic search or RLS is enabled. These are review triggers, not measured database limits.',
        formula5: 'Delivery is a rough planning range: round the score up to the next 10 points, count 1 engineering day per 10 points, then allow 2 extra days at the upper end. Validate with real requirements.',
        noQueue: 'No dedicated queue at this scope',
        useQueue: n => `Recommended · ${n} jobs/day`,
        useSchedule: 'Recommended · scheduled workflows',
        standardDb: 'Baseline indexes and query checks',
        reviewDb: 'Review indexes and test query plans',
        queueStack: 'Redis + BullMQ', storageStack: 'Object storage', vectorStack: 'pgvector', rlsStack: 'PostgreSQL RLS', webauthnStack: 'WebAuthn',
        growthValue: (total, rows, files) => `${total} MiB · ${rows} DB + ${files} files`,
        deliveryValue: (min, max) => `+${min}–${max} engineering days`,
        scoreValue: (score, requests) => `${score}/100 · ${requests} requests/day`
    },
    ar: {
        title: 'وضع تخطيط البنية التقنية',
        intro: 'استكشف كيف يؤثر حجم العمل وخيارات الأمان على تصميم النظام. تقديرات التخطيط منفصلة عن سعر المشروع.',
        scale: 'الحجم', tenants: 'المستأجرون', users: 'المستخدمون النشطون', requests: 'الطلبات يوميًا',
        requestHint: 'عند تركه فارغًا، يُقدّر الطلب بجلستين × 5 إجراءات لكل مستخدم نشط يوميًا.',
        data: 'البيانات', records: 'السجلات شهريًا', uploads: 'الملفات المرفوعة شهريًا', semantic: 'البحث الدلالي',
        automation: 'الأتمتة', jobs: 'المهام الخلفية يوميًا', schedules: 'مسارات العمل المجدولة', notifications: 'الإشعارات يوميًا',
        security: 'الأمان', rbac: 'صلاحيات حسب الدور (RBAC)', audit: 'سجلات التدقيق', webauthn: 'WebAuthn', rls: 'عزل المستأجرين (RLS)',
        score: 'درجة التعقيد', stack: 'التقنيات المقترحة', queue: 'الحاجة إلى قائمة مهام', db: 'مخاطر قاعدة البيانات والفهرسة',
        growth: 'نمو البيانات شهريًا', delivery: 'الأثر التقديري على مدة التنفيذ', auto: 'تلقائي',
        method: 'طريقة حساب التقديرات',
        formula1: 'الطلبات عند ترك الحقل فارغًا = المستخدمون النشطون × جلستين × 5 إجراءات. حمل القائمة = المهام الخلفية + الإشعارات، بواقع مهمة لكل إشعار. أضف التشغيل المجدول والتقارير إلى حقل المهام الخلفية.',
        formula2: 'الدرجة من 100: الحجم 30 (8 للمستأجرين ÷ 100، و8 للمستخدمين ÷ 10,000، و14 للطلبات ÷ 100,000)؛ البيانات 20 (12 للسجلات ÷ 100,000، و8 للملفات ÷ 10,000)؛ الأتمتة 20 (15 للمهام ÷ 5,000، و5 للجدولة)؛ الأمان 20 (5 لكل ضابط)؛ البحث الدلالي 10. نقاط كل حجم = الوزن × أصغر قيمة بين نسبة الحجم إلى المرجع و1. القيم المرجعية للتخطيط.',
        formula3: 'نمو التخزين = السجلات × 2 KiB + الملفات × 5 MiB. لا يشمل الفهارس أو المتجهات أو التدقيق أو النسخ الاحتياطية.',
        formula4: 'تبدأ مراجعة الفهارس عند 100,000 سجل شهريًا أو 100,000 طلب يوميًا، أو عند تفعيل البحث الدلالي أو RLS. هذه عتبات للمراجعة.',
        formula5: 'تقدير مبدئي للمدة: قرّب الدرجة للأعلى إلى أقرب مضاعف لـ10، واحسب يوم عمل هندسي لكل 10 نقاط، ثم أضف يومين للحد الأعلى. راجع التقدير وفق متطلبات المشروع.',
        noQueue: 'هذا النطاق لا يحتاج إلى قائمة مهام مخصصة',
        useQueue: n => `موصى بها · ${n} مهمة يوميًا`,
        useSchedule: 'موصى بها · مسارات العمل المجدولة',
        standardDb: 'فهارس أساسية وفحص الاستعلامات',
        reviewDb: 'راجع الفهارس واختبر خطط الاستعلام',
        queueStack: 'Redis + BullMQ', storageStack: 'تخزين الكائنات', vectorStack: 'pgvector', rlsStack: 'PostgreSQL RLS', webauthnStack: 'WebAuthn',
        growthValue: (total, rows, files) => `${total} MiB · ${rows} للبيانات + ${files} للملفات`,
        deliveryValue: (min, max) => `+${min}–${max} يوم عمل هندسي`,
        scoreValue: (score, requests) => `${score}/100 · ${requests} طلب يوميًا`
    }
};

let language = 'en';
function renderPlan() {
    const t = copy[language];
    const format = new Intl.NumberFormat(language, { maximumFractionDigits: 2 });
    const fmt = n => format.format(n);
    const { requests, jobs, queue, schedules, score, rowMiB, fileMiB, days,
        storage, semantic, rls, webauthn, reviewIndexes } = modelArchitecture(configuration.getState());
    const stack = ['Node.js + Express', 'PostgreSQL'];
    if (queue) stack.push(t.queueStack);
    if (storage) stack.push(t.storageStack);
    if (semantic) stack.push(t.vectorStack);
    if (rls) stack.push(t.rlsStack);
    if (webauthn) stack.push(t.webauthnStack);

    outputs.score.textContent = t.scoreValue(fmt(score), fmt(requests));
    outputs.stack.textContent = new Intl.ListFormat(language).format(stack);
    outputs.queue.textContent = jobs ? t.useQueue(fmt(jobs)) : schedules ? t.useSchedule : t.noQueue;
    outputs.db.textContent = reviewIndexes ? t.reviewDb : t.standardDb;
    outputs.growth.textContent = t.growthValue(fmt(rowMiB + fileMiB), fmt(rowMiB), fmt(fileMiB));
    outputs.delivery.textContent = t.deliveryValue(fmt(days), fmt(days + 2));
}

const unsubscribe = configuration.subscribe((state, previous) => {
    if (Object.keys(state.usage).some(key => state.usage[key] !== previous.usage[key]) ||
        Object.keys(state.engineering).some(key => state.engineering[key] !== previous.engineering[key])) {
        renderPlan();
    }
});
if (import.meta.hot) import.meta.hot.dispose(unsubscribe);

export function localizeArchitecturePlanner(locale) {
    language = locale === 'ar' ? 'ar' : 'en';
    for (const label of labels) label.textContent = copy[language][label.dataset.planLabel];
    fields.requests.placeholder = copy[language].auto;
    renderPlan();
}
localizeArchitecturePlanner('en');
