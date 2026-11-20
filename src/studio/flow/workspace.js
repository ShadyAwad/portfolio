import { captures, channel, clamp, createFrameLoop, distance, easeTravel, handoff,
    landingFrames, magnet, mix, proximity, spring } from './request-motion.js';
import { journeyOutcomes, requestLayout, socketFor } from './request-layout.js';
import './workspace.css';

const velocity = () => ({ x: 0, y: 0 });
const marks = { browser: '▱', api: '⌁', access: '◇', postgres: '≋', queue: '≡', workers: '⚙', artifact: '↧' };

export function mountWorkspace(root, { reduced, canDrag, canLaunch, launch }) {
    root.innerHTML = `<div class="workspace-field">
        <canvas aria-hidden="true"></canvas><canvas aria-hidden="true"></canvas>
        <div class="workspace-sockets"></div>
        <button type="button" class="workspace-token"><span aria-hidden="true"></span></button>
        <p class="workspace-return"><i aria-hidden="true"></i><span></span></p>
        <p class="workspace-branch" hidden></p>
    </div><div class="workspace-caption"><p class="workspace-hint"></p><p class="workspace-outcome" hidden></p></div>`;
    const field = root.firstElementChild;
    const packet = field.querySelector('button');
    const [canvas, overlay] = field.querySelectorAll('canvas');
    const ctx = canvas.getContext('2d');
    const glow = overlay.getContext('2d');
    const sockets = field.querySelector('.workspace-sockets');
    const outcome = root.querySelector('.workspace-outcome');
    const nodes = new Map();
    const events = new AbortController();
    const listen = (name, handler) => packet.addEventListener(name, handler, { signal: events.signal });
    const loop = createFrameLoop(requestAnimationFrame, cancelAnimationFrame);
    let geometry, gesture, target, pulse, signature, layout, entry, translate;
    let steps = [], landed = 0;
    let body = { position: { x: 0, y: 0 }, velocity: velocity() };
    let frameTime;
    const colorFor = track => geometry.colors[track.channel === 'response' ? 'mint' :
        track.channel === 'background' ? 'branch' : 'cyan'];

    function drawTrack(context, track, color, width, dash, start = 0, end = 1, segments = 22) {
        if (!track || end <= start) return;
        context.beginPath();
        const first = track(start);
        context.moveTo(first.x, first.y);
        for (let i = 1; i <= segments; i++) {
            const point = track(start + (end - start) * i / segments);
            context.lineTo(point.x, point.y);
        }
        context.strokeStyle = color;
        context.lineWidth = width;
        context.setLineDash(dash ? [4, 6] : []);
        context.stroke();
    }

    function paintRoute() {
        if (!geometry) return;
        const { width, height, tracks, colors } = geometry;
        ctx.clearRect(0, 0, width, height);
        tracks.forEach(track => drawTrack(ctx, track.path, track.channel === 'response' ? colors.returning :
            track.channel === 'background' ? colors.branch : colors.track, 1.2, track.channel !== 'request'));
    }

    function clearGlow() {
        if (geometry) glow.clearRect(0, 0, geometry.width, geometry.height);
    }

    function paintTrail(track, end, tail) {
        clearGlow();
        if (!track.path) return;
        const color = colorFor(track);
        glow.lineCap = 'round';
        for (let i = 0; i < 4; i++) {
            glow.globalAlpha = .15 + i * .21;
            drawTrack(glow, track.path, color, 1.1 + i * .42, false,
                Math.max(0, end - tail * (4 - i) / 4), Math.max(0, end - tail * (3 - i) / 4), 4);
        }
        glow.globalAlpha = 1;
    }

    function react(index, socket, delivered) {
        pulse?.cancel();
        const duration = delivered ? 440 : 365;
        pulse = socket.querySelector('i').animate(landingFrames(delivered), { duration });
        const started = performance.now();
        loop.start(now => {
            const t = clamp((now - started) / duration, 0, 1);
            clearGlow();
            const incoming = geometry.tracks[index];
            const outgoing = geometry.tracks[index + 1];
            glow.globalAlpha = (1 - t) ** 1.6 * .62;
            if (incoming) drawTrack(glow, incoming.path, colorFor(incoming),
                1.8, false, .7, 1, 9);
            if (outgoing?.from === index) drawTrack(glow, outgoing.path, colorFor(outgoing),
                1.6, false, 0, .27, 9);
            glow.globalAlpha = 1;
            return t < 1;
        });
    }

    function show() {
        packet.style.transform = `translate3d(${body.position.x}px, ${body.position.y}px, 0)`;
    }

    function measure() {
        if (root.closest('[hidden]')) return;
        const width = field.clientWidth;
        const height = field.clientHeight;
        if (!width || !height || !steps.length) return;
        const points = steps.map(step => {
            const node = nodes.get(socketFor(step));
            return { x: node.offsetLeft, y: node.offsetTop };
        });
        const style = getComputedStyle(field);
        const colors = Object.fromEntries(['track', 'returning', 'cyan', 'mint', 'branch']
            .map(key => [key, style.getPropertyValue('--ws-' + key).trim()]));
        const rtl = field.matches(':dir(rtl)');
        const tracks = layout.links.map((link, i) => {
            const from = points[link.from];
            if (!from || distance(from, points[i]) < 1) return link;
            const bend = link.channel === 'response' ? (width <= 470 ? -53 : -85)
                : link.channel === 'background' ? 30 : (i === 2 ? -29 : -36);
            return { ...link, path: channel(from, points[i], rtl ? -bend : bend) };
        });
        const scale = Math.min(devicePixelRatio || 1, 2);
        for (const context of [ctx, glow]) {
            const pixelWidth = Math.round(width * scale);
            const pixelHeight = Math.round(height * scale);
            if (context.canvas.width !== pixelWidth) context.canvas.width = pixelWidth;
            if (context.canvas.height !== pixelHeight) context.canvas.height = pixelHeight;
            context.setTransform(scale, 0, 0, scale, 0, 0);
        }
        geometry = { width, height, points, tracks, colors };
        if (!gesture && !field.hasAttribute('data-travel')) place(landed);
        paintRoute();
    }

    function place(index) {
        if (!geometry) return;
        body.position = { ...geometry.points[index] };
        body.velocity = velocity();
        show();
    }

    function stop() {
        loop.stop();
        if (gesture) {
            const id = gesture.id;
            gesture = undefined;
            if (packet.hasPointerCapture(id)) packet.releasePointerCapture(id);
        }
        pulse?.cancel();
        pulse = undefined;
        field.removeAttribute('data-travel');
        field.removeAttribute('data-drag');
        entry?.removeAttribute('data-magnet');
        entry?.style.removeProperty('--ws-proximity');
        clearGlow();
        body.velocity = velocity();
        frameTime = undefined;
    }

    function sync(index, animate = false) {
        landed = index;
        place(index);
        const delivered = index === steps.length - 1;
        field.toggleAttribute('data-delivered', delivered);
        field.dataset.channel = layout.links[index].channel;
        const outcomes = journeyOutcomes(steps, index);
        const result = [...outcomes].at(-1);
        outcome.hidden = !result;
        if (result) outcome.textContent = translate(result);
        field.toggleAttribute('data-confirmed', outcomes.has('orderConfirmed'));
        field.toggleAttribute('data-artifact', outcomes.has('exportCreated'));
        const current = socketFor(steps[index]);
        const visited = new Set(steps.slice(0, index).map(socketFor));
        nodes.forEach((node, key) => {
            node.toggleAttribute('data-active', key === current);
            node.toggleAttribute('data-complete', key !== current && visited.has(key));
        });
        packet.setAttribute('aria-disabled', String(!canLaunch()));
        clearGlow();
        if (animate && !reduced() && geometry) react(index, nodes.get(current), delivered);
    }

    function move(from, to, origin, done) {
        if (!geometry || reduced()) {
            done();
            return;
        }
        const initialTime = performance.now();
        field.setAttribute('data-travel', '');
        const link = layout.links[to];
        field.dataset.channel = link.channel;
        packet.setAttribute('aria-disabled', 'true');
        const adjacent = !origin && to === from + 1;
        const start = adjacent ? link.from : from;
        const length = distance(origin?.position ?? geometry.points[start], geometry.points[to]);
        const duration = adjacent ? clamp(270 + length, 290, 620) : clamp(205 + length * .65, 230, 390);
        const tail = clamp(32 / (length || 1), .07, .23);
        let cachedGeometry;
        let track;
        loop.start(now => {
            const elapsed = clamp((now - initialTime) / duration, 0, 1);
            const t = origin ? elapsed : easeTravel(elapsed);
            if (cachedGeometry !== geometry) {
                cachedGeometry = geometry;
                track = adjacent ? cachedGeometry.tracks[to] : {
                    path: origin ? handoff(origin.position, cachedGeometry.points[to], origin.velocity, duration / 1000) :
                        channel(cachedGeometry.points[start], cachedGeometry.points[to], -14),
                    channel: link.channel
                };
            }
            body.position = track.path?.(t) ?? geometry.points[to];
            show();
            paintTrail(track, t, tail);
            if (elapsed < 1) return true;
            field.removeAttribute('data-travel');
            done();
            return false;
        });
    }

    function configure(next, variant, label, copy, index, revision) {
        steps = next;
        translate = copy;
        const keys = new Set(steps.map(step => step.node));
        const access = keys.has('auth') && keys.has('tenant') ? copy('workspaceAccess') :
            label(keys.has('auth') ? 'auth' : 'tenant');
        const changed = signature !== revision;
        signature = revision;
        if (changed) {
            layout = requestLayout(steps, variant);
            field.dataset.variant = variant;
            field.style.setProperty('--mobile-height', layout.mobileHeight + 'px');
            const descriptors = layout.nodes.map(({ key, position }) => {
                const node = nodes.get(key) ?? document.createElement('div');
                node.className = 'workspace-socket';
                node.dataset.socket = key;
                node.removeAttribute('data-entry');
                if (!node.firstChild) node.innerHTML = '<i aria-hidden="true"></i><span></span>';
                node.firstElementChild.textContent = marks[key] ?? '·';
                node.lastElementChild.textContent = key === 'access' ? access :
                    key === 'artifact' ? 'records.csv' : label(key);
                ['--x', '--y', '--mobile-x', '--mobile-y'].forEach((style, i) => node.style.setProperty(style, position[i] + '%'));
                return [key, node];
            });
            nodes.clear();
            descriptors.forEach(([key, node]) => nodes.set(key, node));
            sockets.replaceChildren(...nodes.values());
            entry = nodes.get(socketFor(steps[layout.entry]));
            entry.dataset.entry = '';
        }
        const branch = root.querySelector('.workspace-branch');
        branch.hidden = !steps.some(step => step.channel === 'background');
        branch.textContent = copy('requestBackground');
        root.querySelector('.workspace-hint').textContent = copy(variant === 'workspace' ? 'workspaceHint' : variant + 'Hint');
        root.querySelector('.workspace-return span').textContent = copy('workspaceReturn');
        packet.setAttribute('aria-label', copy(variant === 'workspace' ? 'workspaceLaunch' : variant + 'Launch'));
        landed = index;
        if (changed || !geometry) measure();
        if (!field.hasAttribute('data-travel') && !gesture) sync(index);
    }

    function positionFor(event) {
        return {
            x: clamp(event.clientX - gesture.left, 15, geometry.width - 15),
            y: clamp(event.clientY - gesture.top, 15, geometry.height - 15)
        };
    }

    const follow = now => {
        const elapsed = (now - (frameTime ?? now - 16)) / 1000;
        frameTime = now;
        const settled = reduced() || spring(body, target, elapsed);
        if (settled) body.position = { ...target };
        show();
        if (settled) frameTime = undefined;
        return !settled;
    };

    listen('pointerdown', event => {
        if (!geometry || !event.isPrimary || event.button !== 0 || !canDrag() || field.hasAttribute('data-travel')) return;
        stop();
        const rect = field.getBoundingClientRect();
        gesture = { id: event.pointerId, left: rect.left + field.clientLeft, top: rect.top + field.clientTop,
            time: event.timeStamp, speed: velocity(), moved: false };
        gesture.start = gesture.last = positionFor(event);
        packet.setPointerCapture(event.pointerId);
        field.setAttribute('data-drag', '');
        entry.setAttribute('data-magnet', '');
        entry.style.setProperty('--ws-proximity', '.16');
    });

    listen('pointermove', event => {
        if (gesture?.id !== event.pointerId) return;
        const point = positionFor(event);
        const elapsed = Math.max(8, event.timeStamp - gesture.time);
        gesture.speed = mix(gesture.speed, { x: (point.x - gesture.last.x) / elapsed, y: (point.y - gesture.last.y) / elapsed }, .58);
        gesture.last = point;
        gesture.time = event.timeStamp;
        gesture.moved ||= distance(point, gesture.start) > 7;
        const socket = geometry.points[layout.entry];
        const radius = geometry.width <= 470 ? 77 : 103;
        target = magnet(point, socket, radius, reduced());
        entry.toggleAttribute('data-magnet', distance(point, socket) < radius);
        entry.style.setProperty('--ws-proximity', proximity(point, socket, radius).toFixed(3));
        loop.start(follow);
    });

    function release(event, cancelled) {
        if (gesture?.id !== event.pointerId) return;
        const point = positionFor(event);
        const { speed, time, start } = gesture;
        const moved = gesture.moved || distance(point, start) > 7;
        gesture = undefined;
        field.removeAttribute('data-drag');
        entry.removeAttribute('data-magnet');
        entry.style.removeProperty('--ws-proximity');
        if (!cancelled && (!moved || captures(point, geometry.points[layout.entry], speed, event.timeStamp - time < 95))) {
            launch(moved ? { position: { ...body.position }, velocity: { ...body.velocity } } : undefined);
        } else {
            target = geometry.points[landed];
            loop.start(follow);
        }
    }
    listen('pointerup', event => release(event, false));
    listen('pointercancel', event => release(event, true));
    listen('lostpointercapture', event => release(event, true));
    listen('click', event => {
        if ((event.detail === 0 || landed === steps.length - 1) && canLaunch() && !field.hasAttribute('data-travel')) launch();
    });
    const observer = new ResizeObserver(measure);
    observer.observe(field);
    const theme = new MutationObserver(measure);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return { configure, sync, move, stop, destroy() { stop(); events.abort(); observer.disconnect(); theme.disconnect(); } };
}
