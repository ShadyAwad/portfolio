export const SECONDS_PER_DAY = 86400;
export const SECONDS_PER_HOUR = 3600;
export const MAX_EXACT = BigInt(Number.MAX_SAFE_INTEGER);

export function available(value, unit, assumptions, intermediates = {}, warnings = []) {
    return { value, unit, status: warnings.length ? 'warning' : 'ok', warnings, assumptions, intermediates };
}
export function unavailable(unit, reason, assumptions, intermediates = {}) {
    return { value: null, unit, status: 'unavailable', warnings: [reason], assumptions, intermediates };
}

export function count(value) {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function exactNumber(value) {
    return value <= MAX_EXACT ? Number(value) : null;
}

// Input count × average rate can be fractional but should stay within the safe magnitude.
export function safeMagnitude(value) {
    return Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;
}
