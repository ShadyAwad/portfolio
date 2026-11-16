import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspaceRun, workspacePreviewJourney } from '../src/studio/preview-workspace-motion.js';

const graph = (...ids) => ({ nodes: ids.map(id => ({ id })) });

test('the workspace pulse condenses configured components into a round trip', () => {
    const result = workspacePreviewJourney(graph('browser', 'api', 'postgres', 'auth', 'queue'));
    assert.deepEqual(result.outward, ['browser', 'api', 'postgres']);
    assert.deepEqual(result.stops.map(({ id, time, returning }) => [id, time, returning]), [
        ['browser', 240, false], ['api', 710, false], ['postgres', 1200, false],
        ['api', 1660, true], ['browser', 2160, true]
    ]);
    assert.equal(result.duration, 2400);
    assert.deepEqual(workspacePreviewJourney(graph('browser', 'api')).stops.map(stop => stop.id),
        ['browser', 'api', 'browser']);
    assert.deepEqual(workspacePreviewJourney(graph('browser')).outward, ['browser']);
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
