import test from 'node:test';
import assert from 'node:assert/strict';
import { createConfigurationStore } from '../src/studio/configuration.js';
import { deriveInlineFlow } from '../src/studio/preview-inline-flow.js';
import { createPreviewAction } from '../src/studio/preview-trace.js';

const stages = (state, action, context) =>
    deriveInlineFlow(createPreviewAction(state.applicationType, action, context), state)?.stages.map(({ key }) => key);

test('the inline workspace flow adds a single access stage when the route requires it', () => {
    const store = createConfigurationStore();
    assert.deepEqual(stages(store.getState(), 'workspace'), ['api', 'postgres']);
    for (const patch of [{ previewFeatures: { auth: true, tenancy: true } }, { engineering: { webauthn: true } }, { engineering: { rls: true } }]) {
        store.reset();
        assert.deepEqual(stages(store.update(patch), 'workspace'), ['api', 'access', 'postgres']);
    }
});

test('checkout confirms independently of background work and export shows how CSV is generated', () => {
    const store = createConfigurationStore();
    const bag = { count: 1, total: 64 };
    assert.deepEqual(stages(store.update({ applicationType: 'ecommerce', previewFeatures: { jobs: true } }), 'checkout', bag), ['api', 'postgres']);
    assert.deepEqual(stages(store.update({ previewFeatures: { auth: true } }), 'checkout', bag), ['api', 'access', 'postgres']);
    assert.equal(stages(store.getState(), 'checkout', { count: 0, total: 0 }), undefined);
    const selection = { filter: 'review' };
    assert.deepEqual(stages(store.update({ applicationType: 'internal-tool' }), 'export', selection), ['api', 'postgres', 'queue']);
    assert.deepEqual(stages(store.update({ previewFeatures: { jobs: false } }), 'export', selection), ['api', 'postgres', 'inline']);
});

test('only an enabled demo form has a route, and no form value is captured', () => {
    const store = createConfigurationStore();
    const state = store.update({ applicationType: 'landing' });
    const action = createPreviewAction('landing', 'demo', { email: 'ignored@example.test' });
    assert.deepEqual(action.context, {});
    assert.equal(deriveInlineFlow(action, state), null);
    assert.deepEqual(stages(store.update({ previewFeatures: { conversion: true } }), 'demo'), ['api', 'postgres']);
    assert.equal(deriveInlineFlow(action, store.update({ applicationType: 'saas' })), null);
});
