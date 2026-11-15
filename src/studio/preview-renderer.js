import { APPLICATION_TYPES, PREVIEW_FEATURE_KEYS } from './configuration.js';
import { derivePreview } from './preview-model.js';
import { featureModules, templates, translations } from './preview-templates.js';
import { mountArchitectureExplorer } from './architecture/explorer.js';

const displayFeatures = [...PREVIEW_FEATURE_KEYS, 'roles'];

export function mountDesignStudio(store, reset) {
    const anchor = document.getElementById('architectural-showcase-card');
    const studio = document.createElement('section');
    studio.id = 'application-design-studio';
    studio.className = 'bento-item design-studio';
    studio.setAttribute('aria-labelledby', 'design-studio-title');
    const localized = (key, tag = 'span') => `<${tag} data-studio-copy="${key}"></${tag}>`;
    const options = choices => choices.map(key => `<option value="${key}" data-studio-copy="${key}"></option>`).join('');
    const featureInput = key => {
        const note = ['orders', 'conversion', 'roles'].includes(key) ? key + 'Note' : null;
        return `<label class="studio-toggle"><input type="checkbox" name="${key}"${note ? ` aria-describedby="studio-${note}"` : ''}>
            <span>${localized(key)}${note ? `<small id="studio-${note}" data-studio-copy="${note}"></small>` : ''}</span></label>`;
    };

    // All markup originates from the module's static labels and fictional sample templates.
    studio.innerHTML = `<header class="studio-heading">
        <h3 id="design-studio-title" tabindex="-1" data-studio-copy="title"></h3>
        ${localized('intro', 'p')}
    </header>
    <div class="studio-layout">
        <form class="studio-settings" aria-label="Preview settings">
            <label>${localized('template')}<select name="applicationType">${options(APPLICATION_TYPES)}</select></label>
            <label>${localized('theme')}<select name="theme">${options(['system', 'light', 'dark'])}</select></label>
            <fieldset><legend data-studio-copy="features"></legend>${displayFeatures.map(featureInput).join('')}</fieldset>
            <button type="button" class="studio-plan-link" data-studio-plan data-studio-copy="plan"></button>
            <button type="button" data-studio-reset data-studio-copy="reset"></button>
            <p class="studio-announcement" role="status"></p>
        </form>
        <div class="studio-canvas">
            <div class="studio-canvas-bar">${localized('preview')}<strong data-studio-current></strong></div>
            <div data-studio-preview-panel><div class="studio-preview">
                <div class="studio-workspaces" data-studio-module="tenancy"><div></div></div>
                <div class="studio-template"></div>
                <div class="studio-modules"></div>
            </div>
            <p class="studio-recommendation" data-studio-copy="signFirst" hidden></p>
            </div>
        </div>
    </div>`;
    anchor.before(studio);

    const form = studio.querySelector('form');
    const status = studio.querySelector('[role="status"]');
    const preview = studio.querySelector('.studio-preview');
    const screen = studio.querySelector('.studio-template');
    const modules = studio.querySelector('.studio-modules');
    const workspaces = studio.querySelector('.studio-workspaces');
    const current = studio.querySelector('[data-studio-current]');
    const hint = studio.querySelector('.studio-recommendation');
    const events = new AbortController();
    const listen = (element, type, handler) => element.addEventListener(type, handler, { signal: events.signal });
    const planner = document.getElementById('architecture-planner');
    const plan = form.querySelector('[data-studio-plan]');
    const returnLink = document.createElement('a');
    returnLink.className = 'studio-return-link';
    returnLink.href = '#application-design-studio';
    planner?.querySelector(':scope > summary')?.after(returnLink);
    plan.hidden = !planner;
    let language;
    let previous;
    let moduleElements;

    const label = pair => pair[language === 'ar' ? 1 : 0];
    const copy = key => label(translations[key]);

    function render() {
        const nextLanguage = document.documentElement.lang.startsWith('ar') ? 'ar' : 'en';
        const localeChanged = language !== nextLanguage;
        language = nextLanguage;
        if (localeChanged) {
            studio.lang = language;
            studio.dir = language === 'ar' ? 'rtl' : 'ltr';
            form.setAttribute('aria-label', copy('controls'));
            returnLink.textContent = copy('backToStudio');
            studio.querySelectorAll('[data-studio-copy]').forEach(node => {
                node.textContent = copy(node.dataset.studioCopy);
            });
            workspaces.firstElementChild.innerHTML = `<span>${label(['Workspace','مساحة العمل'])}</span>
                <strong>Northstar Studio <span aria-hidden="true">⌄</span></strong>`;
        }

        const state = store.getState();
        const model = derivePreview(state);
        const templateChanged = localeChanged || model.template !== previous?.template;
        if (templateChanged) {
            current.textContent = copy(model.template);
            screen.innerHTML = templates[model.template](label);
        }

        if (localeChanged) {
            moduleElements = { tenancy: workspaces };
            modules.replaceChildren(...Object.entries(featureModules(label)).map(([key, markup]) => {
                const section = document.createElement('section');
                section.dataset.studioModule = key;
                section.className = 'studio-module';
                section.innerHTML = `<div class="studio-module-clip"><div class="mock-card">${markup}</div></div>`;
                moduleElements[key] = section;
                return section;
            }));
        }
        if (model.theme !== previous?.theme) preview.dataset.previewTheme = model.theme;
        if (model.density !== previous?.density) preview.dataset.density = model.density;
        if (templateChanged) form.elements.applicationType.value = model.template;
        if (model.theme !== previous?.theme) form.elements.theme.value = model.theme;
        for (const key of displayFeatures) {
            const active = key === 'roles' ? model.roles : model.capabilities[key];
            const wasActive = key === 'roles' ? previous?.roles : previous?.capabilities[key];
            if (localeChanged || active !== wasActive) {
                moduleElements[key].classList.toggle('is-active', active);
                moduleElements[key].inert = !active;
                moduleElements[key].setAttribute('aria-hidden', String(!active));
            }
            const checked = key === 'roles' ? state.engineering.rbac : state.previewFeatures[key];
            if (form.elements[key].checked !== checked) form.elements[key].checked = checked;
        }
        hint.hidden = !(model.recommendations.accountForRoles || model.recommendations.accountForOrganizations);
        previous = model;
    }

    listen(form, 'submit', event => event.preventDefault());
    listen(form, 'change', ({ target }) => {
        status.textContent = '';
        const { name, value, checked } = target;
        if (name === 'applicationType') store.update({ applicationType: value });
        else if (name === 'theme') store.update({ visual: { theme: value } });
        else if (name === 'roles') store.update({ engineering: { rbac: checked } });
        else if (PREVIEW_FEATURE_KEYS.includes(name)) store.update({ previewFeatures: { [name]: checked } });
    });
    listen(form.querySelector('[data-studio-reset]'), 'click', () => {
        reset();
        status.textContent = copy('resetDone');
    });
    listen(plan, 'click', () => {
        const toggle = document.querySelector('.configurator-toggle');
        if (!planner || !toggle) return;
        if (toggle.getAttribute('aria-expanded') === 'false') toggle.click();
        planner.open = true;
        const summary = planner.querySelector(':scope > summary');
        summary?.focus();
        summary?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    });
    listen(returnLink, 'click', event => {
        event.preventDefault();
        studio.querySelector('h3').focus();
    });

    const observer = new MutationObserver(render);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    const unsubscribe = store.subscribe((next, last) => {
        if (next.applicationType !== last.applicationType || next.visual.theme !== last.visual.theme ||
            next.visual.density !== last.visual.density || next.engineering.rbac !== last.engineering.rbac ||
            PREVIEW_FEATURE_KEYS.some(key => next.previewFeatures[key] !== last.previewFeatures[key])) render();
    });
    render();
    const unmountArchitecture = mountArchitectureExplorer(studio.querySelector('.studio-canvas'),
        studio.querySelector('[data-studio-preview-panel]'), store);
    return () => {
        unmountArchitecture();
        returnLink.remove();
        events.abort();
        observer.disconnect();
        unsubscribe();
        studio.remove();
    };
}
