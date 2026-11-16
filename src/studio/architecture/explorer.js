import { modelApiWorkload } from '../capacity/api-workload.js';
import { modelQueueCapacity } from '../capacity/queue.js';
import { modelStorageGrowth } from '../capacity/storage.js';
import { capacityCopy } from '../capacity/copy.js';
import { translations } from '../preview-templates.js';
import { architectureCopy } from './copy.js';
import { buildArchitectureGraph, resolveNodeSelection } from './graph.js';
import { layoutArchitecture } from './layout.js';
import { mountUniverse } from '../universe/view.js';
import { creationCopy } from '../universe/challenge-copy.js';
import './explorer.css';

const ns = 'http://www.w3.org/2000/svg';
function svg(tag, attributes = {}) {
    const element = document.createElementNS(ns, tag);
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    return element;
}

export function mountArchitectureExplorer(canvas, preview, store) {
    const switcher = document.createElement('div');
    switcher.className = 'architecture-switch';
    switcher.setAttribute('role', 'group');
    switcher.innerHTML = Array.from({ length: 3 }, () => '<button type="button" aria-pressed="false"></button>').join('');
    const [previewButton, architectureButton, universeButton] = switcher.children;
    previewButton.setAttribute('aria-pressed', 'true');
    const explorer = document.createElement('div');
    explorer.id = 'studio-architecture-panel';
    explorer.className = 'architecture-explorer';
    explorer.hidden = true;
    explorer.innerHTML = `<p class="architecture-hint"></p><div class="architecture-grid">
        <div class="architecture-scroll" tabindex="0" role="region"></div><section class="architecture-inspector"></section>
        </div><p class="architecture-legend"></p><details class="architecture-outline"><summary></summary><div></div></details>`;
    preview.before(switcher);
    canvas.append(explorer);
    const hint = explorer.querySelector('.architecture-hint');
    const inspector = explorer.querySelector('.architecture-inspector');
    const diagramGrid = inspector.parentElement;
    const universe = mountUniverse(canvas, (id, focus) => {
        selection = id;
        updateSelection(focus);
    }, () => switchView('preview', true));
    preview.id = 'studio-preview-panel';
    universe.panel.id = 'studio-universe-panel';
    previewButton.setAttribute('aria-controls', preview.id);
    architectureButton.setAttribute('aria-controls', explorer.id);
    universeButton.setAttribute('aria-controls', universe.panel.id);
    const scroll = explorer.querySelector('.architecture-scroll');
    const legend = explorer.querySelector('.architecture-legend');
    const outline = explorer.querySelector('.architecture-outline');
    const diagram = svg('svg', { role: 'group' });
    scroll.append(diagram);
    const defs = svg('defs');
    const marker = svg('marker', { id: 'studio-architecture-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto' });
    marker.append(svg('path', { d: 'M0 0 L10 5 L0 10z', class: 'architecture-arrow' }));
    defs.append(marker);
    const edgeLayer = svg('g', { 'aria-hidden': 'true' });
    const nodeLayer = svg('g');
    diagram.append(defs, edgeLayer, nodeLayer);

    const nodeMap = new Map(), edgeMap = new Map();
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const compact = matchMedia('(max-width: 600px)');
    const events = new AbortController();
    const listen = (root, name, handler) => root.addEventListener(name, handler, { signal: events.signal });
    let graph;
    let graphState;
    let view = 'preview';
    let selection;
    let locale = 'en';
    let outlineSignature = '';
    let inspectorSignature = '';
    let activeLayout;

    const label = key => (creationCopy[key] ?? architectureCopy[key] ?? capacityCopy[key] ?? translations[key])?.[locale === 'ar' ? 1 : 0] ?? key;
    const metricLabel = key => label(key === 'audit' ? 'auditStorage' : key);
    const setText = (node, value) => { if (node.textContent !== value) node.textContent = value; };
    function format(metric) {
        if (metric.value === null) return label('unavailable');
        const number = new Intl.NumberFormat(locale, { maximumSignificantDigits: 7 });
        if (metric.unit === 'fraction') return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }).format(metric.value);
        if (metric.unit === 'bytes/month') return number.format(metric.value) + ' B / ' + (locale === 'ar' ? 'شهر' : 'month');
        return number.format(metric.value) + ' ' + metric.unit;
    }

    function revive(record) {
        clearTimeout(record.timer);
        record.timer = undefined;
        record.element.classList.remove('is-exiting');
    }

    function retireMissing(records, alive) {
        for (const [id, record] of records) {
            if (alive.has(id) || record.timer) continue;
            const remove = () => {
                record.element.remove();
                records.delete(id);
                resizeDiagram();
            };
            record.element.classList.add('is-exiting');
            record.element.setAttribute('aria-hidden', 'true');
            record.element.setAttribute('tabindex', '-1');
            if (motion.matches) remove();
            else record.timer = setTimeout(remove, 190);
        }
    }

    function resizeDiagram() {
        if (!activeLayout) return;
        const bottom = Math.max(activeLayout.height,
            ...[...nodeMap.values()].filter(record => record.timer).map(record => record.bottom + 14));
        diagram.setAttribute('viewBox', `0 0 ${activeLayout.width} ${bottom}`);
    }

    function createNode(id, width, height) {
        const element = svg('g', { 'data-arch-node': id, role: 'button', class: 'architecture-node' });
        const box = svg('rect', { width, height, rx: 9 });
        const name = svg('text', { y: 22, class: 'architecture-node-title' });
        const relationship = svg('text', { y: 42, class: 'architecture-node-flow' });
        element.append(box, name, relationship);
        // SVG elements are grouped by key to retain focus throughout updates.
        nodeLayer.append(element);
        return { element, name, relationship };
    }

    function renderDetails() {
        const node = graph.nodes.find(item => item.id === selection);
        if (!node) return;
        const title = view === 'universe' && node.id === 'browser' ? label('universeCore') : label(node.label);
        const signature = JSON.stringify([locale, title, node, graph.boundaries]);
        if (signature === inspectorSignature) return;
        inspectorSignature = signature;
        const metrics = Object.entries(node.metrics);
        const boundary = graph.boundaries.find(item => item.nodes.includes(node.id));
        const numbers = new Intl.NumberFormat(locale);
        const percentages = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 });
        const assumptionValue = (key, value) => {
            if (typeof value === 'string') return label(value);
            if (typeof value === 'boolean') return label(value ? 'yes' : 'no');
            return ['fraction', 'target'].includes(key) ? percentages.format(value) : numbers.format(value);
        };
        const assumptionText = metric => Object.entries(metric.assumptions ?? {})
            .filter(([, value]) => value !== null)
            .map(([key, value]) => `${label(key)}: ${assumptionValue(key, value)}`).join(' · ');
        inspector.innerHTML = `<div class="architecture-inspector-label">${label('selected')}</div>
            <h4 aria-live="polite">${title}</h4>
            <p>${label(node.description)}</p>
            ${boundary ? `<p class="architecture-context">${label('boundaries')}: ${label(boundary.id)}</p>` : ''}
            ${node.context.length ? `<p class="architecture-context">${label('setting')}: ${node.context.map(label).join(' · ')}</p>` : ''}
            ${metrics.length ? `<h5>${label('metrics')}</h5><dl>${metrics.map(([key, metric]) => `<div class="architecture-metric" data-status="${
                metric.status === 'warning' && metric.warnings.every(key => ['illustrative-burst', 'theoretical-capacity'].includes(key))
                    ? 'ok' : metric.status}">
                <dt>${metricLabel(key)}</dt><dd><bdi>${format(metric)}</bdi>
                ${metric.warnings.map(warning => `<small>${label(warning)}</small>`).join('')}
                ${assumptionText(metric) ? `<small>${label('assumptions')}: ${assumptionText(metric)}</small>` : ''}</dd>
                </div>`).join('')}</dl>` : ''}`;
    }

    function updateSelection(focus = false) {
        if (view === 'universe') {
            universe.updateSelection(selection, focus);
            renderDetails();
            return;
        }
        for (const node of graph.nodes) {
            const element = nodeMap.get(node.id)?.element;
            element?.setAttribute('aria-pressed', String(node.id === selection));
            element?.setAttribute('tabindex', node.id === selection ? '0' : '-1');
        }
        outline.querySelectorAll('[data-arch-select]').forEach(button => {
            button.setAttribute('aria-pressed', String(button.dataset.archSelect === selection));
        });
        renderDetails();
        if (focus) nodeMap.get(selection)?.element.focus();
    }

    function render() {
        if (canvas.closest('[data-studio-host][hidden]')) return;
        locale = document.documentElement.lang.startsWith('ar') ? 'ar' : 'en';
        setText(previewButton, label('preview'));
        setText(architectureButton, label('architecture'));
        setText(universeButton, label('universe'));
        switcher.setAttribute('aria-label', label('view'));
        if (view === 'preview') return;

        const state = store.getState();
        if (graphState !== state) {
            graph = buildArchitectureGraph(state, {
                api: modelApiWorkload(state.usage, state.capacity),
                queue: modelQueueCapacity(state.usage, state.capacity),
                storage: modelStorageGrowth(state.usage, state.engineering, state.capacity)
            });
            graphState = state;
        }
        selection = resolveNodeSelection(graph, selection);
        if (view === 'universe') {
            const focused = document.activeElement?.dataset?.universeNode;
            universe.render(graph, state, label, locale, key => translations[key]?.[locale === 'ar' ? 1 : 0] ?? label(key));
            updateSelection(Boolean(focused && focused !== selection));
            return;
        }
        const focusedNode = document.activeElement?.dataset?.archNode;
        const rtl = locale === 'ar';
        const layout = layoutArchitecture(graph, rtl, compact.matches);
        activeLayout = layout;
        const incoming = new Map(graph.edges.map(edge => [edge.to, edge]));
        diagram.setAttribute('aria-label', label('diagram'));
        scroll.setAttribute('aria-label', label('diagram'));
        setText(hint, label('scrollHint'));
        setText(legend, label('legend'));
        setText(outline.querySelector('summary'), label('outline'));

        retireMissing(nodeMap, new Set(graph.nodes.map(node => node.id)));
        retireMissing(edgeMap, new Set(graph.edges.map(edge => edge.id)));
        for (const edge of layout.edges) {
            let record = edgeMap.get(edge.id);
            if (!record) {
                const element = svg('path', { class: 'architecture-edge', 'marker-end': 'url(#studio-architecture-arrow)' });
                edgeLayer.append(element);
                record = { element };
                edgeMap.set(edge.id, record);
            }
            revive(record);
            record.element.setAttribute('d', edge.path);
        }
        for (const node of graph.nodes) {
            const position = layout.positions.get(node.id);
            let record = nodeMap.get(node.id);
            if (!record) {
                record = createNode(node.id, position.width, position.height);
                nodeMap.set(node.id, record);
            }
            record.element.style.transform = `translate(${position.x}px, ${position.y}px)`;
            record.bottom = position.y + position.height;
            revive(record);
            record.element.removeAttribute('aria-hidden');
            record.element.dataset.kind = node.type;
            record.element.dataset.status = node.status;
            const relationship = incoming.get(node.id);
            const statusLabel = node.status === 'unavailable' ? label('unavailable')
                : node.status === 'warning' ? (node.warnings.map(label).join(' ')) : '';
            record.element.setAttribute('aria-label', [label(node.label), relationship && label(relationship.relationship), statusLabel].filter(Boolean).join(' · '));
            for (const text of [record.name, record.relationship]) {
                text.setAttribute('direction', rtl ? 'rtl' : 'ltr');
                text.setAttribute('x', rtl ? position.width - 13 : 13);
            }
            setText(record.name, label(node.label));
            setText(record.relationship, relationship ? label(relationship.relationship) : label(graph.template));
        }
        resizeDiagram();

        const signature = JSON.stringify([locale, graph.template, graph.edges, graph.boundaries, graph.annotations]);
        const outlineFocusedNode = document.activeElement?.dataset?.archSelect;
        if (signature !== outlineSignature) {
            outlineSignature = signature;
            const buttons = graph.nodes.map(node => `<li><button type="button" data-arch-select="${node.id}">${label(node.label)}</button>
                ${incoming.has(node.id) ? `<span> · ${label(incoming.get(node.id).from)} → ${label(incoming.get(node.id).relationship)}</span>` : ''}</li>`).join('');
            outline.querySelector('div').innerHTML = `<p>${label('connections')}</p><ol>${buttons}</ol>
                <p>${label('boundaries')}</p><ul>${graph.boundaries.map(boundary =>
                    `<li>${label(boundary.id)}: ${boundary.nodes.map(label).join(', ')}</li>`).join('')}
                ${graph.annotations.map(key => `<li>${label(key)}</li>`).join('')}</ul>`;
        }
        updateSelection(Boolean(focusedNode && !graph.nodes.some(node => node.id === focusedNode)));
        if (outlineFocusedNode && !outline.contains(document.activeElement)) {
            outline.querySelector(`[data-arch-select="${resolveNodeSelection(graph, outlineFocusedNode)}"]`)?.focus();
        }
    }

    function switchView(next, focus = false) {
        if (view === next) return;
        if (view === 'universe') universe.hide();
        view = next;
        preview.hidden = next !== 'preview';
        explorer.hidden = next !== 'architecture';
        universe.panel.hidden = next !== 'universe';
        if (next === 'universe') universe.details.append(inspector);
        if (next === 'architecture') diagramGrid.append(inspector);
        for (const [button, name] of [[previewButton, 'preview'], [architectureButton, 'architecture'], [universeButton, 'universe']]) {
            button.setAttribute('aria-pressed', String(next === name));
            if (focus && next === name) button.focus();
        }
        render();
    }

    listen(previewButton, 'click', () => switchView('preview'));
    listen(canvas.closest('[data-studio-host]'), 'studio-visibility', () => {
        if (canvas.closest('[data-studio-host][hidden]')) universe.hide();
        else render();
    });
    listen(architectureButton, 'click', () => switchView('architecture'));
    listen(universeButton, 'click', () => switchView('universe'));
    listen(compact, 'change', () => { if (view === 'architecture') render(); });
    listen(diagram, 'click', event => {
        const id = event.target.closest('[data-arch-node]')?.dataset.archNode;
        if (id && graph.nodes.some(node => node.id === id)) { selection = id; updateSelection(true); }
    });
    listen(diagram, 'keydown', event => {
        const id = event.target.dataset.archNode;
        if (!id) return;
        const index = graph.nodes.findIndex(node => node.id === id);
        let next = index;
        if (['ArrowDown','ArrowRight'].includes(event.key)) next = Math.min(graph.nodes.length - 1, index + 1);
        else if (['ArrowUp','ArrowLeft'].includes(event.key)) next = Math.max(0, index - 1);
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = graph.nodes.length - 1;
        else if (!['Enter',' '].includes(event.key)) return;
        event.preventDefault();
        selection = graph.nodes[next].id;
        updateSelection(true);
    });
    listen(outline, 'click', event => {
        const id = event.target.closest('[data-arch-select]')?.dataset.archSelect;
        if (id) { selection = id; updateSelection(); }
    });

    const unsubscribe = store.subscribe((next, previous) => {
        const changed = (group, keys = Object.keys(next[group])) => keys.some(key => next[group][key] !== previous[group][key]);
        if (view !== 'preview' && (next.applicationType !== previous.applicationType ||
            changed('previewFeatures') || changed('engineering') || changed('usage') || changed('capacity') ||
            changed('features', ['ai']))) render();
    });
    const observer = new MutationObserver(render);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    render();
    return () => {
        unsubscribe();
        observer.disconnect();
        events.abort();
        for (const record of [...nodeMap.values(), ...edgeMap.values()]) clearTimeout(record.timer);
        universe.destroy();
        switcher.remove();
        explorer.remove();
    };
}
