import { channel, landingFrames } from './flow/request-motion.js';
import { socketFor } from './flow/request-layout.js';

const width = 360;
const height = 90;
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
const requestTiming = { browser: 240, api: 470, access: 290, postgres: 490 };
const responseTiming = { browser: 500, api: 460 };
const checkpointDwell = 80;

export function workspacePreviewJourney(steps) {
    const stops = [];
    const checks = new Set();
    for (const step of steps) {
        if (step.illustrative || step.channel === 'background') continue;
        const id = socketFor(step);
        if (!Object.hasOwn(requestTiming, id)) continue;
        if (id === 'access') checks.add(step.node);
        const returning = step.channel === 'response';
        const previous = stops.at(-1);
        if (previous?.id === id && (id !== 'browser' || previous.returning === returning)) continue;
        const delay = returning && previous?.id !== id ? responseTiming[id] : requestTiming[id];
        stops.push({ id, time: (previous?.time ?? 0) + delay, returning });
    }
    const outward = [...new Set(stops.filter(stop => !stop.returning).map(stop => stop.id))];
    const checkpoint = checks.size > 1 ? 'access' : checks.has('auth') ? 'session' : checks.has('tenant') ? 'scope' : null;
    return { outward, stops, checkpoint, duration: stops.at(-1).time + 240 };
}

// Animation completion belongs to the current invitation. Cancellation invalidates even queued promises.
export function createWorkspaceRun({ canRun, stage, animate }) {
    let current;

    function cancel() {
        if (!current) return;
        const previous = current;
        current = undefined;
        previous.effects?.forEach(effect => effect.cancel());
        stage('idle');
    }

    function finish() {
        if (!current) return;
        const { complete } = current;
        cancel();
        if (canRun()) complete();
    }

    return {
        play(input, reduced, complete) {
            cancel();
            if (!canRun()) return;
            if (reduced) {
                complete();
                return;
            }
            stage('running');
            const run = { complete, effects: animate(input) };
            current = run;
            run.effects[0].finished.then(() => {
                if (current === run) finish();
            }, () => {
                if (current === run) cancel();
            });
        },
        cancel, finish
    };
}

const pointText = point => `${point.x},${point.y}`;
const curve = (from, to, bend) => {
    const mid = channel(from, to, bend)(.5);
    const control = { x: 2 * mid.x - (from.x + to.x) / 2, y: 2 * mid.y - (from.y + to.y) / 2 };
    return `M${pointText(from)} Q${pointText(control)} ${pointText(to)}`;
};

