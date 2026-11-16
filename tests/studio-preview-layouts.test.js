import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutDefaults, previewLayouts } from '../src/studio/preview-layouts.js';
import { APPLICATION_TYPES, createConfigurationStore } from '../src/studio/configuration.js';
import { connectPersistence, readSavedConfiguration, STORAGE_KEY } from '../src/studio/persistence.js';
import { appearanceDefaults } from '../src/studio/appearance.js';
import { modelApiWorkload } from '../src/studio/capacity/api-workload.js';
import { modelStorageGrowth } from '../src/studio/capacity/storage.js';
import { defaultEffortAssumptions, estimateEngineeringEffort } from '../src/studio/capacity/effort.js';
import { estimateCommercialPrice } from '../src/studio/commercial/model.js';
import { priceProject } from '../src/studio/pricing.js';

test('every template accepts exactly two layouts and rejects choices from other templates', () => {
    const store = createConfigurationStore();
    assert.deepEqual(store.getState().layouts, { saas: 'sidebar', ecommerce: 'product', landing: 'split', 'internal-tool': 'table' });
    for (const applicationType of APPLICATION_TYPES) {
        const [first, second, ...rest] = previewLayouts[applicationType];
        assert.equal(rest.length, 0);
        for (const { id } of [first, second]) {
            assert.equal(store.update({ applicationType, layouts: { [applicationType]: id } }).layouts[applicationType], id);
        }
        const invalid = applicationType === 'saas' ? 'catalog' : 'top';
        assert.equal(store.update({ layouts: { [applicationType]: invalid } }).layouts[applicationType], second.id);
    }
});

test('version 1 restores each template layout alongside its appearance and defaults older drafts', () => {
    let saved = JSON.stringify({ version: 1, configuration: { visual: { theme: 'dark', accent: 'coral' } } });
    const storage = { getItem: key => key === STORAGE_KEY ? saved : null, setItem: (_, value) => { saved = value; } };
    const store = createConfigurationStore();
    connectPersistence(store, storage);
    assert.deepEqual(store.getState().layouts, layoutDefaults);
    const visual = store.getState().visual;
    const layouts = { saas: 'top', ecommerce: 'catalog', landing: 'centered', 'internal-tool': 'overview' };
    for (const applicationType of APPLICATION_TYPES) store.update({ applicationType, layouts: { [applicationType]: layouts[applicationType] } });
    const restored = readSavedConfiguration(storage);
    assert.deepEqual(restored.layouts, layouts);
    assert.deepEqual(restored.visual, visual);
    const reset = store.update({ applicationType: 'saas', visual: appearanceDefaults, layouts: { saas: layoutDefaults.saas } });
    assert.deepEqual(reset.layouts, { ...layouts, saas: 'sidebar' });
    assert.equal(reset.visual.theme, 'dark');
});

test('layout choices do not affect pricing, workload, storage, effort or commercial estimates', () => {
    const store = createConfigurationStore({ previewFeatures: { auth: true, storage: true }, pricingTier: 4 });
    const calculate = state => {
        const effort = estimateEngineeringEffort(state, defaultEffortAssumptions);
        return [priceProject(state), modelApiWorkload(state.usage, state.capacity),
            modelStorageGrowth(state.usage, state.engineering, state.capacity), effort, estimateCommercialPrice(effort, state.commercial)];
    };
    const initial = store.getState();
    const next = store.update({ layouts: { saas: 'top' } });
    assert.deepEqual(next.previewFeatures, initial.previewFeatures);
    assert.deepEqual(calculate(next), calculate(initial));
});
