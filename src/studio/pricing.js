const basePrices = [75, 200, 450, 850, 1400];
const featurePrices = { pwa: 75, l10n: 50, rbac: 100, ai: 150 };

export function priceProject({ pricingTier, features }) {
    const base = basePrices[pricingTier - 1];
    const addOns = Object.entries(featurePrices).reduce((sum, [feature, price]) =>
        sum + (features[feature] ? price : 0), 0);
    return { base, addOns, total: base + addOns };
}
