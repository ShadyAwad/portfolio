import './style.css';
import { createConfigurationStore } from '../../src/studio/configuration.js';
import { buildArchitectureGraph } from '../../src/studio/architecture/graph.js';
import { resolveFlow } from '../../src/studio/flow/model.js';

const fixture = createConfigurationStore({ applicationType: 'saas', previewFeatures: { auth: true, tenancy: true } }).getState();
const route = resolveFlow(fixture, buildArchitectureGraph(fixture), 'workspace').steps;
const titles = ['Request ready', 'API accepts the request', 'Verify the session', 'Resolve tenant scope',
    'Read scoped data', 'API assembles the response', 'Workspace loaded'];
const field = document.querySelector('#field');
const packet = document.querySelector('#packet');
const launch = document.querySelector('#launch');
const reset = document.querySelector('#reset');
const canvas = field.querySelector('canvas');
const context = canvas.getContext('2d');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const stations = new Map([...field.querySelectorAll('[data-station]')].map(node => [node.dataset.station, node]));
const ticks = route.map(() => document.createElement('i'));
document.querySelector('.ticks').append(...ticks);
const progress = document.querySelector('#progress');
const heading = document.querySelector('#stage');
const explanation = document.querySelector('#explanation');

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const interpolate = (a, b, t) => a + (b - a) * t;
const ease = t => t * t * (3 - 2 * t);
const keyFor = step => step.node === 'tenant' ? 'auth' : step.node;
let geometry, position, target, gesture, leg, frameId, lastFrame, reaction;
let phase = 'ready', active = 0, velocity = { x: 0, y: 0 };
let bounds;

function curve(from, to, bend) {
    const length = distance(from, to) || 1;
    const middle = {
        x: (from.x + to.x) / 2 + (from.y - to.y) / length * bend,
        y: (from.y + to.y) / 2 + (to.x - from.x) / length * bend
    };
    return t => ({
        x: interpolate(interpolate(from.x, middle.x, t), interpolate(middle.x, to.x, t), t),
        y: interpolate(interpolate(from.y, middle.y, t), interpolate(middle.y, to.y, t), t)
    });
}

function drawChannel(track, end, color, width, dashed = false) {
    const origin = track(0);
    context.beginPath();
    context.moveTo(origin.x, origin.y);
    for (let i = 1; i <= 24; i++) {
        const point = track(end * i / 24);
        context.lineTo(point.x, point.y);
    }
    context.strokeStyle = color;
    context.lineWidth = width;
    context.setLineDash(dashed ? [4, 7] : []);
    context.stroke();
}

function paint(progress = 0) {
    context.clearRect(0, 0, geometry.width, geometry.height);
    geometry.tracks.forEach((track, index) => {
        if (!track) return;
        const returning = index >= 5;
        drawChannel(track, 1, returning ? '#75b9a386' : '#81dffa66', 1.25, returning);
        if (index <= active && index > 0) drawChannel(track, 1, returning ? '#a9f7cd77' : '#8beeff66', 1.8, returning);
    });
    if (leg?.type === 'travel' && leg.track && !motion.matches) {
        drawChannel(leg.track, progress, leg.index >= 5 ? '#a9f7cddd' : '#8beeffcc', 2);
    }
}

function measure() {
    const width = field.clientWidth;
    const height = field.clientHeight;
    if (!width || (geometry?.width === width && geometry?.height === height)) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    const points = Object.fromEntries([...stations].map(([key, node]) => [key, { x: node.offsetLeft, y: node.offsetTop }]));
    const tracks = route.map((step, index) => {
        if (!index || keyFor(step) === keyFor(route[index - 1])) return null;
        const from = points[keyFor(route[index - 1])];
        const to = points[keyFor(step)];
        return curve(from, to, index >= 5 ? (width < 650 ? -55 : -135) : (index === 2 ? -34 : -42));
    });
    geometry = { width, height, points, tracks };
    if (!position || phase === 'ready' || phase === 'done') position = { ...points.browser };
    if (phase === 'return') target = points.browser;
    if (leg?.type === 'travel' && leg.track === leg.original) {
        leg.track = tracks[leg.index];
        leg.original = leg.track;
    }
    if (gesture) bounds = field.getBoundingClientRect();
    showPacket();
    paint();
}

