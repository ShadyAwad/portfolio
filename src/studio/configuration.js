import { capacityDefaults, validAssumption } from './capacity/assumptions.js';
import { commercialDefaults, isCommercialInput } from './commercial/inputs.js';
import { findModelAsset, modelModes } from '../components/model-assets.js';
import { appearanceDefaults, appearanceOptions, normalizeAccent } from './appearance.js';
import { isPreviewLayout, layoutDefaults } from './preview-layouts.js';

export const MAX_USAGE = 1_000_000_000;
export const FEATURE_KEYS = Object.freeze(['pwa', 'l10n', 'rbac', 'ai']);
export const ENGINEERING_KEYS = Object.freeze(['semantic', 'schedules', 'rbac', 'audit', 'webauthn', 'rls']);
export const APPLICATION_TYPES = Object.freeze(['saas', 'ecommerce', 'landing', 'internal-tool']);
export const PREVIEW_FEATURE_KEYS = Object.freeze(['auth', 'analytics', 'tenancy', 'storage', 'jobs', 'orders', 'conversion']);

const defaults = freeze({
    applicationType: 'saas',
    pricingTier: 1,
    features: { pwa: false, l10n: false, rbac: false, ai: false },
    previewFeatures: Object.fromEntries(PREVIEW_FEATURE_KEYS.map(key => [key, false])),
    usage: { tenants: 5, users: 250, requests: null, records: 10000, uploads: 100, jobs: 0, notifications: 0 },
    visual: { theme: 'system', ...appearanceDefaults },
    layouts: layoutDefaults,
    interactiveMedia: { enabled: false, asset: 'planet', mode: 'drag' },
    capacity: capacityDefaults,
    commercial: commercialDefaults,
    engineering: { semantic: false, schedules: false, rbac: false, audit: false, webauthn: false, rls: false }
});

function freeze(config) {
    for (const value of Object.values(config)) {
        if (value && typeof value === 'object') Object.freeze(value);
    }
    return Object.freeze(config);
}

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
const choice = (value, allowed, previous) => allowed.includes(value) ? value : previous;
const flag = (value, previous) => typeof value === 'boolean' ? value : previous;
const count = (value, previous) => Number.isFinite(value)
    ? Math.max(0, Math.min(MAX_USAGE, Math.floor(value)))
    : previous;

function patchGroup(current, patch, validate) {
    const input = object(patch);
    return Object.fromEntries(Object.entries(current).map(([key, previous]) => [
        key, Object.hasOwn(input, key) ? validate(input[key], previous, key) : previous
    ]));
}

function applyPatch(current, patch) {
    const input = object(patch);
    const visual = object(input.visual);
    const media = object(input.interactiveMedia);
    return freeze({
        applicationType: choice(input.applicationType, APPLICATION_TYPES, current.applicationType),
        pricingTier: choice(input.pricingTier, [1, 2, 3, 4, 5], current.pricingTier),
        features: patchGroup(current.features, input.features, flag),
        previewFeatures: patchGroup(current.previewFeatures, input.previewFeatures, flag),
        usage: patchGroup(current.usage, input.usage, (value, previous) =>
            value === null ? null : count(value, previous)),
        visual: {
            theme: choice(visual.theme, ['system', 'light', 'dark'], current.visual.theme),
            ...Object.fromEntries(Object.entries(appearanceOptions).map(([key, allowed]) =>
                [key, choice(visual[key], allowed, current.visual[key])])),
            customAccent: normalizeAccent(visual.customAccent) ?? current.visual.customAccent
        },
        layouts: patchGroup(current.layouts, input.layouts, (value, previous, template) =>
            isPreviewLayout(template, value) ? value : previous),
        interactiveMedia: {
            enabled: flag(media.enabled, current.interactiveMedia.enabled),
            asset: findModelAsset(media.asset)?.id ?? current.interactiveMedia.asset,
            mode: choice(media.mode, modelModes, current.interactiveMedia.mode)
        },
        engineering: patchGroup(current.engineering, input.engineering, flag),
        capacity: patchGroup(current.capacity, input.capacity, (value, previous, key) =>
            validAssumption(key, value) ? value : previous),
        commercial: patchGroup(current.commercial, input.commercial, (value, previous, key) =>
            isCommercialInput(key, value) ? value : previous)
    });
}

function equal(a, b) {
    return Object.keys(a).every(key => {
        const value = a[key];
        return value && typeof value === 'object'
            ? Object.keys(value).every(field => value[field] === b[key][field])
            : value === b[key];
    });
}

export function createConfigurationStore(initial) {
    let state = applyPatch(defaults, initial);
    const listeners = new Set();
    let notifying = false;

    function publish(next) {
        if (notifying) throw new Error('Configuration subscribers must not dispatch updates.');
        if (equal(state, next)) return state;
        const previous = state;
        state = next;
        notifying = true;
        try {
            for (const listener of [...listeners]) listener(next, previous);
        } finally {
            notifying = false;
        }
        return state;
    }

    return Object.freeze({
        getState: () => state,
        update: patch => publish(applyPatch(state, patch)),
        reset: () => publish(defaults),
        subscribe(listener) {
            if (typeof listener !== 'function') throw new TypeError('Expected a configuration subscriber.');
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    });
}

export const configuration = createConfigurationStore();
