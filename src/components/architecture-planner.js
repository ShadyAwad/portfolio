const planner = document.getElementById('architecture-planner');
const fields = Object.fromEntries([...planner.querySelectorAll('input')].map(input => [input.name, input]));
const labels = planner.querySelectorAll('[data-plan-label]');
const copy = {
    en: {
        title: 'Advanced Architecture Mode',
        intro: 'Set workload and security requirements, then review the engineering models and separate development estimate.',
        scale: 'Scale', tenants: 'Tenants', users: 'Active users', requests: 'Requests per day',
        requestHint: 'Leave blank to estimate daily requests from active users and the model assumptions.',
        data: 'Data', records: 'Records per month', uploads: 'File uploads per month', semantic: 'Semantic search',
        automation: 'Automation', jobs: 'Background jobs per day', schedules: 'Scheduled workflows', notifications: 'Notifications per day',
        security: 'Security', rbac: 'Role-based access (RBAC)', audit: 'Audit logs', webauthn: 'WebAuthn', rls: 'Tenant isolation (RLS)',
        auto: 'Auto'
    },
    ar: {
        title: 'وضع تخطيط البنية التقنية',
        intro: 'حدّد حجم العمل ومتطلبات الأمان، ثم راجع النماذج الهندسية وتقدير التطوير المنفصل.',
        scale: 'الحجم', tenants: 'المستأجرون', users: 'المستخدمون النشطون', requests: 'الطلبات يوميًا',
        requestHint: 'اتركه فارغًا لتقدير الطلبات من عدد المستخدمين النشطين وافتراضات النموذج.',
        data: 'البيانات', records: 'السجلات شهريًا', uploads: 'الملفات المرفوعة شهريًا', semantic: 'البحث الدلالي',
        automation: 'الأتمتة', jobs: 'المهام الخلفية يوميًا', schedules: 'مسارات العمل المجدولة', notifications: 'الإشعارات يوميًا',
        security: 'الأمان', rbac: 'صلاحيات حسب الدور (RBAC)', audit: 'سجلات التدقيق', webauthn: 'WebAuthn', rls: 'عزل المستأجرين (RLS)',
        auto: 'تلقائي'
    }
};

export function localizeArchitecturePlanner(locale) {
    const language = locale === 'ar' ? 'ar' : 'en';
    for (const label of labels) label.textContent = copy[language][label.dataset.planLabel];
    fields.requests.placeholder = copy[language].auto;
}
localizeArchitecturePlanner('en');