function showPacket() {
    packet.style.transform = `translate3d(${position.x}px,${position.y}px,0)`;
}

function setPhase(next) {
    phase = next;
    field.dataset.phase = next;
    const busy = ['drag', 'return', 'run'].includes(next);
    launch.setAttribute('aria-disabled', String(busy));
    packet.setAttribute('aria-disabled', String(busy));
    reset.disabled = next === 'ready';
    launch.firstChild.textContent = next === 'run' ? 'Routing… ' :
        next === 'done' ? 'Replay request ' : 'Launch request ';
}

function report(index) {
    active = index;
    progress.textContent = index === 0 ? 'Ready' : index === route.length - 1 ? 'Delivered' : `Step ${index} of ${route.length - 1}`;
    heading.textContent = titles[index];
    explanation.textContent = route[index].text[0];
    const visited = new Set(route.slice(0, index).map(keyFor));
    stations.forEach((station, key) => {
        station.toggleAttribute('data-active', key === keyFor(route[index]));
        station.toggleAttribute('data-passed', visited.has(key));
    });
    ticks.forEach((tick, step) => tick.toggleAttribute('data-done', step <= index));
}

function schedule() {
    if (frameId === undefined) frameId = requestAnimationFrame(tick);
}

function spring(dt) {
    const steps = Math.max(1, Math.ceil(dt / .008));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
        velocity.x += ((target.x - position.x) * 365 - velocity.x * 27) * h;
        velocity.y += ((target.y - position.y) * 365 - velocity.y * 27) * h;
        position.x += velocity.x * h;
        position.y += velocity.y * h;
    }
    if (distance(position, target) < .45 && Math.hypot(velocity.x, velocity.y) < 7) {
        position = { ...target };
        velocity = { x: 0, y: 0 };
        return true;
    }
    return false;
}

function beginLeg(index, time, from) {
    const original = geometry.tracks[index];
    const track = from ? curve(from, geometry.points[keyFor(route[index])], -12) : original;
    const duration = from ? 310 : clamp(300 + distance(track?.(0) ?? position, track?.(1) ?? position) * .95, 370, 870);
    leg = { type: 'travel', index, start: time, track, original, duration };
}

function tick(time) {
    frameId = undefined;
    const dt = clamp((time - (lastFrame ?? time - 16)) / 1000, .001, .034);
    lastFrame = time;
    if (phase === 'drag' || phase === 'return') {
        const settled = motion.matches ? (position = { ...target }, true) : spring(dt);
        showPacket();
        if (!settled) schedule();
        else if (phase === 'return') setPhase('ready');
        return;
    }
    if (phase !== 'run') return;
    const elapsed = time - leg.start;
    if (leg.type === 'travel') {
        const t = clamp(elapsed / (motion.matches ? 85 : leg.duration), 0, 1);
        if (leg.track && !motion.matches) position = leg.track(ease(t));
        if (t === 1) {
            position = { ...geometry.points[keyFor(route[leg.index])] };
            report(leg.index);
            reaction?.cancel();
            if (!motion.matches) {
                reaction = stations.get(keyFor(route[active])).firstElementChild.animate(
                    [{ scale: 1 }, { scale: 1.09, offset: .25 }, { scale: 1 }],
                    { duration: 380, easing: 'ease-out' }
                );
            }
            if (leg.index === route.length - 1) {
                leg = undefined;
                setPhase('done');
            } else leg = { type: 'dwell', index: active, start: time };
        }
        showPacket();
        paint(ease(t));
    } else if (elapsed >= (motion.matches ? 950 : active === 2 ? 660 : 520)) {
        beginLeg(leg.index + 1, time);
    }
    if (phase === 'run') schedule();
}

