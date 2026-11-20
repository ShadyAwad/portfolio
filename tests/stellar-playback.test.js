import test from 'node:test';
import assert from 'node:assert/strict';
import { StellarPlayback, STELLAR_DURATION } from '../src/components/stellar-playback.js';

test('stellar activation plays once, ignores repeat clicks, returns and can replay', () => {
    const p = new StellarPlayback();
    p.advance(500);
    assert.equal(p.state, 'IDLE');
    assert(p.activate());
    p.advance(8);
    assert(!p.activate());
    assert.equal(p.elapsed, 8);
    p.advance(STELLAR_DURATION - 8);
    assert.equal(p.state, 'RETURNING');
    assert(!p.activate());
    p.advance(1);
    assert.equal(p.state, 'RETURNING');
    p.advance(1);
    assert.equal(p.state, 'IDLE');
    assert(p.activate());
    p.reset();
    assert.equal(p.state, 'IDLE');
    assert.equal(p.elapsed, 0);
});
