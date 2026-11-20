import { PREVIEW_FEATURE_KEYS } from './configuration.js';

const templateSpecific = Object.freeze({ orders: 'ecommerce', conversion: 'landing' });

export function derivePreview(configuration) {
    const { applicationType: template, previewFeatures, engineering, visual } = configuration;
    const capabilities = Object.freeze(Object.fromEntries(PREVIEW_FEATURE_KEYS.map(key => [
        key, Boolean(previewFeatures[key] && (!Object.hasOwn(templateSpecific, key) || templateSpecific[key] === template))
    ])));
    return Object.freeze({
        template,
        theme: visual.theme,
        density: visual.density,
        interactiveMedia: configuration.interactiveMedia,
        capabilities,
        roles: engineering.rbac,
        recommendations: Object.freeze({
            accountForRoles: engineering.rbac && !previewFeatures.auth,
            accountForOrganizations: capabilities.tenancy && !previewFeatures.auth
        })
    });
}