function start(from) {
    if (phase === 'run') return;
    if (phase === 'done') report(0);
    setPhase('run');
    stations.get('api').removeAttribute('data-magnet');
    beginLeg(1, performance.now(), from);
    schedule();
}

function resetRoute() {
    if (gesture) {
        const pointer = gesture.id;
        gesture = undefined;
        if (packet.hasPointerCapture(pointer)) packet.releasePointerCapture(pointer);
    }
    cancelAnimationFrame(frameId);
    reaction?.cancel();
    frameId = lastFrame = leg = undefined;
    velocity = { x: 0, y: 0 };
    stations.get('api').removeAttribute('data-magnet');
    position = { ...geometry.points.browser };
    setPhase('ready');
    report(0);
    showPacket();
    paint();
}

function pointerPoint(event) {
    return {
        x: clamp(event.clientX - bounds.left - field.clientLeft, 22, geometry.width - 22),
        y: clamp(event.clientY - bounds.top - field.clientTop, 22, geometry.height - 22)
    };
}

packet.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || phase !== 'ready') return;
    bounds = field.getBoundingClientRect();
    const point = pointerPoint(event);
    gesture = { id: event.pointerId, start: point, last: point, at: event.timeStamp, vx: 0, vy: 0, moved: false };
    target = { ...position };
    lastFrame = undefined;
    packet.setPointerCapture(event.pointerId);
    setPhase('drag');
    stations.get('api').setAttribute('data-magnet', '');
});
packet.addEventListener('pointermove', event => {
    if (gesture?.id !== event.pointerId) return;
    const point = pointerPoint(event);
    const elapsed = Math.max(8, event.timeStamp - gesture.at);
    gesture.vx = interpolate(gesture.vx, (point.x - gesture.last.x) / elapsed, .58);
    gesture.vy = interpolate(gesture.vy, (point.y - gesture.last.y) / elapsed, .58);
    gesture.last = point;
    gesture.at = event.timeStamp;
    gesture.moved ||= distance(point, gesture.start) > 7;
    const api = geometry.points.api;
    const radius = geometry.width > 650 ? 116 : 83;
    const strength = motion.matches ? 0 : .8 * Math.max(0, 1 - distance(point, api) / radius) ** 1.4;
    target = { x: interpolate(point.x, api.x, strength), y: interpolate(point.y, api.y, strength) };
    stations.get('api').toggleAttribute('data-magnet', distance(point, api) < radius);
    schedule();
});

function release(event, cancelled = false) {
    if (gesture?.id !== event.pointerId) return;
    const released = gesture;
    gesture = undefined;
    const api = geometry.points.api;
    const point = pointerPoint(event);
    const momentum = event.timeStamp - released.at < 95 ? 65 : 0;
    const projected = { x: point.x + clamp(released.vx, -1.7, 1.7) * momentum,
        y: point.y + clamp(released.vy, -1.7, 1.7) * momentum };
    stations.get('api').removeAttribute('data-magnet');
    if (!cancelled && (!released.moved || distance(point, api) < 60 ||
        (distance(point, api) < 150 && distance(projected, api) < 60))) {
        start(released.moved ? position : undefined);
    } else {
        target = geometry.points.browser;
        setPhase('return');
        schedule();
    }
}
packet.addEventListener('pointerup', event => release(event));
packet.addEventListener('pointercancel', event => release(event, true));
packet.addEventListener('lostpointercapture', event => release(event, true));
function activate() {
    if (phase === 'ready' || phase === 'done') start();
}
packet.addEventListener('click', event => { if (event.detail === 0 || phase === 'done') activate(); });
launch.addEventListener('click', activate);
reset.addEventListener('click', () => { resetRoute(); launch.focus(); });
motion.addEventListener('change', () => { if (motion.matches) reaction?.cancel(); });

const observer = new ResizeObserver(measure);
observer.observe(field);
measure();
resetRoute();
if (import.meta.hot) import.meta.hot.dispose(() => {
    observer.disconnect();
    cancelAnimationFrame(frameId);
});
