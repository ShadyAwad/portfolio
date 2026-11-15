import { configuration } from './configuration.js';
import { connectPersistence } from './persistence.js';
import { mountDesignStudio } from './preview-renderer.js';
import { mountCapacityPanel } from './capacity/panel.js';
import './preview.css';
import './capacity/panel.css';

let storage;
try { storage = window.localStorage; } catch {}
const draft = connectPersistence(configuration, storage);
const unmount = mountDesignStudio(configuration, draft.reset);
const unmountCapacity = mountCapacityPanel(configuration);
if (import.meta.hot) import.meta.hot.dispose(() => {
    unmountCapacity();
    unmount();
    draft.disconnect();
});
