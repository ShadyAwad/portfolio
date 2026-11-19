import './space-atmosphere.css';
import './galaxy.css';
import { mountCurrents } from './spiral-currents.js';
import { mountStarfield } from './starfield.js';

const atmosphere = document.querySelector('.space-atmosphere');
const comet = atmosphere.querySelector('.space-comet');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const events = new AbortController();
const { signal } = events;
let timer;
let inPage = true;
const active = () => inPage && !document.hidden;
const canvas = document.getElementById('starfield');
const grid = document.getElementById('portfolio-grid');
const field = document.createElement('canvas');
field.className = 'galaxy-orbit';
field.tabIndex = 0;
field.setAttribute('role', 'button');
field.setAttribute('aria-label', 'Pulse spiral currents');
canvas.after(field);
const disposeField = mountCurrents(field, { grid });
const starfield = mountStarfield(canvas, motion, active);

function stop() {
    clearTimeout(timer);
    comet.classList.remove('is-flying');
}

function schedule() {
    stop();
    if (!active() || motion.matches) return;
    timer = setTimeout(() => {
        if (!active() || motion.matches) return;
        const distance = 38 + Math.random() * 19;
        const drop = 12 + Math.random() * 26;
        const pathX = innerWidth * distance / 100;
        comet.style.setProperty('--comet-top', (6 + Math.random() * 10) + 'px');
        comet.style.setProperty('--comet-distance', distance + 'vw');
        comet.style.setProperty('--comet-drop', drop + 'px');
        comet.style.setProperty('--comet-angle', Math.atan2(drop, pathX) + 'rad');
        comet.style.setProperty('--comet-peak', (.32 + Math.random() * .2).toFixed(2));
        comet.style.setProperty('--comet-duration', (1150 + Math.round(Math.random() * 420)) + 'ms');
        comet.classList.add('is-flying');
    }, 48000 + Math.random() * 26000);
}

comet.addEventListener('animationend', schedule, { signal });
function sync() {
    starfield.sync();
    schedule();
}
document.addEventListener('visibilitychange', sync, { signal });
motion.addEventListener('change', sync, { signal });
window.addEventListener('pagehide', () => {
    inPage = false;
    sync();
}, { signal });
window.addEventListener('pageshow', () => {
    inPage = true;
    sync();
}, { signal });
sync();

if (import.meta.hot) import.meta.hot.dispose(() => {
    events.abort();
    starfield.destroy();
    disposeField();
    field.remove();
    stop();
});
