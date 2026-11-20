import { mountCurrents } from '../../src/components/spiral-currents.js';

const dispose = mountCurrents(document.querySelector('canvas'), {
    quality: document.querySelector('#quality'),
    reset: document.querySelector('#reset')
});
if (import.meta.hot) import.meta.hot.dispose(dispose);
