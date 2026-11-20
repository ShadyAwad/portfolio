import { captures, channel, clamp, createFrameLoop, distance, easeTravel, handoff, landingFrames, magnet, mix, proximity, spring } from './flow/request-motion.js';
import { socketFor } from './flow/request-layout.js';

const copy = {
    browser: ['UI', 'الواجهة'],
    api: ['API', 'واجهة البرمجة'],
    postgres: ['Database', 'قاعدة البيانات'],
    session: ['Session', 'الجلسة'],
    scope: ['Scope', 'النطاق'],
    access: ['Access', 'الوصول']
};
const glyph = {
    browser: '<rect x="-6" y="-4.5" width="12" height="9" rx="2"/><path d="M-2 7h4M0 4.5V7"/>',
    api: '<path d="m-3-4-4 4 4 4m6-8 4 4-4 4M1-6-1 6"/>',
    postgres: '<ellipse cy="-4" rx="6" ry="2.5"/><path d="M-6-4v8c0 3.4 12 3.4 12 0v-8M-6 0c0 3.4 12 3.4 12 0"/>',
    session: '<rect x="-5" y="-1" width="10" height="8" rx="2"/><path d="M-3-1v-2.5a3 3 0 0 1 6 0V-1M0 2v2"/>',
    scope: '<path d="M0-7 6-4v4c0 3-2.5 5.5-6 7C-3.5 5.5-6 3-6 0v-4zM-2 0h4"/>',
    access: '<path d="M0-7 6-4v4c0 3-2.5 5.5-6 7C-3.5 5.5-6 3-6 0v-4z"/><circle cy="-1" r="1.4"/><path d="M0 .4v2"/>'
};
const stages = ['browser', 'api', 'access', 'postgres'];

export function workspacePreviewJourney(steps) {
    const stops = [];
    const checks = new Set();
    for (const step of steps) {
        if (step.illustrative || step.channel === 'background') continue;
        const id = socketFor(step);
        if (!stages.includes(id)) continue;
        if (id === 'access') checks.add(step.node);
        const returning = step.channel === 'response';
        const previous = stops.at(-1);
        if (previous?.id === id && (id !== 'browser' || previous.returning === returning)) continue;
        stops.push({ id, returning });
    }
    const outward = [...new Set(stops.filter(stop => !stop.returning).map(stop => stop.id))];
    const checkpoint = checks.size > 1 ? 'access' : checks.has('auth') ? 'session' : checks.has('tenant') ? 'scope' : null;
    return { outward, stops, checkpoint };
}

const velocity = () => ({ x: 0, y: 0 });

export function previewDragTarget(point, from, to) {
    const length = distance(from, to) || 1;
    const x = (to.x - from.x) / length;
    const y = (to.y - from.y) / length;
    const across = (point.x - from.x) * -y + (point.y - from.y) * x;
    const resistance = across - 56 * Math.tanh(across / 56);
    const behind = Math.max(0, -((point.x - from.x) * x + (point.y - from.y) * y));
    const pullback = behind - 34 * Math.tanh(behind / 34);
    const softened = { x: point.x + y * resistance + x * pullback, y: point.y - x * resistance + y * pullback };
    return magnet(softened, to, Math.min(87, length * .85));
}

export function previewCaptures(point, from, to, speed, recent) {
    const radius = Math.max(22, Math.min(49, distance(from, to) * .43));
    const factor = 54 / radius;
    const scale = ({ x, y }) => ({ x: x * factor, y: y * factor });
    return captures(scale(point), scale(to), scale(speed), recent);
}

function curve(from, to, bend) {
    const mid = channel(from, to, bend)(.5);
    return 'M' + from.x + ',' + from.y + ' Q' + (2 * mid.x - (from.x + to.x) / 2) + ',' +
        (2 * mid.y - (from.y + to.y) / 2) + ' ' + to.x + ',' + to.y;
}

