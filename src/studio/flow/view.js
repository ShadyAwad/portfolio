import { flowCopy } from './copy.js';
import { flowQueue, initialPlayback, playback, resolveFlow } from './model.js';
import { mountWorkspace } from './workspace.js';
import { journeyOutcomes } from './request-layout.js';
import './flow.css';

const labels = ['play', 'back', 'step', 'reset'];

export function mountFlow(canvas) {
    const panel = document.createElement('section');
    panel.className = 'flow-panel';
    panel.id = 'studio-flow-panel';
    panel.hidden = true;
    panel.innerHTML = `<div class="flow-toolbar">
        <label><span data-flow-label="pick"></span><select data-flow-scenario></select></label>
        <div class="flow-controls">${labels.map(key =>
            `<button type="button" data-playback="${key}" data-flow-label="${key === 'step' ? 'next' : key}"></button>`).join('')}</div>
        </div><div class="flow-composition">
            <div class="flow-scene"><h4 data-flow-label="sequence"></h4><div class="workspace-interaction" hidden></div>
            <div class="workspace-timeline" hidden><label for="workspace-scrubber" data-flow-label="workspaceTimeline"></label>
                <input id="workspace-scrubber" type="range" min="0" max="0" value="0" step="1"></div><div class="flow-route">
                <ol></ol><i class="flow-packet" aria-hidden="true"></i>
            </div><p class="flow-reference" data-flow-label="reference" hidden></p></div>
            <div class="flow-side">
                <div class="flow-card flow-current" role="status" aria-atomic="true">
                    <p class="flow-progress"></p><h4></h4><strong></strong><p class="flow-explanation"></p>
                    <p class="flow-engineering"></p></div>
                <div class="flow-card flow-load" hidden>
                    <label><span data-flow-label="stress"></span><select data-flow-load>
                        ${['normal','elevated','saturated','overloaded'].map(key => `<option value="${key}" data-flow-label="${key}"></option>`).join('')}
                    </select></label>
                    <p class="flow-load-status" role="status"></p>
                    <div class="flow-meter" aria-hidden="true"><i></i></div>
                    <dl></dl><p data-flow-label="workloadNote"></p><p data-flow-label="backgroundNote"></p>
                </div>
            </div>
        </div>`;
    canvas.append(panel);
    const q = selector => panel.querySelector(selector);
    const scenarioInput = q('[data-flow-scenario]');
    const loadInput = q('[data-flow-load]');
    const route = q('ol');
    const packet = q('.flow-packet');
    const scrubber = q('#workspace-scrubber');
    const controls = [...panel.querySelectorAll('[data-playback]')];
    const events = new AbortController();
    const listen = (target, type, handler) => target.addEventListener(type, handler, { signal: events.signal });
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const observer = new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) hide(); });
    observer.observe(panel);
    let state, journey, language, label, signature, animation, timer;
    let progress = initialPlayback();
    let track = [];
    let workspace, interactive = false;
    let outcomeListener;
    const text = (element, value) => { if (element.textContent !== value) element.textContent = value; };
    const local = pair => pair[language === 'ar' ? 1 : 0];
    const copy = key => flowCopy[key] ? local(flowCopy[key]) : label(key);

    function renderPlayback() {
        const step = journey.steps[progress.index];
        const numbers = new Intl.NumberFormat(language);
        const index = numbers.format(progress.index + 1);
        const count = numbers.format(journey.steps.length);
        const current = language === 'ar' ? `الخطوة ${index} من ${count}` : `Step ${index} of ${count}`;
        text(q('.flow-progress'), current);
        if (interactive) {
            scrubber.value = progress.index;
            scrubber.setAttribute('aria-valuetext', current + ' · ' + label(step.component.label));
            scrubber.style.setProperty('--timeline-progress', (progress.index / (journey.steps.length - 1) * 100) + '%');
        }
        text(q('.flow-current h4'), local(journey.scenario.title));
        text(q('.flow-current strong'), label(step.component.label));
        text(q('.flow-explanation'), local(step.text));
        text(q('.flow-engineering'), copy('detail') + ' · ' + label(step.component.description));
        track.forEach((button, i) => {
            if (i === progress.index) button.setAttribute('aria-current', 'step');
            else button.removeAttribute('aria-current');
        });
        for (const button of controls) {
            const action = button.dataset.playback;
            const disabled = (action === 'step' && progress.index === track.length - 1) ||
                (action === 'back' && progress.index === 0);
            button.setAttribute('aria-disabled', String(disabled));
            if (action === 'play') {
                text(button, copy(progress.playing ? 'pause' : 'play'));
                button.setAttribute('aria-pressed', String(progress.playing));
            }
        }
        outcomeListener?.(journeyOutcomes(journey.steps, progress.index));
    }

    function renderLoad() {
        const card = q('.flow-load');
        card.hidden = !journey.queue;
        if (card.hidden) {
            delete panel.dataset.loadStatus;
            return;
        }
        const { metrics, status } = flowQueue(state, loadInput.value);
        panel.dataset.loadStatus = status;
        const percent = new Intl.NumberFormat(language, { style: 'percent', maximumFractionDigits: 1 });
        const number = new Intl.NumberFormat(language);
        const value = metric => metric.value === null ? label('unavailable') :
            metric.unit === 'fraction' ? percent.format(metric.value) : number.format(metric.value) + ' ' + metric.unit;
        text(q('.flow-load-status'), copy(status) + ' · ' + value(metrics.utilization));
        q('.flow-meter i').style.inlineSize = Math.min(100, (metrics.utilization.value ?? 0) * 100) + '%';
        const rows = [['arrival', metrics.arrival], ['capacity', metrics.capacity], ['backlog', metrics.backlog]];
        q('.flow-load dl').replaceChildren(...rows.map(([key, metric]) => {
            const row = document.createElement('div');
            const name = document.createElement('dt');
            const figure = document.createElement('dd');
            const numeric = document.createElement('bdi');
            name.textContent = label(key);
            numeric.textContent = value(metric);
            figure.append(numeric);
            row.append(name, figure);
            return row;
        }));
    }

    function clearEffects() {
        clearTimeout(timer);
        animation?.cancel();
        animation = undefined;
        workspace?.stop();
    }

    function commitWorkspace(next, animate = false) {
        progress = next;
        workspace.sync(progress.index, animate);
        renderPlayback();
        if (progress.playing) timer = setTimeout(() => change('tick'), motion.matches ? 950 : 480);
    }

    function changeWorkspace(action, next, previous, origin) {
        if (action === 'play') {
            progress = next;
            if (!origin) workspace.sync(progress.index);
            renderPlayback();
            change('tick', undefined, origin);
        } else if (['tick', 'step', 'back'].includes(action) && next.index !== previous) {
            workspace.move(previous, next.index, origin, () => commitWorkspace(next, true));
        } else {
            commitWorkspace(next);
        }
    }

    function change(action, index, origin) {
        clearEffects();
        const previous = progress.index;
        const next = action === 'select' ? { index, playing: false } :
            playback(progress, action, journey.steps.length);
        if (interactive) {
            changeWorkspace(action, next, previous, origin);
            return;
        }
        progress = next;
        renderPlayback();
        if (previous !== progress.index && !motion.matches && !panel.closest('[hidden]') && !document.hidden) {
            const y = node => node.offsetTop + node.offsetHeight / 2;
            const branch = journey.steps[progress.index].branchFrom;
            const from = progress.index === previous + 1 && branch ? journey.steps.findIndex(step => step.node === branch) : previous;
            animation = packet.animate([
                { opacity: 0, transform: `translateY(${y(track[from])}px)` },
                { opacity: 1, offset: .2 },
                { opacity: 1, offset: .8 },
                { opacity: 0, transform: `translateY(${y(track[progress.index])}px)` }
            ], { duration: 440, easing: 'ease-in-out' });
        }
        if (progress.playing) timer = setTimeout(() => change('tick'), 1350);
    }

    function render(graph, configuration, translate, locale, selection = journey?.id) {
        state = configuration;
        label = translate;
        language = locale;
        const next = resolveFlow(state, graph, selection);
        const structure = JSON.stringify([state.applicationType, next.id, next.steps.map(step => step.node)]);
        const changed = signature !== structure;
        const rebuild = changed || panel.lang !== locale;
        if (changed && outcomeListener) {
            outcomeListener(null);
            outcomeListener = undefined;
        }
        signature = structure;
        journey = next;
        panel.lang = locale;
        if (rebuild) {
            clearEffects();
            progress = changed ? initialPlayback() : playback(progress, 'pause', next.steps.length);
        }
        if (rebuild) {
            for (const element of panel.querySelectorAll('[data-flow-label]')) text(element, copy(element.dataset.flowLabel));
            scenarioInput.replaceChildren(...Object.entries(next.options).map(([key, scenario]) => new Option(local(scenario.title), key)));
            scenarioInput.value = next.id;
            track = next.steps.map((step, index) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.dataset.flowStep = index;
                button.dataset.component = step.node;
                button.dataset.kind = step.component.type;
                button.innerHTML = '<span class="flow-number"></span><span class="flow-copy"><strong></strong><span class="flow-example" hidden></span><small></small></span>';
                text(button.firstElementChild, new Intl.NumberFormat(locale).format(index + 1));
                text(button.querySelector('strong'), label(step.component.label));
                text(button.querySelector('small'), local(step.text));
                const row = document.createElement('li');
                row.append(button);
                return button;
            });
            route.replaceChildren(...track.map(button => button.parentElement));
        }
        const workspaceRoot = q('.workspace-interaction');
        interactive = Boolean(next.scenario.motion);
        workspaceRoot.hidden = !interactive;
        q('.workspace-timeline').hidden = !interactive;
        q('.flow-composition').toggleAttribute('data-workspace', interactive);
        if (interactive) {
            scrubber.max = next.steps.length - 1;
            workspace ??= mountWorkspace(workspaceRoot, {
                reduced: () => motion.matches,
                canDrag: () => !progress.playing && progress.index === 0,
                canLaunch: () => !progress.playing && (progress.index === 0 || progress.index === journey.steps.length - 1),
                launch: origin => change('play', undefined, origin)
            });
            workspace.configure(next.steps, next.scenario.motion, label, copy, progress.index,
                structure + locale + document.documentElement.dir);
        }
        q('.flow-reference').hidden = !next.steps.some(step => step.illustrative);
        track.forEach((button, index) => {
            const step = next.steps[index];
            button.toggleAttribute('data-reference', step.illustrative);
            const example = button.querySelector('.flow-example');
            example.hidden = !step.illustrative;
            if (step.illustrative) text(example, copy('illustrative'));
        });
        renderPlayback();
        renderLoad();
        latestGraph = graph;
    }

    let latestGraph;
    function hide() {
        if (!journey) return;
        if (progress.playing) change('pause');
        else {
            clearEffects();
            if (interactive) workspace.sync(progress.index);
        }
    }

    listen(scenarioInput, 'change', () => render(latestGraph, state, label, language, scenarioInput.value));
    listen(loadInput, 'change', renderLoad);
    listen(scrubber, 'pointerdown', hide);
    listen(scrubber, 'input', () => {
        if (interactive) change('select', scrubber.valueAsNumber);
    });
    listen(panel, 'click', event => {
        const button = event.target.closest('button');
        if (!button || button.getAttribute('aria-disabled') === 'true') return;
        const { playback: action, flowStep } = button.dataset;
        if (action === 'play' && (panel.closest('[hidden]') || document.hidden)) return;
        if (action) change(action === 'play' && progress.playing ? 'pause' : action);
        if (flowStep !== undefined) change('select', Number(flowStep));
    });
    listen(document, 'visibilitychange', () => { if (document.hidden) hide(); });
    listen(motion, 'change', () => {
        if (interactive) hide();
        else animation?.cancel();
    });
    return {
        panel, render, hide,
        prepare(listener) {
            outcomeListener = listener;
            change('reset');
        },
        detach() { outcomeListener = undefined; },
        focus() {
            scenarioInput.focus({ preventScroll: true });
            scenarioInput.scrollIntoView({ block: 'nearest', behavior: 'instant' });
        },
        destroy() {
            outcomeListener = undefined;
            hide();
            workspace?.destroy();
            observer.disconnect();
            events.abort();
            panel.remove();
        }
    };
}
