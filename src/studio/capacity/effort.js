import { derivePreview } from '../preview-model.js';
import { available, unavailable, exactNumber } from './result.js';

const freezeRanges = ranges => Object.freeze(Object.fromEntries(Object.entries(ranges)
    .map(([key, range]) => [key, Object.freeze(range)])));

export const defaultEffortAssumptions = Object.freeze({
    baseline: freezeRanges({
        frontend: [12, 24], backend: [10, 20], database: [6, 12], auth: [0, 0],
        background: [0, 0], integration: [0, 0], testing: [8, 16], deployment: [4, 8]
    }),
    increments: freezeRanges({
        analytics: [4, 8], conversion: [3, 6], pwa: [4, 8], l10n: [4, 10],
        orders: [8, 16], tenancy: [6, 12], semantic: [6, 14], audit: [4, 8],
        signIn: [6, 12], rbac: [4, 10], webauthn: [4, 8], rls: [6, 12],
        jobs: [6, 12], schedules: [3, 6], storage: [4, 8], ai: [6, 14]
    })
});

const workPackages = Object.freeze({
    frontend: ['analytics', 'conversion', 'pwa', 'l10n'],
    backend: ['orders', 'tenancy'],
    database: ['semantic', 'audit'],
    auth: ['signIn', 'rbac', 'webauthn', 'rls'],
    background: ['jobs', 'schedules'],
    integration: ['storage', 'ai'],
    testing: [],
    deployment: []
});

function validRange(range) {
    return Array.isArray(range) && range.length === 2 && range.every(value =>
        Number.isSafeInteger(value) && value >= 0) && range[0] <= range[1];
}

function addRanges(ranges) {
    const min = exactNumber(ranges.reduce((total, [lo]) => total + BigInt(lo), 0n));
    const max = exactNumber(ranges.reduce((total, [, hi]) => total + BigInt(hi), 0n));
    return min === null || max === null ? null : { min, max };
}

export function estimateEngineeringEffort(state, assumptions) {
    // This model expects a validated Studio snapshot. The commercial estimator is separate.
    const capabilities = derivePreview(state).capabilities;
    const { engineering, features, usage } = state;
    const selected = {
        ...capabilities, signIn: capabilities.auth, pwa: features.pwa, l10n: features.l10n,
        semantic: engineering.semantic, audit: engineering.audit,
        rbac: engineering.rbac || features.rbac, webauthn: engineering.webauthn, rls: engineering.rls,
        jobs: capabilities.jobs || usage.jobs > 0 || usage.notifications > 0,
        schedules: engineering.schedules, storage: capabilities.storage || usage.uploads > 0, ai: features.ai
    };
    const packages = Object.fromEntries(Object.entries(workPackages).map(([key, options]) => {
        const active = options.filter(option => selected[option]);
        const baseline = assumptions?.baseline?.[key];
        const increments = Object.fromEntries(active.map(option => [option, assumptions?.increments?.[option]]));
        const basis = {
            baseline: validRange(baseline) ? [...baseline] : null,
            increments: Object.fromEntries(Object.entries(increments).map(([option, range]) =>
                [option, validRange(range) ? [...range] : null]))
        };
        const ranges = [basis.baseline, ...Object.values(basis.increments)];
        if ((key === 'background' && !selected.jobs && (usage.jobs === null || usage.notifications === null)) ||
            (key === 'integration' && !selected.storage && usage.uploads === null)) {
            return [key, unavailable('engineering-hours', 'missing-or-invalid-input', basis, { active })];
        }
        if (ranges.some(range => range === null)) {
            return [key, unavailable('engineering-hours', 'effort-assumption-unavailable', basis, { active })];
        }
        const value = addRanges(ranges);
        return [key, value === null ? unavailable('engineering-hours', 'numeric-range', basis, { active })
            : available(value, 'engineering-hours', basis, { active })];
    }));
    const values = Object.values(packages).map(item => item.value);
    const basis = { method: 'sum-of-work-package-ranges' };
    const intermediates = { packageCount: values.length };
    if (values.some(value => value === null)) {
        return { packages, total: unavailable('engineering-hours', 'package-unavailable', basis, intermediates) };
    }
    const total = addRanges(values.map(({ min, max }) => [min, max]));
    return { packages, total: total === null ? unavailable('engineering-hours', 'numeric-range', basis, intermediates)
        : available(total, 'engineering-hours', basis, intermediates, ['planning-range-not-delivery-date']) };
}
