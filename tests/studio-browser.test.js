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
        window.traceAction = () => click('[data-preview-action]');
        window.openTrace = () => click('[data-preview-trace]');
        window.returnToPreview = () => click('.studio-trace-bar button');
        window.completeTrace = () => set('#workspace-scrubber',q('#workspace-scrubber').max);
        window.traceSaved = localStorage.getItem('awad-portfolio-studio');
        window.tracePrice = q('#price-display').dataset.price;
        window.traceCommercial = q('.commercial-summary').textContent;
        traceAction();`);
    await check("q('.flow-panel').hidden && !q('[data-preview-trace]').hidden && q('.mock-trace').hasAttribute('data-trace-complete') && q('.workspace-preview-motion').getAnimations({subtree:true}).length===0");
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
    await check("q('.mock-trace-status').textContent.includes('workspace ready') && traceSaved===localStorage.getItem('awad-portfolio-studio') && tracePrice===q('#price-display').dataset.price && traceCommercial===q('.commercial-summary').textContent");
    await evaluate("openTrace();completeTrace()");
    await check("q('.workspace-outcome').textContent==='Workspace ready'");
    await evaluate("click('[data-playback=reset]');click('[data-playback=play]');click('.configurator-toggle')");
    await waitFor("q('[data-studio-host]').hidden && document.activeElement===q('.configurator-toggle')");
    await check("q('[data-playback=play]').getAttribute('aria-pressed')==='false' && !q('.workspace-field').hasAttribute('data-travel')");
    await evaluate("click('.configurator-toggle');returnToPreview()");

    await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await evaluate("traceAction();window.restartedPulse=q('.workspace-preview-motion').getAnimations({subtree:true});traceAction()");
    await check("q('.workspace-preview-motion').dataset.pulse==='running' && q('.flow-panel').hidden && restartedPulse.length>0 && restartedPulse.every(effect=>effect.playState==='idle')");
    await waitFor("q('.workspace-preview-motion').dataset.pulse==='ready' && q('.mock-trace-status').textContent.includes('workspace ready')");
    await check("q('.workspace-preview-motion').getAnimations({subtree:true}).length===0 && traceSaved===localStorage.getItem('awad-portfolio-studio') && tracePrice===q('#price-display').dataset.price");
    await evaluate("traceAction();window.oldPulse=q('.workspace-preview-motion');view(1)");
    await waitFor("oldPulse.dataset.pulse==='idle' && oldPulse.getAnimations({subtree:true}).length===0");
    await evaluate("view(0);traceAction();template('ecommerce');template('landing');template('saas')");
    await check("!oldPulse.isConnected && oldPulse.getAnimations({subtree:true}).length===0 && q('[data-preview-trace]').hidden");
    await evaluate("click('.studio-preview-theme');traceAction()");
    await check("q('.workspace-preview-motion').dataset.pulse==='running'");
    await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await waitFor("q('.workspace-preview-motion').dataset.pulse==='ready' && q('.workspace-preview-motion').getAnimations({subtree:true}).length===0");

    await evaluate(`for (const key of ['auth','tenancy','jobs']) {
        const control = q('.studio-settings [name='+key+']');
        if (control.checked) control.click();
    }`);
    await check("!q('[data-pulse-node=access]') && q('.workspace-preview-motion').dataset.pulse==='idle'");
    await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await evaluate("traceAction();window.oldJourney=q('.workspace-preview-motion svg');window.oldEffects=oldJourney.getAnimations({subtree:true});click('.studio-settings [name=auth]')");
    await check("!oldJourney.isConnected && oldEffects.every(effect=>effect.playState==='idle') && q('.workspace-preview-motion').dataset.pulse==='idle' && !q('.mock-trace').hasAttribute('data-trace-complete') && !q('[data-preview-trace]').hidden");
    await check("q('[data-pulse-node=access]').parentElement.textContent.includes('Session') && q('#workspace-pulse-route').textContent.includes('API → Session → Database') && q('.workspace-preview-motion').getAnimations({subtree:true}).length<=1");
    await evaluate(`window.secureJourney=q('.workspace-preview-motion svg');
        click('.studio-settings [name=jobs]');
        window.secureSaved=localStorage.getItem('awad-portfolio-studio');
        traceAction();`);
    await check("secureJourney===q('.workspace-preview-motion svg') && q('.workspace-preview-motion').dataset.pulse==='running' && secureJourney.querySelectorAll('.workspace-pulse-lanes path').length===5");
    await waitFor("Number(getComputedStyle(q('.workspace-pulse-verified')).opacity)>.55");
    await waitFor("q('.workspace-preview-motion').dataset.pulse==='ready'");
    await check("localStorage.getItem('awad-portfolio-studio')===secureSaved && q('#price-display').dataset.price===tracePrice && secureJourney.getAnimations({subtree:true}).length===0");
    await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await evaluate("click('.studio-settings [name=tenancy]');click('.studio-settings [name=auth]')");
    await check("q('[data-pulse-node=access]').parentElement.textContent.includes('Scope') && q('.workspace-preview-motion').getAnimations({subtree:true}).length===0");
    await evaluate("traceAction();openTrace()");
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
    }
    await waitFor("!q('.flow-panel').hidden");
    await check("q('[data-pulse-node=browser]').closest('g[transform]').getAttribute('transform').startsWith('translate(315 ')");
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
    assert.deepEqual(runtimeErrors, []);
});
