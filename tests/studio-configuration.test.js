import test from 'node:test';
import assert from 'node:assert/strict';
import { createConfigurationStore } from '../src/studio/configuration.js';
import { priceProject } from '../src/studio/pricing.js';
import { modelArchitecture } from '../src/studio/architecture-model.js';

test('partial updates publish one immutable snapshot and preserve other inputs', () => {
    const store = createConfigurationStore();
    const initial = store.getState();
    const calls = [];
    const listener = (next, previous) => calls.push([next, previous]);
    const unsubscribe = store.subscribe(listener);
    store.subscribe(listener);
    const patch = { applicationType: 'api', pricingTier: 4, features: { pwa: true }, usage: { users: 50 } };
    const next = store.update(patch);
    patch.features.pwa = false;
    assert.equal(next.features.pwa, true);
    assert.equal(next.usage.users, 50);
    assert.equal(next.usage.tenants, initial.usage.tenants);
    assert.equal(next.visual.theme, 'system');
    assert.deepEqual(calls, [[next, initial]]);
    assert.throws(() => { next.usage.users = 100; }, TypeError);
    assert.equal(store.update({ usage: { users: 50 } }), next);
    assert.equal(calls.length, 1);
    unsubscribe();
    store.update({ pricingTier: 2 });
    assert.equal(calls.length, 1);
});

test('validation applies safe defaults, bounds counts, and preserves zero versus auto requests', () => {
    const store = createConfigurationStore({
        applicationType: 'bad', pricingTier: '5', visual: { theme: 'bogus', density: 'compact' },
        features: { ai: 'true', unknown: true }, usage: { jobs: -5, uploads: Infinity, users: 2.9, records: 9e14 },
        engineering: { rls: true, audit: 1 }, unknown: 'value'
    });
    const state = store.getState();
    assert.equal(state.applicationType, 'unspecified');
    assert.equal(state.pricingTier, 1);
    assert.deepEqual(state.visual, { theme: 'system', density: 'compact' });
    assert.deepEqual(state.features, { pwa: false, l10n: false, rbac: false, ai: false });
    assert.equal(state.usage.jobs, 0);
    assert.equal(state.usage.uploads, 100);
    assert.equal(state.usage.users, 2);
    assert.equal(state.usage.records, 1_000_000_000);
    assert.equal(state.engineering.rls, true);
    assert.equal(state.engineering.audit, false);
    assert.equal(Object.hasOwn(state, 'unknown'), false);
    assert.equal(modelArchitecture(state).requests, 20);
    assert.equal(modelArchitecture(store.update({ usage: { requests: 0 } })).requests, 0);
    assert.equal(modelArchitecture(store.update({ usage: { requests: null } })).requests, 20);
    assert.equal(store.update({ usage: { users: NaN }, engineering: null }).usage.users, 2);
});

test('reset restores schema defaults, publishes once, and skips a second reset', () => {
    const store = createConfigurationStore({ pricingTier: 5, features: { ai: true }, usage: { requests: 0 } });
    const before = store.getState();
    const events = [];
    store.subscribe((...args) => events.push(args));
    const reset = store.reset();
    assert.deepEqual(reset, createConfigurationStore().getState());
    assert.deepEqual(events, [[reset, before]]);
    assert.equal(store.reset(), reset);
    assert.equal(events.length, 1);
});

test('existing tier and add-on prices stay independent of architecture estimates', () => {
    const store = createConfigurationStore();
    for (const [index, expected] of [75, 200, 450, 850, 1400].entries()) {
        assert.equal(priceProject(store.update({ pricingTier: index + 1 })).total, expected);
    }
    const state = store.update({
        features: { pwa: true, l10n: true, rbac: true, ai: true },
        usage: { tenants: 100, users: 10000, records: 100000, uploads: 10000, jobs: 4000, notifications: 1000 },
        engineering: { semantic: true, schedules: true, rbac: true, audit: true, webauthn: true, rls: true }
    });
    assert.deepEqual(priceProject(state), { base: 1400, addOns: 375, total: 1775 });
    const plan = modelArchitecture(state);
    assert.equal(plan.score, 100);
    assert.equal(plan.jobs, 5000);
    assert.equal(plan.rowMiB + plan.fileMiB, 50_195.3125);
    assert.equal(plan.days, 10);
});
