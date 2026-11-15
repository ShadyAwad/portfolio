import test from 'node:test';
import assert from 'node:assert/strict';
import { createConfigurationStore } from '../src/studio/configuration.js';
import { defaultEffortAssumptions, estimateEngineeringEffort } from '../src/studio/capacity/effort.js';
import { priceProject } from '../src/studio/pricing.js';
import { commercialDefaults, parseCommercialInput } from '../src/studio/commercial/inputs.js';
import { estimateCommercialPrice, roundCurrencyCents } from '../src/studio/commercial/model.js';

const effort = (min, max) => ({ total: { value: { min, max } } });
const cents = ({ value }) => [roundCurrencyCents(value.min), roundCurrencyCents(value.max)];

test('worked price bounds apply contingency to labor and add itemized expenses once', () => {
    const estimate = estimateCommercialPrice(effort(56, 114), {
        ...commercialDefaults, assetsCents: 10000, setupCents: 2500
    });
    assert.deepEqual(cents(estimate.labor), [96600n, 196650n]);
    assert.equal(roundCurrencyCents(estimate.fixed.value), 12500n);
    assert.deepEqual(cents(estimate.total), [109100n, 209150n]);
    assert.deepEqual(Object.values(estimate.expenses).map(roundCurrencyCents), [10000n, 2500n, 0n]);
});

test('zero hours, zero contingency and independent rate changes are valid', () => {
    const zero = estimateCommercialPrice(effort(0, 0), { ...commercialDefaults, assetsCents: 1299 });
    assert.deepEqual(cents(zero.labor), [0n, 0n]);
    assert.deepEqual(cents(zero.total), [1299n, 1299n]);
    const initial = estimateCommercialPrice(effort(10, 20), { ...commercialDefaults, contingencyBps: 0 });
    assert.deepEqual(cents(initial.labor), [15000n, 30000n]);
    const revised = estimateCommercialPrice(effort(10, 20), { ...commercialDefaults, rateCents: 2200, contingencyBps: 0 });
    assert.deepEqual(cents(revised.labor), [22000n, 44000n]);
});

test('currency rounding is half-up for display, with no per-package rounding in totals', () => {
    const work = { value: { min: 1, max: 1 }, assumptions: {}, intermediates: { active: [] } };
    const estimate = estimateCommercialPrice({
        ...effort(2, 2), packages: { first: work, second: work }
    }, { ...commercialDefaults, rateCents: 101, contingencyBps: 5000 });
    assert.equal(estimate.packages.first.cost.value.min, 1515000n);
    assert.equal(estimate.packages.first.cost.value.min + estimate.packages.second.cost.value.min, estimate.labor.value.min);
    assert.equal(roundCurrencyCents(estimate.packages.first.cost.value.min), 152n);
    assert.deepEqual(cents(estimate.total), [303n, 303n]);
});

test('invalid hours, missing inputs, and unsafe presentation bounds remain unavailable', () => {
    for (const input of [effort(-1, 2), effort(3, 2), effort(1.2, 2), effort(0, Infinity), undefined]) {
        assert.equal(estimateCommercialPrice(input, commercialDefaults).labor.reason, 'hoursUnavailable');
    }
    assert.equal(estimateCommercialPrice(effort(1, 2), {}).labor.reason, 'laborInputsUnavailable');
    assert.equal(estimateCommercialPrice(effort(1, 2), { ...commercialDefaults, contingencyBps: 10001 }).labor.value, null);
    const expense = estimateCommercialPrice(effort(1, 2), { ...commercialDefaults, setupCents: null });
    assert.deepEqual(cents(expense.labor), [1725n, 3450n]);
    assert.equal(expense.total.reason, 'expenseInputsUnavailable');
    const large = { ...commercialDefaults, rateCents: 1, contingencyBps: 0 };
    const max = Number.MAX_SAFE_INTEGER;
    assert.deepEqual(cents(estimateCommercialPrice(effort(0, max), large).total), [0n, BigInt(max)]);
    assert.equal(estimateCommercialPrice(effort(0, max), { ...large, assetsCents: 1 }).total.reason, 'outOfRange');
    assert.equal(estimateCommercialPrice(effort(0, max), { ...large, rateCents: 2 }).labor.reason, 'outOfRange');
});

test('feature requirements update only their package ranges and deduplicate overlapping work', () => {
    const store = createConfigurationStore({ usage: { uploads: 0 } });
    const quote = state => estimateCommercialPrice(estimateEngineeringEffort(state, defaultEffortAssumptions), state.commercial);
    assert.deepEqual(quote(store.getState()).hours, { min: 40, max: 80 });
    const engineering = store.update({ engineering: { rbac: true } });
    assert.equal(priceProject(engineering).total, 75);
    const advanced = quote(engineering);
    assert.deepEqual(advanced.hours, { min: 44, max: 90 });
    assert.deepEqual(advanced.packages.auth.requirements, ['rbac']);
    assert.deepEqual(advanced.packages.frontend.hours, { min: 12, max: 24 });
    const pricedRbac = store.update({ features: { rbac: true } });
    assert.equal(priceProject(pricedRbac).total, 175);
    assert.deepEqual(quote(pricedRbac).labor, advanced.labor);
    const queue = quote(store.update({ usage: { jobs: 5 }, previewFeatures: { jobs: true } }));
    assert.deepEqual(queue.packages.background.requirements, ['jobs']);
    assert.deepEqual(queue.packages.background.hours, { min: 6, max: 12 });
    assert.deepEqual(Object.values(queue.packages).reduce((acc, pkg) => ({
        min: acc.min + pkg.cost.value.min, max: acc.max + pkg.cost.value.max
    }), { min: 0n, max: 0n }), queue.labor.value);
});

test('all original tier and add-on prices remain unchanged regardless of commercial inputs', () => {
    const store = createConfigurationStore();
    for (const [index, base] of [75, 200, 450, 850, 1400].entries()) {
        const state = store.update({ pricingTier: index + 1, features: { pwa: true, l10n: true, rbac: true, ai: true },
            commercial: { rateCents: 7250, contingencyBps: 2000, setupCents: 9000 } });
        assert.deepEqual(priceProject(state), { base, addOns: 375, total: base + 375 });
    }
});

test('editor amounts convert exactly and validate the persisted input group', () => {
    assert.deepEqual(parseCommercialInput('rateCents', '15.05'), { valid: true, value: 1505 });
    assert.deepEqual(parseCommercialInput('assetsCents', '.75'), { valid: true, value: 75 });
    assert.deepEqual(parseCommercialInput('rateCents', ''), { valid: true, value: null });
    assert.deepEqual(parseCommercialInput('setupCents', ''), { valid: true, value: 0 });
    for (const text of ['1.001', '-2', '1e3', 'Infinity', '100.01', '.']) {
        assert.equal(parseCommercialInput('contingencyBps', text).valid, false);
    }
    const store = createConfigurationStore({
        commercial: { rateCents: '1500', contingencyBps: Infinity, setupCents: -1, assetsCents: 99 }
    });
    assert.deepEqual(store.getState().commercial, { ...commercialDefaults, assetsCents: 99 });
    assert.deepEqual(store.reset().commercial, commercialDefaults);
});
