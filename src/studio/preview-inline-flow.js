import { buildArchitectureGraph } from './architecture/graph.js';
import { resolveFlow } from './flow/model.js';
import { resolvePreviewTrace } from './preview-trace.js';

const stages = {
    workspace: {
        api: ['Request workspace', 'طلب مساحة العمل'],
        access: ['Check access', 'التحقّق من الوصول'],
        postgres: ['Read dashboard data', 'قراءة بيانات اللوحة']
    },
    checkout: {
        api: ['Validate cart', 'التحقّق من السلة'],
        access: ['Check session', 'التحقّق من الجلسة'],
        postgres: ['Save demo order', 'حفظ الطلب التجريبي']
    },
    export: {
        api: ['Validate filters', 'التحقّق من عوامل التصفية'],
        postgres: ['Read matching records', 'قراءة السجلات المطابقة'],
        queue: ['Queue and generate CSV', 'إدراج المهمة وإنشاء CSV'],
        inline: ['Generate CSV', 'إنشاء CSV']
    },
    demo: {
        api: ['Validate form', 'التحقّق من النموذج'],
        postgres: ['Record demo request', 'تسجيل طلب العرض']
    }
};
const feedback = {
    workspace: ['Demo workspace ready.', 'مساحة العمل التجريبية جاهزة.'],
    checkout: ['Demo order confirmed. No purchase was made.', 'تأكّد الطلب التجريبي دون إجراء عملية شراء.'],
    export: ['Demo records.csv ready. No file was created.', 'ملف records.csv التجريبي جاهز دون إنشاء ملف فعلي.'],
    demo: ['Demo request received. No information was sent.', 'تم استلام طلب العرض التجريبي دون إرسال أي معلومات.']
};

export function deriveInlineFlow(action, state) {
    const trace = resolvePreviewTrace(action, state);
    if (!trace || (action.action === 'demo' && !state.previewFeatures.conversion)) return null;
    const route = resolveFlow(state, buildArchitectureGraph(state), trace.event.scenario).steps;
    const outcomeIndex = route.findIndex(step => step.outcome === trace.outcome);
    if (outcomeIndex < 0) return null;
    const nodes = new Set(route.slice(0, outcomeIndex).map(step => step.node));
    const keys = ['api'];
    const labels = stages[action.action];
    if (labels.access && (nodes.has('auth') || nodes.has('tenant'))) keys.push('access');
    keys.push('postgres');
    if (action.action === 'export') keys.push(nodes.has('queue') ? 'queue' : 'inline');
    return { stages: keys.map(key => ({ key, label: labels[key] })), outcome: feedback[action.action] };
}

export function createInlineFlow(panel, host, getState, label, signal) {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let active;
    let timer;

    function clear() {
        clearTimeout(timer);
        if (!active) return;
        const { rail, status, list } = active;
        active = undefined;
        rail.removeAttribute('data-flow-state');
        status.textContent = '';
        list.hidden = true;
        list.replaceChildren();
    }

    function collapse() {
        clearTimeout(timer);
        active.list.hidden = true;
        active.list.replaceChildren();
    }

    function finish() {
        active.rail.dataset.flowState = 'complete';
        active.status.textContent = label(active.outcome);
        if (motion.matches) collapse();
        else {
            active.list.querySelector('[aria-current]')?.removeAttribute('aria-current');
            timer = setTimeout(collapse, 450);
        }
    }

    function advance() {
        const previous = active.list.children[active.index];
        if (previous) {
            previous.removeAttribute('aria-current');
            previous.setAttribute('data-done', '');
        }
        const current = active.list.children[++active.index];
        if (!current) { finish(); return; }
        current.setAttribute('aria-current', 'step');
        timer = setTimeout(advance, 380);
    }

    function run(event, origin) {
        if (host.hidden || panel.hidden || document.hidden) return;
        const flow = deriveInlineFlow(event, getState());
        const rail = origin.querySelector('.mock-flow-feedback');
        if (!flow || !rail) return;
        clear();
        const status = rail.querySelector('.mock-flow-status');
        const list = rail.querySelector('.mock-flow-steps');
        active = { rail, status, list, index: -1, outcome: flow.outcome };
        if (motion.matches) { finish(); return; }
        rail.dataset.flowState = 'running';
        status.textContent = label(['Simulating request…', 'محاكاة الطلب…']);
        list.replaceChildren(...flow.stages.map(stage => {
            const item = document.createElement('li');
            item.dataset.stage = stage.key;
            item.textContent = label(stage.label);
            return item;
        }));
        list.hidden = false;
        advance();
    }

    function suspend() {
        if (active?.rail.dataset.flowState === 'running') clear();
        else if (active) collapse();
    }

    host.addEventListener('studio-visibility', () => { if (host.hidden) suspend(); }, { signal });
    document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); }, { signal });
    motion.addEventListener('change', () => {
        if (!motion.matches || !active) return;
        if (active.rail.dataset.flowState === 'running') finish();
        else collapse();
    }, { signal });
    return { run, clear, suspend };
}
