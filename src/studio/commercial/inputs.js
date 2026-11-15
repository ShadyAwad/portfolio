export const EXPENSE_KEYS = Object.freeze(['assetsCents', 'setupCents', 'otherCents']);
export const MAX_USD_CENTS = 100_000_000;
export const commercialDefaults = Object.freeze({
    rateCents: 1500,
    contingencyBps: 1500,
    assetsCents: 0,
    setupCents: 0,
    otherCents: 0
});

export function isCommercialInput(key, value) {
    return Object.hasOwn(commercialDefaults, key) && (value === null ||
        (Number.isSafeInteger(value) && value >= 0 &&
        value <= (key === 'contingencyBps' ? 10000 : MAX_USD_CENTS)));
}

// Input dollars and percentages use at most two decimals. Convert the text
// directly to minor units so parsing does not introduce a binary rounding step.
export function parseCommercialInput(key, text) {
    if (!Object.hasOwn(commercialDefaults, key) || typeof text !== 'string') return { valid: false, value: null };
    if (text === '') return { valid: true, value: EXPENSE_KEYS.includes(key) ? 0 : null };
    const match = /^(\d+)(?:\.(\d{0,2}))?$/.exec(text.startsWith('.') && text.length > 1 ? '0' + text : text);
    if (!match) return { valid: false, value: null };
    const value = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
    return isCommercialInput(key, value) ? { valid: true, value } : { valid: false, value: null };
}
