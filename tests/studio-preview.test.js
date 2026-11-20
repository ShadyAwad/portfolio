import test from 'node:test';
import assert from 'node:assert/strict';
import { APPLICATION_TYPES, createConfigurationStore } from '../src/studio/configuration.js';
import { derivePreview } from '../src/studio/preview-model.js';
import { STORAGE_KEY, connectPersistence, readSavedConfiguration } from '../src/studio/persistence.js';
import { priceProject } from '../src/studio/pricing.js';

function memoryStorage() {
    const values = new Map();
    return {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key)
    };
}

test('all four templates are explicit selections and unknown values do not replace them', () => {
    const store = createConfigurationStore();
    assert.equal(derivePreview(store.getState()).template, 'saas');
    for (const template of APPLICATION_TYPES) {
        const model = derivePreview(store.update({ applicationType: template }));
        assert.equal(model.template, template);
        assert.equal(derivePreview(store.update({ applicationType: 'api' })).template, template);
    }
});

test('preview model is immutable and independent of pricing and usage', () => {
    const store = createConfigurationStore({
        applicationType: 'internal-tool', visual: { theme: 'dark', density: 'compact' },
        previewFeatures: { analytics: true, storage: true, jobs: true }
    });
    const view = derivePreview(store.getState());
    assert.equal(view.theme, 'dark');
    assert.equal(view.density, 'compact');
    assert.equal(view.capabilities.analytics, true);
    assert.equal(view.capabilities.storage, true);
    assert.equal(view.capabilities.jobs, true);
    assert.throws(() => { view.capabilities.analytics = false; }, TypeError);
    assert.deepEqual(
        derivePreview(store.update({ pricingTier: 5, usage: { tenants: 100 }, features: { ai: true } })),
        view
    );
});

test('template-specific options retain their selection and recommendations do not enable requirements or pricing', () => {
    const store = createConfigurationStore({
        previewFeatures: { orders: true, conversion: true, tenancy: true },
        engineering: { rbac: true }
    });
    let model = derivePreview(store.getState());
    assert.equal(model.capabilities.orders, false);
    assert.equal(model.capabilities.conversion, false);
    assert.equal(model.roles, true);
    assert.equal(model.capabilities.auth, false);
    assert.equal(model.recommendations.accountForRoles, true);
    assert.equal(model.recommendations.accountForOrganizations, true);
    assert.equal(priceProject(store.getState()).total, 75);
    model = derivePreview(store.update({ applicationType: 'ecommerce' }));
    assert.equal(model.capabilities.orders, true);
    assert.equal(model.capabilities.conversion, false);
    model = derivePreview(store.update({ applicationType: 'landing', previewFeatures: { auth: true } }));
    assert.equal(model.capabilities.orders, false);
    assert.equal(model.capabilities.conversion, true);
    assert.equal(model.recommendations.accountForRoles, false);
    assert.equal(store.getState().previewFeatures.orders, true);
});

test('versioned persistence restores only validated configuration and supports disconnect', () => {
    const storage = memoryStorage();
    const store = createConfigurationStore();
    const first = connectPersistence(store, storage);
    const snapshot = store.update({
        applicationType: 'ecommerce', visual: { theme: 'dark' }, pricingTier: 3,
        previewFeatures: { orders: true }, engineering: { rbac: true }, score: 999
    });
    assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), { version: 1, configuration: snapshot });
    first.disconnect();
    store.update({ pricingTier: 5 });

    const reload = createConfigurationStore();
    connectPersistence(reload, storage);
    assert.deepEqual(reload.getState(), snapshot);
    assert.equal(Object.hasOwn(reload.getState(), 'score'), false);
});

test('invalid saved data is ignored or safely validated', () => {
    const storage = memoryStorage();
    for (const raw of ['{broken', '{"version":2,"configuration":{}}', '{"version":1,"configuration":[]}', 'null']) {
        storage.setItem(STORAGE_KEY, raw);
        assert.equal(readSavedConfiguration(storage), undefined);
    }
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, configuration: {
        applicationType: 'x', visual: { theme: 'purple' }, previewFeatures: { jobs: 'yes', storage: true },
        features: { rbac: 1 }, usage: { records: -12 }
    } }));
    const validated = readSavedConfiguration(storage);
    assert.equal(validated.applicationType, 'saas');
    assert.equal(validated.visual.theme, 'system');
    assert.equal(validated.previewFeatures.jobs, false);
    assert.equal(validated.previewFeatures.storage, true);
    assert.equal(validated.features.rbac, false);
    assert.equal(validated.usage.records, 0);
});

test('reset restores defaults, clears the saved draft, and tolerates unavailable storage', () => {
    const storage = memoryStorage();
    const store = createConfigurationStore();
    const persistence = connectPersistence(store, storage);
    store.update({ applicationType: 'landing', features: { pwa: true }, previewFeatures: { conversion: true } });
    persistence.reset();
    assert.deepEqual(store.getState(), createConfigurationStore().getState());
    assert.equal(storage.getItem(STORAGE_KEY), null);
    const blocked = connectPersistence(store, undefined);
    assert.doesNotThrow(() => store.update({ applicationType: 'ecommerce' }));
    assert.doesNotThrow(blocked.reset);
});
