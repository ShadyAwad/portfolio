import './portfolio-controls.css';

const dock = document.getElementById('contact-dock');
const links = [...dock.querySelectorAll('a')];
const emailLink = dock.querySelector('a[href^="mailto:"]');
const copyEmail = dock.querySelector('[data-copy-email]');
const copyStatus = document.querySelector('.dock-status');
let contactCopy = {};
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

function copyWithSelection(address) {
    const field = document.createElement('textarea');
    field.value = address;
    field.readOnly = true;
    field.className = 'dock-copy-field';
    document.body.append(field);
    const previousFocus = document.activeElement;
    try {
        field.focus({ preventScroll: true });
        field.select();
        return document.execCommand('copy');
    } catch {
        return false;
    } finally {
        field.remove();
        previousFocus?.focus({ preventScroll: true });
    }
}

copyEmail.addEventListener('click', async () => {
    const address = emailLink.getAttribute('href').slice('mailto:'.length);
    copyStatus.textContent = '';
    let copied = false;
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(address);
            copied = true;
        }
    } catch {
        // Some browser contexts deny the clipboard API but allow a selection copy.
    }
    if (!copied) copied = copyWithSelection(address);
    if (copied) copyStatus.textContent = contactCopy.dockCopied ?? 'Email address copied.';
    else {
        const value = document.createElement('bdi');
        value.textContent = address;
        copyStatus.replaceChildren((contactCopy.dockCopyFailed ?? 'Copy this address manually.') + ' ', value);
    }
});

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
    contactCopy = copy;
    copyStatus.textContent = '';
    dock.setAttribute('aria-label', copy.dockContact ?? 'Contact');
    dock.dir = document.documentElement.dir;
    document.getElementById('profile-card').dir = document.documentElement.dir;
}
