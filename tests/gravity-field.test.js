import test from 'node:test';
import assert from 'node:assert/strict';
import {
    fieldGeometry, homePosition, lensProximity, projectStar, projectStellarDepth,
    pulseDuration, pulseWeight, resistBoundary, settledOffset
} from '../src/components/gravity-field.js';

test('the field occludes the horizon and fades smoothly to zero within a bounded radius', () => {
    const centre = { x: 42, y: 200 };
    assert.equal(projectStar(42, 200, centre, 18, 112), null);
    assert.equal(projectStar(60, 200, centre, 18, 112), null);
    const near = projectStar(64, 200, centre, 18, 112);
    assert(near.x > 75 && near.y > 200 && near.stretch > .8);
    assert.deepEqual(projectStar(154, 200, centre, 18, 112), { x: 154, y: 200, stretch: 0 });
    assert(Math.abs(projectStar(153.99, 200, centre, 18, 112).x - 153.99) < .00001);
    assert.deepEqual(projectStar(620, 340, centre, 18, 112), { x: 620, y: 340, stretch: 0 });
});

test('autonomous lens motion stays in a peripheral region across viewport sizes', () => {
    for (const width of [320, 900, 1360, 1440, 1560, 1600, 1920]) {
        const geometry = fieldGeometry(width, 900);
        const first = homePosition(geometry, 0);
        assert.notDeepEqual(first, homePosition(geometry, 5));
        for (let elapsed = 0; elapsed < 60; elapsed++) {
            const { x, y } = homePosition(geometry, elapsed);
            assert(x > 0 && x < width);
            if (geometry.topGutter) assert(y < 38 && x > geometry.radius * 3 && x < width - geometry.radius * 3);
            else assert(x < 100 && x > geometry.radius * 2.9);
            assert(Math.abs(y - first.y) <= 17);
        }
    }
});

test('release preserves position and initial velocity before damping to the drift path', () => {
    assert.equal(settledOffset(55, 95, 0), 55);
    assert(Math.abs((settledOffset(55, 95, .00001) - 55) / .00001 - 95) < .01);
    assert(Math.abs(settledOffset(55, 95, 4)) < .1);
});
test('approaching stars accelerate outward with bounded size and stronger near parallax', () => {
    const geometry = fieldGeometry(1440, 900);
    const star = { x: .19, y: -.12, phase: .12, speed: .04 };
    const far = projectStellarDepth(star, 0, geometry);
    const farNext = projectStellarDepth(star, 1, geometry);
    const near = projectStellarDepth(star, 14, geometry);
    const nearNext = projectStellarDepth(star, 15, geometry);
    assert(farNext.x > far.x && farNext.y < far.y);
    assert(nearNext.dx - near.dx > (farNext.dx - far.dx) * 2);
    assert(near.scale < 2.18 && near.streak > far.streak);
    assert(near.x - projectStellarDepth(star, 14, geometry, 8).x >
        far.x - projectStellarDepth(star, 0, geometry, 8).x);
    const recycle = (1 - star.phase) / star.speed;
    for (const time of [recycle - .001, recycle + .001]) {
        assert(projectStellarDepth(star, time, geometry).opacity < .001);
    }
});

test('proximity, click pulses, and drag resistance have smooth bounded responses', () => {
    assert.equal(lensProximity(18, 18), 1);
    assert(lensProximity(40, 18) > lensProximity(55, 18));
    assert.equal(lensProximity(81, 18), 0);
    const age = pulseDuration / 2, radius = 18, influence = 117;
    const distance = radius + (influence - radius) * .41;
    assert(pulseWeight(distance, radius, influence, age) > .9);
    assert.equal(pulseWeight(distance, radius, influence, pulseDuration), 0);
    assert.equal(pulseWeight(influence, radius, influence, age), 0);
    const centre = { x: 0, y: 0 };
    assert(projectStar(distance, 0, centre, radius, influence, 1, age).stretch >
        projectStar(distance, 0, centre, radius, influence).stretch);
    assert.deepEqual(projectStar(influence, 0, centre, radius, influence, 1, age), { x: influence, y: 0, stretch: 0 });
    assert.equal(resistBoundary(50, 0, 100), 50);
    assert(resistBoundary(-20, 0, 100) > 0 && resistBoundary(120, 0, 100) < 100);
    assert(Math.abs(resistBoundary(8.999, 0, 100) - 8.999) < .000001);
});
