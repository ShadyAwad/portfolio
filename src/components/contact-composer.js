import { draftUrl } from './contact-draft.js';

export function bindContactComposer(trigger, dialog, signal) {
    const form = dialog.querySelector('form');
    const close = dialog.querySelector('[data-contact-close]');
    const status = dialog.querySelector('[role="status"]');
    let copy = {};
    const options = { signal };
    const showStatus = key => { status.textContent = copy[key]; };

    trigger.addEventListener('click', () => {
        status.textContent = '';
        dialog.showModal();
    }, options);
    close.addEventListener('click', () => dialog.close(), options);
    dialog.addEventListener('click', event => {
        if (event.target === dialog) dialog.close();
    }, options);
    dialog.addEventListener('close', () => trigger.focus({ preventScroll: true }), options);
    dialog.addEventListener('keydown', event => {
        if (event.key !== 'Tab') return;
        const last = form.querySelector('[value="outlook"]');
        const from = event.shiftKey ? close : last;
        if (document.activeElement !== from) return;
        event.preventDefault();
        (event.shiftKey ? last : close).focus();
    }, options);
    form.addEventListener('input', event => {
        event.target.setCustomValidity?.('');
        status.textContent = '';
    }, options);
    form.addEventListener('submit', event => {
        event.preventDefault();
        for (const key of ['subject', 'message']) {
            const input = form.elements[key];
            if (input.value.trim()) continue;
            input.setCustomValidity(copy.contactRequired);
            input.reportValidity();
            return;
        }
        const provider = event.submitter?.value ?? 'mailto';
        const url = draftUrl(provider, Object.fromEntries(new FormData(form)));
        if (provider === 'mailto') {
            showStatus('contactAppRequested');
            window.location.href = url;
            return;
        }
        let tab;
        try {
            tab = window.open('about:blank', '_blank');
            if (!tab) {
                showStatus('contactBlocked');
                return;
            }
            tab.opener = null;
            tab.location.replace(url);
            showStatus('contactWebRequested');
        } catch {
            tab?.close();
            showStatus('contactBlocked');
        }
    }, options);
    return next => {
        copy = next;
        dialog.dir = document.documentElement.dir;
        close.setAttribute('aria-label', copy.contactClose);
        for (const key of ['subject', 'message']) form.elements[key].setCustomValidity('');
        status.textContent = '';
    };
}
