import './space-atmosphere.css';
import { mountGravityBackground } from './gravity-background.js';

const atmosphere = document.querySelector('.space-atmosphere');
const comet = atmosphere.querySelector('.space-comet');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const events = new AbortController();
const { signal } = events;
let timer;
let inPage = true;
const active = () => inPage && !document.hidden;
const field = mountGravityBackground(document.getElementById('starfield'), motion, active);

function stop() {
    clearTimeout(timer);
    comet.classList.remove('is-flying');
}

function schedule() {
    stop();
    if (!active() || motion.matches) return;
    timer = setTimeout(() => {
        if (active() && !motion.matches) comet.classList.add('is-flying');
    }, 48000 + Math.random() * 26000);
}

comet.addEventListener('animationend', schedule, { signal });
function sync() {
    field.sync();
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
    field.destroy();
    stop();
});
