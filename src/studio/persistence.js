import { createConfigurationStore } from './configuration.js';

export const STORAGE_KEY = 'awad-portfolio-studio';
const VERSION = 1;

export function readSavedConfiguration(storage) {
    try {
        const saved = JSON.parse(storage.getItem(STORAGE_KEY));
        if (saved?.version !== VERSION || !saved.configuration ||
            typeof saved.configuration !== 'object' || Array.isArray(saved.configuration)) return undefined;
        return createConfigurationStore(saved.configuration).getState();
    } catch {
        return undefined;
    }
}

export function connectPersistence(store, storage) {
    const saved = readSavedConfiguration(storage);
    if (saved) store.update(saved);
    const disconnect = store.subscribe(state => {
        try {
            storage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, configuration: state }));
        } catch {
            // A blocked or full storage area must not interrupt editing.
        }
    });
    return {
        disconnect,
        reset() {
            store.reset();
            try { storage.removeItem(STORAGE_KEY); } catch {}
        }
    };
}
