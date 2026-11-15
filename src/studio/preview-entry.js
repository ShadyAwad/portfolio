import { configuration } from './configuration.js';
import { connectPersistence } from './persistence.js';
import { mountDesignStudio } from './preview-renderer.js';
import { mountCapacityPanel } from './capacity/panel.js';
import { mountCommercialEstimate } from './commercial/panel.js';
import './preview.css';
import './capacity/panel.css';
import './commercial/panel.css';

let storage;
try { storage = window.localStorage; } catch {}
const draft = connectPersistence(configuration, storage);
const unmount = mountDesignStudio(configuration, draft.reset);
const unmountCapacity = mountCapacityPanel(configuration);
const unmountCommercial = mountCommercialEstimate(configuration);
if (import.meta.hot) import.meta.hot.dispose(() => {
    unmountCommercial();
    unmountCapacity();
    unmount();
    draft.disconnect();
});
