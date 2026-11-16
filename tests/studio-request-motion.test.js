import test from 'node:test';
import assert from 'node:assert/strict';
import { captures, channel, createFrameLoop, distance, magnet, spring } from '../src/studio/flow/request-motion.js';

const api = { x: 200, y: 70 };
const zero = { x: 0, y: 0 };

test('capture accepts a near drop or a recent flick toward the socket', () => {
    assert(captures({ x: 180, y: 90 }, api, zero, false));
    assert(captures({ x: 115, y: 70 }, api, { x: 1.2, y: 0 }, true));
    assert(!captures({ x: 115, y: 70 }, api, { x: 1.2, y: 0 }, false));
    assert(!captures({ x: 115, y: 70 }, api, { x: -1.2, y: 0 }, true));
});

test('magnet pulls only in range and preserves exact pointer position with reduced motion', () => {
    const near = { x: 169, y: 81 };
    assert(distance(magnet(near, api, 90), api) < distance(near, api));
    assert.deepEqual(magnet(zero, api, 90), zero);
    assert.equal(magnet(near, api, 90, true), near);
});

test('a missed drop spring settles at the origin and channels preserve both endpoints', () => {
    const body = { position: { ...api }, velocity: { x: 80, y: -12 } };
    let settled = false;
    for (let i = 0; i < 100 && !settled; i++) settled = spring(body, zero, .016);
    assert(settled);
    assert(distance(body.position, zero) < .45);
    const path = channel(zero, api, -20);
    assert.deepEqual(path(0), zero);
    assert.deepEqual(path(1), api);
    assert.notEqual(path(.5).y, api.y / 2);
});

test('frame loop coalesces pointer updates, cancels pending work and supports nested replacement', () => {
    const frames = new Map();
    let nextId = 0;
    const loop = createFrameLoop(callback => { frames.set(++nextId, callback); return nextId; }, id => frames.delete(id));
    let calls = 0;
    const follow = () => { calls++; return true; };
    loop.start(follow);
    loop.start(follow);
    assert.equal(frames.size, 1);
    loop.stop();
    assert.equal(frames.size, 0);
    assert.equal(calls, 0);
    loop.start(() => { loop.start(follow); return true; });
    const [id, tick] = frames.entries().next().value;
    frames.delete(id);
    tick(12);
    assert.equal(frames.size, 1);
    loop.stop();
    assert.equal(frames.size, 0);
});
