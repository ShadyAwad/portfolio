import { assumptionSchema, validAssumption } from './assumptions.js';
import { modelCapacity } from './index.js';
import { defaultEffortAssumptions } from './effort.js';
import { capacityCopy } from './copy.js';

const settings = {
    api: ['requestsPerUser','peakHourFraction','burstMultiplier'],
    queue: ['serviceSeconds','workerProcesses','slotsPerProcess','targetUtilization'],
    storage: ['recordBytes','auditRecords','auditBytes','uploadBytes','vectorCount','vectorDimensions','vectorElementBytes',
        'dbOverheadPercent','indexPercent','objectMetadataBytes','extraReplicas','backupCopies']
};

export function mountCapacityPanel(store) {
    const clip = document.querySelector('.configurator-clip');
    if (!clip) return () => {};
    let planner = document.getElementById('architecture-planner');
    const ownsPlanner = !planner;
    if (ownsPlanner) {
        planner = document.createElement('details');
        planner.id = 'architecture-planner';
        planner.className = 'capacity-panel capacity-fallback';
        planner.innerHTML = `<summary data-capacity-copy="planner"></summary><fieldset>
            <legend data-capacity-copy="workload"></legend>
            ${['users','requests','jobs','notifications','records','uploads'].map(key => `<label>
                <span data-capacity-copy="${key}"></span><input name="${key}" type="number" min="0" max="1000000000" step="1"></label>`).join('')}
            ${['audit','semantic'].map(key => `<label><input name="${key}" type="checkbox"> <span data-capacity-copy="${key}"></span></label>`).join('')}
        </fieldset>`;
        clip.append(planner);
    }

    const panel = document.createElement('div');
    panel.className = 'capacity-panel';
    panel.innerHTML = `<h4 data-capacity-copy="heading"></h4><p data-capacity-copy="intro"></p>
        <details><summary data-capacity-copy="assumptions"></summary>
        ${Object.entries(settings).map(([group, keys]) => `<fieldset><legend data-capacity-copy="${group}"></legend>
            ${keys.map(key => {
                const [min, max, , integer] = assumptionSchema[key];
                return `<label><span data-capacity-copy="${key}"></span><input type="number" name="capacity-${key}"
                    data-capacity-input="${key}" min="${min}" max="${max}" step="${integer ? 1 : 'any'}"></label>`;
            }).join('')}</fieldset>`).join('')}
        </details><div class="capacity-results"></div>`;
    planner.append(panel);
    const output = panel.querySelector('.capacity-results');
    const inputs = [...panel.querySelectorAll('[data-capacity-input]')];
    const events = new AbortController();
    let editing;
    let locale;
    const groups = new Map();
    function setText(node, value) {
        if (node.textContent === value) return;
        if (node.childNodes.length === 1 && node.firstChild.nodeType === Node.TEXT_NODE) {
            node.firstChild.data = value;
        } else {
            node.textContent = value;
        }
    }
    const renderedMarkup = new WeakMap();
    function setMarkup(node, markup) {
        if (renderedMarkup.get(node) === markup) return;
        node.innerHTML = markup;
        renderedMarkup.set(node, markup);
    }

    const label = key => capacityCopy[key]?.[locale === 'ar' ? 1 : 0] ?? key;

    function render(state) {
        if (!planner.open || planner.closest('[data-studio-host][hidden]')) return;
        const nextLocale = document.documentElement.lang.startsWith('ar') ? 'ar' : 'en';
        if (locale !== nextLocale) {
            locale = nextLocale;
            planner.querySelectorAll('[data-capacity-copy]').forEach(node => {
                node.textContent = label(node.dataset.capacityCopy);
            });
        }
        for (const input of inputs) {
            if (input !== editing) {
                input.value = state.capacity[input.dataset.capacityInput] ?? '';
                input.removeAttribute('aria-invalid');
            }
        }

        const counts = new Intl.NumberFormat(locale, { maximumFractionDigits: 7 });
        const scientific = new Intl.NumberFormat(locale, { notation: 'scientific', maximumFractionDigits: 3 });
        const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 });
        const number = value => value !== 0 && Math.abs(value) < .00001 ? scientific.format(value) : counts.format(value);
        const fmtRange = value => Array.isArray(value) ? value.map(number).join('–') : `${number(value.min)}–${number(value.max)}`;
        function format(result) {
            if (result.value === null) return label('missing');
            if (result.unit === 'fraction') return percent.format(result.value);
            if (result.unit === 'engineering-hours') return fmtRange(result.value) + ' h';
            if (result.unit === 'bytes/month') {
                return `${number(result.value)} B / ${locale === 'ar' ? 'شهر' : 'month'} · ${number(result.value / 1024 ** 3)} GiB`;
            }
            return `${number(result.value)} ${result.unit}`;
        }

        const model = modelCapacity(state, state.capacity, defaultEffortAssumptions);
        const intermediate = {
            api: { usersIntermediate: model.api.dailyRequests.assumptions.users, requestBasis: model.api.dailyRequests.assumptions.source,
                requestsPerUser: model.api.dailyRequests.assumptions.requestsPerUser, ...model.api.peakHour.intermediates,
                ...model.api.burstRps.intermediates },
            queue: { ...model.queue.arrival.intermediates, ...model.queue.utilization.intermediates },
            storage: { ...model.storage.estimated.intermediates },
            effort: {}
        };
        const entries = { api: model.api, queue: model.queue, storage: model.storage,
            effort: { ...model.effort.packages, total: model.effort.total } };
        for (const [group, results] of Object.entries(entries)) {
            let card = groups.get(group);
            if (!card) {
                const section = document.createElement('section');
                section.className = 'capacity-group';
                section.innerHTML = `<h5></h5><dl></dl><details data-capacity-formula="${group}">
                    <summary></summary><p></p><div class="capacity-explanation"></div></details>`;
                output.append(section);
                card = { section, rows: new Map(), metrics: section.querySelector('dl'),
                    heading: section.querySelector('h5'), summary: section.querySelector('summary'),
                    formula: section.querySelector('details p'), explanation: section.querySelector('.capacity-explanation') };
                groups.set(group, card);
            }
            setText(card.heading, label(group));
            setText(card.summary, label('formulas'));
            setText(card.formula, label(group + '-formula'));
            for (const [key, result] of Object.entries(results)) {
                let row = card.rows.get(key);
                if (!row) {
                    const element = document.createElement('div');
                    element.innerHTML = '<dt></dt><dd><b></b><span></span></dd>';
                    card.metrics.append(element);
                    row = { title: element.querySelector('dt'), value: element.querySelector('b'), warnings: element.querySelector('span') };
                    card.rows.set(key, row);
                }
                setText(row.title, label(group === 'storage' && key === 'audit' ? 'auditStorage' : key));
                setText(row.value, format(result));
                setMarkup(row.warnings, result.warnings.map(warning => `<small>${label(warning)}</small>`).join(''));
            }
            const detail = group === 'effort'
                ? `<ul>${Object.entries(model.effort.packages).map(([key, result]) => `<li>
                    ${label(key)} · ${label('baseline')}: ${result.assumptions.baseline ? fmtRange(result.assumptions.baseline) : label('missing')}
                    ${Object.keys(result.assumptions.increments).length ? ` · ${label('increments')}: ${Object.entries(result.assumptions.increments)
                        .map(([feature, range]) => `${label(feature)} ${range ? fmtRange(range) : label('missing')}`).join(', ')}` : ''}
                    </li>`).join('')}</ul>`
                : `<dl class="capacity-intermediates">${Object.entries(intermediate[group]).map(([key, value]) => `<div>
                    <dt>${label(key)}</dt><dd>${value == null ? label('missing') : typeof value === 'string' ? label(value) : number(value)}</dd></div>`).join('')}</dl>`;
            setMarkup(card.explanation, detail);
        }
    }

    panel.addEventListener('input', ({ target }) => {
        const key = target.dataset.capacityInput;
        if (!key) return;
        const value = target.value === '' && !target.validity.badInput ? null : target.valueAsNumber;
        const valid = validAssumption(key, value);
        target.setAttribute('aria-invalid', String(!valid));
        editing = target;
        try { store.update({ capacity: { [key]: valid ? value : null } }); }
        finally { editing = undefined; }
    }, { signal: events.signal });
    const observer = new MutationObserver(() => render(store.getState()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    const unsubscribe = store.subscribe(render);
    const refresh = () => render(store.getState());
    planner.addEventListener('toggle', refresh, { signal: events.signal });
    planner.closest('[data-studio-host]')?.addEventListener('studio-visibility', refresh, { signal: events.signal });
    render(store.getState());
    return () => {
        unsubscribe();
        observer.disconnect();
        events.abort();
        if (ownsPlanner) planner.remove();
        else panel.remove();
    };
}
