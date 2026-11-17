import test from 'node:test';
import assert from 'node:assert/strict';
import { fieldGeometry, homePosition, projectStar, settledOffset } from '../src/components/gravity-field.js';

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
