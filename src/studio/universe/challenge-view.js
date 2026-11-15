import { modelScenario, parseScenarioValue, resetScenario, scenarioBounds, scenarioFields, scenarioMetrics, updateScenario } from './challenge-model.js';

export function mountChallenge(root, showFeedback) {
    root.innerHTML = `<p data-challenge-copy="challengeNotice"></p>
        <label class="challenge-picker"><span data-challenge-copy="challengeScenario"></span>
            <select><option value="api" data-challenge-copy="challengeApi"></option>
            <option value="queue" data-challenge-copy="challengeQueue"></option>
            <option value="storage" data-challenge-copy="challengeStorage"></option></select></label>
        <div class="challenge-grid">
            <fieldset><legend data-challenge-copy="challengeAssumptions"></legend><div class="challenge-inputs"></div>
                <p class="challenge-basis"></p>
                <button type="button" data-challenge-copy="resetScenario"></button>
                <p class="challenge-reset-status" role="status"></p>
            </fieldset>
            <section aria-labelledby="challenge-estimates"><h4 id="challenge-estimates" data-challenge-copy="challengeEstimates"></h4>
                <p class="challenge-status" id="universe-challenge-status" role="status"></p><p class="challenge-absent"></p><dl></dl>
                <details><summary data-challenge-copy="challengeFormulas"></summary><p></p></details>
            </section>
        </div>`;
    const chooser = root.querySelector('select');
    const fields = root.querySelector('.challenge-inputs');
    const fieldsets = root.querySelector('fieldset');
    const results = root.querySelector('section');
    const metrics = root.querySelector('dl');
    const status = root.querySelector('.challenge-status');
    const resetStatus = root.querySelector('.challenge-reset-status');
    const absent = root.querySelector('.challenge-absent');
    const formula = root.querySelector('details');
    const events = new AbortController();
    const options = { signal: events.signal };
    const inputs = new Map();
    const outputs = new Map();
    let scenario = 'api';
    let draft = {};
    let snapshot;
    let label;
    let language;
    let graph;
    const setText = (element, value) => { if (element.textContent !== value) element.textContent = value; };
    const setHidden = (element, value) => { if (element.hidden !== value) element.hidden = value; };

    function createField(key) {
        const wrapper = document.createElement('label');
        const caption = document.createElement('span');
        const control = document.createElement('input');
        control.type = 'number';
        control.inputMode = 'decimal';
        control.dir = 'ltr';
        control.dataset.challengeInput = key;
        const [min, max, step] = scenarioBounds(key);
        Object.assign(control, { min, max, step });
        const error = document.createElement('small');
        error.id = 'challenge-error-' + key;
        control.setAttribute('aria-describedby', error.id);
        wrapper.append(caption, control, error);
        fields.append(wrapper);
        return { wrapper, caption, control, error };
    }

    function createMetric(key) {
        const wrapper = document.createElement('div');
        const name = document.createElement('dt');
        const value = document.createElement('dd');
        const number = document.createElement('bdi');
        const warning = document.createElement('small');
        wrapper.dataset.challengeMetric = key;
        value.append(number, warning);
        wrapper.append(name, value);
        metrics.append(wrapper);
        return { wrapper, name, number, warning };
    }

    function render(state, architecture, translate, locale) {
        snapshot = state;
        graph = architecture;
        label = translate;
        language = locale;
        const { values, metrics: data, node, status: stateLabel } = modelScenario(state, scenario, draft[scenario]);
        const visibleFields = scenarioFields[scenario].filter(key => key !== 'vectorCount' || state.engineering.semantic);
        const visibleMetrics = scenarioMetrics[scenario].filter(key => key !== 'vectors' || state.engineering.semantic);
        for (const element of root.querySelectorAll('[data-challenge-copy]')) setText(element, label(element.dataset.challengeCopy));
        setText(root.querySelector('.challenge-basis'), label(scenario + 'Basis'));
        setText(formula.querySelector('p'), label(scenario + '-formula'));
        for (const [key, record] of inputs) setHidden(record.wrapper, !visibleFields.includes(key));
        for (const key of visibleFields) {
            const record = inputs.get(key) ?? createField(key);
            inputs.set(key, record);
            // Shared storage fields and retained drafts never replace a number as it is being typed.
            const disabled = key === 'auditRecords' && !state.engineering.audit;
            if (record.control.disabled !== disabled) record.control.disabled = disabled;
            setText(record.caption, label(key));
            const value = String(values[key] ?? '');
            if (record.control !== document.activeElement && record.control.value !== value) record.control.value = value;
        }
        for (const [key, record] of outputs) setHidden(record.wrapper, !visibleMetrics.includes(key));
        const numbers = new Intl.NumberFormat(locale, { maximumSignificantDigits: 9 });
        const percentages = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 3 });
        for (const key of visibleMetrics) {
            const record = outputs.get(key) ?? createMetric(key);
            outputs.set(key, record);
            const metric = data[key];
            setText(record.name, label(key === 'audit' ? 'auditStorage' : key));
            setText(record.number, metric.value === null ? label('unavailable') : metric.unit === 'fraction'
                ? percentages.format(metric.value) : numbers.format(metric.value) + ' ' + metric.unit);
            setText(record.warning, metric.warnings.map(label).join(' '));
        }
        if (status.dataset.status !== stateLabel) status.dataset.status = stateLabel;
        setText(status, label(stateLabel));
        const present = graph.nodes.some(component => component.id === node);
        setHidden(absent, present);
        setText(absent, label('scenarioAbsent'));
        showFeedback(present ? { scenario, node, status: stateLabel, metrics: data } : null);
    }

    const refresh = () => render(snapshot, graph, label, language);
    function clearErrors() {
        for (const { control, error } of inputs.values()) {
            control.removeAttribute('aria-invalid');
            setText(error, '');
        }
    }
    chooser.addEventListener('change', () => {
        scenario = chooser.value;
        if (!Object.hasOwn(scenarioFields, scenario)) scenario = 'api';
        setText(resetStatus, '');
        clearErrors();
        formula.open = false;
        refresh();
    }, options);
    fields.addEventListener('input', event => {
        const control = event.target;
        const key = control.dataset.challengeInput;
        if (!inputs.has(key)) return;
        const value = control.validity.badInput ? undefined : parseScenarioValue(key, control.value);
        const invalid = value === undefined;
        if (invalid) control.setAttribute('aria-invalid', 'true');
        else control.removeAttribute('aria-invalid');
        setText(inputs.get(key).error, invalid ? label(key === 'jobRate' ? 'invalidRate' : 'invalidScenario') : '');
        setText(resetStatus, '');
        draft = updateScenario(draft, scenario, key, invalid ? null : value);
        refresh();
    }, options);
    fieldsets.querySelector('button').addEventListener('click', () => {
        draft = resetScenario(draft, scenario);
        clearErrors();
        refresh();
        setText(resetStatus, label('projectReset'));
    }, options);

    return { render, destroy: () => events.abort() };
}
