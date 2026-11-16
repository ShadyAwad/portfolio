import { captures, channel, clamp, createFrameLoop, distance, magnet, mix, spring } from './request-motion.js';
import './workspace.css';

const socketFor = node => ['auth', 'tenant'].includes(node) ? 'access' : node;
const velocity = () => ({ x: 0, y: 0 });

export function mountWorkspace(root, { reduced, canDrag, canLaunch, launch }) {
    root.innerHTML = `<div class="workspace-field">
        <canvas aria-hidden="true"></canvas>
        ${[['browser','▱'],['api','⌁'],['access','◇'],['postgres','≋']].map(([id, mark]) =>
            `<div class="workspace-socket" data-socket="${id}"><i aria-hidden="true">${mark}</i><span></span></div>`).join('')}
        <button type="button" class="workspace-token"><span aria-hidden="true"></span></button>
        <p class="workspace-return"><i aria-hidden="true"></i><span></span></p>
    </div><p class="workspace-hint"></p>`;
    const field = root.firstElementChild;
    const packet = field.querySelector('button');
    const canvas = field.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const nodes = new Map([...field.querySelectorAll('[data-socket]')].map(node => [node.dataset.socket, node]));
    const api = nodes.get('api');
    const events = new AbortController();
    const listen = (name, handler) => packet.addEventListener(name, handler, { signal: events.signal });
    const loop = createFrameLoop(requestAnimationFrame, cancelAnimationFrame);
    let geometry, gesture, target, pulse, signature;
    let steps = [], landed = 0;
    let body = { position: { x: 0, y: 0 }, velocity: velocity() };
    let frameTime;

    function drawTrack(track, color, width, dash, end = 1) {
        if (!track || !end) return;
        ctx.beginPath();
        const first = track(0);
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i <= 22; i++) {
            const point = track(end * i / 22);
            ctx.lineTo(point.x, point.y);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.setLineDash(dash ? [4, 6] : []);
        ctx.stroke();
    }

    function paint(highlight, end) {
        if (!geometry) return;
        const { width, height, tracks, colors } = geometry;
        ctx.clearRect(0, 0, width, height);
        tracks.forEach(({ path, response }, index) => drawTrack(path,
            response ? colors.returning : index <= landed ? colors.traversed : colors.track,
            index <= landed ? 1.65 : 1.2, response));
        if (highlight) drawTrack(highlight.path, highlight.response ? colors.mint : colors.cyan, 2, false, end);
    }

    function show() {
        packet.style.transform = `translate3d(${body.position.x}px, ${body.position.y}px, 0)`;
    }

    function measure() {
        const width = field.clientWidth;
        const height = field.clientHeight;
        if (!width || !height || !steps.length) return;
        const scale = Math.min(devicePixelRatio || 1, 2);
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        const points = steps.map(step => {
            const node = nodes.get(socketFor(step.node));
            return { x: node.offsetLeft, y: node.offsetTop };
        });
        const style = getComputedStyle(field);
        const colors = Object.fromEntries(['track', 'traversed', 'returning', 'cyan', 'mint']
            .map(key => [key, style.getPropertyValue('--ws-' + key).trim()]));
        const tracks = points.map((to, i) => {
            if (!i || distance(points[i - 1], to) < 1) return {};
            const response = i >= steps.length - 2;
            const bend = response ? (width <= 470 ? -53 : -99) : (i === 2 ? -29 : -36);
            return { path: channel(points[i - 1], to, field.matches(':dir(rtl)') ? -bend : bend), response };
        });
        geometry = { width, height, points, tracks, colors };
        if (!gesture && !field.hasAttribute('data-travel')) place(landed);
        paint();
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
        body.velocity = velocity();
        frameTime = undefined;
    }

    function sync(index, animate = false) {
        landed = index;
        place(index);
        field.toggleAttribute('data-delivered', index === steps.length - 1);
        const current = socketFor(steps[index].node);
        nodes.forEach((node, key) => node.toggleAttribute('data-active', key === current));
        packet.setAttribute('aria-disabled', String(!canLaunch()));
        if (animate && !reduced()) {
            pulse?.cancel();
            pulse = nodes.get(current).querySelector('i').animate(
                [{ scale: 1 }, { scale: 1.2, offset: .28 }, { scale: 1 }], { duration: 330, easing: 'ease-out' });
        }
        paint();
    }

    function move(from, to, origin, done) {
        if (!geometry || reduced()) {
            done();
            return;
        }
        const initialTime = performance.now();
        field.setAttribute('data-travel', '');
        packet.setAttribute('aria-disabled', 'true');
        const adjacent = !origin && to === from + 1;
        const duration = adjacent ? clamp(290 + distance(geometry.points[from], geometry.points[to]), 300, 630) : 305;
        loop.start(now => {
            const elapsed = clamp((now - initialTime) / duration, 0, 1);
            const t = elapsed * elapsed * (3 - 2 * elapsed);
            const track = adjacent ? geometry.tracks[to] : {
                path: channel(origin ?? geometry.points[from], geometry.points[to], -14),
                response: to >= steps.length - 2
            };
            body.position = track.path?.(t) ?? geometry.points[to];
            show();
            paint(track, t);
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
        if (!cancelled && (!moved || captures(point, geometry.points[1], speed, event.timeStamp - time < 95))) {
            launch(moved ? { ...body.position } : undefined);
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
