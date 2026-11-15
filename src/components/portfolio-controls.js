import './portfolio-controls.css';

const dock = document.getElementById('contact-dock');
const links = [...dock.querySelectorAll('a')];
const pointerEffects = matchMedia('(any-hover: hover) and (any-pointer: fine) and (prefers-reduced-motion: no-preference)');
let centers = [];
let frame = 0;
let pointerX = 0;

function resetDock() {
    cancelAnimationFrame(frame);
    frame = 0;
    links.forEach(link => link.style.removeProperty('--dock-scale'));
}

dock.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'mouse' || !pointerEffects.matches) return;
    centers = links.map(link => {
        const bounds = link.getBoundingClientRect();
        return bounds.left + bounds.width / 2;
    });
});

dock.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || !pointerEffects.matches || !centers.length) return;
    pointerX = event.clientX;
    if (frame) return;
    frame = requestAnimationFrame(() => {
        frame = 0;
        links.forEach((link, index) => {
            const proximity = Math.max(0, 1 - Math.abs(pointerX - centers[index]) / 100);
            link.style.setProperty('--dock-scale', 1 + .34 * proximity ** 2);
        });
    });
});

dock.addEventListener('pointerleave', resetDock);
pointerEffects.addEventListener('change', resetDock);

const toggle = document.querySelector('.configurator-toggle');
const panel = document.getElementById(toggle.getAttribute('aria-controls'));
const openLabel = toggle.querySelector('[data-i18n="configuratorOpen"]');
const closeLabel = toggle.querySelector('[data-i18n="configuratorClose"]');

toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'false';
    toggle.setAttribute('aria-expanded', String(expanded));
    panel.inert = !expanded;
    openLabel.hidden = expanded;
    closeLabel.hidden = !expanded;
});

export function localizePortfolioControls(copy) {
    dock.setAttribute('aria-label', copy.dockContact ?? 'Contact');
    dock.dir = document.documentElement.dir;
    document.getElementById('estimator-card').dir = document.documentElement.dir;
}
