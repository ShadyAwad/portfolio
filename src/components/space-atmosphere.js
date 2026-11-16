import './space-atmosphere.css';

const atmosphere = document.querySelector('.space-atmosphere');
const comet = atmosphere.querySelector('.space-comet');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const events = new AbortController();
const { signal } = events;
let timer;
let inPage = true;

function stop() {
    clearTimeout(timer);
    comet.classList.remove('is-flying');
}

function schedule() {
    stop();
    const moving = inPage && !document.hidden && !motion.matches;
    atmosphere.toggleAttribute('data-moving', moving);
    if (!moving) return;
    timer = setTimeout(() => {
        if (inPage && !document.hidden && !motion.matches) comet.classList.add('is-flying');
    }, 48000 + Math.random() * 26000);
}

comet.addEventListener('animationend', schedule, { signal });
document.addEventListener('visibilitychange', schedule, { signal });
motion.addEventListener('change', schedule, { signal });
window.addEventListener('pagehide', () => {
    inPage = false;
    schedule();
}, { signal });
window.addEventListener('pageshow', () => {
    inPage = true;
    schedule();
}, { signal });
schedule();

if (import.meta.hot) import.meta.hot.dispose(() => {
    events.abort();
    inPage = false;
    schedule();
});
