export function modelArchitecture({ usage, engineering }) {
    const { tenants, users, records, uploads } = usage;
    const requests = usage.requests ?? users * 2 * 5;
    const jobs = usage.jobs + usage.notifications;
    const { schedules, semantic, rls, webauthn } = engineering;
    const queue = jobs > 0 || schedules;
    const points = (volume, reference, weight) => weight * Math.min(volume / reference, 1);
    const security = ['rbac', 'audit', 'webauthn', 'rls'].filter(key => engineering[key]).length * 5;
    const score = points(tenants, 100, 8) + points(users, 10000, 8) + points(requests, 100000, 14)
        + points(records, 100000, 12) + points(uploads, 10000, 8)
        + points(jobs, 5000, 15) + (schedules ? 5 : 0) + security + (semantic ? 10 : 0);
    const rowMiB = records * 2 / 1024;
    const fileMiB = uploads * 5;
    const days = Math.ceil(score / 10);
    return {
        requests, jobs, queue, schedules, score, rowMiB, fileMiB, days,
        storage: uploads > 0, semantic, rls, webauthn,
        reviewIndexes: semantic || rls || records >= 100000 || requests >= 100000
    };
}
