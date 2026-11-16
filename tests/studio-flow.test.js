import test from 'node:test';
import assert from 'node:assert/strict';
import { APPLICATION_TYPES, createConfigurationStore } from '../src/studio/configuration.js';
import { buildArchitectureGraph } from '../src/studio/architecture/graph.js';
import { flowQueue, initialPlayback, playback, resolveFlow } from '../src/studio/flow/model.js';

test('every template has its own scenarios and falls back when a selection is unavailable', () => {
    const defaults = ['workspace', 'browse', 'demo', 'filter'];
    APPLICATION_TYPES.forEach((applicationType, index) => {
        const state = createConfigurationStore({ applicationType }).getState();
        const graph = buildArchitectureGraph(state);
        const flow = resolveFlow(state, graph, 'unavailable');
        assert.equal(flow.id, defaults[index]);
        for (const key of Object.keys(flow.options)) {
            const selected = resolveFlow(state, graph, key);
            assert.equal(selected.id, key);
            assert(selected.steps.every(step => step.component.id === step.node));
        }
    });
});

test('workspace follows selected graph capabilities and reference routes do not alter the graph or saved settings', () => {
    const store = createConfigurationStore();
    const initial = store.getState();
    const graph = buildArchitectureGraph(initial);
    assert.deepEqual(resolveFlow(initial, graph).steps.map(step => step.node), ['browser','api','postgres','api','browser']);
    const report = resolveFlow(initial, graph, 'report');
    assert.equal(report.steps.find(step => step.node === 'queue').illustrative, true);
    assert(!graph.nodes.some(node => node.id === 'queue'));
    assert.equal(store.getState(), initial);
    const state = store.update({ previewFeatures: { auth: true, tenancy: true, jobs: true } });
    const expanded = buildArchitectureGraph(state);
    assert.deepEqual(resolveFlow(state, expanded).steps.map(step => step.node),
        ['browser','api','auth','tenant','postgres','api','browser']);
    assert.equal(resolveFlow(state, expanded, 'report').steps.find(step => step.node === 'queue').illustrative, false);
});

test('playback sequences, pauses, steps in either direction, completes and resets', () => {
    let state = playback(initialPlayback(), 'play', 3);
    state = playback(state, 'tick', 3);
    assert.deepEqual(state, { index: 1, playing: true });
    state = playback(state, 'pause', 3);
    assert.equal(playback(state, 'tick', 3), state);
    state = playback(state, 'back', 3);
    assert.deepEqual(state, initialPlayback());
    state = playback(playback(state, 'step', 3), 'play', 3);
    state = playback(state, 'tick', 3);
    assert.deepEqual(state, { index: 2, playing: false });
    assert.deepEqual(playback(state, 'play', 3), { index: 0, playing: true });
    assert.deepEqual(playback(state, 'reset', 3), initialPlayback());
});

test('load presets map the existing queue model outputs to status, including exact saturation', () => {
    const state = createConfigurationStore().getState();
    for (const [load, status, utilization, backlog] of [
        ['normal','nominal',.5,0], ['elevated','elevated',.75,0],
        ['saturated','saturated',1,0], ['overloaded','overloaded',1.25,172800]
    ]) {
        const result = flowQueue(state, load);
        assert.equal(result.status, status);
        assert.equal(result.metrics.capacity.value, 8);
        assert.equal(result.metrics.utilization.value, utilization);
        assert.equal(result.metrics.backlog.value, backlog);
    }
});
