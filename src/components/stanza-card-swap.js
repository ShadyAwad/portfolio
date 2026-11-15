import './stanza-card-swap.css';

const screenshots = ['performance', 'settings', 'semantic', 'company-feed', 'organisation', 'payroll'];
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
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const listeners = new AbortController();
    const on = (target, event, handler) => target.addEventListener(event, handler, { signal: listeners.signal });

    let order = screenshots.map((_, index) => index);
    let hovered = gallery.matches(':hover');
    let focused = gallery.contains(document.activeElement);
    let inView = false;
    let playing = true;
    let drag = null;
    let swap = null;
    let autoTimer;
    let phaseTimer;

    const cards = screenshots.map((name, index) => {
        const card = index ? first.cloneNode(true) : first;
        const image = card.querySelector('img');
        const fallback = card.querySelector('.stanza-fallback');
        const onError = () => {
            image.hidden = true;
            fallback.hidden = false;
        };
        card.dataset.card = String(index);
        on(image, 'error', onError);
        if (index) {
            image.loading = 'lazy';
            image.decoding = 'async';
            image.removeAttribute('fetchpriority');
            image.src = `${import.meta.env.BASE_URL}images/stanza/${name}.webp`;
            stage.append(card);
        } else if (image.complete && !image.naturalWidth) {
            onError();
        }
        return { card, image, fallback, label: card.querySelector('figcaption') };
    });

    function render(announce = false) {
        const active = order[0];
        order.forEach((index, slot) => {
            const { card } = cards[index];
            card.dataset.slot = String(slot);
            if (slot === 0) card.removeAttribute('aria-hidden');
            else card.setAttribute('aria-hidden', 'true');
        });
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
        cards.forEach(({ label, image, fallback }, index) => {
            const [name, , alt] = copy.slides[index];
            label.textContent = name;
            image.alt = alt;
            fallback.textContent = copy.unavailable;
        });
        status.textContent = '';
        render();
    }

    function schedule(delay = autoplayDelay) {
        clearTimeout(autoTimer);
        if (playing && inView && !hovered && !focused && !drag && !swap && !motion.matches && !document.hidden) {
            autoTimer = setTimeout(() => step(1, false), delay);
        }
    }

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
        if (swap || drag || destination < 1 || destination >= cards.length) return;
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
    on(stage, 'lostpointercapture', event => release(event, true));
    on(stage, 'pointerleave', event => {
        if (drag && !drag.moved && event.pointerType === 'mouse') release(event, true);
    });
    on(stage, 'click', event => {
        const target = event.target.closest('.stanza-card');
        if (target) goTo(order.indexOf(Number(target.dataset.card)));
    });

    on(prev, 'click', () => step(-1));
    on(next, 'click', () => step(1));
    on(autoplay, 'click', () => {
        playing = !playing;
        updateAutoplayControl();
        schedule();
    });
    on(gallery, 'keydown', event => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        const rtl = locale === 'ar';
        if (event.key === 'ArrowDown' || event.key === (rtl ? 'ArrowLeft' : 'ArrowRight')) {
            event.preventDefault();
            step(1);
        } else if (event.key === 'ArrowUp' || event.key === (rtl ? 'ArrowRight' : 'ArrowLeft')) {
            event.preventDefault();
            step(-1);
        }
    });
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
        inView = entry.isIntersecting;
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
    }

    localize(copy, locale);
    controls.hidden = false;
    return { localize, destroy };
}
