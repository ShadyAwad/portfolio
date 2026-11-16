import { captures, channel, clamp, createFrameLoop, distance, easeTravel, handoff,
    landingFrames, magnet, mix, proximity, spring } from './request-motion.js';
import './workspace.css';

const socketFor = node => ['auth', 'tenant'].includes(node) ? 'access' : node;
const velocity = () => ({ x: 0, y: 0 });

export function mountWorkspace(root, { reduced, canDrag, canLaunch, launch }) {
    root.innerHTML = `<div class="workspace-field">
        <canvas aria-hidden="true"></canvas><canvas aria-hidden="true"></canvas>
        ${[['browser','▱'],['api','⌁'],['access','◇'],['postgres','≋']].map(([id, mark]) =>
            `<div class="workspace-socket" data-socket="${id}"><i aria-hidden="true">${mark}</i><span></span></div>`).join('')}
        <button type="button" class="workspace-token"><span aria-hidden="true"></span></button>
        <p class="workspace-return"><i aria-hidden="true"></i><span></span></p>
    </div><p class="workspace-hint"></p>`;
    const field = root.firstElementChild;
    const packet = field.querySelector('button');
    const [canvas, overlay] = field.querySelectorAll('canvas');
    const ctx = canvas.getContext('2d');
    const glow = overlay.getContext('2d');
    const nodes = new Map([...field.querySelectorAll('[data-socket]')].map(node => [node.dataset.socket, node]));
    const api = nodes.get('api');
    const events = new AbortController();
    const listen = (name, handler) => packet.addEventListener(name, handler, { signal: events.signal });
    const loop = createFrameLoop(requestAnimationFrame, cancelAnimationFrame);
    let geometry, gesture, target, pulse, signature;
    let steps = [], landed = 0;
    let body = { position: { x: 0, y: 0 }, velocity: velocity() };
    let frameTime;

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
        tracks.forEach(({ path, response }) => drawTrack(ctx, path,
            response ? colors.returning : colors.track, 1.2, response));
    }

    function clearGlow() {
        if (geometry) glow.clearRect(0, 0, geometry.width, geometry.height);
    }

    function paintTrail(track, end, tail) {
        clearGlow();
        if (!track.path) return;
        const color = track.response ? geometry.colors.mint : geometry.colors.cyan;
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
            if (incoming) drawTrack(glow, incoming.path, incoming.response ? geometry.colors.mint : geometry.colors.cyan,
                1.8, false, .7, 1, 9);
            if (outgoing) drawTrack(glow, outgoing.path, outgoing.response ? geometry.colors.mint : geometry.colors.cyan,
                1.6, false, 0, .27, 9);
            glow.globalAlpha = 1;
            return t < 1;
        });
    }

    function show() {
        packet.style.transform = `translate3d(${body.position.x}px, ${body.position.y}px, 0)`;
    }

    function measure() {
        const width = field.clientWidth;
        const height = field.clientHeight;
        if (!width || !height || !steps.length) return;
        const scale = Math.min(devicePixelRatio || 1, 2);
        for (const context of [ctx, glow]) {
            context.canvas.width = Math.round(width * scale);
            context.canvas.height = Math.round(height * scale);
            context.setTransform(scale, 0, 0, scale, 0, 0);
        }
        const points = steps.map(step => {
            const node = nodes.get(socketFor(step.node));
            return { x: node.offsetLeft, y: node.offsetTop };
        });
        const style = getComputedStyle(field);
        const colors = Object.fromEntries(['track', 'returning', 'cyan', 'mint']
            .map(key => [key, style.getPropertyValue('--ws-' + key).trim()]));
        const tracks = points.map((to, i) => {
            if (!i || distance(points[i - 1], to) < 1) return {};
            const response = i >= steps.length - 2;
            const bend = response ? (width <= 470 ? -53 : -99) : (i === 2 ? -29 : -36);
            return { path: channel(points[i - 1], to, field.matches(':dir(rtl)') ? -bend : bend), response };
        });
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
        api.removeAttribute('data-magnet');
        api.style.removeProperty('--ws-proximity');
        clearGlow();
        body.velocity = velocity();
        frameTime = undefined;
    }

    function sync(index, animate = false) {
        landed = index;
        place(index);
        const delivered = index === steps.length - 1;
        field.toggleAttribute('data-delivered', delivered);
        field.toggleAttribute('data-response', index >= steps.length - 2);
        const current = socketFor(steps[index].node);
        const visited = new Set(steps.slice(0, index).map(step => socketFor(step.node)));
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
        field.toggleAttribute('data-response', to >= steps.length - 2);
        packet.setAttribute('aria-disabled', 'true');
        const adjacent = !origin && to === from + 1;
        const length = distance(origin?.position ?? geometry.points[from], geometry.points[to]);
        const duration = adjacent ? clamp(270 + length, 290, 620) : clamp(205 + length * .65, 230, 390);
        const tail = clamp(32 / (length || 1), .07, .23);
        let layout;
        let track;
        loop.start(now => {
            const elapsed = clamp((now - initialTime) / duration, 0, 1);
            const t = origin ? elapsed : easeTravel(elapsed);
            if (layout !== geometry) {
                layout = geometry;
                track = adjacent ? layout.tracks[to] : {
                    path: origin ? handoff(origin.position, layout.points[to], origin.velocity, duration / 1000) :
                        channel(layout.points[from], layout.points[to], -14),
                    response: to >= steps.length - 2
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

    function configure(next, label, copy, index, revision) {
        steps = next;
        const keys = new Set(steps.map(step => step.node));
        const names = { browser: label('browser'), api: label('api'), postgres: label('postgres'),
            access: keys.has('auth') && keys.has('tenant') ? copy('workspaceAccess') :
                label(keys.has('auth') ? 'auth' : 'tenant') };
        const showAccess = keys.has('tenant') || keys.has('auth');
        const changed = signature !== revision;
        signature = revision;
        field.toggleAttribute('data-access', showAccess);
        nodes.forEach((node, key) => { node.lastElementChild.textContent = names[key]; });
        nodes.get('access').hidden = !showAccess;
        root.querySelector('.workspace-hint').textContent = copy('workspaceHint');
        root.querySelector('.workspace-return span').textContent = copy('workspaceReturn');
        packet.setAttribute('aria-label', copy('workspaceLaunch'));
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
        if (!event.isPrimary || event.button !== 0 || !canDrag() || field.hasAttribute('data-travel')) return;
        stop();
        const rect = field.getBoundingClientRect();
        gesture = { id: event.pointerId, left: rect.left + field.clientLeft, top: rect.top + field.clientTop,
            time: event.timeStamp, speed: velocity(), moved: false };
        gesture.start = gesture.last = positionFor(event);
        packet.setPointerCapture(event.pointerId);
        field.setAttribute('data-drag', '');
        api.setAttribute('data-magnet', '');
        api.style.setProperty('--ws-proximity', '.16');
    });

    listen('pointermove', event => {
        if (gesture?.id !== event.pointerId) return;
        const point = positionFor(event);
        const elapsed = Math.max(8, event.timeStamp - gesture.time);
        gesture.speed = mix(gesture.speed, { x: (point.x - gesture.last.x) / elapsed, y: (point.y - gesture.last.y) / elapsed }, .58);
        gesture.last = point;
        gesture.time = event.timeStamp;
        gesture.moved ||= distance(point, gesture.start) > 7;
        const socket = geometry.points[1];
        const radius = geometry.width <= 470 ? 77 : 103;
        target = magnet(point, socket, radius, reduced());
        api.toggleAttribute('data-magnet', distance(point, socket) < radius);
        api.style.setProperty('--ws-proximity', proximity(point, socket, radius).toFixed(3));
        loop.start(follow);
    });

    function release(event, cancelled) {
        if (gesture?.id !== event.pointerId) return;
        const point = positionFor(event);
        const { speed, time, start } = gesture;
        const moved = gesture.moved || distance(point, start) > 7;
        gesture = undefined;
        field.removeAttribute('data-drag');
        api.removeAttribute('data-magnet');
        api.style.removeProperty('--ws-proximity');
        if (!cancelled && (!moved || captures(point, geometry.points[1], speed, event.timeStamp - time < 95))) {
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
