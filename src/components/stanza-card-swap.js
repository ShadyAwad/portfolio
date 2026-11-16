import './stanza-card-swap.css';

const screenshotFiles = [
    'performance.webp', 'settings.webp', 'semantic.webp',
    'company-feed.webp', 'organisation.webp', 'payroll.webp'
];
const screenshotPath = `${import.meta.env.BASE_URL}images/stanza/`;
const autoplayDelay = 5000;
const exitDuration = 230;
const tuckDuration = 390;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Mount once, after the calling page has loaded its current locale. */
export function mountStanzaCardSwap(root, copy, locale) {
    const gallery = root.querySelector('.stanza-gallery');
    const stage = root.querySelector('.stanza-stage');
    const controls = root.querySelector('.stanza-controls');
    const prev = controls.querySelector('[data-stanza-prev]');
    const next = controls.querySelector('[data-stanza-next]');
    const autoplay = controls.querySelector('[data-stanza-play]');
    const title = root.querySelector('[data-stanza-title]');
    const description = root.querySelector('[data-stanza-description]');
    const counter = root.querySelector('[data-stanza-counter]');
    const status = root.querySelector('[data-stanza-status]');
    const first = stage.firstElementChild;
    const cardTemplate = root.querySelector('[data-stanza-card-template]');
    const zoomTemplate = root.querySelector('[data-stanza-zoom-template]');
    const lightbox = root.querySelector('.stanza-lightbox');
    const viewerTitle = lightbox.querySelector('h3');
    const viewerCaption = lightbox.querySelector('.stanza-lightbox-caption');
    const viewerImage = lightbox.querySelector('img');
    const viewerFallback = lightbox.querySelector('.stanza-fallback');
    const viewerClose = lightbox.querySelector('[data-stanza-close]');
    const viewerPrev = lightbox.querySelector('[data-stanza-lightbox-prev]');
    const viewerNext = lightbox.querySelector('[data-stanza-lightbox-next]');
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const listeners = new AbortController();
    const on = (target, event, handler) => target.addEventListener(event, handler, { signal: listeners.signal });

    let order = screenshotFiles.map((_, index) => index);
    let hovered = gallery.matches(':hover');
    let focused = gallery.contains(document.activeElement);
    let inView = false;
    let playing = true;
    let drag = null;
    let swap = null;
    let autoTimer;
    let phaseTimer;
    let viewerIndex = 0;
    let viewerTrigger;
    let pressedBackdrop = false;
    let suppressZoomClick = false;

    const cards = screenshotFiles.map((_, index) => {
        const card = index ? cardTemplate.content.firstElementChild.cloneNode(true) : first;
        const image = card.querySelector('img');
        const fallback = card.querySelector('.stanza-fallback');
        const zoom = zoomTemplate.content.firstElementChild.cloneNode(true);
        image.parentElement.append(zoom);
        const showFallback = failed => {
            image.hidden = failed;
            fallback.hidden = !failed;
        };
        card.dataset.card = String(index);
        on(image, 'error', () => showFallback(true));
        on(image, 'load', () => showFallback(false));
        if (index) {
            stage.append(card);
        } else if (image.complete && !image.naturalWidth) {
            // The preloaded Performance image can finish before the carousel mounts.
            showFallback(true);
        }
        return { card, image, fallback, zoom, label: card.querySelector('figcaption') };
    });

    function loadCardImage(index) {
        const { image } = cards[index];
        if (!image.hasAttribute('src')) image.src = `${screenshotPath}cards/${screenshotFiles[index]}`;
    }

    function render(announce = false) {
        const active = order[0];
        loadCardImage(active);
        const zoomHadFocus = stage.contains(document.activeElement) && document.activeElement.matches('[data-stanza-open]');
        order.forEach((index, slot) => {
            const { card, zoom } = cards[index];
            card.dataset.slot = String(slot);
            zoom.hidden = slot !== 0;
            if (slot === 0) card.removeAttribute('aria-hidden');
            else card.setAttribute('aria-hidden', 'true');
        });
        if (zoomHadFocus) cards[active].zoom.focus({ preventScroll: true });
        const [name, detail] = copy.slides[active];
        const format = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 });
        const position = `${format.format(active + 1)} / ${format.format(cards.length)}`;
        title.textContent = name;
        description.textContent = detail;
        counter.textContent = position;
        if (announce) status.textContent = `${name} · ${position}`;
    }

    function updateAutoplayControl() {
        autoplay.hidden = motion.matches;
        autoplay.toggleAttribute('data-paused', !playing);
        autoplay.setAttribute('aria-label', playing ? copy.pause : copy.play);
    }

    function localize(nextCopy, nextLocale) {
        copy = nextCopy;
        locale = nextLocale;
        gallery.setAttribute('aria-label', copy.label);
        prev.setAttribute('aria-label', copy.previous);
        next.setAttribute('aria-label', copy.next);
        updateAutoplayControl();
        cards.forEach(({ label, image, fallback, zoom }, index) => {
            const [name, , alt] = copy.slides[index];
            label.textContent = name;
            image.alt = alt;
            fallback.textContent = copy.unavailable;
            zoom.setAttribute('aria-label', copy.openViewer);
        });
        viewerClose.setAttribute('aria-label', copy.closeViewer);
        viewerPrev.setAttribute('aria-label', copy.previous);
        viewerNext.setAttribute('aria-label', copy.next);
        viewerFallback.textContent = copy.unavailable;
        if (lightbox.open) renderViewer();
        status.textContent = '';
        render();
    }

    function schedule(delay = autoplayDelay) {
        clearTimeout(autoTimer);
        if (playing && inView && !hovered && !focused && !drag && !swap && !lightbox.open && !motion.matches && !document.hidden) {
            autoTimer = setTimeout(() => step(1, false), delay);
        }
    }

    function renderViewer() {
        const [name, detail, alt] = copy.slides[viewerIndex];
        const source = screenshotPath + screenshotFiles[viewerIndex];
        viewerTitle.textContent = name;
        viewerCaption.textContent = detail;
        viewerImage.alt = alt;
        if (viewerImage.getAttribute('src') !== source) {
            viewerImage.hidden = true;
            viewerFallback.hidden = true;
            viewerImage.src = source;
        }
    }

    function openViewer(trigger) {
        viewerIndex = order[0];
        viewerTrigger = trigger;
        renderViewer();
        lightbox.showModal();
        schedule();
    }

    function stepViewer(delta) {
        viewerIndex = (viewerIndex + delta + cards.length) % cards.length;
        renderViewer();
    }

    function isBackdrop(event) {
        if (event.target !== lightbox) return false;
        const { left, right, top, bottom } = lightbox.getBoundingClientRect();
        return event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom;
    }

    on(viewerImage, 'load', () => {
        viewerImage.hidden = false;
        viewerFallback.hidden = true;
    });
    on(viewerImage, 'error', () => {
        viewerImage.hidden = true;
        viewerFallback.hidden = false;
    });
    on(viewerPrev, 'click', () => stepViewer(-1));
    on(viewerNext, 'click', () => stepViewer(1));
    on(viewerClose, 'click', () => lightbox.close());
    on(lightbox, 'pointerdown', event => { pressedBackdrop = isBackdrop(event); });
    on(lightbox, 'click', event => {
        if (pressedBackdrop && isBackdrop(event)) lightbox.close();
        pressedBackdrop = false;
    });
    on(lightbox, 'close', () => {
        viewerTrigger?.focus({ preventScroll: true });
        viewerTrigger = null;
        schedule();
    });

    function placeThrow(card, x, y, angle, scale) {
        card.style.setProperty('--throw-x', `${x}px`);
        card.style.setProperty('--throw-y', `${y}px`);
        card.style.setProperty('--throw-angle', `${angle}deg`);
        card.style.setProperty('--throw-scale', scale);
    }

    function clearThrow(card) {
        for (const property of ['x', 'y', 'angle', 'scale']) card.style.removeProperty(`--throw-${property}`);
    }

    function tuck() {
        const { card, destination, announce } = swap;
        // Rotate the deck once; the slot transitions advance all the cards together.
        order = [...order.slice(destination), ...order.slice(0, destination)];
        swap.committed = true;
        card.classList.remove('is-releasing');
        clearThrow(card);
        render(announce);
    }

    function finishSwap(animate = false) {
        if (!swap) return;
        clearTimeout(phaseTimer);
        if (!swap.committed) tuck();
        if (animate) {
            swap.card.classList.add('is-tucking');
            phaseTimer = setTimeout(finishSwap, tuckDuration);
            return;
        }
        swap.card.classList.remove('is-tucking');
        const elapsed = swap.announce ? 0 : performance.now() - swap.started;
        swap = null;
        schedule(Math.max(0, autoplayDelay - elapsed));
    }

    function goTo(destination, announce = true, direction = { x: 0, y: 1 }) {
        if (swap || drag || lightbox.open || destination < 1 || destination >= cards.length) return;
        loadCardImage(order[destination]);
        clearTimeout(autoTimer);
        const card = cards[order[0]].card;
        swap = { card, destination, announce, committed: false, started: performance.now() };
        if (motion.matches || document.hidden) {
            finishSwap();
            return;
        }

        const { x, y } = direction;
        const travel = card.offsetWidth * .105;
        placeThrow(card, x * travel, y * travel, x * 4 + (1 - Math.abs(x)) * 2, .72);
        card.classList.add('is-releasing');
        phaseTimer = setTimeout(() => finishSwap(true), exitDuration);
    }

    function step(delta, announce = true) {
        goTo(delta > 0 ? 1 : cards.length - 1, announce, { x: 0, y: delta > 0 ? 1 : -1 });
    }

    function release(event, cancelled = false) {
        if (!drag || (event && event.pointerId !== drag.id)) return;
        const gesture = drag;
        suppressZoomClick = gesture.moved;
        drag = null;
        gesture.card.classList.remove('is-dragging');
        stage.classList.remove('is-dragging');
        if (stage.hasPointerCapture(gesture.id)) stage.releasePointerCapture(gesture.id);

        if (gesture.moved && !cancelled) {
            const dx = event.clientX - gesture.x;
            const dy = event.clientY - gesture.y;
            const recent = gesture.samples[0];
            const elapsed = Math.max(16, event.timeStamp - recent.time);
            const vx = (event.clientX - recent.x) / elapsed;
            const vy = (event.clientY - recent.y) / elapsed;
            if (Math.hypot(dx, dy) > clamp(gesture.width * .19, 37, 100)
                || (Math.hypot(dx, dy) > 18 && Math.hypot(vx, vy) > .55)) {
                const x = dx + vx * 85;
                const y = dy + vy * 85;
                const distance = Math.hypot(x, y) || 1;
                goTo(1, true, { x: x / distance, y: y / distance });
                return;
            }
        }
        clearThrow(gesture.card);
        schedule();
    }

    on(stage, 'pointerdown', event => {
        if (!event.isPrimary || event.button !== 0 || swap || drag) return;
        suppressZoomClick = false;
        const card = cards[order[0]].card;
        if (!card.contains(event.target)) return;
        drag = {
            card, id: event.pointerId, x: event.clientX, y: event.clientY,
            width: card.offsetWidth, height: card.offsetHeight, moved: false,
            samples: [{ x: event.clientX, y: event.clientY, time: event.timeStamp }]
        };
        schedule();
    });

    on(stage, 'pointermove', event => {
        if (!drag || drag.id !== event.pointerId) return;
        const x = event.clientX - drag.x;
        const y = event.clientY - drag.y;
        const distance = Math.hypot(x, y);
        if (!drag.moved && distance < 7) return;
        if (!drag.moved) {
            drag.moved = true;
            stage.setPointerCapture(event.pointerId);
            if (!motion.matches) {
                stage.classList.add('is-dragging');
                drag.card.classList.add('is-dragging');
            }
        }
        drag.samples = drag.samples.filter(sample => event.timeStamp - sample.time < 110);
        drag.samples.push({ x: event.clientX, y: event.clientY, time: event.timeStamp });
        if (!motion.matches) {
            const maxX = drag.width * .082;
            const maxY = drag.height * .097;
            placeThrow(drag.card, maxX * Math.tanh(x / maxX), maxY * Math.tanh(y / maxY),
                clamp(x / 24, -3, 3), 1 - .12 * Math.tanh(distance / 65));
        }
    });

    on(stage, 'pointerup', event => release(event));
    on(stage, 'pointercancel', event => release(event, true));
    on(stage, 'lostpointercapture', event => {
        // Touch first captures the zoom button implicitly, then transfers capture to the stage.
        if (event.target === stage) release(event, true);
    });
    on(stage, 'pointerleave', event => {
        if (drag && !drag.moved && event.pointerType === 'mouse') release(event, true);
    });
    on(stage, 'click', event => {
        const card = event.target.closest('.stanza-card');
        if (!card) return;
        const slot = order.indexOf(Number(card.dataset.card));
        if (slot > 0) goTo(slot);
        else if (!swap && (!suppressZoomClick || event.detail === 0)) {
            const trigger = event.target.closest('[data-stanza-open]');
            if (trigger) openViewer(trigger);
        }
    });

    on(prev, 'click', () => step(-1));
    on(next, 'click', () => step(1));
    on(autoplay, 'click', () => {
        playing = !playing;
        updateAutoplayControl();
        schedule();
    });
    function arrowStep(event) {
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return 0;
        const rtl = locale === 'ar';
        if (event.key === 'ArrowDown' || event.key === (rtl ? 'ArrowLeft' : 'ArrowRight')) return 1;
        if (event.key === 'ArrowUp' || event.key === (rtl ? 'ArrowRight' : 'ArrowLeft')) return -1;
        return 0;
    }

    for (const [target, navigate] of [[gallery, step], [lightbox, stepViewer]]) {
        on(target, 'keydown', event => {
            const delta = arrowStep(event);
            if (!delta) return;
            event.preventDefault();
            navigate(delta);
        });
    }
    on(gallery, 'pointerenter', event => {
        if (event.pointerType !== 'touch') {
            hovered = true;
            schedule();
        }
    });
    on(gallery, 'pointerleave', () => {
        hovered = false;
        schedule();
    });
    on(gallery, 'focusin', () => {
        focused = true;
        schedule();
    });
    on(gallery, 'focusout', event => {
        if (!gallery.contains(event.relatedTarget)) {
            focused = false;
            schedule();
        }
    });

    const observer = new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting && entry.intersectionRatio >= .25;
        if (!inView) {
            release(null, true);
            finishSwap();
        }
        schedule();
    }, { threshold: .25 });
    observer.observe(gallery);
    on(document, 'visibilitychange', () => {
        if (document.hidden) {
            release(null, true);
            finishSwap();
        }
        schedule();
    });
    on(motion, 'change', () => {
        release(null, true);
        finishSwap();
        updateAutoplayControl();
        schedule();
    });
    on(window, 'pagehide', event => {
        if (!event.persisted) destroy();
    });

    function destroy() {
        release(null, true);
        finishSwap();
        clearTimeout(autoTimer);
        clearTimeout(phaseTimer);
        observer.disconnect();
        listeners.abort();
        if (lightbox.open) lightbox.close();
    }

    localize(copy, locale);
    controls.hidden = false;
    return { localize, destroy };
}
