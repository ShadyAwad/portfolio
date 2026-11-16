import test from 'node:test';
import assert from 'node:assert/strict';
import { accentPresets, appearanceDefaults, appearancePalette, normalizeAccent } from '../src/studio/appearance.js';
import { APPLICATION_TYPES, createConfigurationStore } from '../src/studio/configuration.js';
import { connectPersistence, readSavedConfiguration, STORAGE_KEY } from '../src/studio/persistence.js';
import { priceProject } from '../src/studio/pricing.js';
import { modelApiWorkload } from '../src/studio/capacity/api-workload.js';
import { estimateEngineeringEffort, defaultEffortAssumptions } from '../src/studio/capacity/effort.js';
import { estimateCommercialPrice } from '../src/studio/commercial/model.js';

const luminance = hex => [1, 3, 5].reduce((total, offset, index) => {
    const s = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return total + [0.2126, 0.7152, 0.0722][index] * (s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4);
}, 0);
const contrast = (a, b) => {
    const [lo, hi] = [luminance(a), luminance(b)].sort((x, y) => x - y);
    return (hi + .05) / (lo + .05);
};

test('curated and edge-case custom colors retain readable text and action contrast in both themes', () => {
    for (const dark of [false, true]) {
        const backgrounds = dark ? ['#1b2639', '#111928', '#3a2a25'] : ['#ffffff', '#eff2f8', '#f1e3d4'];
        for (const [accent, customAccent] of [
            ...Object.keys(accentPresets).map(key => [key, '#000000']),
            ...['#000000', '#ffffff', '#777777', '#ffff00', '#0000ff'].map(hex => ['custom', hex])
        ]) {
            const palette = appearancePalette({ accent, customAccent }, dark);
            assert(backgrounds.every(background => contrast(palette.ink, background) >= 4.5));
            assert(contrast(palette.ink, palette.tint) >= 4.5);
            assert(contrast(palette.fill, palette.onAccent) >= 4.5);
            assert(contrast(palette.heroFill, palette.onHero) >= 4.5);
        }
    }
    assert.equal(appearancePalette(appearanceDefaults, false), null);
});

test('the store validates appearance selections and normalizes six-digit HEX values', () => {
    assert.equal(normalizeAccent(' #1AbC9E '), '#1abc9e');
    for (const input of ['#CAF', 'indigo', '#123456; color:red', '#abcdex', null]) assert.equal(normalizeAccent(input), null);
    const store = createConfigurationStore();
    const visual = store.update({ visual: { accent: 'custom', customAccent: '#7722EE', style: 'soft', typography: 'editorial' } }).visual;
    assert.equal(visual.customAccent, '#7722ee');
    assert.deepEqual(store.update({ visual: { accent: 'bad', customAccent: 'bad', style: 'bad', typography: 'bad' } }).visual, visual);
});

test('version 1 restores appearance, defaults missing fields, and retains theme and project choices on appearance reset', () => {
    const records = new Map();
    const storage = {
        getItem: key => records.get(key), setItem: (key, value) => records.set(key, value), removeItem: key => records.delete(key)
    };
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, configuration: {
        applicationType: 'landing', pricingTier: 4, visual: { theme: 'dark', density: 'compact' }
    } }));
    const store = createConfigurationStore();
    connectPersistence(store, storage);
    assert.deepEqual(store.getState().visual, { ...appearanceDefaults, theme: 'dark', density: 'compact' });
    const visual = store.update({ visual: { accent: 'coral', typography: 'technical', style: 'bold' } }).visual;
    for (const applicationType of APPLICATION_TYPES) {
        assert.deepEqual(store.update({ applicationType }).visual, visual);
        assert.deepEqual(readSavedConfiguration(storage).visual, visual);
    }
    const reset = store.update({ visual: appearanceDefaults });
    assert.deepEqual(reset.visual, { ...appearanceDefaults, theme: 'dark' });
    assert.equal(reset.applicationType, 'internal-tool');
    assert.equal(reset.pricingTier, 4);
});

test('appearance preferences leave pricing, engineering effort and workload calculations unchanged', () => {
    const store = createConfigurationStore({ previewFeatures: { analytics: true }, usage: { users: 500 }, pricingTier: 4 });
    const initial = store.getState();
    const next = store.update({ visual: { accent: 'amber', style: 'bold', typography: 'editorial', density: 'compact' } });
    const calculate = state => {
        const effort = estimateEngineeringEffort(state, defaultEffortAssumptions);
        return [priceProject(state), modelApiWorkload(state.usage, state.capacity), effort, estimateCommercialPrice(effort, state.commercial)];
    };
    assert.deepEqual(calculate(next), calculate(initial));
});
