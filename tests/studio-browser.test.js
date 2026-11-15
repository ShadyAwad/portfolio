import test from 'node:test';
import assert from 'node:assert/strict';

const debug = process.env.STUDIO_CHROME_DEBUG;
const url = process.env.STUDIO_PREVIEW_URL;

test('Creation Engine production workflow and persistence in Chromium', { skip: !(debug && url) }, async t => {
    const origin = new URL(url).origin;
    const tab = await (await fetch(new URL('/json/new?about:blank', debug), { method: 'PUT' })).json();
    const socket = new WebSocket(tab.webSocketDebuggerUrl);
    const pending = new Map();
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
        window.phase = name => click('.universe-phases [data-phase="' + name + '"]');
        window.set = (selector, value, type = 'input') => {
            const element = q(selector);
            element.value = value;
            element.dispatchEvent(new Event(type, { bubbles: true }));
        };
        window.template = value => set('.studio-settings select[name=applicationType]', value, 'change');
        window.scenario = value => set('.challenge-picker select', value, 'change');
        window.sim = (key, value) => set('[data-challenge-input="' + key + '"]', value);
        window.statusIs = name => q('.challenge-status').dataset.status === name;
    `;
    await command('Page.enable');
    await command('Storage.clearDataForOrigin', { origin, storageTypes: 'local_storage' });
    await command('Page.addScriptToEvaluateOnNewDocument', { source: helpers });
    await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await command('Page.navigate', { url });
    await waitFor("Boolean(q('.universe-phases'))");

    await evaluate("click('.configurator-toggle');click('#architecture-planner > summary')");
    await check("q('#architecture-planner').open && q('.capacity-panel') && q('.commercial-panel')");
    for (const name of ['saas', 'ecommerce', 'landing', 'internal-tool']) {
        await evaluate(`template('${name}');view(0)`);
        await check("!q('[data-studio-preview-panel]').hidden && q('.studio-template').children.length");
        await evaluate("view(1)");
        await check("!q('.architecture-explorer').hidden");
        await evaluate("view(2);phase('create');phase('architect');phase('challenge')");
        await check(`q('.universe-stage').dataset.template === '${name}' && !q('.universe-challenge').hidden`);
    }
    await evaluate(`click('.studio-settings [name=jobs]');phase('architect');
        window.queue = q('[data-universe-node=queue]');queue.click();
        view(1);`);
    await check("q('.architecture-explorer .architecture-inspector h4').textContent === 'Background queue'");
    await evaluate(`view(2);phase('challenge');scenario('queue');
        window.saved = localStorage.getItem('awad-portfolio-studio');
        window.price = q('#price-display').dataset.price;
        sim('jobRate',8);`);
    await check("statusIs('saturated')");
    await evaluate("sim('jobRate',10)");
    await check("statusIs('overloaded')");
    await evaluate("sim('jobRate','')");
    await check("statusIs('unavailable')");
    await evaluate(`sim('jobRate',10);
        for (let i = 0; i < 16; i++) {phase('create');phase('architect');phase('challenge');}
        click('.studio-disclosure');`);
    await check("q('#studio-workspace').hidden");
    await evaluate("click('.studio-disclosure')");
    await check("statusIs('overloaded') && queue === q('[data-universe-node=queue]') && queue.getAttribute('aria-pressed') === 'true'");
    await evaluate("click('.challenge-grid fieldset button')");
    await check("statusIs('nominal') && price === q('#price-display').dataset.price && saved === localStorage.getItem('awad-portfolio-studio')");
    await evaluate("click('#theme-toggle');click('#lang-toggle')");
    await waitFor("document.documentElement.dir === 'rtl' && document.documentElement.dataset.theme === 'light'");
    await check("q('.universe-phases [data-phase=create]').textContent === 'إنشاء'");
    await command('Page.reload');
    await waitFor("q('.studio-settings select[name=applicationType]')?.value === 'internal-tool'");
    await check("q('.studio-settings [name=jobs]').checked && q('.universe-panel').hidden");
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
});
