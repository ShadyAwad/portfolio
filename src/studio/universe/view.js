import { space } from './layout.js';
import { buildUniverseScene, universeKeyTarget } from './scene.js';
import { mountUniverseMotion } from './motion.js';
import { derivePreview } from '../preview-model.js';
import { mountChallenge } from './challenge-view.js';
import { stages, stageVisibility } from './challenge-model.js';
import './universe.css';

const glyphs = {
    core: `<circle r="19"/><ellipse rx="23" ry="9" transform="rotate(-35)"/>
        <g data-core-mark="saas"><path d="M-9 8V0 M0 8V-8 M9 8V-4"/></g>
        <g data-core-mark="ecommerce"><path d="M-9 -4h18v13H-9z M-4 -4v-3a4 4 0 0 1 8 0v3"/></g>
        <g data-core-mark="landing"><path d="M0 -11 3 -3 11 0 3 3 0 11 -3 3 -11 0 -3 -3z"/></g>
        <g data-core-mark="internal-tool"><path d="M-9 -8h18V8H-9z M-9 -3h18 M-9 3h18 M-3 -3V8"/></g>`,
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

export function mountUniverse(canvas, selectNode, openPreview) {
    const panel = document.createElement('section');
    panel.className = 'universe-panel';
    panel.hidden = true;
    panel.innerHTML = `<div class="universe-phases" role="group">${stages.map(stage =>
        `<button type="button" data-phase="${stage}" aria-controls="universe-scene"></button>`).join('')}</div>
        <div class="universe-stage" id="universe-scene">
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
        <div class="universe-heading"><p></p><button type="button"></button></div>
        <div class="universe-summary">
            <h4></h4><p></p><ul></ul><button type="button"></button>
        </div>
        <div class="universe-challenge" hidden></div>
        <p class="universe-project-note" hidden></p>
        <div class="universe-details"></div>`;
    canvas.append(panel);

    const stage = panel.querySelector('.universe-stage');
    const phaseNav = panel.querySelector('.universe-phases');
    const summary = panel.querySelector('.universe-summary');
    const details = panel.querySelector('.universe-details');
    const challengePanel = panel.querySelector('.universe-challenge');
    const note = panel.querySelector('.universe-project-note');
    const nodes = panel.querySelector('.universe-nodes');
    const channels = panel.querySelector('.universe-channels');
    const home = panel.querySelector('.universe-heading button');
    const hint = panel.querySelector('.universe-heading p');
    const events = new AbortController();
    const options = { signal: events.signal };
    const active = new Map();
    const paths = new Map();
    const retiring = new Map();
    const motion = mountUniverseMotion(stage, clearRetiring);
    let scene;
    let signature;
    let rtl;
    let phase = 'create';
    let selection = 'browser';
    let current;
    let summarySignature;
    let feedbackNode;
    const setText = (element, value) => { if (element.textContent !== value) element.textContent = value; };
    const challenge = mountChallenge(challengePanel, showFeedback);

    function showFeedback(feedback) {
        if (feedbackNode && feedbackNode !== feedback?.node) {
            const previous = active.get(feedbackNode);
            previous?.removeAttribute('data-simulation');
            previous?.removeAttribute('aria-describedby');
        }
        feedbackNode = feedback?.node;
        const node = active.get(feedbackNode);
        if (node && node.dataset.simulation !== feedback.status) {
            node.dataset.simulation = feedback.status;
            node.setAttribute('aria-describedby', 'universe-challenge-status');
        }
        if (!feedback) {
            stage.removeAttribute('data-scenario');
            stage.style.removeProperty('--universe-activity');
            return;
        }
        if (stage.dataset.scenario !== feedback.scenario) stage.dataset.scenario = feedback.scenario;
        // The glow is a decorative, monotonic scale. The numbers remain model outputs.
        const burst = feedback.metrics.burstRps?.value ?? 0;
        const intensity = String(Math.min(.92, .22 + Math.log10(1 + burst) * .12));
        if (stage.style.getPropertyValue('--universe-activity') !== intensity) stage.style.setProperty('--universe-activity', intensity);
    }

    function renderPhase() {
        const { graph, state, label, locale } = current;
        const visibility = stageVisibility(phase);
        if (panel.dataset.phase !== phase) panel.dataset.phase = phase;
        phaseNav.setAttribute('aria-label', label('creationStages'));
        for (const button of phaseNav.children) {
            setText(button, label(button.dataset.phase));
            button.setAttribute('aria-pressed', String(phase === button.dataset.phase));
        }
        panel.querySelector('.universe-heading').hidden = !visibility.graph;
        details.hidden = !visibility.graph;
        summary.hidden = !visibility.summary;
        challengePanel.hidden = !visibility.controls;
        note.hidden = !visibility.controls;
        if (visibility.controls) {
            setText(note, label('projectInspector'));
            challenge.render(state, graph, label, locale);
        } else if (feedbackNode) showFeedback(null);
        const { template, capabilities, roles } = derivePreview(state);
        const enabled = [...Object.keys(capabilities).filter(key => capabilities[key]), ...(roles ? ['roles'] : [])];
        const signature = JSON.stringify([template, enabled, locale]);
        if (signature !== summarySignature) {
            summarySignature = signature;
            stage.dataset.template = template;
            stage.toggleAttribute('data-capabilities', enabled.length > 0);
            setText(summary.querySelector('h4'), label(template));
            setText(summary.querySelector('p'), label(enabled.length ? 'enabledCapabilities' : 'noCapabilities'));
            setText(summary.querySelector('button'), label('openPreview'));
            summary.querySelector('ul').replaceChildren(...enabled.map(key => {
                const item = document.createElement('li');
                item.textContent = current.capabilityLabel(key);
                return item;
            }));
        }
    }

    function changePhase(next, focus = false) {
        const previous = phase;
        phase = stageVisibility(phase, next).stage;
        if (phase === previous) return;
        const reveal = previous === 'create' && motion.canAnimate();
        if (phase === 'create') motion.suspend();
        renderPhase();
        updateSelection(selection);
        if (reveal) {
            for (const [id, button] of active) if (id !== 'browser') button.classList.add('universe-enter');
            for (const path of paths.values()) path.classList.add('universe-enter');
        }
        if (focus) phaseNav.querySelector(`[data-phase="${phase}"]`).focus();
    }

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
        if (phase !== 'create' && motion.canAnimate()) button.classList.add('universe-enter');
        button.dataset.universeNode = node.id;
        button.dataset.appearance = node.appearance;
        button.style.left = `${node.x / space.width * 100}%`;
        button.style.top = `${node.y / space.height * 100}%`;
        button.innerHTML = `<svg viewBox="-26 -26 52 52" aria-hidden="true">${glyphs[node.appearance] ?? glyphs.satellite}</svg>
            <span aria-hidden="true"></span>`;
        nodes.append(button);
        return button;
    }

    function render(graph, state, label, locale, capabilityLabel = label) {
        current = { graph, state, label, locale, capabilityLabel };
        const nextSignature = JSON.stringify([locale, graph.nodes.map(node => node.id), graph.edges]);
        if (nextSignature === signature) {
            renderPhase();
            return;
        }
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
            path.dataset.from = edge.from;
            path.dataset.to = edge.to;
            if (phase !== 'create' && motion.canAnimate()) path.classList.add('universe-enter');
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
        renderPhase();
    }

    function updateSelection(id, focus) {
        selection = id;
        const selected = phase === 'create' ? 'browser' : id;
        for (const [key, button] of active) {
            if (button.tabIndex !== (key === selected ? 0 : -1)) button.tabIndex = key === selected ? 0 : -1;
            if (phase === 'create' && key === 'browser') button.removeAttribute('aria-pressed');
            else if (button.getAttribute('aria-pressed') !== String(key === selected)) button.setAttribute('aria-pressed', String(key === selected));
        }
        const core = active.get('browser');
        core?.setAttribute('aria-label', current.label(phase === 'create' ? 'architect' : 'universeCore'));
        if (focus) active.get(selected)?.focus();
    }
    phaseNav.addEventListener('click', event => {
        const button = event.target.closest('[data-phase]');
        if (button) changePhase(button.dataset.phase);
    }, options);
    summary.querySelector('button').addEventListener('click', openPreview, options);
    nodes.addEventListener('click', event => {
        const id = event.target.closest('[data-universe-node]')?.dataset.universeNode;
        if (phase === 'create' && id === 'browser') changePhase('architect', true);
        else if (active.has(id)) selectNode(id, true);
    }, options);
    nodes.addEventListener('keydown', event => {
        const id = event.target.dataset.universeNode;
        if (phase === 'create' || !active.has(id)) return;
        const target = universeKeyTarget(scene.nodes, id, event.key, rtl);
        if (target) {
            event.preventDefault();
            selectNode(target, true);
        }
    }, options);
    home.addEventListener('click', () => selectNode('browser', true), options);
    return {
        panel,
        details,
        render,
        updateSelection,
        hide() {
            motion.suspend();
        },
        destroy() {
            events.abort();
            challenge.destroy();
            motion.destroy();
            clearRetiring();
            panel.remove();
        }
    };
}
