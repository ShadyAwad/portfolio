import test from 'node:test';
import assert from 'node:assert/strict';
import { createConfigurationStore } from '../src/studio/configuration.js';
import { buildArchitectureGraph } from '../src/studio/architecture/graph.js';
import { priceProject } from '../src/studio/pricing.js';
import { buildUniverseScene } from '../src/studio/universe/scene.js';
import { modelScenario, parseScenarioValue, resetScenario, stageVisibility, updateScenario } from '../src/studio/universe/challenge-model.js';

const initial = () => createConfigurationStore().getState();
const queue = (jobRate, effectiveSlots = 4, serviceSeconds = .5, targetUtilization = .7) =>
    modelScenario(initial(), 'queue', { jobRate, effectiveSlots, serviceSeconds, targetUtilization });

test('exposes only the relevant stage content and preserves navigation on invalid requests', () => {
    assert.deepEqual(stageVisibility(), { stage: 'create', graph: false, controls: false, summary: true });
    assert.deepEqual(stageVisibility('create', 'architect'), { stage: 'architect', graph: true, controls: false, summary: false });
    assert.deepEqual(stageVisibility('architect', 'challenge'), { stage: 'challenge', graph: true, controls: true, summary: false });
    assert.equal(stageVisibility('challenge', 'invalid').stage, 'challenge');
    assert.equal(stageVisibility('challenge', 'create').stage, 'create');
});

test('queue status follows exact model boundaries including target and saturation', () => {
    assert.equal(queue(0).status, 'nominal');
    assert.equal(queue(5.6).status, 'nominal');
    assert.equal(queue(6).status, 'elevated');
    assert.equal(queue(8).status, 'saturated');
    assert.equal(queue(8).metrics.utilization.value, 1);
    assert.equal(queue(8).metrics.backlog.value, 0);
    assert.equal(queue(10).status, 'overloaded');
    assert.equal(queue(10).metrics.backlog.value, 172800);
    assert.equal(queue(10).metrics.capacity.value, 8);
    assert.equal(queue(0.8, 1, 1.25).status, 'saturated');
    assert.equal(queue(1, 0).status, 'overloaded');
    assert.equal(queue(1, 0).metrics.utilization.value, null);
    assert.equal(queue(0, 0).status, 'unavailable');
});

test('missing values remain unavailable and zero remains a distinct result', () => {
    assert.equal(queue(null).status, 'unavailable');
    assert.equal(queue(1, null).metrics.capacity.value, null);
    const api = modelScenario(initial(), 'api', { users: null });
    assert.equal(api.status, 'unavailable');
    assert.equal(api.metrics.dailyRequests.value, null);
    assert.equal(modelScenario(initial(), 'api', { users: 0 }).metrics.burstRps.value, 0);
    assert.equal(parseScenarioValue('jobRate', '0.01'), .01);
    assert.equal(parseScenarioValue('jobRate', '0.001'), undefined);
    assert.equal(parseScenarioValue('jobRate', String(1 / 86400)), 1 / 86400);
    assert.equal(parseScenarioValue('users', '2.5'), undefined);
    assert.equal(parseScenarioValue('users', ''), null);
});

test('drafts are independent and scenario reset restores current project assumptions', () => {
    const store = createConfigurationStore({ usage: { users: 200, requests: 99000 } });
    const state = store.getState();
    let draft = updateScenario({}, 'api', 'users', 1200);
    draft = updateScenario(draft, 'queue', 'jobRate', 10);
    assert.deepEqual(updateScenario(draft, 'api', 'jobRate', 2), draft);
    assert.equal(modelScenario(state, 'api', draft.api).metrics.dailyRequests.value, 12000);
    assert.equal(modelScenario(state, 'api', draft.api).metrics.peakHour.value, .5);
    assert.equal(modelScenario(state, 'api', draft.api).metrics.burstRps.value, 1);
    assert.equal(store.getState(), state);
    assert.deepEqual(priceProject(store.getState()), priceProject(state));
    draft = resetScenario(draft, 'api');
    assert.equal(draft.queue.jobRate, 10);
    assert.equal(modelScenario(store.update({ usage: { users: 300 } }), 'api', draft.api).values.users, 300);
});

test('storage uses configured categories and simulation never changes the project topology', () => {
    const store = createConfigurationStore({ applicationType: 'landing' });
    const state = store.getState();
    const original = buildUniverseScene(buildArchitectureGraph(state));
    const dryRun = modelScenario(state, 'queue', { jobRate: 10 });
    assert.equal(dryRun.status, 'overloaded');
    assert.deepEqual(buildUniverseScene(buildArchitectureGraph(store.getState())), original);
    const changed = store.update({ previewFeatures: { storage: true, jobs: true }, engineering: { audit: true, semantic: true } });
    const scene = buildUniverseScene(buildArchitectureGraph(changed));
    assert.deepEqual(scene.nodes[0], original.nodes[0]);
    assert(scene.nodes.some(node => node.id === 'queue'));
    const storage = modelScenario(changed, 'storage', { records: 1e6, auditRecords: 1e6, uploads: 10000, vectorCount: 100000 });
    assert.equal(storage.status, 'growth');
    assert.equal(storage.metrics.structured.value, 2048000000);
    assert.equal(storage.metrics.audit.value, 512000000);
    assert.equal(storage.metrics.files.value, 52428800000);
    assert.equal(storage.metrics.vectors.value, 614400000);
    assert.equal(storage.metrics.raw.value, 55603200000);
    assert.equal(modelScenario(state, 'storage', { records: 0, uploads: 0 }).metrics.estimated.value, 0);
});
