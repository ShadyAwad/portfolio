import test from 'node:test';
import assert from 'node:assert/strict';
import { createField, project, displace } from '../../src/components/current-particles.js';

test('stream tubes are seeded and continuous across an orbital period', () => {
    const field = createField(50);
    assert.deepEqual(createField(50), field);
    for (const p of field) {
        const crossing = (2 * Math.PI - p.phase) / p.speed;
        project(p, crossing - .001, 400, 500, 350);
        const { x, y } = p;
        project(p, crossing + .001, 400, 500, 350);
        assert(Math.hypot(p.x - x, p.y - y) < 1);
    }
});

test('local swirl is bounded, absent outside its radius, and settles consistently at different cadences', () => {
    const p = createField(1)[0];
    Object.assign(p, { x: 118, y: 95 });
    const hand = { x: 100, y: 100, vx: 1, vy: 0, strength: 1, spin: 1, speed: 1 };
    const pulse = { age: 1 };
    displace(p, hand, pulse, 100, .05);
    assert(p.dy > 0 && Math.hypot(p.dx, p.dy) < 100);
    const slower = { ...p };
    hand.strength = 0;
    for (let i = 0; i < 30; i++) displace(p, hand, pulse, 100, 1 / 30);
    for (let i = 0; i < 60; i++) displace(slower, hand, pulse, 100, 1 / 60);
    assert(Math.abs(p.dy - slower.dy) < 1e-10 && Math.abs(p.dy) < .001);
    Object.assign(p, { x: 500, dx: 0, dy: 0 });
    hand.strength = 1;
    displace(p, hand, { x: 100, y: 100, age: .2 }, 100, .05);
    assert.equal(p.dx, 0);
    assert.equal(p.dy, 0);
});
