import { APPLICATION_TYPES, PREVIEW_FEATURE_KEYS } from './configuration.js';
import { derivePreview } from './preview-model.js';
import { featureModules, templates, translations } from './preview-templates.js';
import { mountArchitectureExplorer } from './architecture/explorer.js';
import { bindPreviewInteractions } from './preview-interactions.js';
import { createPreviewTrace, previewTraceContext } from './preview-trace.js';
import { buildArchitectureGraph } from './architecture/graph.js';
import { resolveFlow } from './flow/model.js';
import { mountWorkspacePreview, workspacePreviewJourney } from './preview-workspace-motion.js';
import './preview-workspace-motion.css';
import { modelAssets, modelModes } from '../components/model-assets.js';
import { mediaCopy, mountPreviewMedia } from './preview-media.js';
import { mountPreviewAppearance } from './preview-appearance.js';
import './preview-media.css';

const displayFeatures = [...PREVIEW_FEATURE_KEYS, 'roles'];
const viewports = ['desktop', 'tablet', 'mobile'];
const feedback = {
    workspace: ['Demo workspace ready.', 'مساحة العمل التجريبية جاهزة.'],
    checkout: ['Demo order confirmed. No purchase was made.', 'تأكّد الطلب التجريبي دون إجراء عملية شراء.'],
    export: ['Demo records.csv ready. No file was created.', 'ملف records.csv التجريبي جاهز دون إنشاء ملف فعلي.']
};

