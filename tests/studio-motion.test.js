import test from 'node:test';
import assert from 'node:assert/strict';
import { mountUniverseMotion } from '../src/studio/universe/motion.js';

test('Universe motion coalesces pointer events and cleans up frames, listeners, and observers', t => {
    const document = new EventTarget();
    document.hidden = false;
    const media = new EventTarget();
    media.matches = false;
    const stage = new EventTarget();
    const styles = new Map();
    stage.style = { setProperty: styles.set.bind(styles), removeProperty: styles.delete.bind(styles) };
    stage.closest = () => null;
    stage.querySelectorAll = () => [];
    stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
    let setVisibility;
    let disconnected = false;
    const frames = new Map();
    let frameId = 0;
    const mocks = {
        document,
        matchMedia: () => media,
        IntersectionObserver: class {
            constructor(callback) { setVisibility = isIntersecting => callback([{ isIntersecting }]); }
            observe(target) { assert.equal(target, stage); }
            disconnect() { disconnected = true; }
        },
        requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; },
        cancelAnimationFrame: id => frames.delete(id)
    };
    for (const [key, value] of Object.entries(mocks)) {
        const original = Object.getOwnPropertyDescriptor(globalThis, key);
        Object.defineProperty(globalThis, key, { configurable: true, value });
        t.after(() => original ? Object.defineProperty(globalThis, key, original) : delete globalThis[key]);
    }
    let suspensions = 0;
    const motion = mountUniverseMotion(stage, () => suspensions++);
    const move = () => stage.dispatchEvent(Object.assign(new Event('pointermove'),
        { pointerType: 'mouse', clientX: 40, clientY: 45 }));
    move();
    assert.equal(frames.size, 0);
    setVisibility(true);
    move();
    move();
    assert.equal(frames.size, 1);
    const draw = frames.get(frameId);
    frames.delete(frameId);
    draw();
    assert(styles.has('--universe-x'));

    move();
    document.hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(frames.size, 0);
    assert.equal(styles.size, 0);
    document.hidden = false;
    media.matches = true;
    media.dispatchEvent(new Event('change'));
    move();
    assert.equal(frames.size, 0);
    media.matches = false;
    move();
    assert.equal(frames.size, 1);

    motion.destroy();
    assert.equal(frames.size, 0);
    assert(disconnected);
    move();
    media.dispatchEvent(new Event('change'));
    assert.equal(frames.size, 0);
    assert.equal(suspensions, 2);
});
