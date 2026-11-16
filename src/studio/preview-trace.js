import { scenarios } from './flow/scenarios.js';

const actions = {
    workspace: { template: 'saas', scenario: 'workspace', outcome: 'workspaceReady' },
    checkout: { template: 'ecommerce', scenario: 'checkout', outcome: 'orderConfirmed' },
    export: { template: 'internal-tool', scenario: 'report', outcome: 'exportReady' }
};
const filters = ['all', 'review', 'approved', 'pending'];

// Accept only the fictional values this preview renders. Never capture form inputs or user data.
export function createPreviewAction(template, action, context) {
    const route = Object.hasOwn(actions, action) && actions[action];
    if (!route || route.template !== template) return null;
    let sample = {};
    if (action === 'checkout') {
        const { count, total } = context ?? {};
        if (!Number.isSafeInteger(count) || count < 1 || !Number.isSafeInteger(total) || total < 1) return null;
        sample = { count, total };
    }
    if (action === 'export') {
        const { filter } = context ?? {};
        if (!filters.includes(filter)) return null;
        sample = { filter };
    }
    return Object.freeze({ action, template, scenario: route.scenario, context: Object.freeze(sample) });
}

const filterLabels = {
    all: ['All statuses', 'كل الحالات'], review: ['In review', 'قيد المراجعة'],
    approved: ['Approved', 'معتمد'], pending: ['Pending', 'معلق']
};

export function previewTraceContext({ action, context }, locale) {
    const ar = locale === 'ar';
    if (action === 'export') return filterLabels[context.filter][ar ? 1 : 0];
    if (action === 'checkout') {
        const count = new Intl.NumberFormat(locale).format(context.count);
        const total = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(context.total);
        return ar ? `الكمية: ${count} · ${total}` : `Quantity: ${count} · ${total}`;
    }
    return '';
}

export function resolvePreviewTrace(event, configuration) {
    if (!event || event.template !== configuration.applicationType) return null;
    const validated = createPreviewAction(event.template, event.action, event.context);
    if (!validated || event.scenario !== validated.scenario) return null;
    const { outcome } = actions[validated.action];
    const scenario = scenarios[validated.template][validated.scenario];
    return scenario?.steps.some(step => step.outcome === outcome) ? { event: validated, outcome, title: scenario.title } : null;
}

// One transient invitation per preview. Identity guards updates from a replaced or cleared action.
export function createPreviewTrace(onChange) {
    let action = null;
    let outcome = false;
    function update(next, completed) {
        if (action === next && outcome === completed) return;
        action = next;
        outcome = completed;
        onChange(action, outcome);
    }
    return {
        get action() { return action; },
        offer(event) { if (event) update(event, false); },
        clear() { update(null, false); },
        reflect(event, completed) { if (event && action === event) update(event, completed); }
    };
}
