import test from 'node:test';
import assert from 'node:assert/strict';
import { createConfigurationStore, APPLICATION_TYPES } from '../src/studio/configuration.js';
import { modelCapacity } from '../src/studio/capacity/index.js';
import { defaultEffortAssumptions } from '../src/studio/capacity/effort.js';
import { buildArchitectureGraph, resolveNodeSelection } from '../src/studio/architecture/graph.js';
import { layoutArchitecture } from '../src/studio/architecture/layout.js';
import { priceProject } from '../src/studio/pricing.js';

const metrics = state => modelCapacity(state, state.capacity, defaultEffortAssumptions);
const graphFor = state => buildArchitectureGraph(state, metrics(state));
const ids = graph => graph.nodes.map(node => node.id);
const node = (graph, id) => graph.nodes.find(item => item.id === id);

test('supports every template and keeps conceptual infrastructure conditional', () => {
    for (const applicationType of APPLICATION_TYPES) {
        const state = createConfigurationStore({ applicationType }).getState();
        const graph = graphFor(state);
        assert.equal(graph.template, applicationType);
        assert.deepEqual(ids(graph), applicationType === 'landing' ? ['browser'] : ['browser', 'api', 'postgres']);
    }
    const store = createConfigurationStore({ applicationType: 'landing', previewFeatures: { orders: true } });
    assert.deepEqual(ids(graphFor(store.getState())), ['browser']);
    assert(ids(graphFor(store.update({ previewFeatures: { conversion: true } }))).includes('postgres'));
});

test('toggles components without changing stable IDs, paid RBAC, or input state', () => {
    const store = createConfigurationStore();
    const base = graphFor(store.getState());
    const state = store.update({
        previewFeatures: { tenancy: true, storage: true, auth: true, jobs: true },
        engineering: { semantic: true, rls: true, rbac: true }
    });
    const graph = graphFor(state);
    assert.deepEqual(ids(graph).filter(id => ids(base).includes(id)), ids(base));
    for (const id of ['auth','tenant','vectors','objects','queue','workers','redis']) assert(ids(graph).includes(id));
    assert.equal(graph.nodes.filter(item => item.id === 'postgres').length, 1);
    assert(graph.annotations.includes('sharedRls'));
    assert(graph.edges.some(edge => edge.from === 'postgres' && edge.to === 'tenant'));
    assert.equal(state.features.rbac, false);
    assert.equal(priceProject(state).total, 75);
    assert.equal(store.getState(), state);
    const disabled = graphFor(store.update({
        previewFeatures: { tenancy: false, storage: false, jobs: false }, engineering: { semantic: false, rls: false }
    }));
    for (const id of ['tenant','vectors','objects','queue','workers','redis']) assert(!ids(disabled).includes(id));
    assert(ids(disabled).includes('auth'));
});

test('a known workload, scheduling, or external integration justifies its own branch', () => {
    const store = createConfigurationStore({ applicationType: 'landing', usage: { jobs: 1, notifications: null } });
    const missing = graphFor(store.getState());
    assert(ids(missing).includes('queue'));
    assert.equal(node(missing,'queue').metrics.arrival.value,null);
    const next = graphFor(store.update({ usage: { jobs: 0, notifications: 0 }, features: { ai: true } }));
    assert(!ids(next).includes('queue'));
    assert.deepEqual(next.boundaries.find(boundary => boundary.id === 'external').nodes, ['integration']);
    assert(ids(graphFor(store.update({ engineering: { schedules: true } }))).includes('workers'));
});

test('capacity metrics are reused by identity, missing data stays unavailable, and overload is surfaced', () => {
    const state = createConfigurationStore({
        usage: { jobs: 864000, notifications: 0 },
        previewFeatures: { storage: true }, engineering: { audit: true, semantic: true }
    }).getState();
    const result = metrics(state);
    const graph = buildArchitectureGraph(state, result);
    assert.equal(node(graph,'api').metrics.burstRps, result.api.burstRps);
    assert.equal(node(graph,'api').status, 'ok');
    assert.equal(node(graph,'queue').metrics.utilization, result.queue.utilization);
    assert.equal(node(graph,'queue').metrics.utilization.value, 1.25);
    assert.equal(node(graph,'queue').metrics.backlog.value, 172800);
    assert.equal(node(graph,'queue').status, 'warning');
    assert.equal(graph.status, 'warning');
    assert(graph.annotations.includes('queueWarning'));
    assert.equal(node(graph,'postgres').metrics.audit, result.storage.audit);
    assert.equal(node(graph,'postgres').status, 'unavailable');
    assert.equal(node(graph,'objects').metrics.files, result.storage.files);
    assert.equal(node(graph,'vectors').metrics.vectors.value, null);
    assert.equal(node(buildArchitectureGraph(state, null),'api').metrics.dailyRequests.status, 'unavailable');
});

test('edges and boundary references are valid and routed layout is deterministic, bounded, and mirrored', () => {
    const state = createConfigurationStore({
        previewFeatures: { auth: true, tenancy: true, jobs: true, storage: true },
        engineering: { rls: true, semantic: true },
        features: { ai: true }
    }).getState();
    const graph = graphFor(state);
    assert.deepEqual(graph, graphFor(state));
    assert.equal(new Set(ids(graph)).size, graph.nodes.length);
    assert.equal(new Set(graph.edges.map(edge => edge.id)).size, graph.edges.length);
    assert.equal(graph.edges.length, graph.nodes.length - 1);
    for (const edge of graph.edges) assert(ids(graph).includes(edge.from) && ids(graph).includes(edge.to) && edge.relationship);
    for (const boundary of graph.boundaries) for (const id of boundary.nodes) assert(ids(graph).includes(id));
    const layout = layoutArchitecture(graph);
    const rtl = layoutArchitecture(graph, true);
    assert.deepEqual(layout, layoutArchitecture(graph));
    for (const [id, box] of layout.positions) {
        assert.equal(rtl.positions.get(id).x + box.x + box.width, layout.width);
        assert(box.x >= 0 && box.x + box.width <= layout.width && box.y + box.height <= layout.height);
    }
    const rows = [...layout.positions.values()];
    assert(rows.every((box, i) => i === 0 || box.y >= rows[i - 1].y + rows[i - 1].height));
    assert(layout.edges.every(edge => /^M \d+ \d+ V \d+ H \d+$/.test(edge.path)));
    const mobile = layoutArchitecture(graph, true, true);
    assert(mobile.width < layout.width);
    for (const box of mobile.positions.values()) assert(box.x >= 0 && box.x + box.width <= mobile.width);
});

test('selection is retained while the node remains and returns to the browser when it disappears', () => {
    const store = createConfigurationStore({ previewFeatures: { jobs: true } });
    const selected = resolveNodeSelection(graphFor(store.getState()), 'queue');
    assert.equal(selected, 'queue');
    assert.equal(resolveNodeSelection(graphFor(store.update({ previewFeatures: { storage: true } })), selected), 'queue');
    assert.equal(resolveNodeSelection(graphFor(store.update({ previewFeatures: { jobs: false } })), selected), 'browser');
    assert.equal(resolveNodeSelection({ nodes: [] }, 'queue'), null);
});
