import test from 'node:test';
import assert from 'node:assert/strict';

const debug = process.env.STUDIO_CHROME_DEBUG;
const url = process.env.STUDIO_PREVIEW_URL;

test('Creation Engine production workflow and persistence in Chromium', { skip: !(debug && url) }, async t => {
    const origin = new URL(url).origin;
    const tab = await (await fetch(new URL('/json/new?about:blank', debug), { method: 'PUT' })).json();
    const socket = new WebSocket(tab.webSocketDebuggerUrl);
    const pending = new Map();
    const runtimeErrors = [];
    let id = 0;
    await new Promise((resolve, reject) => {
        socket.addEventListener('open', resolve, { once: true });
        socket.addEventListener('error', reject, { once: true });
    });
    t.after(async () => {
        socket.close();
        await fetch(new URL('/json/close/' + tab.id, debug));
    });
    socket.addEventListener('message', ({ data }) => {
        const message = JSON.parse(data);
        if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails.text);
        if (!message.id) return;
        const { resolve, reject } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
    });
    const command = (method, params = {}) => new Promise((resolve, reject) => {
        pending.set(++id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
        const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
        return result.result.value;
    };
    const check = async expression => assert(await evaluate(expression), expression);
    async function waitFor(expression, attempts = 100) {
        for (let attempt = 0; attempt < attempts; attempt++) {
            if (await evaluate(expression)) return;
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        await check(expression);
    }
    const helpers = `
        window.q = selector => document.querySelector(selector);
        window.click = selector => q(selector).click();
        window.view = index => q('.architecture-switch').children[index].click();
        window.set = (selector, value, type = 'input') => {
            const element = q(selector);
            element.value = value;
            element.dispatchEvent(new Event(type, { bubbles: true }));
        };
        window.template = value => set('.studio-settings select[name=applicationType]', value, 'change');
        window.runAction = () => click('[data-preview-action]');
        window.mediaEnabled = () => click('.studio-settings [name=enabled]');
        window.mediaSlot = () => q('[data-preview-media]');
        window.model = () => mediaSlot().querySelector('model-viewer');
        window.showModel = () => q('.studio-media-stage').scrollIntoView({block:'center',behavior:'instant'});
        window.ensureModelInView = () => {
            const bounds = q('.studio-media-stage').getBoundingClientRect();
            if (bounds.top < 0 || bounds.bottom > innerHeight) {
                scrollBy({ top: bounds.top - (innerHeight - bounds.height) / 2, behavior: 'instant' });
            }
            return mediaSlot().dataset.viewer === 'ready' && model()?.modelIsVisible;
        };
        window.modelRequests = () => performance.getEntriesByType('resource').filter(entry => entry.name.endsWith('/Planet.glb'));
        window.viewerRequests = () => performance.getEntriesByType('resource').filter(entry => entry.name.includes('model-viewer.min.js'));
        window.cometTimers = new Map();
        window.starfieldDraws = 0;
        const schedule = window.setTimeout, cancel = window.clearTimeout;
        window.setTimeout = (callback, delay, ...args) => {
            if (delay < 48000 || delay > 74000 || !Number.isFinite(delay)) return schedule(callback, delay, ...args);
            const run = () => { cometTimers.delete(timer); callback(...args); };
            const timer = schedule(run, delay);
            cometTimers.set(timer, run);
            return timer;
        };
        window.clearTimeout = timer => { cometTimers.delete(timer); cancel(timer); };
        window.releaseComet = () => {
            const [timer, run] = cometTimers.entries().next().value;
            clearTimeout(timer);
            run();
        };
        window.backgroundAnimations = () => q('.space-atmosphere').getAnimations({ subtree:true });
        window.databaseDraws = 0;
        const clear = CanvasRenderingContext2D.prototype.clearRect;
        CanvasRenderingContext2D.prototype.clearRect = function (...args) {
            if (this.canvas.id === 'visualizer-canvas') databaseDraws++;
            if (this.canvas.id === 'starfield') starfieldDraws++;
            return clear.apply(this, args);
        };
    `;
    await command('Page.enable');
    await command('Page.bringToFront');
    await command('Runtime.enable');
    await command('Network.enable');
    await command('Network.setBlockedURLs', { urls: ['*model-viewer.min.js*'] });
    await command('Storage.clearDataForOrigin', { origin, storageTypes: 'local_storage' });
    await command('Page.addScriptToEvaluateOnNewDocument', { source: helpers });
    await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await command('Page.navigate', { url });
    await waitFor("Boolean(q('.architecture-switch'))");

    await check("q('[data-studio-host]').hidden && q('.studio-invite').hidden");
    await evaluate("q('footer').scrollIntoView({block:'center',behavior:'instant'})");
    await check("!q('#interstellar-asset-card, #ship-viewer, model-viewer') && modelRequests().length===0 && viewerRequests().length===0");
    await evaluate("click('.configurator-toggle');set('#tier', '2');set('#tier', '1')");
    await check("q('[data-studio-host]').hidden && q('.studio-invite').hidden");
    await evaluate("q('#tier').focus()");
    await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await waitFor("!q('.studio-invite').hidden");
    await evaluate("click('[data-studio-invite-dismiss]');q('#tier').focus()");
    await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await check("q('.studio-invite').hidden && sessionStorage.getItem('portfolio-studio-invite-dismissed') === '1'");
    await evaluate("click('#configurator-studio > summary')");
    await waitFor("!q('[data-studio-host]').hidden");
    await check("!q('.studio-feature-settings').open && q('.studio-feature-settings summary').textContent==='Features and 3D'");
    await evaluate("q('.studio-feature-settings summary').focus()");
    await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
    await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await check("q('.studio-feature-settings').open && document.activeElement===q('.studio-feature-settings summary')");
    await evaluate("click('.studio-feature-settings summary')");
    await evaluate("click('#architecture-planner > summary')");
    await check("q('#architecture-planner').open && q('.capacity-panel') && q('.commercial-panel')");
    await waitFor("q('.commercial-summary').textContent.length > 0");
    await evaluate("window.advancedPrice = q('.commercial-summary').textContent;set('#tier','4')");
    await check("q('.commercial-summary').textContent === advancedPrice && q('.studio-invite').hidden");
    for (const name of ['saas', 'ecommerce', 'landing', 'internal-tool']) {
        await evaluate(`template('${name}');view(0)`);
        await check("!q('[data-studio-preview-panel]').hidden && q('.studio-template').children.length");
        await evaluate("view(1)");
        await check("!q('.architecture-explorer').hidden");
        await check("q('.architecture-switch').children.length===2 && !q('.flow-panel, [data-preview-trace]')");
    }
    await evaluate("click('.studio-settings [name=jobs]');view(1)");
    await waitFor("Boolean(q('[data-arch-node=queue]'))");
    await evaluate("q('[data-arch-node=queue]').dispatchEvent(new MouseEvent('click',{bubbles:true}))");
    await check("q('.architecture-explorer .architecture-inspector h4').textContent === 'Background queue'");
    await evaluate("click('#theme-toggle');click('#lang-toggle')");
    await waitFor("document.documentElement.dir === 'rtl' && document.documentElement.dataset.theme === 'light'");
    await waitFor("q('.architecture-switch button:last-child').textContent === 'بنية النظام'");
    await command('Page.reload');
    await waitFor("Boolean(q('.architecture-switch'))");
    await evaluate("click('.configurator-toggle');click('#configurator-studio > summary')");
    await waitFor("q('.studio-settings select[name=applicationType]')?.value === 'internal-tool'");
    await check("q('.studio-settings [name=jobs]').checked && !q('.flow-panel')");
    await evaluate("click('[data-studio-reset]')");
    await check("q('.studio-settings select[name=applicationType]').value === 'saas' && !q('.studio-settings [name=jobs]').checked && localStorage.getItem('awad-portfolio-studio') === null");

    await evaluate(`template('ecommerce');view(0);
        window.beforeCart = localStorage.getItem('awad-portfolio-studio');
        click('[data-store-category=lighting]');click('[data-cart-add]');click('[data-preview-viewport=mobile]');`);
    await check("q('[data-cart-count]').textContent === '1' && q('[data-category=furniture]').hidden && q('.studio-preview-frame').dataset.viewport === 'mobile' && localStorage.getItem('awad-portfolio-studio') === beforeCart");
    await evaluate("window.previewTheme = q('.studio-preview').dataset.previewTheme;click('.studio-preview-theme')");
    await check("q('.studio-preview').dataset.previewTheme !== previewTheme && document.documentElement.dataset.theme === 'light' && q('[data-cart-count]').textContent === '1'");
    await evaluate("template('landing');click('.studio-settings [name=conversion]');click('[data-preview-start]')");
    await check("document.activeElement.type === 'email' && q('[data-preview-demo]').closest('.mock-landing')");
    await evaluate("template('internal-tool');set('[data-record-filter]', 'review', 'change')");
    await check("document.querySelectorAll('[data-record-status]:not([hidden])').length === 2");
    await evaluate("click('[data-contact-open]')");
    await check("q('#contact-composer').open && document.activeElement.name === 'subject'");
    await evaluate("click('[data-contact-close]')");
    await waitFor("!q('#contact-composer').open && document.activeElement === q('[data-contact-open]')");
    await evaluate("window.stanzaOrigin=q('.stanza-card[data-slot=\"0\"] [data-stanza-open]');stanzaOrigin.focus();stanzaOrigin.click()");
    await check("q('#stanza-lightbox').open && q('#stanza-lightbox [data-stanza-close]')===document.activeElement");
    await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await waitFor("!q('#stanza-lightbox').open && document.activeElement===stanzaOrigin");
    const slideFiles = ['performance', 'settings', 'semantic', 'company-feed', 'organisation', 'payroll'];
    for (const file of slideFiles) {
        await waitFor("q('.stanza-card[data-slot=\"0\"] img').naturalWidth>0");
        await check("q('.stanza-card[data-slot=\"0\"] img').currentSrc.endsWith('/images/stanza/cards/" + file + ".webp') && !q('.stanza-card[data-slot=\"0\"] img').hidden");
        await evaluate("click('[data-stanza-next]')");
    }
    await evaluate("q('#node-tenants-elem').focus()");
    await command('Input.dispatchKeyEvent', { type:'keyDown', key:'Enter', code:'Enter', windowsVirtualKeyCode:13, text:'\r' });
    await command('Input.dispatchKeyEvent', { type:'keyUp', key:'Enter', code:'Enter', windowsVirtualKeyCode:13 });
    await check("q('#node-tenants-elem').getAttribute('aria-pressed')==='true' && document.activeElement===q('#node-tenants-elem')");
    await evaluate("q('#tab-btn-sql').focus()");
    await command('Input.dispatchKeyEvent', { type:'keyDown', key:'ArrowRight', code:'ArrowRight', windowsVirtualKeyCode:39 });
    await command('Input.dispatchKeyEvent', { type:'keyUp', key:'ArrowRight', code:'ArrowRight', windowsVirtualKeyCode:39 });
    await check("document.activeElement===q('#tab-btn-rls') && q('#tab-btn-rls').getAttribute('aria-selected')==='true' && q('#code-block-sql').hidden && !q('#code-block-rls').hidden");
    await evaluate("template('saas');view(0);click('#lang-toggle')");
    await waitFor("document.documentElement.dir==='ltr'");
    await evaluate("window.flowSaved=localStorage.getItem('awad-portfolio-studio');window.flowPrice=q('#price-display').dataset.price;window.flowCommercial=q('.commercial-summary').textContent;q('[data-preview-action]').focus()");
    await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
    await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await check("q('.mock-flow-status').textContent.includes('workspace ready') && q('.mock-flow-steps').hidden && document.activeElement===q('[data-preview-action]')");
    await check("flowSaved===localStorage.getItem('awad-portfolio-studio') && flowPrice===q('#price-display').dataset.price && flowCommercial===q('.commercial-summary').textContent");

    await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await evaluate("click('.studio-settings [name=auth]');runAction()");
    await check("q('.mock-flow-feedback').dataset.flowState==='running' && q('.mock-flow-steps [aria-current]').dataset.stage==='api' && q('.mock-flow-steps [data-stage=access]')");
    await waitFor("q('.mock-flow-steps [aria-current]')?.dataset.stage==='access'");
    await evaluate("runAction()");
    await check("q('.mock-flow-steps [aria-current]').dataset.stage==='api'");
    await evaluate("view(1)");
    await check("q('.mock-flow-steps').hidden && !q('.mock-flow-status').textContent && !q('.architecture-explorer').hidden");
    await waitFor("Boolean(q('[data-arch-node=auth]'))");
    await evaluate("view(0);runAction();template('ecommerce')");
    await check("!q('.mock-flow-status').textContent && q('[data-preview-action]').disabled");
    await evaluate("click('[data-cart-add]');runAction()");
    await waitFor("q('.mock-flow-status').textContent.includes('order confirmed')");
    await waitFor("q('.mock-flow-steps').hidden");
    await check("q('[data-cart-count]').textContent==='1' && q('.mock-flow-feedback').getAnimations({subtree:true}).length===0");
    await evaluate("runAction();click('[data-cart-clear]')");
    await check("q('.mock-flow-steps').hidden && !q('.mock-flow-status').textContent && q('[data-preview-action]').disabled");

    await evaluate("template('internal-tool');click('.studio-settings [name=jobs]');set('[data-record-filter]','review','change');runAction()");
    await check("q('.mock-flow-steps [data-stage=queue]')");
    await waitFor("q('.mock-flow-status').textContent.includes('records.csv ready')");
    await check("q('[data-record-filter]').value==='review'");
    await evaluate("runAction();click('#configurator-studio > summary')");
    await waitFor("q('[data-studio-host]').hidden && q('.mock-flow-steps').hidden && !q('.mock-flow-status').textContent");
    await evaluate("click('#configurator-studio > summary');template('landing')");
    await waitFor("!q('[data-studio-host]').hidden");
    await evaluate("if(!q('.studio-settings [name=conversion]').checked)click('.studio-settings [name=conversion]');click('[data-preview-start]');document.activeElement.value='sample@example.test';q('[data-preview-demo]').requestSubmit()");
    await waitFor("q('.mock-flow-status').textContent.includes('Demo request received')");
    await check("document.activeElement.value==='sample@example.test' && !localStorage.getItem('awad-portfolio-studio').includes('sample@example.test')");

    await command('Emulation.setDeviceMetricsOverride', { width: 320, height: 760, deviceScaleFactor: 1, mobile: true });
    await command('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await evaluate("template('saas');click('#lang-toggle');click('[data-preview-viewport=mobile]')");
    await waitFor("document.documentElement.dir==='rtl'");
    const buttonPoint = await evaluate("(() => {const button=q('[data-preview-action]');button.scrollIntoView({block:'center',behavior:'instant'});const rect=button.getBoundingClientRect();return {x:rect.x+rect.width/2,y:rect.y+rect.height/2}})()");
    await command('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [buttonPoint] });
    await command('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await waitFor("q('.mock-flow-status').textContent.includes('محاكاة')");
    await check("q('.studio-preview-frame').scrollWidth<=q('.studio-preview-frame').clientWidth && document.documentElement.scrollWidth===document.documentElement.clientWidth");
    await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await waitFor("q('.mock-flow-status').textContent.includes('جاهزة') && q('.mock-flow-steps').hidden");

    await evaluate("window.mediaPrice = q('#price-display').dataset.price");
    await check("!mediaSlot().hasAttribute('data-media-enabled') && !model() && modelRequests().length===0");
    await evaluate("view(1);mediaEnabled()");
    await check("mediaSlot().dataset.viewer==='idle' && !model() && modelRequests().length===0");
    await evaluate("view(0);showModel()");
    await waitFor("mediaSlot().dataset.viewer==='unavailable'");
    await check("!model() && modelRequests().length===0 && q('.studio-media-status').textContent.includes('صورة توضيحية') && q('#price-display').dataset.price===mediaPrice");
    await evaluate("mediaEnabled()");
    await check("mediaSlot().inert && !model()");

    await evaluate("q('#visualizer-canvas').scrollIntoView({block:'center',behavior:'instant'})");
    await waitFor('databaseDraws>0');
    await evaluate("window.previousDraws=databaseDraws;click('.search-key-btn')");
    await waitFor('databaseDraws>previousDraws');
    await waitFor("q('#terminal-logs').textContent.includes('KEY 15 FOUND') || databaseDraws >= previousDraws+3");
    await new Promise(resolve => setTimeout(resolve, 200));
    await evaluate('window.settledDatabaseDraws=databaseDraws');
    await new Promise(resolve => setTimeout(resolve, 150));
    await check('settledDatabaseDraws===databaseDraws');

    if (process.env.STUDIO_TEST_WEBGL) {
        await command('Network.setBlockedURLs', { urls: [] });
        await command('Emulation.setDeviceMetricsOverride', { width: 1360, height: 900, deviceScaleFactor: 1, mobile: false });
        await command('Emulation.setTouchEmulationEnabled', { enabled: false });
        await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
        // Chromium may cache the failed module load from the offline check for the document's lifetime.
        await command('Page.reload');
        await waitFor("Boolean(q('.architecture-switch'))");
        await evaluate("click('.configurator-toggle');click('#configurator-studio > summary');click('#lang-toggle')");
        await waitFor("document.documentElement.dir==='ltr'");
        await check("!q('.studio-settings [name=enabled]').checked && q('.studio-settings [name=mode]').value==='drag'");
        await evaluate("mediaEnabled()");
        for (const [templateName, viewport, title] of [
            ['landing', 'desktop', 'Explore the launch visual'], ['ecommerce', 'tablet', '3D product showcase'],
            ['saas', 'desktop', 'Interactive media'], ['internal-tool', 'mobile', 'Asset inspection']
        ]) {
            await evaluate(`template('${templateName}');click('[data-preview-viewport=${viewport}]')`);
            await waitFor("mediaSlot().getBoundingClientRect().height > 120");
            await waitFor("ensureModelInView()", 300).catch(async error => {
                const stage = await evaluate("({state: mediaSlot().dataset.viewer, bounds: q('.studio-media-stage').getBoundingClientRect().toJSON(), hidden: document.hidden})");
                throw new Error(`The ${templateName} viewer did not appear: ${JSON.stringify(stage)}`, { cause: error });
            });
            await check(`mediaSlot().dataset.previewMedia==='${templateName}' && mediaSlot().querySelector('h5').textContent==='${title}' &&
                model().loaded && model().getDimensions().x>0 && document.querySelectorAll('.studio-media-stage model-viewer').length===1`);
        }
        await check(`(async () => {
            const bitmap = await createImageBitmap(await model().toBlob());
            const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(bitmap, 0, 0);
            const pixel = ctx.getImageData(bitmap.width >> 1, bitmap.height >> 1, 1, 1).data;
            bitmap.close();
            return pixel[3] > 0;
        })()`);
        await evaluate("window.mediaInstance = model();click('.studio-preview-theme');set('.studio-settings [name=mode]','static','change')");
        await check("model()===mediaInstance && !model().hasAttribute('camera-controls') && !model().hasAttribute('auto-rotate')");
        await evaluate("set('.studio-appearance [name=style]','soft','change')");
        await check("model()===mediaInstance && getComputedStyle(q('.studio-media-card')).borderRadius==='17px'");
        await evaluate("click('[name=preview-layout][value=overview]')");
        await check("model()===mediaInstance && q('.studio-preview').dataset.layout==='overview' && mediaSlot().closest('.mock-ops')");
        await evaluate("set('.studio-settings [name=mode]','orbit','change')");
        await check("model().hasAttribute('camera-controls') && model().hasAttribute('auto-rotate')");
        await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
        await waitFor("!model()?.hasAttribute('auto-rotate') && q('.studio-media-status').textContent.includes('reduced motion')");
        await evaluate("view(1)");
        await waitFor("!model()");
        await check("!mediaInstance.isConnected && !mediaInstance.hasAttribute('auto-rotate')");
        await evaluate("view(0)");
        await waitFor("ensureModelInView()");
        await evaluate("set('.studio-settings [name=mode]','drag','change')");
        await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
        await command('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
        await evaluate("mediaEnabled();mediaEnabled()");
        await evaluate("showModel()");
        await waitFor("ensureModelInView() && model().cameraControls && !model().inert");
        await new Promise(resolve => setTimeout(resolve, 180));
        const { x, y, theta } = await evaluate(`(() => {
            const rect = model().getBoundingClientRect();
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, theta: model().getCameraOrbit().theta };
        })()`);
        await check(`document.elementFromPoint(${x}, ${y})===model()`);
        await command('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        for (let i = 1; i <= 5; i++) {
            await command('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + i * 10, y }] });
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        await command('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await waitFor(`Math.abs(model().getCameraOrbit().theta-(${theta})) > .035`);
        await evaluate("mediaEnabled()");
        await check("!model() && !mediaInstance.isConnected && mediaSlot().inert && modelRequests().length===1");
    }
    await command('Emulation.setDeviceMetricsOverride', { width: 1360, height: 900, deviceScaleFactor: 1, mobile: false });
    await command('Emulation.setTouchEmulationEnabled', { enabled: false });
    await evaluate(`if (document.documentElement.dir==='rtl') click('#lang-toggle');
        view(0);click('[data-preview-viewport=desktop]');
        q('.studio-appearance').open=true;
        window.look=(name,value)=>set('.studio-appearance [name='+name+']',value,'change');
        window.theme=value=>{if(q('.studio-preview').dataset.previewTheme!==value)click('.studio-preview-theme')};
        window.appearancePrice=q('#price-display').dataset.price;`);
    await waitFor("document.documentElement.dir==='ltr'");
    for (const [app, tone, accent, style, typography, density, hex] of [
        ['saas', 'dark', 'violet', 'soft', 'modern', 'comfortable', '#8055dc'],
        ['ecommerce', 'light', 'coral', 'minimal', 'editorial', 'comfortable', '#e3665a'],
        ['landing', 'dark', 'emerald', 'bold', 'modern', 'comfortable', '#17a472'],
        ['internal-tool', 'light', 'cyan', 'minimal', 'technical', 'compact', '#0899bd']
    ]) {
        await evaluate(`template('${app}');theme('${tone}');
            window.mockRoot=q('.studio-template').firstElementChild;
            look('accent','${accent}');look('style','${style}');look('typography','${typography}');look('density','${density}');`);
        await check(`mockRoot===q('.studio-template').firstElementChild && q('.studio-preview').style.getPropertyValue('--appearance-source')==='${hex}' &&
            q('.studio-preview').dataset.style==='${style}' && q('.studio-preview').dataset.typography==='${typography}' &&
            q('.studio-preview').dataset.density==='${density}' && q('#price-display').dataset.price===appearancePrice`);
    }
    await evaluate("q('.studio-appearance summary').focus()");
    for (const open of [false, true]) {
        await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
        await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
        await check(`q('.studio-appearance').open===${open} && document.activeElement===q('.studio-appearance summary')`);
    }
    await evaluate(`q('[data-appearance-hex]').focus();
        set('[data-appearance-hex]','#f0','input');`);
    await check("q('[data-appearance-hex]').getAttribute('aria-invalid')==='true' && q('.studio-appearance [name=accent]').value==='cyan'");
    await evaluate("q('[data-appearance-hex]').select();window.appearanceScroll=scrollY");
    await command('Input.insertText', { text: '#1AB2CF' });
    await check("document.activeElement===q('[data-appearance-hex]') && !q('[data-appearance-hex]').hasAttribute('aria-invalid') && q('.studio-appearance [name=accent]').value==='custom' && q('.studio-preview').style.getPropertyValue('--appearance-source')==='#1ab2cf'");
    await check("scrollY===appearanceScroll");
    await evaluate("set('[data-appearance-picker]','#bf2150','input');click('[data-preview-viewport=tablet]');theme('dark')");
    await check("q('[data-appearance-hex]').value==='#bf2150' && q('.studio-preview-frame').dataset.viewport==='tablet' && q('.studio-preview').dataset.previewTheme==='dark'");
    await evaluate("click('[data-appearance-reset]')");
    await check("q('.studio-appearance [name=accent]').value==='template' && q('.studio-preview').dataset.style==='minimal' && q('.studio-preview').dataset.typography==='modern' && q('.studio-preview').dataset.density==='comfortable' && q('.studio-preview-frame').dataset.viewport==='tablet' && q('.studio-preview').dataset.previewTheme==='dark'");
    await command('Emulation.setDeviceMetricsOverride', { width: 320, height: 760, deviceScaleFactor: 1, mobile: true });
    await evaluate("click('#lang-toggle');look('accent','amber');look('typography','technical')");
    await waitFor("document.documentElement.dir==='rtl' && q('.studio-appearance summary').textContent.includes('المظهر')");
    await check("document.documentElement.scrollWidth===document.documentElement.clientWidth && q('[data-appearance-picker]').getAttribute('aria-label').includes('اختر')");

    await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await evaluate("click('#lang-toggle');click('[data-preview-viewport=desktop]');window.chooseLayout=id=>click('[name=preview-layout][value='+id+']')");
    await waitFor("document.documentElement.dir==='ltr'");
    const layoutPairs = [
        ['saas','sidebar','top'], ['ecommerce','product','catalog'],
        ['landing','split','centered'], ['internal-tool','table','overview']
    ];
    for (const [app, baseline, alternate] of layoutPairs) {
        await evaluate(`template('${app}');window.layoutRoot=q('.studio-template').firstElementChild;chooseLayout('${baseline}')`);
        await check(`q('.studio-preview').dataset.layout==='${baseline}' &&
            [...document.querySelectorAll('[name=preview-layout]')].map(input=>input.value).join(',')==='${baseline},${alternate}'`);
        await evaluate(`chooseLayout('${alternate}')`);
        await check(`q('.studio-preview').dataset.layout==='${alternate}' && layoutRoot===q('.studio-template').firstElementChild &&
            q('.studio-preview').dataset.typography==='technical' && q('.studio-preview').style.getPropertyValue('--appearance-source')==='#d58b16'`);
    }
    await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await evaluate("template('saas');chooseLayout('sidebar');runAction();window.inlineSteps=q('.mock-flow-steps');chooseLayout('top')");
    await check("inlineSteps===q('.mock-flow-steps') && inlineSteps.hidden && !q('.mock-flow-status').textContent && getComputedStyle(q('.mock-sidebar')).flexDirection==='row'");
    await evaluate("runAction()");
    await waitFor("q('.studio-preview').dataset.layout==='top' && q('.mock-flow-status').textContent.includes('workspace ready')");
    await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });

    await evaluate("template('ecommerce');chooseLayout('product');click('[data-cart-add]');click('[data-store-category=lighting]');chooseLayout('catalog');q('.mock-product-details summary').focus()");
    await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
    await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await check("q('.mock-product-details').open && q('[data-cart-count]').textContent==='1' && q('[data-category=furniture]').hidden && getComputedStyle(q('.mock-store-feature')).display==='none'");
    await evaluate("chooseLayout('product')");
    await check("document.activeElement===q('[data-cart-add]') && getComputedStyle(q('.mock-product-details')).display==='none'");
    await evaluate("chooseLayout('catalog');runAction()");
    await check("q('.mock-product-details').open && q('[data-cart-count]').textContent==='1' && q('.mock-flow-status').textContent.includes('confirmed')");

    await evaluate(`template('landing');chooseLayout('split');
        if(!q('.studio-settings [name=conversion]').checked)click('.studio-settings [name=conversion]');
        click('.mock-landing-hero [data-preview-start]');document.activeElement.value='custom@example.test';
        window.formField=document.activeElement;chooseLayout('centered');click('.mock-landing-hero [data-preview-start]')`);
    await check("document.activeElement===formField && formField.value==='custom@example.test' && getComputedStyle(q('.mock-landing-hero')).textAlign==='center'");
    await evaluate("q('[data-preview-demo]').requestSubmit();chooseLayout('split');chooseLayout('centered')");
    await check("q('[data-preview-demo] [role=status]').textContent.length>0");

    await evaluate("template('internal-tool');chooseLayout('table');set('[data-record-filter]','pending','change');chooseLayout('overview');runAction()");
    await check("q('[data-record-filter]').value==='pending' && q('[data-record-status=review]').hidden && q('.mock-flow-status').textContent.includes('ready') && getComputedStyle(q('.mock-workflow')).gridColumnStart==='2'");
    await evaluate("click('[data-appearance-reset]');template('ecommerce')");
    await check("q('.studio-preview').dataset.layout==='catalog'");
    await evaluate("template('internal-tool')");
    await check("q('.studio-preview').dataset.layout==='table' && q('#price-display').dataset.price===appearancePrice");
    await command('Emulation.setDeviceMetricsOverride', { width: 320, height: 760, deviceScaleFactor: 1, mobile: true });
    await evaluate("click('#lang-toggle');click('[data-preview-viewport=mobile]')");
    await waitFor("document.documentElement.dir==='rtl'");
    for (const [app, baseline, alternate] of layoutPairs) {
        for (const id of [baseline, alternate]) {
            await evaluate(`template('${app}');chooseLayout('${id}')`);
            await check("document.documentElement.scrollWidth===document.documentElement.clientWidth && q('.studio-layout-picker legend').textContent==='التخطيط'");
        }
    }
    await waitFor("q('#starfield').getAttribute('aria-hidden')==='true' && getComputedStyle(q('#starfield')).pointerEvents==='none' && !backgroundAnimations().length && !cometTimers.size");
    await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });
    await command('Emulation.setTouchEmulationEnabled', { enabled: false });
    await evaluate("scrollTo({top:0,behavior:'instant'})");
    await waitFor("q('#starfield').width===1944");
    await check("q('#starfield').height===1215 && q('#theme-toggle').getBoundingClientRect().width>0");
    await command('Emulation.setEmulatedMedia', { features: [{ name:'prefers-reduced-motion', value:'no-preference' }] });
    await waitFor("cometTimers.size===1");
    await evaluate("window.stellarBefore=starfieldDraws;window.bounds=()=>JSON.stringify(['#profile-card','.studio-heading'].map(s=>q(s).getBoundingClientRect()));window.foregroundBefore=bounds()");
    await waitFor("starfieldDraws>=stellarBefore+8");
    await check("foregroundBefore===bounds() && !document.documentElement.hasAttribute('data-gravity-dragging')");
    await check("(() => {const r=q('#theme-toggle').getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2).closest('button')===q('#theme-toggle')})()");
    await evaluate("releaseComet()");
    await waitFor("q('.space-comet').getAnimations().length===1");
    const cometStyle = await evaluate("q('.space-comet').getAttribute('style')");
    await check("Number.parseFloat(q('.space-comet').style.getPropertyValue('--comet-duration'))>=1150 && Number.parseFloat(q('.space-comet').style.getPropertyValue('--comet-peak'))<=.52");
    await check("cometTimers.size===0 && !document.elementFromPoint(15,15)?.closest('.space-atmosphere')");
    await waitFor("q('.space-comet').getAnimations().length===0 && cometTimers.size===1");
    await evaluate("releaseComet()");
    await check("q('.space-comet').getAttribute('style')!==" + JSON.stringify(cometStyle));
    const backgroundTab = await (await fetch(new URL('/json/new?about:blank', debug), { method: 'PUT' })).json();
    try {
        const activated = await fetch(new URL('/json/activate/' + backgroundTab.id, debug));
        assert(activated.ok);
        await waitFor("document.hidden && !backgroundAnimations().length && !cometTimers.size");
        await evaluate("window.hiddenDraws=starfieldDraws");
        await new Promise(resolve => setTimeout(resolve, 180));
        await check("starfieldDraws===hiddenDraws");
        await command('Page.bringToFront');
        await waitFor("!document.hidden && starfieldDraws>hiddenDraws && cometTimers.size===1");
    } finally {
        await fetch(new URL('/json/close/' + backgroundTab.id, debug));
    }
    await command('Emulation.setDeviceMetricsOverride', { width: 320, height: 760, deviceScaleFactor: 2, mobile: true });
    await command('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await waitFor("q('#starfield').width===320 && document.documentElement.scrollWidth===320");
    await command('Emulation.setEmulatedMedia', { features: [{ name:'prefers-reduced-motion', value:'reduce' }] });
    await waitFor("!backgroundAnimations().length && !cometTimers.size");
    await evaluate("window.staticDraws=starfieldDraws");
    await new Promise(resolve => setTimeout(resolve, 180));
    await check("starfieldDraws===staticDraws && document.documentElement.scrollWidth===320");
    await evaluate("window.previousTheme=document.documentElement.dataset.theme;click('#theme-toggle')");
    await waitFor("document.documentElement.dataset.theme!==previousTheme && starfieldDraws>staticDraws");
    const production = await (await fetch(url)).text();
    const entry = production.match(/<script type="module"[^>]*src="([^"]+)"/)?.[1];
    assert(entry);
    const bundle = await (await fetch(new URL(entry, url))).text();
    assert.doesNotMatch(bundle, /studio-flow-panel|studio-trace-bar|Drag the request from Browser|workspace-scrubber|How It Works|data-gravity-dragging|Accretion study/);
    assert.deepEqual(runtimeErrors, []);
});
