import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreviewAction, createPreviewTrace, resolvePreviewTrace } from '../src/studio/preview-trace.js';

test('preview actions map to three existing scenario outcomes without feature prerequisites', () => {
    const cases = [
        ['saas', 'workspace', {}, 'workspace', 'workspaceReady'],
        ['ecommerce', 'checkout', { count: 2, total: 82 }, 'checkout', 'orderConfirmed'],
        ['internal-tool', 'export', { filter: 'review' }, 'report', 'exportReady']
    ];
    for (const [template, action, context, scenario, outcome] of cases) {
        const event = createPreviewAction(template, action, { ...context, email: 'ignored' });
        assert.deepEqual(event, { action, template, scenario, context });
        assert(Object.isFrozen(event) && Object.isFrozen(event.context));
        assert.equal(resolvePreviewTrace(event, { applicationType: template, previewFeatures: {} }).outcome, outcome);
    }
});

test('trace validation rejects unavailable, mismatched and malformed actions', () => {
    for (const [template, action, context] of [
        ['landing', 'workspace'], ['saas', 'constructor'], ['ecommerce', 'checkout', { count: 0, total: 0 }],
        ['ecommerce', 'checkout', null], ['ecommerce', 'checkout', { count: 2.5, total: 82 }],
        ['internal-tool', 'export', { filter: 'unknown' }]
    ]) assert.equal(createPreviewAction(template, action, context), null);
    const event = createPreviewAction('saas', 'workspace');
    assert.equal(resolvePreviewTrace(event, { applicationType: 'internal-tool' }), null);
    assert.equal(resolvePreviewTrace({ ...event, scenario: 'signIn' }, { applicationType: 'saas' }), null);
});

test('replaced or cleared preview actions reject stale playback feedback', () => {
    const changes = [];
    const controller = createPreviewTrace((...change) => changes.push(change));
    const first = createPreviewAction('saas', 'workspace');
    const second = createPreviewAction('saas', 'workspace');
    controller.offer(first);
    controller.offer(second);
    controller.reflect(first, true);
    controller.reflect(second, true);
    controller.reflect(second, true);
    controller.reflect(second, false);
    controller.clear();
    controller.reflect(second, true);
    assert.deepEqual(changes, [[first, false], [second, false], [second, true], [second, false], [null, false]]);
});
