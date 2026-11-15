import { defaultEffortAssumptions, estimateEngineeringEffort } from '../capacity/effort.js';
import { EXPENSE_KEYS, MAX_USD_CENTS, parseCommercialInput } from './inputs.js';
import { estimateCommercialPrice, roundCurrencyCents } from './model.js';
import { commercialCopy } from './copy.js';

const fields = ['rateCents', 'contingencyBps', ...EXPENSE_KEYS];
const operatingKeys = ['appHosting', 'dbHosting', 'objectHosting', 'queueHosting', 'apiUsage', 'monitoring', 'backups'];

export function mountCommercialEstimate(store) {
    const planner = document.getElementById('architecture-planner');
    if (!planner) return () => {};
    const panel = document.createElement('section');
    panel.className = 'commercial-panel';
    panel.setAttribute('aria-labelledby', 'commercial-title');
    const copy = (key, tag) => `<${tag} data-commercial-copy="${key}"></${tag}>`;
    const field = key => `<label>${copy(key, 'span')}<input type="number" name="commercial-${key}" data-commercial-input="${key}"
        min="0" max="${key === 'contingencyBps' ? 100 : MAX_USD_CENTS / 100}" step=".01" inputmode="decimal"
        aria-describedby="commercial-input-error"></label>`;
    panel.innerHTML = `<header><h4 id="commercial-title" data-commercial-copy="title"></h4>${copy('intro','p')}</header>
        <dl class="commercial-summary" aria-live="polite"></dl>
        <div class="commercial-inputs">${fields.slice(0, 2).map(field).join('')}</div>
        ${copy('examples','p')}
        <details><summary data-commercial-copy="fixed"></summary><div class="commercial-inputs">${EXPENSE_KEYS.map(field).join('')}</div>
            <dl class="commercial-expenses"></dl></details>
        <p id="commercial-input-error" hidden data-commercial-copy="invalidInput"></p>
        <details><summary data-commercial-copy="breakdown"></summary><div class="commercial-packages"></div></details>
        <details><summary data-commercial-copy="assumptions"></summary>${['rule','scope','exclusions'].map(key => copy(key,'p')).join('')}</details>
        <details class="commercial-operating"><summary data-commercial-copy="operating"></summary>${copy('operatingIntro','p')}
            <dl>${operatingKeys.map(key => `<div>${copy(key,'dt')}${copy('unpriced','dd')}</div>`).join('')}</dl>
        </details>`;
    const capacity = planner.querySelector(':scope > div.capacity-panel');
    if (capacity) capacity.before(panel);
    else planner.append(panel);

    const summary = panel.querySelector('.commercial-summary');
    const breakdown = panel.querySelector('.commercial-packages');
    const expenseList = panel.querySelector('.commercial-expenses');
    const error = panel.querySelector('#commercial-input-error');
    const inputs = [...panel.querySelectorAll('[data-commercial-input]')];
    const events = new AbortController();
    let editing, locale, lastScope;
    let changed = new Set();
    const label = key => commercialCopy[key]?.[locale === 'ar' ? 1 : 0] ?? key;
    const setMarkup = (target, markup) => {
        if (target.innerHTML !== markup) target.innerHTML = markup;
    };

    function render(state) {
        const language = document.documentElement.lang.startsWith('ar') ? 'ar' : 'en';
        if (locale !== language) {
            locale = language;
            panel.querySelectorAll('[data-commercial-copy]').forEach(node => {
                node.textContent = label(node.dataset.commercialCopy);
            });
        }
        for (const input of inputs) {
            if (input !== editing) {
                const value = state.commercial[input.dataset.commercialInput];
                if (input.getAttribute('aria-invalid') !== 'true' || value !== null) {
                    input.value = value === null ? '' : String(value / 100);
                    input.removeAttribute('aria-invalid');
                }
            }
        }
        error.hidden = !inputs.some(input => input.getAttribute('aria-invalid') === 'true');
        const effort = estimateEngineeringEffort(state, defaultEffortAssumptions);
        const price = estimateCommercialPrice(effort, state.commercial);
        const currency = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', currencyDisplay: 'code' });
        const decimals = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false });
        const numbers = new Intl.NumberFormat(locale);
        const money = units => {
            if (units === null) return label('unavailable');
            const cents = roundCurrencyCents(units);
            return currency.formatToParts(cents / 100n)
                .map(part => part.type === 'fraction' ? decimals.format(cents % 100n) : part.value).join('');
        };
        const range = item => item.value
            ? `<bdi>${money(item.value.min)} – ${money(item.value.max)}</bdi>`
            : `${label('unavailable')}<small>${label(item.reason)}</small>`;
        const hours = value => value ? `<bdi>${numbers.format(value.min)}–${numbers.format(value.max)} h</bdi>` : label('unavailable');
        const row = (key, value) => `<div><dt>${label(key)}</dt><dd>${value}</dd></div>`;
        setMarkup(summary, row('hours', hours(price.hours)) + row('labor', range(price.labor)) +
            row('fixed', `<bdi>${money(price.fixed.value)}</bdi>`) + row('total', range(price.total)));
        setMarkup(expenseList, EXPENSE_KEYS.map(key => row(key, `<bdi>${money(price.expenses[key])}</bdi>`)).join(''));

        const scope = Object.fromEntries(Object.entries(price.packages).map(([key, item]) =>
            [key, JSON.stringify([item.hours, item.requirements])]));
        if (lastScope && Object.keys(scope).some(key => scope[key] !== lastScope[key])) {
            changed = new Set(Object.keys(scope).filter(key => scope[key] !== lastScope[key]));
        }
        lastScope = scope;
        const spanHours = pair => pair && hours({ min: pair[0], max: pair[1] });
        setMarkup(breakdown, Object.entries(price.packages).map(([key, item]) => `<article class="commercial-package"${changed.has(key) ? ' data-scope-changed' : ''}>
            <header><h5>${label(key)}</h5>${changed.has(key) ? `<small>${label('changed')}</small>` : ''}</header>
            <p>${label(key + 'Base')}</p>
            <dl>${row('hours',hours(item.hours))}${row('contribution',range(item.cost))}
            ${row('baseline',spanHours(item.assumptions.baseline) || label('unavailable'))}</dl>
            ${item.requirements.length ? `<p>${label('featureHours')}</p><ul>${item.requirements.map(feature =>
                `<li>${label(feature)} · ${spanHours(item.assumptions.increments[feature]) || label('unavailable')}</li>`).join('')}</ul>` : ''}
        </article>`).join(''));
    }

    panel.addEventListener('input', ({ target }) => {
        const key = target.dataset.commercialInput;
        if (!key) return;
        const parsed = target.validity.badInput ? { valid: false, value: null } : parseCommercialInput(key, target.value);
        target.setAttribute('aria-invalid', String(!parsed.valid));
        error.hidden = !inputs.some(input => input.getAttribute('aria-invalid') === 'true');
        editing = target;
        try { store.update({ commercial: { [key]: parsed.value } }); }
        finally { editing = undefined; }
    }, { signal: events.signal });

    const unsubscribe = store.subscribe(render);
    const observer = new MutationObserver(() => render(store.getState()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    render(store.getState());
    return () => {
        observer.disconnect();
        unsubscribe();
        events.abort();
        panel.remove();
    };
}
