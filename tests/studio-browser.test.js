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
        window.scenario = value => set('[data-flow-scenario]', value, 'change');
        window.traceAction = () => click('[data-preview-action]');
        window.openTrace = () => click('[data-preview-trace]');
        window.returnToPreview = () => click('.studio-trace-bar button');
        window.completeTrace = () => set('#workspace-scrubber',q('#workspace-scrubber').max);
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
        window.databaseDraws = 0;
        const clear = CanvasRenderingContext2D.prototype.clearRect;
        CanvasRenderingContext2D.prototype.clearRect = function (...args) {
            if (this.canvas.id === 'visualizer-canvas') databaseDraws++;
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
    await waitFor("Boolean(q('.flow-toolbar'))");

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
        await evaluate("view(2)");
        await check(`q('[data-flow-scenario]').options.length >= 2 && !q('.flow-panel').hidden && q('.flow-route [aria-current=step]').dataset.flowStep === '0'`);
    }
    await evaluate(`click('.studio-settings [name=jobs]');view(1);
        q('[data-arch-node=queue]').dispatchEvent(new MouseEvent('click',{bubbles:true}));`);
    await check("q('.architecture-explorer .architecture-inspector h4').textContent === 'Background queue'");
    await evaluate(`view(2);scenario('report');
        window.saved = localStorage.getItem('awad-portfolio-studio');
        window.price = q('#price-display').dataset.price;
        set('[data-flow-load]','saturated','change');`);
    await check("q('.flow-panel').dataset.loadStatus === 'saturated'");
    await evaluate("set('[data-flow-load]','overloaded','change');click('[data-playback=step]')");
    await check("q('.flow-panel').dataset.loadStatus === 'overloaded' && q('.flow-load dd:last-child') && q('.flow-route [aria-current=step]').dataset.flowStep === '1' && q('.flow-packet').getAnimations().length === 0");
    await evaluate(`window.routeStart=q('[data-flow-step="0"]');
        for (let i = 0; i < 16; i++) {view(1);view(2);}
        click('#configurator-studio > summary');`);
    await waitFor("q('[data-studio-host]').hidden");
    await evaluate("click('.configurator-toggle');click('.configurator-toggle');click('#configurator-studio > summary')");
    await waitFor("!q('[data-studio-host]').hidden");
    await check("q('.flow-panel').dataset.loadStatus === 'overloaded' && routeStart === q('[data-flow-step=\"0\"]') && q('.flow-route [aria-current=step]').dataset.flowStep === '1'");
    await evaluate("click('[data-playback=reset]');set('[data-flow-load]','normal','change')");
    await check("q('.flow-panel').dataset.loadStatus === 'nominal' && q('.flow-route [aria-current=step]').dataset.flowStep === '0'");
    await check("price === q('#price-display').dataset.price");
    await check("saved === localStorage.getItem('awad-portfolio-studio')");

    await evaluate("click('#theme-toggle');click('#lang-toggle')");
    await waitFor("document.documentElement.dir === 'rtl' && document.documentElement.dataset.theme === 'light'");
    await waitFor("q('.architecture-switch button:last-child').textContent === 'كيف يعمل'");
    await command('Page.reload');
    await waitFor("Boolean(q('.flow-toolbar'))");
    await evaluate("click('.configurator-toggle');click('#configurator-studio > summary')");
    await waitFor("q('.studio-settings select[name=applicationType]')?.value === 'internal-tool'");
    await check("q('.studio-settings [name=jobs]').checked && q('.flow-panel').hidden");
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
    await evaluate("template('saas');view(2);scenario('workspace')");
    await check("!q('.workspace-interaction').hidden && !q('[data-socket=access]')");
    await evaluate("click('.studio-settings [name=auth]');click('.studio-settings [name=tenancy]')");
    await check("!q('[data-socket=access]').hidden && q('.flow-route ol').children.length === 7");
    await evaluate("q('.workspace-field').scrollIntoView({block:'center',behavior:'instant'})");
    const centers = await evaluate(`['.workspace-token','[data-socket=api] i'].map(selector => {
        const rect = q(selector).getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    })`);
    await command('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...centers[0] });
    await command('Input.dispatchMouseEvent', { type: 'mouseMoved', button: 'left', buttons: 1, ...centers[1] });
    await waitFor(`Math.abs(q('.workspace-token').getBoundingClientRect().x + 22 - ${centers[1].x}) < 2`);
    await command('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...centers[1] });
    await waitFor("q('[data-flow-step=\"1\"]').hasAttribute('aria-current')");
    await evaluate("click('[data-playback=reset]')");
    await evaluate("q('.flow-toolbar').scrollIntoView();q('.workspace-token').focus()");
    await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
    await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await waitFor("q('[data-playback=play]').getAttribute('aria-pressed') === 'true' && q('[data-flow-step=\"1\"]').hasAttribute('aria-current')");
    await evaluate("click('[data-playback=play]');click('[data-playback=step]')");
    await check("q('[data-flow-step=\"2\"]').hasAttribute('aria-current') && !q('.workspace-field').hasAttribute('data-travel')");
    await evaluate("click('[data-playback=play]');set('#workspace-scrubber','6')");
    await check("q('#workspace-scrubber').value==='6' && q('.workspace-field').hasAttribute('data-delivered') && q('[data-socket=browser]').hasAttribute('data-active') && q('[data-playback=play]').getAttribute('aria-pressed')==='false'");
    await evaluate("set('#workspace-scrubber','3')");
    await check("q('[data-socket=access]').hasAttribute('data-active') && q('[data-socket=api]').hasAttribute('data-complete') && q('.workspace-field').dataset.channel==='request'");
    await evaluate("click('[data-playback=play]')");
    await check("q('#workspace-scrubber').value==='4' && q('[data-socket=postgres]').hasAttribute('data-active')");
    await evaluate("click('[data-playback=reset]')");
    await check("q('#workspace-scrubber').value==='0' && q('[data-socket=browser]').hasAttribute('data-active') && !q('.workspace-field').hasAttribute('data-delivered')");
    await evaluate("click('[data-playback=reset]');scenario('report')");
    await check("q('.workspace-interaction').hidden && !q('.flow-load').hidden && q('[data-flow-step=\"0\"]').hasAttribute('aria-current')");
    await evaluate("template('ecommerce');scenario('checkout')");
    await check("q('.workspace-field').dataset.variant==='checkout' && !q('[data-socket=queue]') && q('.flow-load').hidden");
    await evaluate("click('.studio-settings [name=jobs]')");
    await check("q('[data-socket=queue]') && !q('.flow-load').hidden");
    await evaluate("window.checkoutLast=Number(q('#workspace-scrubber').max);set('#workspace-scrubber',String(checkoutLast-2))");
    await check("q('.workspace-field').hasAttribute('data-confirmed') && q('.workspace-field').dataset.channel==='response' && q('[data-socket=browser]').hasAttribute('data-active')");
    await evaluate("set('#workspace-scrubber',String(checkoutLast-1))");
    await check("q('.workspace-field').hasAttribute('data-confirmed') && q('.workspace-field').dataset.channel==='background' && q('[data-socket=queue]').hasAttribute('data-active')");
    await evaluate("click('[data-playback=play]');click('[data-playback=reset]');template('internal-tool');scenario('report')");
    await check("q('.workspace-field').dataset.variant==='export' && q('[data-socket=artifact]') && !q('.workspace-field').hasAttribute('data-confirmed')");
    await evaluate("set('#workspace-scrubber',q('#workspace-scrubber').max)");
    await check("q('.workspace-field').hasAttribute('data-artifact') && q('.workspace-field').hasAttribute('data-delivered') && q('.workspace-outcome').textContent.includes('records.csv')");
    await evaluate("for (let i=0;i<8;i++){scenario('filter');scenario('report')}");
    await check("!q('.workspace-field').hasAttribute('data-artifact') && q('#workspace-scrubber').value==='0' && document.querySelectorAll('.workspace-token').length===1");

    await evaluate("click('#lang-toggle')");
    await waitFor("document.documentElement.lang === 'en' && q('.architecture-switch button:last-child').textContent === 'How It Works'");
    await evaluate(`view(0);template('saas');
        window.traceSaved = localStorage.getItem('awad-portfolio-studio');
        window.tracePrice = q('#price-display').dataset.price;
        window.traceCommercial = q('.commercial-summary').textContent;
        traceAction();`);
    await check("q('.flow-panel').hidden && !q('[data-preview-trace]').hidden && !q('.workspace-request-surface').hidden && q('.workspace-preview-motion').getAnimations({subtree:true}).length===0");
    await evaluate("q('[data-preview-trace]').focus()");
    await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
    await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await check("!q('.flow-panel').hidden && q('[data-flow-scenario]').value==='workspace' && document.activeElement===q('[data-flow-scenario]') && q('#workspace-scrubber').value==='0' && q('[data-socket=access]')");
    await evaluate("click('[data-playback=play]')");
    await check("q('[data-playback=play]').getAttribute('aria-pressed')==='true' && !q('.mock-trace').hasAttribute('data-trace-complete')");
    await evaluate("returnToPreview()");
    await check("q('.flow-panel').hidden && q('[data-playback=play]').getAttribute('aria-pressed')==='false' && document.activeElement===q('[data-preview-action]')");
    await evaluate("openTrace();completeTrace()");
    await check("q('.mock-trace').hasAttribute('data-trace-complete')");
    await evaluate("click('[data-playback=reset]');returnToPreview()");
    await check("!q('.mock-trace').hasAttribute('data-trace-complete') && !q('[data-preview-trace]').hidden");
    await evaluate("openTrace();completeTrace();returnToPreview()");
    await check("q('.mock-trace-status').textContent.includes('workspace ready')");
    await check("traceSaved===localStorage.getItem('awad-portfolio-studio') && tracePrice===q('#price-display').dataset.price && traceCommercial===q('.commercial-summary').textContent");
    await evaluate("openTrace();completeTrace()");
    await check("q('.workspace-outcome').textContent==='Workspace ready'");
    await evaluate("click('[data-playback=reset]');click('[data-playback=play]');click('.configurator-toggle')");
    await waitFor("q('[data-studio-host]').hidden && document.activeElement===q('.configurator-toggle')");
    await check("q('[data-playback=play]').getAttribute('aria-pressed')==='false' && !q('.workspace-field').hasAttribute('data-travel')");
    await evaluate("click('.configurator-toggle');returnToPreview()");

    await command('Emulation.setDeviceMetricsOverride', { width: 1280, height: 860, deviceScaleFactor: 1, mobile: false });
    await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await evaluate("click('[data-preview-viewport=desktop]');window.metricsY=q('.mock-metrics').offsetTop;traceAction();window.oldEntrance=q('.workspace-request-surface').getAnimations();traceAction()");
    await check("q('.workspace-preview-motion').dataset.pulse==='open' && q('.flow-panel').hidden && oldEntrance.every(effect=>effect.playState==='idle') && q('.mock-metrics').offsetTop===metricsY");
    await evaluate("click('[data-workspace-close]')");
    await check("q('.workspace-request-surface').hidden && document.activeElement===q('[data-preview-action]')");
    await evaluate("traceAction();view(1)");
    await waitFor("q('.workspace-request-surface').hidden && q('.workspace-preview-motion').getAnimations({subtree:true}).length===0");
    await evaluate("view(0);traceAction();window.oldPulse=q('.workspace-preview-motion');template('ecommerce');template('landing');template('saas')");
    await check("!oldPulse.isConnected && oldPulse.getAnimations({subtree:true}).length===0 && q('[data-preview-trace]').hidden");

    await evaluate(`for (const key of ['auth','tenancy','jobs']) {
        const control = q('.studio-settings [name='+key+']');
        if (control.checked) control.click();
    }
    traceAction();q('.workspace-request-surface').scrollIntoView({block:'center',behavior:'instant'});`);
    await waitFor("q('.workspace-request-surface').getAnimations().length===0");
    await check("!q('[data-pulse-node=access]') && document.activeElement===q('.workspace-field-token')");
    const previewCenters = await evaluate(`['.workspace-field-token','[data-next] .workspace-field-socket'].map(selector => {
        const r = q(selector).getBoundingClientRect();
        return {x:r.x+r.width/2,y:r.y+r.height/2};
    })`);
    await command('Input.dispatchMouseEvent', { type: 'mousePressed', ...previewCenters[0], button: 'left', buttons: 1, clickCount: 1 });
    for (let i = 1; i <= 6; i++) {
        await command('Input.dispatchMouseEvent', { type: 'mouseMoved', button: 'left', buttons: 1,
            x: previewCenters[0].x + (previewCenters[1].x-previewCenters[0].x)*i/6,
            y: previewCenters[0].y + (previewCenters[1].y-previewCenters[0].y)*i/6 });
    }
    await check("q('.workspace-request-board').hasAttribute('data-drag') && Number(q('.workspace-request-board').style.getPropertyValue('--pull'))>.7");
    await command('Input.dispatchMouseEvent', { type: 'mouseReleased', ...previewCenters[1], button: 'left', buttons: 0, clickCount: 1 });
    await waitFor("q('.workspace-field-node[data-current]').dataset.pulseNode==='api'");
    await check("!q('.mock-trace').hasAttribute('data-trace-complete') && !q('.workspace-request-board').hasAttribute('data-drag')");
    await evaluate("click('.workspace-field-token')");
    await waitFor("q('.workspace-preview-motion').dataset.pulse==='ready'");
    await waitFor("q('.workspace-request-surface').hidden && document.activeElement===q('[data-preview-action]')");
    await check("q('.workspace-preview-motion').getAnimations({subtree:true}).length===0 && q('#price-display').dataset.price===tracePrice");

    await evaluate("click('.studio-preview-theme');click('[data-preview-viewport=tablet]');traceAction();click('[data-workspace-run]');window.oldJourney=q('.workspace-request-surface');click('.studio-settings [name=auth]')");
    await check("!oldJourney.isConnected && oldJourney.getAnimations({subtree:true}).length===0 && q('.workspace-request-surface').hidden && !q('.mock-trace').hasAttribute('data-trace-complete') && !q('[data-preview-trace]').hidden");
    await check("q('[data-pulse-node=access]').textContent.includes('Session') && q('#workspace-pulse-route').textContent.includes('API → Session → Database')");
    await evaluate(`window.secureJourney=q('.workspace-request-surface');
        click('.studio-settings [name=jobs]');
        window.secureSaved=localStorage.getItem('awad-portfolio-studio');
        traceAction();click('[data-workspace-run]');`);
    await check("secureJourney===q('.workspace-request-surface') && q('.workspace-pulse-lanes').children.length===5");
    await waitFor("Number(getComputedStyle(q('.workspace-field-verified')).opacity)>.55");
    await waitFor("q('.workspace-preview-motion').dataset.pulse==='ready'");
    await check("localStorage.getItem('awad-portfolio-studio')===secureSaved && q('#price-display').dataset.price===tracePrice");

    await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await evaluate("click('.studio-settings [name=tenancy]');click('.studio-settings [name=auth]');traceAction()");
    await check("q('[data-pulse-node=access]').textContent.includes('Scope') && q('.workspace-preview-motion').getAnimations({subtree:true}).length===0");
    for (let step = 0; step < 3; step++) {
        await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
        await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    }
    await check("q('.workspace-preview-motion').dataset.pulse==='ready' && q('.workspace-preview-motion').getAnimations({subtree:true}).length===0");
    await evaluate("traceAction()");
    await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await check("q('.workspace-request-surface').hidden && document.activeElement===q('[data-preview-action]')");
    await evaluate("openTrace()");
    await check("q('[data-flow-scenario]').value==='workspace' && q('.flow-route [data-component=tenant]') && !q('.flow-route [data-component=auth]')");
    await evaluate("completeTrace();returnToPreview()");
    await check("q('.workspace-preview-motion').dataset.pulse==='ready' && document.activeElement===q('[data-preview-action]')");

    await evaluate("template('ecommerce')");
    await check("q('[data-preview-action]').disabled && q('[data-preview-trace]').hidden");
    await evaluate("click('[data-cart-add]');traceAction();openTrace()");
    await check("q('[data-flow-scenario]').value==='checkout' && q('.studio-trace-bar p').textContent.includes('Quantity: 1') && q('[data-socket=queue]')");
    await evaluate("set('#workspace-scrubber',String(Number(q('#workspace-scrubber').max)-3))");
    await check("!q('.mock-trace').hasAttribute('data-trace-complete')");
    await evaluate("set('#workspace-scrubber',String(Number(q('#workspace-scrubber').max)-2));returnToPreview()");
    await check("q('.mock-trace-status').textContent.includes('order confirmed') && q('[data-cart-count]').textContent==='1'");
    await evaluate("click('[data-cart-clear]')");
    await check("q('[data-preview-trace]').hidden && !q('.mock-trace').hasAttribute('data-trace-complete')");
    await evaluate("click('[data-cart-add]');traceAction();openTrace();click('[data-playback=play]');template('internal-tool');scenario('report');completeTrace();returnToPreview()");
    await check("q('[data-preview-trace]').hidden && !q('.mock-trace').hasAttribute('data-trace-complete')");

    await evaluate("set('[data-record-filter]','review','change');traceAction();openTrace()");
    await check("q('[data-flow-scenario]').value==='report' && q('.studio-trace-bar p').textContent.includes('In review')");
    await evaluate("completeTrace();scenario('filter');scenario('report');completeTrace();returnToPreview()");
    await check("!q('.mock-trace').hasAttribute('data-trace-complete')");
    await evaluate("openTrace();completeTrace();returnToPreview()");
    await check("q('.mock-trace-status').textContent.includes('records.csv ready') && q('[data-record-filter]').value==='review'");
    await evaluate("click('[data-studio-reset]');template('landing')");
    await check("!q('[data-preview-action]') && q('.flow-panel').hidden");

    await command('Emulation.setDeviceMetricsOverride', { width: 320, height: 760, deviceScaleFactor: 1, mobile: true });
    await command('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await evaluate("click('#lang-toggle');click('#theme-toggle');template('saas')");
    await waitFor("document.documentElement.dir==='rtl' && q('[data-preview-action]').textContent.includes('تحميل')");
    for (const selector of ['[data-preview-action]', '[data-preview-trace]']) {
        const point = await evaluate(`(() => {
            const button = q('${selector}');
            button.scrollIntoView({ block: 'center', behavior: 'instant' });
            const r = button.getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        })()`);
        await command('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
        await command('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        if (selector === '[data-preview-action]') {
            await check("!q('.workspace-request-surface').hidden && q('.workspace-request-surface').getBoundingClientRect().width<=innerWidth");
            const mobileDrag = await evaluate(`(() => {
                const point = selector => {
                    const r = q(selector).getBoundingClientRect();
                    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
                };
                return { start: point('.workspace-field-token'), end: point('[data-next] .workspace-field-socket'), scroll: scrollY };
            })()`);
            await command('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [mobileDrag.start] });
            for (let i = 1; i <= 5; i++) {
                await command('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{
                    x: mobileDrag.start.x + (mobileDrag.end.x - mobileDrag.start.x) * i / 5,
                    y: mobileDrag.start.y + (mobileDrag.end.y - mobileDrag.start.y) * i / 5
                }] });
            }
            await command('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            await waitFor("q('.workspace-field-node[data-current]').dataset.pulseNode==='api'");
            await check(`scrollY===${mobileDrag.scroll}`);
            await command('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [mobileDrag.end] });
            await command('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            await check("q('.workspace-preview-motion').dataset.pulse==='ready'");
        }
    }
    await waitFor("!q('.flow-panel').hidden");
    await check("parseFloat(q('[data-pulse-node=browser]').style.left) > parseFloat(q('[data-pulse-node=api]').style.left)");
    await check("q('.studio-trace-bar button').textContent.includes('العودة') && q('.flow-panel').scrollWidth <= q('.flow-panel').clientWidth");
    await evaluate("completeTrace();returnToPreview()");
    await check("q('.mock-trace-status').textContent.includes('جاهزة') && q('.studio-preview-frame').scrollWidth <= q('.studio-preview-frame').clientWidth");
    await check("document.documentElement.scrollWidth===document.documentElement.clientWidth");

    await evaluate("window.mediaPrice = q('#price-display').dataset.price");
    await check("!mediaSlot().hasAttribute('data-media-enabled') && !model() && modelRequests().length===0");
    await evaluate("view(2);mediaEnabled()");
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
        await waitFor("Boolean(q('.flow-toolbar'))");
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
        await evaluate("view(2)");
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
    await evaluate("template('saas');chooseLayout('sidebar');traceAction();window.workspaceField=q('.workspace-request-surface');chooseLayout('top')");
    await check("workspaceField===q('.workspace-request-surface') && workspaceField.hidden && !q('[data-preview-trace]').hidden && getComputedStyle(q('.mock-sidebar')).flexDirection==='row'");
    await evaluate("traceAction();click('[data-workspace-run]');openTrace();completeTrace();returnToPreview()");
    await check("q('.studio-preview').dataset.layout==='top' && q('.mock-trace-status').textContent.includes('workspace ready')");

    await evaluate("template('ecommerce');chooseLayout('product');click('[data-cart-add]');click('[data-store-category=lighting]');chooseLayout('catalog');q('.mock-product-details summary').focus()");
    await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
    await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await check("q('.mock-product-details').open && q('[data-cart-count]').textContent==='1' && q('[data-category=furniture]').hidden && getComputedStyle(q('.mock-store-feature')).display==='none'");
    await evaluate("chooseLayout('product')");
    await check("document.activeElement===q('[data-cart-add]') && getComputedStyle(q('.mock-product-details')).display==='none'");
    await evaluate("chooseLayout('catalog');traceAction();openTrace();completeTrace();returnToPreview()");
    await check("q('.mock-product-details').open && q('[data-cart-count]').textContent==='1' && q('.mock-trace-status').textContent.includes('confirmed')");

    await evaluate(`template('landing');chooseLayout('split');
        if(!q('.studio-settings [name=conversion]').checked)click('.studio-settings [name=conversion]');
        click('.mock-landing-hero [data-preview-start]');document.activeElement.value='custom@example.test';
        window.formField=document.activeElement;chooseLayout('centered');click('.mock-landing-hero [data-preview-start]')`);
    await check("document.activeElement===formField && formField.value==='custom@example.test' && getComputedStyle(q('.mock-landing-hero')).textAlign==='center'");
    await evaluate("q('[data-preview-demo]').requestSubmit();chooseLayout('split');chooseLayout('centered')");
    await check("q('[data-preview-demo] [role=status]').textContent.length>0");

    await evaluate("template('internal-tool');chooseLayout('table');set('[data-record-filter]','pending','change');chooseLayout('overview');traceAction();openTrace();completeTrace();returnToPreview()");
    await check("q('[data-record-filter]').value==='pending' && q('[data-record-status=review]').hidden && q('.mock-trace-status').textContent.includes('ready') && getComputedStyle(q('.mock-workflow')).gridColumnStart==='2'");
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
    assert.deepEqual(runtimeErrors, []);
});
