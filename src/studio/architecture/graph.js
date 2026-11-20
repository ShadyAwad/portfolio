import { derivePreview } from '../preview-model.js';

const keyMetrics = (group, keys) => Object.fromEntries(keys.map(key => [key, group?.[key] ?? {
    value: null, unit: null, status: 'unavailable', warnings: ['missing-or-invalid-input'], assumptions: {}, intermediates: {}
}]));

export function buildArchitectureGraph(state, capacity) {
    const { template, capabilities, roles, recommendations } = derivePreview(state);
    const { semantic, rls, audit, webauthn, schedules } = state.engineering;
    const needsQueue = capabilities.jobs || schedules || capacity?.queue?.arrival?.value > 0 || state.usage.jobs > 0 || state.usage.notifications > 0;
    const tenancy = capabilities.tenancy || rls;
    const auth = capabilities.auth || webauthn;
    const database = template !== 'landing' || auth || tenancy || roles || audit || semantic ||
        capabilities.conversion || capabilities.analytics;
    const backend = database || needsQueue || capabilities.storage || state.features.ai;
    const nodes = [];
    const edges = [];
    const boundaries = [{ id: 'browser', nodes: ['browser'] }];
    const annotations = [];
    const caveats = ['illustrative-burst', 'theoretical-capacity'];

    function add(id, type, parent, relationship, metrics = {}, context = []) {
        const statuses = Object.values(metrics);
        const warnings = [...new Set(statuses.flatMap(metric => metric.warnings ?? []).filter(item => !caveats.includes(item)))];
        const status = statuses.some(metric => metric.status === 'warning' &&
            (metric.warnings ?? []).some(item => !caveats.includes(item))) ? 'warning'
            : statuses.some(metric => metric.status === 'unavailable') ? 'unavailable' : 'ok';
        nodes.push({ id, type, label: id, description: id + 'Description', metrics, context, status, warnings });
        if (parent) edges.push({ id: parent + '-' + id, from: parent, to: id, relationship });
    }

    add('browser', 'client', null, null, {}, [template]);
    if (backend) {
        add('api', 'service', 'browser', 'https', keyMetrics(capacity?.api, ['dailyRequests','peakHour','burstRps']), [
            ...(capabilities.analytics ? ['analytics'] : []), ...(capabilities.conversion ? ['conversion'] : []),
            ...(capabilities.orders ? ['orders'] : []), ...(roles ? ['roles'] : [])
        ]);
    }
    if (auth) add('auth', 'security', 'api', 'verify', {}, webauthn ? ['webauthn'] : []);
    if (database) add('postgres', 'data', 'api', 'sql', keyMetrics(capacity?.storage, ['structured','audit']), audit ? ['auditEnabled'] : []);
    if (tenancy) add('tenant', 'security', 'postgres', 'scope', {}, rls ? ['rls'] : ['applicationScope']);
    if (semantic) add('vectors', 'data', 'postgres', 'similarity', keyMetrics(capacity?.storage, ['vectors']));
    if (capabilities.storage) add('objects', 'data', 'api', 'fileAccess', keyMetrics(capacity?.storage, ['files']));
    if (needsQueue) {
        add('queue', 'service', 'api', 'enqueue', keyMetrics(capacity?.queue, ['arrival','capacity','utilization','backlog']), schedules ? ['schedules'] : []);
        add('redis', 'data', 'queue', 'queueState');
        add('workers', 'service', 'queue', 'dispatch', keyMetrics(capacity?.queue, ['concurrency','requiredConcurrency']));
    }
    if (state.features.ai) add('integration', 'external', 'api', 'externalRequest');

    if (backend) boundaries.push({ id: 'application', nodes: nodes.filter(node => !['client','external'].includes(node.type)).map(node => node.id) });
    if (state.features.ai) boundaries.push({ id: 'external', nodes: ['integration'] });
    if (tenancy) annotations.push(rls ? 'sharedRls' : 'sharedTenant');
    if (recommendations.accountForRoles || (tenancy && !auth)) annotations.push('identityRecommendation');
    if (needsQueue && capacity?.queue?.utilization?.status === 'warning') annotations.push('queueWarning');
    return {
        template, nodes, edges, boundaries, annotations,
        status: nodes.some(node => node.status === 'warning') ? 'warning'
            : nodes.some(node => node.status === 'unavailable') ? 'unavailable' : 'ok'
    };
}

export function resolveNodeSelection(graph, current) {
    return graph.nodes.some(node => node.id === current) ? current : graph.nodes[0]?.id ?? null;
}
