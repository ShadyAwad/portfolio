import test from 'node:test';
import assert from 'node:assert/strict';
import { createStellarLayers, projectStellarDepth } from '../src/components/stellar-perspective.js';

test('three bounded layers vary in depth travel, size and brightness', () => {
    const layers = createStellarLayers();
    assert.deepEqual(layers.map(layer => layer.length), [101, 79, 60]);
    for (const [index, layer] of layers.entries()) {
        for (const star of layer) {
            assert(star.phase >= 0 && star.phase < 1);
            assert(star.speed >= .038 + index * .007 && star.speed < .056 + index * .007 + Number.EPSILON);
            assert(star.size >= .65 + index * .25 && star.size < 1.04 + index * .25 + Number.EPSILON);
        }
    }
});

test('forward projection accelerates with depth and applies stronger parallax to near stars', () => {
    const screen = { width: 1440, height: 900 };
    const star = { x: .19, y: -.12, phase: .12, speed: .05 };
    const far = projectStellarDepth(star, 0, screen);
    const farNext = projectStellarDepth(star, 1, screen);
    const near = projectStellarDepth(star, 12, screen);
    const nearNext = projectStellarDepth(star, 13, screen);
    assert(farNext.x > far.x && farNext.y < far.y);
    assert(nearNext.dx - near.dx > (farNext.dx - far.dx) * 2);
    assert(near.scale < 2.57 && near.streak > far.streak);
    assert(near.x - projectStellarDepth(star, 12, screen, 8).x >
        far.x - projectStellarDepth(star, 0, screen, 8).x);
    const recycle = (1 - star.phase) / star.speed;
    assert(projectStellarDepth(star, recycle - .001, screen).opacity < .001);
    assert(projectStellarDepth(star, recycle + .001, screen).opacity < .001);
});
