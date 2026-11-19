import test from 'node:test';
import assert from 'node:assert/strict';
import { createGrains, gutterPlacement, mountGalaxy, orbit } from '../src/components/spiral-galaxy.js';

test('seeded dust keeps its identity and a bounded opacity and radius', () => {
    const grains = createGrains(512);
    assert.deepEqual(grains, createGrains(512));
    assert.notDeepEqual(grains, createGrains(512, 123));
    assert.deepEqual(new Set(grains.map(g => g.band)), new Set([0, 1, 2]));
    assert(grains.every(g => g.r > 0 && g.r <= 1 && g.alpha >= 0 && g.alpha <= 1));
});

test('differential motion preserves arm alignment at long uptime', () => {
    assert.notEqual(orbit(5, 0) - orbit(0, 0), orbit(5, 2) - orbit(0, 2));
    for (const t of [0, 5, 100, 1e6]) {
        assert(Math.abs(orbit(t, 0) - orbit(t, 2)) < .28);
        assert(Math.abs(orbit(t + .05, 1) - orbit(t, 1)) < .005);
    }
});

test('galaxy always fits outside the grid and disappears in a phone gutter', () => {
    assert.equal(gutterPlacement(320, 320, 720), null);
    for (const width of [1500, 1680, 1920, 2560]) {
        const edge = (width + 1320) / 2;
        const p = gutterPlacement(edge, width, 900);
        assert(p.x - p.radius > edge && p.x + p.radius < width);
        assert(p.radius <= 99);
    }
});

test('drawing reuses cached plates, sheds sparks under pressure and releases interaction on cleanup', t => {
    const hit = Object.assign(new EventTarget(), {
        style: {}, setAttribute() { }, setPointerCapture(id) { this.capture = id; },
        hasPointerCapture(id) { return this.capture === id; },
        releasePointerCapture() { this.capture = null; }, remove() { this.removed = true; }
    });
    const ctx = {
        save() { }, restore() { }, rotate() { }, scale() { }, translate() { }, fillRect() { },
        drawImage() { }, createRadialGradient: () => ({ addColorStop() { } })
    };
    let plates = 0, time = 0, active = true;
    t.mock.method(performance, 'now', () => time += 4);
    const previous = globalThis.document;
    globalThis.document = {
        createElement(tag) {
            if (tag === 'button') return hit;
            plates++;
            return { getContext() { return { ...ctx, canvas: this }; } };
        }
    };
    t.after(() => { if (previous) globalThis.document = previous; else delete globalThis.document; });
    const motion = { matches: false };
    const galaxy = mountGalaxy({ after() { } }, motion, () => ({ x: 100, y: 100, radius: 60 }), () => active);
    galaxy.resize(500, 400, 1);
    galaxy.resize(500, 400, 1);
    assert.equal(plates, 3);
    let sparks;
    ctx.fillRect = () => sparks++;
    for (let i = 0; i < 9; i++) {
        sparks = 0;
        galaxy.draw(ctx, i / 20, false);
        assert.equal(sparks, i === 8 ? 12 : 48);
    }
    const press = () => hit.dispatchEvent(Object.assign(new Event('pointerdown'), {
        pointerId: 1, isPrimary: true, button: 0, clientX: 100, clientY: 100
    }));
    press();
    assert.equal(hit.capture, 1);
    active = false;
    galaxy.sync();
    assert.equal(hit.capture, null);
    assert(hit.hidden);
    active = true;
    motion.matches = true;
    galaxy.sync();
    press();
    assert(hit.hidden && !hit.capture);
    motion.matches = false;
    galaxy.sync();
    assert.equal(hit.hidden, false);
    galaxy.destroy();
    press();
    assert(hit.removed && !hit.capture);
});