export function mountWorkspacePreview(root, button, panel, host, initialJourney, label) {
    const rtl = root.closest('[dir]')?.dir === 'rtl';
    const bend = rtl ? -24 : 24;
    let journey, signature, svg, points, packets, emphasis;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const canRun = () => root.isConnected && !root.closest('[hidden]') && !document.hidden;
    const stage = state => { root.dataset.pulse = state; };

    function drawRoute() {
        const { outward, stops, checkpoint } = journey;
        points = Object.fromEntries(outward.map((id, i) => {
            const x = 45 + i * 270 / Math.max(1, outward.length - 1);
            return [id, { x: rtl ? width - x : x, y: 44 }];
        }));
        root.innerHTML = `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true">
            <g class="workspace-pulse-lanes">${stops.slice(1).map((stop, i) => stop.id === stops[i].id ? '' :
                `<path class="${stop.returning ? 'pulse-response' : 'pulse-request'}" d="${curve(points[stops[i].id], points[stop.id], bend)}"/>`).join('')}</g>
            ${outward.map(id => {
                const { x, y } = points[id];
                const key = id === 'access' ? checkpoint : id;
                return `<g transform="translate(${x} ${y})">
                    <g class="workspace-pulse-socket" data-pulse-node="${id}">
                        <circle class="workspace-pulse-ring" r="18"/><circle class="workspace-pulse-core" r="13"/>
                        <g class="workspace-pulse-glyph">${glyph[key]}</g>
                        ${id === 'access' ? '<g class="workspace-pulse-verified"><circle cx="10" cy="-10" r="5.5"/><path d="m7.4-10 1.7 1.9 3.4-4"/></g>' : ''}
                    </g><text y="33" text-anchor="middle">${label(copy[key])}</text>
                </g>`;
            }).join('')}
            <g class="workspace-pulse-packets">${[1.4, 2.1, 3, 4].map(radius => `<circle r="${radius}"/>`).join('')}</g>
        </svg><span class="workspace-pulse-demo">${label(['Simulated request', 'طلب محاكى'])}</span>
        <span id="workspace-pulse-route" class="workspace-pulse-description">${label(['Simulated request', 'طلب محاكى'])}.
            ${stops.map(({ id }) => label(copy[id === 'access' ? checkpoint : id])).join(rtl ? ' ← ' : ' → ')}</span>`;
        svg = root.querySelector('svg');
        packets = [...root.querySelectorAll('.workspace-pulse-packets circle')].reverse();
    }

    function animate(origin) {
        const { stops, duration } = journey;
        const legs = stops.map((stop, index) => ({
            ...stop,
            start: (stops[index - 1]?.time ?? 0) + (stops[index - 1]?.id === 'access' ? checkpointDwell : 0),
            path: channel(index ? points[stops[index - 1].id] : origin, points[stop.id], index ? bend : -bend / 2)
        }));
        const travel = packets.map((packet, index) => {
            const keyframes = legs.flatMap(({ start, time, path, returning }, leg) =>
                Array.from({ length: 15 }, (_, sample) => {
                    if (leg && sample === 0 && start === stops[leg - 1].time) return null;
                    const fraction = sample / 14;
                    const t = fraction * fraction * (3 - 2 * fraction);
                    const point = path(t);
                    const age = (start + (time - start) * fraction + index * 36) / duration;
                    return {
                        offset: age,
                        transform: `translate(${point.x}px, ${point.y}px)`,
                        fill: returning ? 'var(--pulse-return)' : 'var(--pulse-live)',
                        opacity: index ? .46 / index : 1
                    };
                }).filter(Boolean));
            if (index) keyframes.unshift({ offset: 0, opacity: 0, transform: keyframes[0].transform });
            keyframes.push({ offset: 1, opacity: 0, transform: keyframes.at(-1).transform });
            return packet.animate(keyframes, { duration });
        });
        const press = button.animate([{ scale: 1 }, { scale: .96, offset: .28 }, { scale: 1 }],
            { duration: 205, easing: 'ease-out' });
        const reactions = stops.map(({ id, time, returning }) => {
            const socket = root.querySelector(`[data-pulse-node="${id}"]`);
            return socket.animate(landingFrames(returning && id === 'browser').map(frame => ({
                ...frame,
                color: frame.offset === 1 ? 'var(--pulse-rest)' : id === 'access' ? 'var(--pulse-check)' :
                    returning ? 'var(--pulse-return)' : 'var(--pulse-live)'
            })), { duration: 240, delay: time });
        });
        const verification = root.querySelector('.workspace-pulse-verified');
        if (verification) reactions.push(verification.animate([
            { opacity: 0, scale: .78 }, { opacity: 1, scale: 1.06, offset: .23 },
            { opacity: 1, scale: 1, offset: .67 }, { opacity: 0, scale: 1 }
        ], { duration: 320, delay: stops.find(stop => stop.id === 'access').time }));
        return [...travel, press, ...reactions];
    }

    const run = createWorkspaceRun({ canRun, stage, animate });
    function cancel() {
        run.cancel();
        emphasis?.cancel();
        emphasis = undefined;
    }

    function configure(next) {
        const key = JSON.stringify(next);
        if (key === signature) return false;
        const changed = Boolean(journey);
        cancel();
        signature = key;
        journey = next;
        stage('idle');
        drawRoute();
        if (changed && canRun() && !motion.matches) {
            const node = root.querySelector(`[data-pulse-node="${journey.checkpoint ? 'access' : 'api'}"]`);
            emphasis = node?.animate(landingFrames(true), { duration: 330 });
        }
        return changed;
    }

    button.setAttribute('aria-describedby', 'workspace-pulse-route');
    configure(initialJourney);
    const events = new AbortController();
    const { signal } = events;
    const cancelIfHidden = () => { if (!canRun()) cancel(); };
    const visibility = new MutationObserver(cancelIfHidden);
    visibility.observe(panel, { attributes: true, attributeFilter: ['hidden'] });
    host.addEventListener('studio-visibility', cancelIfHidden, { signal });
    document.addEventListener('visibilitychange', cancelIfHidden, { signal });
    motion.addEventListener('change', () => {
        if (!motion.matches) return;
        emphasis?.cancel();
        run.finish();
    }, { signal });
    return {
        configure,
        play(complete) {
            if (!canRun()) return;
            emphasis?.cancel();
            const bounds = svg.getBoundingClientRect();
            const origin = button.getBoundingClientRect();
            const factor = bounds.width / width;
            const point = factor ? {
                x: (origin.left + origin.width / 2 - bounds.left) / factor,
                y: (origin.bottom - bounds.top) / factor
            } : points.browser;
            run.play(point, motion.matches || !factor, complete);
        },
        reflect(completed) {
            if (completed) stage('ready');
            else if (root.dataset.pulse === 'ready') stage('idle');
        },
        cancel,
        destroy() { cancel(); visibility.disconnect(); events.abort(); }
    };
}
