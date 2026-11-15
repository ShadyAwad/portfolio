import { space } from './layout.js';
import { buildUniverseScene, universeKeyTarget } from './scene.js';
import { mountUniverseMotion } from './motion.js';
import './universe.css';

const glyphs = {
    core: '<circle r="19"/><ellipse rx="22" ry="8" transform="rotate(-35)"/>',
    satellite: '<circle r="8"/><path d="M-20 -6h10v12h-10z M10 -6h10v12H10z M-10 0h-3 M10 0h3"/>',
    shield: '<path d="M0 -15 13 -10v10Q12 10 0 16Q-12 10 -13 0v-10z M-5 0l4 4 7 -8"/>',
    tenant: '<path d="M0 -16 14 -8v16L0 16 -14 8V-8z M0 -8 7 -4v8L0 8 -7 4v-8z"/>',
    planet: '<circle r="13"/><ellipse rx="21" ry="6" transform="rotate(-25)"/>',
    crystal: '<path d="M0 -17 13 -5 8 14 -8 14 -13 -5z M0 -17 5 -5 0 14 -5 -5z M-13 -5h26"/>',
    queue: '<circle r="14"/><path d="M-7 -5h14 M-7 0h14 M-7 5h9"/>',
    broker: '<path d="M-13 -5 0 -13 13 -5 0 3z M-13 1 0 9 13 1 M-13 7 0 15 13 7"/>',
    worker: '<path d="M0 -12 10 -5v10L0 12 -10 5V-5z M-5 0h10 M0 -5v10"/><circle cx="-15" r="2"/><circle cx="15" r="2"/>',
    external: '<circle r="13"/><path d="M0 -18V18 M-18 0H18 M-8 -8 8 8 M8 -8 -8 8"/>'
};
const ns = 'http://www.w3.org/2000/svg';

export function mountUniverse(canvas, selectNode) {
    const panel = document.createElement('section');
    panel.className = 'universe-panel';
    panel.hidden = true;
    panel.innerHTML = `<div class="universe-heading"><p></p><button type="button"></button></div>
        <div class="universe-stage">
            <div class="universe-dust" aria-hidden="true"></div>
            <svg class="universe-space" viewBox="0 0 ${space.width} ${space.height}" aria-hidden="true">
                <g class="universe-orbits" transform="translate(320 260) rotate(-18)">
                    <ellipse rx="142" ry="104"/><ellipse rx="221" ry="161"/>
                    <ellipse rx="280" ry="204"/><ellipse rx="308" ry="230"/>
                </g>
                <g class="universe-channels"></g>
            </svg>
            <div class="universe-nodes" role="group"></div>
        </div>
        <div class="universe-details"></div>`;
    canvas.append(panel);

    const stage = panel.querySelector('.universe-stage');
    const nodes = panel.querySelector('.universe-nodes');
    const channels = panel.querySelector('.universe-channels');
    const home = panel.querySelector('button');
    const hint = panel.querySelector('p');
    const events = new AbortController();
    const options = { signal: events.signal };
    const active = new Map();
    const paths = new Map();
    const retiring = new Map();
    const motion = mountUniverseMotion(stage, clearRetiring);
    let scene;
    let signature;
    let rtl;

    function clearRetiring() {
        for (const { element, timer } of retiring.values()) {
            clearTimeout(timer);
            element.remove();
        }
        retiring.clear();
    }
    function remove(id, element) {
        element.disabled = true;
        element.setAttribute('aria-hidden', 'true');
        element.classList.remove('universe-enter');
        if (!motion.canAnimate()) {
            element.remove();
            return;
        }
        element.classList.add('universe-exit');
        const timer = setTimeout(() => {
            element.remove();
            retiring.delete(id);
        }, 185);
        retiring.set(id, { element, timer });
    }

    function createNode(node) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'universe-node';
        if (motion.canAnimate()) button.classList.add('universe-enter');
        button.dataset.universeNode = node.id;
        button.dataset.appearance = node.appearance;
        button.style.left = `${node.x / space.width * 100}%`;
        button.style.top = `${node.y / space.height * 100}%`;
        button.innerHTML = `<svg viewBox="-26 -26 52 52" aria-hidden="true">${glyphs[node.appearance] ?? glyphs.satellite}</svg>
            <span aria-hidden="true"></span>`;
        nodes.append(button);
        return button;
    }

    function render(graph, label, locale) {
        const nextSignature = JSON.stringify([locale, graph.nodes.map(node => node.id), graph.edges]);
        if (nextSignature === signature) return;
        signature = nextSignature;
        rtl = locale === 'ar';
        scene = buildUniverseScene(graph);
        hint.textContent = label('universeHint');
        home.textContent = label('universeHome');
        nodes.setAttribute('aria-label', label('universe'));
        const alivePaths = new Set(scene.channels.map(edge => edge.id));
        for (const [id, element] of paths) {
            if (alivePaths.has(id)) continue;
            element.remove();
            paths.delete(id);
        }
        const aliveNodes = new Set(scene.nodes.map(node => node.id));
        for (const [id, element] of active) {
            if (aliveNodes.has(id)) continue;
            remove(id, element);
            active.delete(id);
        }
        for (const edge of scene.channels) {
            if (paths.has(edge.id)) continue;
            const path = document.createElementNS(ns, 'path');
            path.setAttribute('d', edge.path);
            if (motion.canAnimate()) path.classList.add('universe-enter');
            channels.append(path);
            paths.set(edge.id, path);
        }
        for (const node of scene.nodes) {
            const previous = retiring.get(node.id);
            if (previous) {
                clearTimeout(previous.timer);
                previous.element.remove();
                retiring.delete(node.id);
            }
            const element = active.get(node.id) ?? createNode(node);
            active.set(node.id, element);
            const name = label(node.id === 'browser' ? 'universeCore' : node.id);
            element.setAttribute('aria-label', name);
            element.querySelector('span').textContent = name;
        }
    }

    function updateSelection(id, focus) {
        for (const [key, button] of active) {
            if (button.tabIndex !== (key === id ? 0 : -1)) button.tabIndex = key === id ? 0 : -1;
            if (button.getAttribute('aria-pressed') !== String(key === id)) button.setAttribute('aria-pressed', String(key === id));
        }
        if (focus) active.get(id)?.focus();
    }
    nodes.addEventListener('click', event => {
        const id = event.target.closest('[data-universe-node]')?.dataset.universeNode;
        if (active.has(id)) selectNode(id, true);
    }, options);
    nodes.addEventListener('keydown', event => {
        const id = event.target.dataset.universeNode;
        if (!active.has(id)) return;
        const target = universeKeyTarget(scene.nodes, id, event.key, rtl);
        if (target) {
            event.preventDefault();
            selectNode(target, true);
        }
    }, options);
    home.addEventListener('click', () => selectNode('browser', true), options);
    return {
        panel,
        details: panel.querySelector('.universe-details'),
        render,
        updateSelection,
        hide() {
            motion.suspend();
        },
        destroy() {
            events.abort();
            motion.destroy();
            clearRetiring();
            panel.remove();
        }
    };
}