export function mountDesignStudio(store, reset) {
    const host = document.querySelector('[data-studio-host]');
    const studio = document.createElement('section');
    studio.id = 'application-design-studio';
    studio.className = 'design-studio';
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
        <div><h3 id="design-studio-title" tabindex="-1" data-studio-copy="title"></h3>
        ${localized('intro', 'p')}</div>
    </header>
    <div class="studio-layout" id="studio-workspace">
        <form class="studio-settings" aria-label="Preview settings">
            <label>${localized('template')}<select name="applicationType">${options(APPLICATION_TYPES)}</select></label>
            <fieldset><legend data-studio-copy="features"></legend>${displayFeatures.map(featureInput).join('')}</fieldset>
            <div class="studio-media-settings">
                ${featureInput('enabled')}
                <div class="studio-media-options" hidden>
                    <label>${localized('asset')}<select name="asset">${options(Object.keys(modelAssets))}</select></label>
                    <label>${localized('mode')}<select name="mode">${options(modelModes)}</select></label>
                </div>
            </div>
            <button type="button" class="studio-plan-link" data-studio-plan data-studio-copy="plan"></button>
            <button type="button" data-studio-reset data-studio-copy="reset"></button>
            <p class="studio-announcement" role="status"></p>
        </form>
        <div class="studio-canvas">
            <div class="studio-canvas-bar">${localized('preview')}<strong data-studio-current></strong></div>
            <div data-studio-preview-panel>
            <div class="studio-preview-tools">
                <div class="studio-viewport-controls" dir="auto" role="group">${viewports.map((mode, index) =>
                    `<button type="button" data-preview-viewport="${mode}" data-studio-copy="${mode}" aria-pressed="${index === 0}"></button>`).join('')}</div>
                <button class="studio-preview-theme" type="button"><span aria-hidden="true"></span></button>
            </div>
            <div class="studio-preview-frame" data-viewport="desktop">
            <div class="studio-frame-chrome"><span aria-hidden="true"></span><strong dir="auto"></strong></div>
            <div class="studio-preview">
                <div class="studio-workspaces" data-studio-module="tenancy" hidden><div></div></div>
                <div class="studio-template"></div>
                <div class="studio-modules"></div>
            </div>
            </div>
            <p class="studio-recommendation" data-studio-copy="signFirst" hidden></p>
            </div>
        </div>
    </div>`;
    host.prepend(studio);

    const form = studio.querySelector('form');
    const status = studio.querySelector('[role="status"]');
    const preview = studio.querySelector('.studio-preview');
    const previewPanel = studio.querySelector('[data-studio-preview-panel]');
    const frame = studio.querySelector('.studio-preview-frame');
    const viewportControls = studio.querySelector('.studio-viewport-controls');
    const themeButton = studio.querySelector('.studio-preview-theme');
    const systemTheme = matchMedia('(prefers-color-scheme: dark)');
    const screen = studio.querySelector('.studio-template');
    const modules = studio.querySelector('.studio-modules');
    const workspaces = studio.querySelector('.studio-workspaces');
    const current = studio.querySelector('[data-studio-current]');
    const hint = studio.querySelector('.studio-recommendation');
    const mediaOptions = studio.querySelector('.studio-media-options');
    const events = new AbortController();
    const listen = (element, type, handler) => element.addEventListener(type, handler, { signal: events.signal });
    const appearance = mountPreviewAppearance(studio.querySelector('.studio-preview-tools'), preview, store, events.signal);
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
    let media;
    let workspaceMotion;
    let workspaceRouteKey;

    const label = pair => pair[language === 'ar' ? 1 : 0];
    const copy = key => label(translations[key] ?? mediaCopy[key] ?? modelAssets[key].name);
    const trace = createPreviewTrace((action, completed) => {
        const rail = screen.querySelector('.mock-trace');
        if (!rail) return;
        rail.toggleAttribute('data-trace-ready', Boolean(action));
        rail.toggleAttribute('data-trace-complete', completed);
        workspaceMotion?.reflect(completed);
        rail.querySelector('[data-preview-trace]').hidden = !action;
        const status = rail.querySelector('.mock-trace-status');
        const context = action && previewTraceContext(action, language);
        const message = action && label(completed ? feedback[action.action] :
            ['See how this demo request is processed.', 'اطّلع على كيفية معالجة هذا الطلب التجريبي.']);
        status.textContent = [message, context].filter(Boolean).join(' · ');
    });
    const architecture = mountArchitectureExplorer(studio.querySelector('.studio-canvas'), previewPanel, store);

    function clearTrace() {
        workspaceMotion?.cancel();
        trace.clear();
        architecture.cancelTrace();
    }

    function traceAction() {
        const action = trace.action;
        if (!action) return;
        workspaceMotion?.cancel();
        architecture.openTrace(action, completed => trace.reflect(action, completed),
            screen.querySelector('[data-preview-action]'));
    }

    function syncWorkspaceMotion(state) {
        if (state.applicationType !== 'saas') return;
        const key = [state.previewFeatures.auth, state.previewFeatures.tenancy, state.engineering.webauthn, state.engineering.rls].join();
        if (workspaceMotion && workspaceRouteKey === key) return;
        workspaceRouteKey = key;
        const journey = workspacePreviewJourney(resolveFlow(state, buildArchitectureGraph(state), 'workspace').steps);
        if (!workspaceMotion) {
            workspaceMotion = mountWorkspacePreview(screen.querySelector('.workspace-preview-motion'),
                screen.querySelector('[data-preview-action="workspace"]'), previewPanel, host, journey, label);
        } else if (workspaceMotion.configure(journey)) {
            trace.reflect(trace.action, false);
        }
    }

    function renderTheme() {
        const visual = store.getState().visual;
        const { theme } = visual;
        const dark = theme === 'system' ? systemTheme.matches : theme === 'dark';
        const action = copy(dark ? 'useLight' : 'useDark');
        const activeTheme = dark ? 'dark' : 'light';
        if (preview.dataset.previewTheme !== activeTheme) preview.dataset.previewTheme = activeTheme;
        if (themeButton.getAttribute('aria-label') !== action) {
            themeButton.setAttribute('aria-label', action);
            themeButton.title = action;
            themeButton.firstElementChild.textContent = dark ? '☀' : '☾';
        }
        appearance.render(visual, dark);
    }
    function render() {
        if (host.hidden) return;
        const nextLanguage = document.documentElement.lang.startsWith('ar') ? 'ar' : 'en';
        const localeChanged = language !== nextLanguage;
        language = nextLanguage;
        if (localeChanged) {
            studio.lang = language;
            studio.dir = language === 'ar' ? 'rtl' : 'ltr';
            appearance.localize(label);
            form.setAttribute('aria-label', copy('controls'));
            viewportControls.setAttribute('aria-label', copy('viewport'));
            returnLink.textContent = copy('backToStudio');
            studio.querySelectorAll('[data-studio-copy]').forEach(node => {
                node.textContent = copy(node.dataset.studioCopy);
            });
            workspaces.firstElementChild.innerHTML = `<label>${label(['Workspace','مساحة العمل'])}
                <select data-preview-workspace-select><option>Northstar Studio</option><option>Harbor Design</option></select></label>`;
        }

        const state = store.getState();
        const model = derivePreview(state);
        const templateChanged = localeChanged || model.template !== previous?.template;
        if (templateChanged) {
            clearTrace();
            media?.destroy();
            workspaceMotion?.destroy();
            workspaceMotion = undefined;
            current.textContent = copy(model.template);
            frame.querySelector('.studio-frame-chrome strong').textContent = {
                saas: 'app.pulse.example', ecommerce: 'formandfield.example',
                landing: 'linearise.example', 'internal-tool': 'ops.relay.example'
            }[model.template];
            screen.innerHTML = templates[model.template](label);
            media = mountPreviewMedia(screen.querySelector('[data-preview-media]'), label);
            screen.querySelector('[data-preview-workspace]').append(workspaces);
            const footer = screen.querySelector('[data-preview-footer]');
            if (footer) footer.before(modules);
            else (screen.querySelector('[data-preview-modules]') ?? screen.firstElementChild).append(modules);
            const workspaceName = screen.querySelector('[data-workspace-name]');
            if (workspaceName) workspaceName.textContent = workspaces.querySelector('select').value;
        }
        syncWorkspaceMotion(state);

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
        renderTheme();
        if (templateChanged) form.elements.applicationType.value = model.template;
        for (const key of displayFeatures) {
            const active = key === 'roles' ? model.roles : model.capabilities[key];
            const wasActive = key === 'roles' ? previous?.roles : previous?.capabilities[key];
            if (localeChanged || active !== wasActive) {
                if (key === 'tenancy') workspaces.hidden = !active;
                moduleElements[key].classList.toggle('is-active', active);
                moduleElements[key].inert = !active;
                moduleElements[key].setAttribute('aria-hidden', String(!active));
            }
            const checked = key === 'roles' ? state.engineering.rbac : state.previewFeatures[key];
            if (form.elements[key].checked !== checked) form.elements[key].checked = checked;
        }
        hint.hidden = !(model.recommendations.accountForRoles || model.recommendations.accountForOrganizations);
        const { enabled, asset, mode } = model.interactiveMedia;
        mediaOptions.hidden = !enabled;
        form.elements.enabled.checked = enabled;
        form.elements.asset.value = asset;
        form.elements.mode.value = mode;
        media.render(model.interactiveMedia);
        previous = model;
    }

    listen(form, 'submit', event => event.preventDefault());
    bindPreviewInteractions(preview, events.signal, () => copy('demoSaved'), {
        template: () => store.getState().applicationType,
        offer(action) {
            trace.offer(action);
            if (action?.action === 'workspace') workspaceMotion?.play(() => trace.reflect(action, true));
        },
        clear: clearTrace, trace: traceAction
    });
    listen(systemTheme, 'change', () => {
        if (!host.hidden && store.getState().visual.theme === 'system') renderTheme();
    });
    listen(themeButton, 'click', () => store.update({ visual: { theme: preview.dataset.previewTheme === 'dark' ? 'light' : 'dark' } }));
    listen(viewportControls, 'click', event => {
        const mode = event.target.closest('[data-preview-viewport]')?.dataset.previewViewport;
        if (!viewports.includes(mode) || mode === frame.dataset.viewport) return;
        workspaceMotion?.cancel();
        frame.dataset.viewport = mode;
        for (const button of viewportControls.children) {
            button.setAttribute('aria-pressed', String(button.dataset.previewViewport === mode));
        }
    });
    listen(host, 'studio-visibility', render);
    listen(form, 'change', ({ target }) => {
        status.textContent = '';
        const { name, value, checked } = target;
        if (name === 'applicationType') store.update({ applicationType: value });
        else if (name === 'roles') store.update({ engineering: { rbac: checked } });
        else if (PREVIEW_FEATURE_KEYS.includes(name)) store.update({ previewFeatures: { [name]: checked } });
        else if (name === 'enabled') store.update({ interactiveMedia: { enabled: checked } });
        else if (name === 'asset' || name === 'mode') store.update({ interactiveMedia: { [name]: value } });
    });
    listen(form.querySelector('[data-studio-reset]'), 'click', () => {
        clearTrace();
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
        if (next.applicationType !== last.applicationType || next.engineering.rbac !== last.engineering.rbac ||
            (next.applicationType === 'saas' && ['rls', 'webauthn'].some(key => next.engineering[key] !== last.engineering[key])) ||
            Object.keys(next.interactiveMedia).some(key => next.interactiveMedia[key] !== last.interactiveMedia[key]) ||
            PREVIEW_FEATURE_KEYS.some(key => next.previewFeatures[key] !== last.previewFeatures[key])) render();
        else if (!host.hidden && Object.keys(next.visual).some(key => next.visual[key] !== last.visual[key])) renderTheme();
    });
    render();
    return () => {
        architecture.destroy();
        media?.destroy();
        workspaceMotion?.destroy();
        returnLink.remove();
        events.abort();
        observer.disconnect();
        unsubscribe();
        studio.remove();
    };
}
