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
    async function waitFor(expression) {
        for (let attempt = 0; attempt < 100; attempt++) {
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
    `;
    await command('Page.enable');
    await command('Runtime.enable');
    await command('Storage.clearDataForOrigin', { origin, storageTypes: 'local_storage' });
    await command('Page.addScriptToEvaluateOnNewDocument', { source: helpers });
    await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await command('Page.navigate', { url });
    await waitFor("Boolean(q('.flow-toolbar'))");

    await check("q('[data-studio-host]').hidden && q('.studio-invite').hidden");
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
    await check("q('.flow-panel').dataset.loadStatus === 'nominal' && q('.flow-route [aria-current=step]').dataset.flowStep === '0' && price === q('#price-display').dataset.price && saved === localStorage.getItem('awad-portfolio-studio')");

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
    await check("q('.flow-panel').hidden && !q('[data-preview-trace]').hidden && !q('.mock-trace').hasAttribute('data-trace-complete')");
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
    await check("q('.studio-trace-bar button').textContent.includes('العودة') && q('.flow-panel').scrollWidth <= q('.flow-panel').clientWidth");
    await evaluate("completeTrace();returnToPreview()");
    await check("q('.mock-trace-status').textContent.includes('جاهزة') && q('.studio-preview-frame').scrollWidth <= q('.studio-preview-frame').clientWidth");
    assert.deepEqual(runtimeErrors, []);
});
