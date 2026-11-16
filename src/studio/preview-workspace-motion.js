import { channel, landingFrames } from './flow/request-motion.js';

const width = 360;
const height = 90;
const copy = {
    browser: ['UI', 'الواجهة'],
    api: ['API', 'واجهة البرمجة'],
    postgres: ['Database', 'قاعدة البيانات']
};
const glyph = {
    browser: '<rect x="-6" y="-4.5" width="12" height="9" rx="2"/><path d="M-2 7h4M0 4.5V7"/>',
    api: '<path d="m-3-4-4 4 4 4m6-8 4 4-4 4M1-6-1 6"/>',
    postgres: '<ellipse cy="-4" rx="6" ry="2.5"/><path d="M-6-4v8c0 3.4 12 3.4 12 0v-8M-6 0c0 3.4 12 3.4 12 0"/>'
};
const arrival = { browser: 240, api: 710, postgres: 1200 };

export function workspacePreviewJourney(graph) {
    const outward = ['browser', 'api', 'postgres'].filter(id => graph.nodes.some(node => node.id === id));
    const stops = outward.map(id => ({ id, time: arrival[id], returning: false }));
    if (outward.length > 2) stops.push({ id: 'api', time: 1660, returning: true });
    const returnTime = outward.length > 2 ? 2160 : Math.max(480, stops.at(-1).time + (outward.length === 2 ? 460 : 240));
    stops.push({ id: 'browser', time: returnTime, returning: true });
    return { outward, stops, duration: stops.at(-1).time + 240 };
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

export function mountWorkspacePreview(root, button, panel, host, graph, label) {
    const { outward, stops, duration } = workspacePreviewJourney(graph);
    const rtl = root.closest('[dir]')?.dir === 'rtl';
    const points = Object.fromEntries(outward.map((id, i) => {
        const x = outward.length === 1 ? 45 : 45 + i * 270 / (outward.length - 1);
        return [id, { x: rtl ? width - x : x, y: 44 }];
    }));
    const bend = rtl ? -24 : 24;
    root.innerHTML = `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true">
        <g class="workspace-pulse-lanes">${stops.slice(1).map((stop, i) => stop.id === stops[i].id ? '' :
            `<path class="${stop.returning ? 'pulse-response' : 'pulse-request'}" d="${curve(points[stops[i].id], points[stop.id], bend)}"/>`).join('')}</g>
        ${outward.map(id => {
            const { x, y } = points[id];
            return `<g transform="translate(${x} ${y})">
                <g class="workspace-pulse-socket" data-pulse-node="${id}">
                    <circle class="workspace-pulse-ring" r="18"/><circle class="workspace-pulse-core" r="13"/>
                    <g class="workspace-pulse-glyph">${glyph[id]}</g>
                </g><text y="33" text-anchor="middle">${label(copy[id])}</text>
            </g>`;
        }).join('')}
        <g class="workspace-pulse-packets">${[1.4, 2.1, 3, 4].map(radius => `<circle r="${radius}"/>`).join('')}</g>
    </svg><span class="workspace-pulse-demo">${label(['Simulated request', 'طلب محاكى'])}</span>`;
    const svg = root.querySelector('svg');
    const packets = [...root.querySelectorAll('.workspace-pulse-packets circle')].reverse();
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const canRun = () => root.isConnected && !root.closest('[hidden]') && !document.hidden;
    const stage = state => { root.dataset.pulse = state; };

    function animate(origin) {
        const legs = stops.map((stop, index) => ({
            ...stop,
            start: stops[index - 1]?.time ?? 0,
            path: channel(index ? points[stops[index - 1].id] : origin, points[stop.id], index ? bend : -bend / 2)
        }));
        const travel = packets.map((packet, index) => {
            const keyframes = legs.flatMap(({ start, time, path, returning }, leg) =>
                Array.from({ length: 15 }, (_, sample) => {
                    if (leg && sample === 0) return null;
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
                color: frame.offset === 1 ? 'var(--pulse-rest)' : returning ? 'var(--pulse-return)' : 'var(--pulse-live)'
            })), { duration: 240, delay: time });
        });
        return [...travel, press, ...reactions];
    }

    const run = createWorkspaceRun({ canRun, stage, animate });
    const events = new AbortController();
    const { signal } = events;
    const cancelIfHidden = () => { if (!canRun()) run.cancel(); };
    const visibility = new MutationObserver(cancelIfHidden);
    visibility.observe(panel, { attributes: true, attributeFilter: ['hidden'] });
    host.addEventListener('studio-visibility', cancelIfHidden, { signal });
    document.addEventListener('visibilitychange', cancelIfHidden, { signal });
    motion.addEventListener('change', () => { if (motion.matches) run.finish(); }, { signal });
    return {
        play(complete) {
            if (!canRun()) return;
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
        cancel: run.cancel,
        destroy() { run.cancel(); visibility.disconnect(); events.abort(); }
    };
}
