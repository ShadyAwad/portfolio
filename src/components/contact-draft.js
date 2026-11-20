export const recipient = 'shadyawad225@gmail.com';

export function draftUrl(provider, { identity, subject, message }) {
    const sender = identity.trim();
    const body = [message.trim(), sender].filter(Boolean).join('\n\n')
        .replace(/\r\n?|\n/g, '\r\n');
    const title = subject.trim().replace(/[\r\n]+/g, ' ');
    if (provider === 'mailto') {
        return `mailto:${recipient}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    }
    const gmail = provider === 'gmail';
    const url = new URL(gmail ? 'https://mail.google.com/mail/' : 'https://outlook.live.com/mail/0/deeplink/compose');
    if (gmail) {
        url.searchParams.set('view', 'cm');
        url.searchParams.set('fs', '1');
    }
    url.searchParams.set('to', recipient);
    url.searchParams.set(gmail ? 'su' : 'subject', title);
    url.searchParams.set('body', body);
    return url.href;
}
