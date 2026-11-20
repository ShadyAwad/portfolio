import test from 'node:test';
import assert from 'node:assert/strict';
import { draftUrl, recipient } from '../src/components/contact-draft.js';

const draft = { subject: 'تجربة & update? #1', message: 'Hello + مرحبًا\nSecond line', identity: ' Ada <ada@example.test> ' };

test('encodes mailto subject, CRLF body and optional sender without adding headers', () => {
    const result = draftUrl('mailto', draft);
    assert(result.startsWith('mailto:' + recipient));
    assert(result.includes('%20') && result.includes('%0D%0A'));
    const query = new URL(result).searchParams;
    assert.deepEqual([...query.keys()], ['subject', 'body']);
    assert.equal(query.get('subject'), draft.subject);
    assert.equal(query.get('body'), 'Hello + مرحبًا\r\nSecond line\r\n\r\nAda <ada@example.test>');
});

test('sets the provider-specific compose parameters and preserves Unicode and reserved characters', () => {
    for (const [provider, host, subjectField] of [
        ['gmail', 'mail.google.com', 'su'], ['outlook', 'outlook.live.com', 'subject']
    ]) {
        const url = new URL(draftUrl(provider, { ...draft, identity: '' }));
        assert.equal(url.hostname, host);
        assert.equal(url.searchParams.get('to'), recipient);
        assert.equal(url.searchParams.get(subjectField), draft.subject);
        assert.equal(url.searchParams.get('body'), 'Hello + مرحبًا\r\nSecond line');
    }
});
