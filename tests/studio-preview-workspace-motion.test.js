import test from 'node:test';
import assert from 'node:assert/strict';
import { previewCaptures, previewDragTarget, workspacePreviewJourney } from '../src/studio/preview-workspace-motion.js';
import { createConfigurationStore } from '../src/studio/configuration.js';
import { buildArchitectureGraph } from '../src/studio/architecture/graph.js';
import { resolveFlow } from '../src/studio/flow/model.js';
import { priceProject } from '../src/studio/pricing.js';

const workspace = state => resolveFlow(state, buildArchitectureGraph(state), 'workspace');
const project = state => workspacePreviewJourney(workspace(state).steps);

test('the workspace pulse condenses configured components into a round trip', () => {
    const state = createConfigurationStore().getState();
    const result = project(state);
    assert.deepEqual(result.outward, ['browser', 'api', 'postgres']);
    assert.deepEqual(result.stops.map(({ id, returning }) => [id, returning]), [
        ['browser', false], ['api', false], ['postgres', false],
        ['api', true], ['browser', true]
    ]);
    assert.equal(result.checkpoint, null);
    const steps = workspace(state).steps;
    assert.deepEqual(workspacePreviewJourney(steps.map(step => ({ ...step, illustrative: step.node === 'postgres' }))).stops.map(stop => stop.id),
        ['browser', 'api', 'browser']);
    assert.deepEqual(workspacePreviewJourney(steps.filter(step => step.node === 'browser')).outward, ['browser']);
});

test('session and tenant checks share one checkpoint when the detailed scenario includes both', () => {
    const cases = [
        [{ auth: true }, {}, 'session', ['auth']],
        [{}, { webauthn: true }, 'session', ['auth']],
        [{ tenancy: true }, {}, 'scope', ['tenant']],
        [{}, { rls: true }, 'scope', ['tenant']],
        [{ auth: true, tenancy: true }, {}, 'access', ['auth', 'tenant']]
    ];
    for (const [previewFeatures, engineering, checkpoint, checks] of cases) {
        const state = createConfigurationStore({ previewFeatures, engineering }).getState();
        assert.deepEqual(workspace(state).steps.filter(step => ['auth', 'tenant'].includes(step.node)).map(step => step.node), checks);
        const result = project(state);
        assert.deepEqual(result.outward, ['browser', 'api', 'access', 'postgres']);
        assert.equal(result.checkpoint, checkpoint);
        assert.deepEqual(result.stops[2], { id: 'access', returning: false });
    }
});

test('a configured queue does not add a branch to Load Workspace or modify the quote or draft', () => {
    const store = createConfigurationStore();
    const baseline = store.getState();
    const state = store.update({
        previewFeatures: { jobs: true, analytics: true, storage: true }, engineering: { schedules: true },
        visual: { theme: 'light' }, usage: { jobs: 80 }
    });
    assert(buildArchitectureGraph(state).nodes.some(node => node.id === 'queue'));
    assert(!workspace(state).steps.some(step => step.channel === 'background'));
    assert.deepEqual(project(state), project(baseline));
    assert.equal(store.getState(), state);
    assert.deepEqual(priceProject(state), priceProject(baseline));
});

test('drag resists off-route movement and attracts the token near the next socket', () => {
    const from = { x: 30, y: 70 };
    const to = { x: 175, y: 70 };
    const offRoute = { x: 90, y: 155 };
    const resisted = previewDragTarget(offRoute, from, to);
    assert(resisted.y < offRoute.y && resisted.y > from.y);
    assert(previewDragTarget({ x: -25, y: 70 }, from, to).x > -25);
    assert(previewDragTarget({ x: 145, y: 70 }, from, to).x > 145);
    const mirrored = previewDragTarget({ x: 35, y: 70 }, { x: 150, y: 70 }, { x: 5, y: 70 });
    assert(mirrored.x < 35);
});

test('capture accepts close drops and a recent flick but rejects a miss or a stale gesture', () => {
    const from = { x: 25, y: 80 };
    const to = { x: 160, y: 80 };
    assert(previewCaptures({ x: 141, y: 82 }, from, to, { x: 0, y: 0 }, false));
    assert(previewCaptures({ x: 94, y: 80 }, from, to, { x: 1, y: 0 }, true));
    assert(!previewCaptures({ x: 94, y: 80 }, from, to, { x: 1, y: 0 }, false));
    assert(!previewCaptures({ x: 40, y: 155 }, from, to, { x: -1, y: 0 }, true));
});
