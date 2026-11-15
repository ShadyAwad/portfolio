import { configuration } from './configuration.js';
import { connectPersistence } from './persistence.js';
import { mountDesignStudio } from './preview-renderer.js';
import './preview.css';

let storage;
try { storage = window.localStorage; } catch {}
const draft = connectPersistence(configuration, storage);
const unmount = mountDesignStudio(configuration, draft.reset);
if (import.meta.hot) import.meta.hot.dispose(() => {
    unmount();
    draft.disconnect();
});