export function mountWorkspacePreview(root, button, panel, host, initialJourney, label) {
    const rtl = root.closest('[dir]')?.dir === 'rtl';
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const events = new AbortController();
    const { signal } = events;
    const loop = createFrameLoop(requestAnimationFrame, cancelAnimationFrame);
    const canRun = () => root.isConnected && !root.closest('[hidden]') && !document.hidden;
    const ready = label(['Workspace ready', 'مساحة العمل جاهزة']);
    let journey, signature, surface, board, token, svg, trail, status;
    let points, bounds, index, result, gesture, body, target, lastFrame, reaction, checkmark, entrance, closeTimer;
    let busy = false, suppressClick = false, previousBounds;

    const stageName = id => label(copy[id === 'access' ? journey.checkpoint : id]);
    const nextStop = () => journey.stops[index + 1];
    const currentPoint = () => points[journey.stops[index].id];

    function drawRoute() {
        const route = journey.stops.map(stop => stageName(stop.id)).join(rtl ? ' ← ' : ' → ');
        root.innerHTML = '<span id="workspace-pulse-route" class="workspace-pulse-route"><b>' +
            label(['Simulated request', 'طلب محاكى']) + '</b> <span>' + route + '</span></span>' +
            '<section class="workspace-request-surface" id="workspace-request-surface" aria-label="' +
            label(['Workspace request field', 'مساحة طلب العمل']) + '" hidden>' +
            '<div class="workspace-field-heading"><div><strong>' + label(['Workspace request', 'طلب مساحة العمل']) + '</strong>' +
            '<p class="workspace-field-status" role="status"></p></div><button type="button" data-workspace-close>' +
            label(['Close', 'إغلاق']) + '</button></div>' +
            '<div class="workspace-request-board"><svg aria-hidden="true"><g class="workspace-pulse-lanes"></g>' +
            '<g class="workspace-field-trail"><circle r="2"/><circle r="3"/><circle r="4"/></g></svg>' +
            journey.outward.map(id => '<div class="workspace-field-node" data-pulse-node="' + id + '">' +
                '<span class="workspace-field-socket"><svg viewBox="-11 -11 22 22" aria-hidden="true">' +
                glyph[id === 'access' ? journey.checkpoint : id] + '</svg>' +
                (id === 'access' ? '<span class="workspace-field-verified" aria-hidden="true">✓</span>' : '') +
                '</span><span>' + stageName(id) + '</span></div>').join('') +
            '<button type="button" class="workspace-field-token"><span aria-hidden="true"></span></button></div>' +
            '<div class="workspace-field-footer"><span>' + label(['Simulated request', 'طلب محاكى']) +
            '</span><button type="button" data-workspace-run>' + label(['Run request', 'تشغيل الطلب']) +
            '</button></div></section>';
        surface = root.querySelector('.workspace-request-surface');
        board = root.querySelector('.workspace-request-board');
        token = root.querySelector('.workspace-field-token');
        svg = board.querySelector('svg');
        trail = [...svg.querySelectorAll('circle')];
        status = root.querySelector('.workspace-field-status');
    }

    function measure() {
        bounds = board.getBoundingClientRect();
        previousBounds = { width: board.clientWidth, height: board.clientHeight };
        const { width, height } = previousBounds;
        const compact = width < 420;
        const layout = compact ? [[.24, .25], [.76, .25], [.76, .67], [.24, .67]] :
            [[.12, .56], [.37, .32], [.63, .56], [.87, .32]];
        points = Object.fromEntries(journey.outward.map((id, i) => {
            const slot = !compact && journey.outward.length === 3 && i === 2 ? 3 : i;
            const [x, y] = layout[slot];
            return [id, { x: width * (rtl ? 1 - x : x), y: height * y }];
        }));
        for (const node of board.querySelectorAll('[data-pulse-node]')) {
            const point = points[node.dataset.pulseNode];
            node.style.left = point.x + 'px';
            node.style.top = point.y + 'px';
        }
        svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
        svg.firstElementChild.innerHTML = journey.stops.slice(1).map((stop, i) => {
            const from = points[journey.stops[i].id], to = points[stop.id];
            return from === to ? '' : '<path class="' + (stop.returning ? 'pulse-response' : 'pulse-request') +
                '" d="' + curve(from, to, rtl ? -24 : 24) + '"/>';
        }).join('');
    }

    function place(point) {
        token.style.transform = 'translate3d(' + point.x + 'px,' + point.y + 'px,0)';
    }

    function hideTrail() { board.removeAttribute('data-travel'); }

    function releaseCapture() {
        if (!gesture) return;
        const { id } = gesture;
        gesture = undefined;
        if (token.hasPointerCapture(id)) token.releasePointerCapture(id);
        board.removeAttribute('data-drag');
        board.style.removeProperty('--pull');
    }

    function close(restore = true) {
        if (!surface || surface.hidden) return;
        const focused = surface.contains(document.activeElement);
        loop.stop();
        releaseCapture();
        hideTrail();
        reaction?.cancel();
        checkmark?.cancel();
        entrance?.cancel();
        clearTimeout(closeTimer);
        result = undefined;
        busy = false;
        surface.hidden = true;
        button.setAttribute('aria-expanded', 'false');
        root.dataset.pulse = root.dataset.completed === 'true' ? 'ready' : 'idle';
        if (restore && focused && canRun()) button.focus({ preventScroll: true });
    }

    function sync() {
        const next = nextStop();
        for (const node of board.querySelectorAll('[data-pulse-node]')) {
            node.toggleAttribute('data-current', node.dataset.pulseNode === journey.stops[index].id);
            node.toggleAttribute('data-next', node.dataset.pulseNode === next?.id);
        }
        board.toggleAttribute('data-return', Boolean(next?.returning));
        const hint = next
            ? (next.returning ? label(['Returning to the workspace', 'العودة إلى مساحة العمل']) :
                label(['Drag or tap → ', 'اسحب أو اضغط ← ']) + stageName(next.id))
            : ready;
        status.textContent = hint;
        token.setAttribute('aria-label', next
            ? label(['Advance request to ', 'أرسل الطلب إلى ']) + stageName(next.id)
            : ready);
        token.setAttribute('aria-disabled', String(!next || busy));
    }

    function finish() {
        if (!result || !canRun()) { close(false); return; }
        const complete = result;
        result = undefined;
        index = journey.stops.length - 1;
        busy = false;
        body.position = currentPoint();
        place(body.position);
        hideTrail();
        sync();
        complete();
        closeTimer = setTimeout(close, 1000);
    }

    function fly(automatic = false, handoffVelocity) {
        const stop = nextStop();
        if (!stop || !result || !canRun()) return;
        releaseCapture();
        if (motion.matches && automatic) { finish(); return; }
        loop.stop();
        const from = body.position;
        const to = points[stop.id];
        const duration = clamp(290 + distance(from, to) * .56, 330, 525);
        const path = handoffVelocity ? handoff(from, to, handoffVelocity, duration / 1000)
            : channel(from, to, rtl ? -24 : 24);
        busy = true;
        token.setAttribute('aria-disabled', 'true');
        const start = performance.now();
        function arrive() {
            hideTrail();
            index++;
            busy = false;
            body.position = to;
            body.velocity = velocity();
            place(to);
            sync();
            const node = board.querySelector('[data-current] .workspace-field-socket');
            if (!motion.matches) {
                reaction?.cancel();
                reaction = node.animate(landingFrames(!nextStop()), { duration: 240 });
                const mark = node.querySelector('.workspace-field-verified');
                if (mark) checkmark = mark.animate([{ opacity: 0 }, { opacity: 1, offset: .23 }, { opacity: 1, offset: .72 }, { opacity: 0 }], 390);
            }
            if (!nextStop()) finish();
            else if (automatic || nextStop().returning) fly(true);
        }
        if (motion.matches) { arrive(); return; }
        board.setAttribute('data-travel', '');
        loop.start(now => {
            const progress = clamp((now - start) / duration, 0, 1);
            const positionAt = t => path(handoffVelocity ? t : easeTravel(t));
            body.position = positionAt(progress);
            place(body.position);
            trail.forEach((bead, i) => {
                const point = positionAt(Math.max(0, progress - (3 - i) * .067));
                bead.setAttribute('cx', point.x);
                bead.setAttribute('cy', point.y);
            });
            if (progress < 1) return true;
            arrive();
            return false;
        });
    }

    function open(complete) {
        close(false);
        if (!canRun()) return;
        const keyboard = button.matches(':focus-visible');
        result = complete;
        index = 0;
        root.dataset.completed = 'false';
        root.dataset.pulse = 'open';
        surface.hidden = false;
        button.setAttribute('aria-expanded', 'true');
        measure();
        body = { position: currentPoint(), velocity: velocity() };
        hideTrail();
        place(body.position);
        sync();
        if (!motion.matches) entrance = surface.animate([
            { opacity: .25, clipPath: rtl ? 'inset(0 0 55% 11% round 14px)' : 'inset(0 11% 55% 0 round 14px)', translate: '0 -7px' },
            { opacity: 1, clipPath: 'inset(0 0 0 0 round 14px)', translate: '0 0' }
        ], { duration: 260, easing: 'cubic-bezier(.2,.76,.25,1)' });
        token.focus({ preventScroll: true });
        if (keyboard) token.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    }

    function reflect(completed) {
        root.dataset.completed = String(completed);
        if (completed) root.dataset.pulse = 'ready';
        else if (surface.hidden) root.dataset.pulse = 'idle';
    }

    function configure(next) {
        const key = JSON.stringify(next);
        if (key === signature) return false;
        const changed = Boolean(journey);
        close();
        signature = key;
        journey = next;
        root.dataset.pulse = 'idle';
        drawRoute();
        return changed;
    }

    button.setAttribute('aria-describedby', 'workspace-pulse-route');
    button.setAttribute('aria-controls', 'workspace-request-surface');
    button.setAttribute('aria-expanded', 'false');
    configure(initialJourney);

    function pointerPoint(event) {
        return {
            x: clamp(event.clientX - bounds.left + gesture.offset.x, 23, bounds.width - 23),
            y: clamp(event.clientY - bounds.top + gesture.offset.y, 23, bounds.height - 23)
        };
    }

    function follow(now) {
        const settled = motion.matches || spring(body, target, (now - (lastFrame ?? now - 16)) / 1000);
        lastFrame = settled ? undefined : now;
        if (settled) body.position = target;
        place(body.position);
        return !settled;
    }

    root.addEventListener('pointerdown', event => {
        if (!result || event.target.closest('.workspace-field-token') !== token || busy || gesture || !event.isPrimary || event.button !== 0) return;
        suppressClick = false;
        loop.stop();
        lastFrame = undefined;
        bounds = board.getBoundingClientRect();
        gesture = { id: event.pointerId, offset: { x: body.position.x - event.clientX + bounds.left,
            y: body.position.y - event.clientY + bounds.top }, time: event.timeStamp, moved: false, speed: velocity(),
            last: body.position, start: body.position };
        token.setPointerCapture(event.pointerId);
    }, { signal });
    root.addEventListener('pointermove', event => {
        if (gesture?.id !== event.pointerId) return;
        const point = pointerPoint(event);
        const elapsed = Math.max(8, event.timeStamp - gesture.time);
        gesture.speed = mix(gesture.speed, { x: (point.x - gesture.last.x) / elapsed,
            y: (point.y - gesture.last.y) / elapsed }, .58);
        gesture.last = point;
        gesture.time = event.timeStamp;
        gesture.moved ||= distance(point, gesture.start) > 5;
        if (!gesture.moved) return;
        const to = points[nextStop().id];
        target = motion.matches ? point : previewDragTarget(point, currentPoint(), to);
        board.setAttribute('data-drag', '');
        board.style.setProperty('--pull', proximity(point, to, 85).toFixed(2));
        loop.start(follow);
    }, { signal });

    function release(event, cancelled) {
        if (gesture?.id !== event.pointerId) return;
        const { moved, speed, time } = gesture;
        const point = pointerPoint(event);
        suppressClick = moved || cancelled;
        releaseCapture();
        if (!moved) return;
        if (!cancelled && previewCaptures(point, currentPoint(), points[nextStop().id], speed, event.timeStamp - time < 100)) {
            fly(false, body.velocity);
        } else {
            target = currentPoint();
            lastFrame = undefined;
            loop.start(follow);
        }
    }

    root.addEventListener('pointerup', event => release(event, false), { signal });
    root.addEventListener('pointercancel', event => release(event, true), { signal });
    root.addEventListener('lostpointercapture', event => release(event, true), { signal });
    root.addEventListener('click', event => {
        if (event.target.closest('[data-workspace-close]')) close();
        else if (result && !busy) {
            if (event.target.closest('[data-workspace-run]')) fly(true);
            else if (event.target.closest('.workspace-field-token') === token && (!suppressClick || event.detail === 0)) fly();
        }
    }, { signal });
    root.parentElement.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || surface.hidden) return;
        event.preventDefault();
        close();
    }, { signal });
    root.addEventListener('focusout', event => {
        if (event.relatedTarget && !root.parentElement.contains(event.relatedTarget)) close(false);
    }, { signal });
    const cancelIfHidden = () => { if (!canRun()) close(false); };
    const visibility = new MutationObserver(cancelIfHidden);
    visibility.observe(panel, { attributes: true, attributeFilter: ['hidden'] });
    host.addEventListener('studio-visibility', cancelIfHidden, { signal });
    document.addEventListener('visibilitychange', cancelIfHidden, { signal });
    window.addEventListener('resize', () => {
        if (!surface.hidden && (board.clientWidth !== previousBounds.width || board.clientHeight !== previousBounds.height)) close();
    }, { signal });
    motion.addEventListener('change', () => {
        if (!motion.matches) return;
        entrance?.cancel();
        if (busy) { loop.stop(); finish(); }
    }, { signal });

    return { configure, play: open, reflect, cancel: close, destroy() { close(false); visibility.disconnect(); events.abort(); } };
}
