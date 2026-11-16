import './portfolio-controls.css';
import { bindContactComposer } from './contact-composer.js';

const dock = document.getElementById('contact-dock');
const links = [...dock.children];
const events = new AbortController();
const composer = document.getElementById('contact-composer');
const localizeContact = bindContactComposer(dock.querySelector('[data-contact-open]'), composer, events.signal);
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
}, { signal: events.signal });

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
}, { signal: events.signal });

dock.addEventListener('pointerleave', resetDock, { signal: events.signal });
pointerEffects.addEventListener('change', resetDock, { signal: events.signal });

const toggle = document.querySelector('.configurator-toggle');
const panel = document.getElementById(toggle.getAttribute('aria-controls'));
const openLabel = toggle.querySelector('[data-i18n="configuratorOpen"]');
const closeLabel = toggle.querySelector('[data-i18n="configuratorClose"]');
const studio = document.getElementById('configurator-studio');
const studioHost = studio.querySelector('[data-studio-host]');
const summary = studio.querySelector('summary');
const invite = panel.querySelector('.studio-invite');
const dismiss = invite.querySelector('[data-studio-invite-dismiss]');
const invitationKey = 'portfolio-studio-invite-dismissed';
let suppressed = false;
let studioCopy = {};
try { suppressed = sessionStorage.getItem(invitationKey) === '1'; } catch {}

function dismissInvite() {
    suppressed = true;
    invite.hidden = true;
    try { sessionStorage.setItem(invitationKey, '1'); } catch {}
}

export function offerDesignStudio(event) {
    if (event.isTrusted && !suppressed && !studio.open && !panel.inert) invite.hidden = false;
}

function syncStudio() {
    const hidden = panel.inert || !studio.open;
    if (studioHost.hidden !== hidden) {
        studioHost.hidden = hidden;
        studioHost.dispatchEvent(new Event('studio-visibility'));
    }
    summary.textContent = studio.open ? studioCopy.studioClose ?? 'Collapse Design Studio' : studioCopy.studioOpen ?? 'Open Design Studio';
}

studio.addEventListener('toggle', () => {
    if (studio.open) dismissInvite();
    syncStudio();
}, { signal: events.signal });
dismiss.addEventListener('click', () => {
    dismissInvite();
    summary.focus({ preventScroll: true });
}, { signal: events.signal });
invite.querySelector('[data-studio-invite-open]').addEventListener('click', () => {
    studio.open = true;
    dismissInvite();
    syncStudio();
    summary.focus({ preventScroll: true });
}, { signal: events.signal });

toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'false';
    toggle.setAttribute('aria-expanded', String(expanded));
    panel.inert = !expanded;
    openLabel.hidden = expanded;
    closeLabel.hidden = !expanded;
    syncStudio();
}, { signal: events.signal });

export function localizePortfolioControls(copy) {
    localizeContact(copy);
    studioCopy = copy;
    dismiss.setAttribute('aria-label', copy.studioDismiss);
    syncStudio();
    dock.setAttribute('aria-label', copy.dockContact ?? 'Contact');
    dock.dir = document.documentElement.dir;
    document.getElementById('profile-card').dir = document.documentElement.dir;
}

if (import.meta.hot) import.meta.hot.dispose(() => {
    composer.close();
    resetDock();
    events.abort();
});
