import test from 'node:test';
import assert from 'node:assert/strict';
import { createConfigurationStore } from '../src/studio/configuration.js';
import { buildArchitectureGraph, resolveNodeSelection } from '../src/studio/architecture/graph.js';
import { buildUniverseScene, universeKeyTarget } from '../src/studio/universe/scene.js';
import { space } from '../src/studio/universe/layout.js';

test('maps only real graph components and valid connections into the scene', () => {
    const state = createConfigurationStore({ previewFeatures: { storage: true, jobs: true } }).getState();
    const graph = buildArchitectureGraph(state);
    const scene = buildUniverseScene({
        ...graph, edges: [...graph.edges, { id: 'invalid', from: 'missing', to: 'api' }]
    });
    assert.deepEqual(scene.nodes.map(node => node.id), graph.nodes.map(node => node.id));
    assert.deepEqual(scene.channels.map(({ path, ...edge }) => {
        assert.match(path, /^M [\d.]+ [\d.]+ Q /);
        return edge;
    }), graph.edges);
    assert.equal(scene.nodes.find(node => node.id === 'browser').appearance, 'core');
    assert.equal(scene.nodes.find(node => node.id === 'objects').appearance, 'crystal');
});

test('feature toggles preserve deterministic positions and remove dependent channels', () => {
    const store = createConfigurationStore({ applicationType: 'landing' });
    const graphFor = state => buildArchitectureGraph(state);
    const minimal = buildUniverseScene(graphFor(store.getState()));
    const extendedGraph = graphFor(store.update({
        previewFeatures: { auth: true, storage: true, jobs: true, tenancy: true },
        engineering: { semantic: true },
        features: { ai: true }
    }));
    const extended = buildUniverseScene(extendedGraph);
    assert.deepEqual(buildUniverseScene(extendedGraph), extended);
    assert.deepEqual(extended.nodes.slice(0, 1), minimal.nodes);
    assert.equal(new Set(extended.nodes.map(node => `${node.x},${node.y}`)).size, extended.nodes.length);
    assert(extended.nodes.every(node => node.x > 0 && node.x < space.width && node.y > 0 && node.y < space.height));
    const reduced = buildUniverseScene(graphFor(store.update({ previewFeatures: { jobs: false } })));
    const removed = ['queue', 'redis', 'workers'];
    assert.deepEqual(reduced.nodes, extended.nodes.filter(node => !removed.includes(node.id)));
    assert.deepEqual(reduced.channels, extended.channels.filter(edge => !removed.includes(edge.from) && !removed.includes(edge.to)));
});

test('uses one selection for both diagrams and supports mirrored keyboard navigation', () => {
    const store = createConfigurationStore({ previewFeatures: { jobs: true } });
    const graph = buildArchitectureGraph(store.getState());
    const { nodes } = buildUniverseScene(graph);
    assert.equal(resolveNodeSelection(graph, 'queue'), 'queue');
    assert.equal(universeKeyTarget(nodes, 'browser', 'ArrowRight', false), 'api');
    assert.equal(universeKeyTarget(nodes, 'browser', 'ArrowLeft', true), 'api');
    assert.equal(universeKeyTarget(nodes, 'api', 'Home', true), 'browser');
    assert.equal(universeKeyTarget(nodes, 'api', 'Escape', false), 'browser');
    assert.equal(universeKeyTarget(nodes, 'api', 'End', false), 'workers');
    assert.equal(universeKeyTarget(nodes, 'api', 'Tab', false), undefined);
    const updated = buildArchitectureGraph(store.update({ previewFeatures: { jobs: false } }));
    assert.equal(resolveNodeSelection(updated, 'queue'), 'browser');
});

test('missing engineering metrics do not affect scene generation or invent estimates', () => {
    const graph = buildArchitectureGraph(createConfigurationStore().getState());
    const api = graph.nodes.find(node => node.id === 'api');
    assert.equal(api.metrics.burstRps.status, 'unavailable');
    assert.equal(api.metrics.burstRps.value, null);
    const stripped = { ...graph, nodes: graph.nodes.map(({ metrics, ...node }) => node) };
    assert.deepEqual(buildUniverseScene(graph), buildUniverseScene(stripped));
});
