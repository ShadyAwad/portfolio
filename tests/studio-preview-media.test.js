import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { findModelAsset, modelAssets, viewerInteraction } from '../src/components/model-assets.js';
import { createConfigurationStore } from '../src/studio/configuration.js';
import { derivePreview } from '../src/studio/preview-model.js';
import { connectPersistence, readSavedConfiguration, STORAGE_KEY } from '../src/studio/persistence.js';

test('every registry entry targets a self-contained local GLB with valid geometry', async () => {
    for (const [id, asset] of Object.entries(modelAssets)) {
        assert.equal(findModelAsset(id), asset);
        assert.equal(asset.id, id);
        assert.match(asset.path, /^assets\/[\w-]+\.glb$/i);
        assert(asset.name.every(Boolean) && asset.category && asset.defaults['camera-orbit']);
        const glb = await readFile(new URL('../public/' + asset.path, import.meta.url));
        assert.equal(glb.toString('ascii', 0, 4), 'glTF');
        assert.equal(glb.readUInt32LE(4), 2);
        assert.equal(glb.readUInt32LE(8), glb.length);
        assert.equal(glb.toString('ascii', 16, 20), 'JSON');
        const end = 20 + glb.readUInt32LE(12);
        const model = JSON.parse(glb.toString('utf8', 20, end));
        assert.equal(glb.toString('ascii', end + 4, end + 8), 'BIN\0');
        assert.equal(end + 8 + glb.readUInt32LE(end), glb.length);
        assert(model.meshes.length && model.accessors.length && model.buffers.every(buffer => !buffer.uri));
        assert((model.images ?? []).every(image => !image.uri));
    }
    assert.equal(findModelAsset('constructor'), undefined);
    assert.equal(findModelAsset('../Planet.glb'), undefined);
    assert.equal(findModelAsset({ toString: null, valueOf: null }), undefined);
});

test('3D configuration validates updates, survives template and theme changes, and stays separate from pricing', () => {
    const store = createConfigurationStore();
    const initial = store.getState();
    assert.deepEqual(initial.interactiveMedia, { enabled: false, asset: 'planet', mode: 'drag' });
    for (const mode of ['static', 'drag', 'orbit']) {
        store.update({ interactiveMedia: { enabled: true, mode } });
        assert.equal(derivePreview(store.getState()).interactiveMedia.mode, mode);
    }
    const next = store.update({
        applicationType: 'landing', visual: { theme: 'dark' },
        interactiveMedia: { enabled: 'false', asset: 'unknown', mode: 'fast' }
    });
    assert.deepEqual(next.interactiveMedia, { enabled: true, asset: 'planet', mode: 'orbit' });
    assert.deepEqual(next.features, initial.features);
    assert.deepEqual(next.commercial, initial.commercial);
    assert.equal(next.pricingTier, initial.pricingTier);
    assert.equal(store.update({ interactiveMedia: { enabled: false } }).interactiveMedia.mode, 'orbit');
    assert.deepEqual(store.reset(), initial);
});

test('version 1 drafts restore 3D preferences and safely default older or invalid values', () => {
    const data = new Map();
    const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
    const store = createConfigurationStore();
    const persistence = connectPersistence(store, storage);
    store.update({ interactiveMedia: { enabled: true, mode: 'static' } });
    assert.deepEqual(readSavedConfiguration(storage).interactiveMedia, store.getState().interactiveMedia);
    assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).version, 1);
    persistence.reset();
    assert.equal(readSavedConfiguration(storage), undefined);
    for (const interactiveMedia of [undefined, { asset: 'constructor', mode: 'fast', enabled: 1 }]) {
        storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, configuration: { applicationType: 'ecommerce', interactiveMedia } }));
        assert.deepEqual(readSavedConfiguration(storage).interactiveMedia, store.getState().interactiveMedia);
    }
});

test('viewer policy distinguishes static, manual, orbit, reduced-motion and hidden states', () => {
    const viewing = { ready: true, visible: true, documentHidden: false, reduced: false };
    assert.deepEqual(viewerInteraction('static', viewing), { controls: false, rotate: false });
    assert.deepEqual(viewerInteraction('drag', viewing), { controls: true, rotate: false });
    assert.deepEqual(viewerInteraction('orbit', viewing), { controls: true, rotate: true });
    assert.deepEqual(viewerInteraction('orbit', { ...viewing, reduced: true }), { controls: true, rotate: false });
    for (const hidden of [{ visible: false }, { documentHidden: true }, { ready: false }]) {
        assert.deepEqual(viewerInteraction('orbit', { ...viewing, ...hidden }), { controls: false, rotate: false });
    }
});
