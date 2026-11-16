import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspaceRun, workspacePreviewJourney } from '../src/studio/preview-workspace-motion.js';
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
    assert.deepEqual(result.stops.map(({ id, time, returning }) => [id, time, returning]), [
        ['browser', 240, false], ['api', 710, false], ['postgres', 1200, false],
        ['api', 1660, true], ['browser', 2160, true]
    ]);
    assert.equal(result.duration, 2400);
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
        assert.deepEqual(result.stops[2], { id: 'access', time: 1000, returning: false });
        assert.equal(result.duration, 2690);
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

function setup() {
    const states = [], effects = [], completed = [];
    let visible = true;
    const run = createWorkspaceRun({
        canRun: () => visible,
        stage: state => states.push(state),
        animate() {
            let finish, reject;
            const finished = new Promise((resolve, fail) => { finish = resolve; reject = fail; });
            const effect = { finished, finish, reject, cancelled: false, cancel() { this.cancelled = true; } };
            effects.push(effect);
            return [effect];
        }
    });
    return {
        run, states, effects, completed, hide() { visible = false; },
        play(name, reduced = false) { run.play(null, reduced, () => completed.push(name)); }
    };
}

test('restart discards the old completion and releases all active effects', async () => {
    const pulse = setup();
    pulse.play('first');
    pulse.effects[0].finish();
    pulse.play('second');
    await Promise.resolve();
    assert.deepEqual(pulse.completed, []);
    pulse.effects[1].finish();
    await Promise.resolve();
    assert.deepEqual(pulse.completed, ['second']);
    assert.deepEqual(pulse.states, ['running', 'idle', 'running', 'idle']);
    assert(pulse.effects.every(effect => effect.cancelled));
});

test('cancelled, rejected, and hidden runs leave no completed preview state', async () => {
    const pulse = setup();
    pulse.play('cancelled');
    pulse.run.cancel();
    pulse.effects[0].finish();
    pulse.play('rejected');
    pulse.effects[1].reject();
    await Promise.resolve();
    pulse.play('hidden');
    pulse.hide();
    pulse.effects[2].finish();
    await Promise.resolve();
    pulse.play('disabled');
    assert.deepEqual(pulse.completed, []);
    assert.equal(pulse.states.at(-1), 'idle');
    assert(pulse.effects.every(effect => effect.cancelled));
});

test('reduced motion resolves immediately and can settle an existing run', async () => {
    const pulse = setup();
    pulse.play('instant', true);
    assert.deepEqual(pulse.effects, []);
    pulse.play('running');
    pulse.run.finish();
    pulse.effects[0].finish();
    await Promise.resolve();
    assert.deepEqual(pulse.completed, ['instant', 'running']);
    assert(pulse.effects[0].cancelled);
});
