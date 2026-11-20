import { EXPENSE_KEYS, isCommercialInput } from './inputs.js';

// Exact units are one millionth of a dollar. A whole cent is 10,000 units.
const unitsPerCent = 10000n;
const maxCents = BigInt(Number.MAX_SAFE_INTEGER);
export const roundCurrencyCents = units => (units + unitsPerCent / 2n) / unitsPerCent;

const validHours = hours => hours && Number.isSafeInteger(hours.min) && Number.isSafeInteger(hours.max) &&
    hours.min >= 0 && hours.max >= hours.min;
const result = (value, reason = null) => ({ value, reason });

export function estimateCommercialPrice(effort, inputs) {
    const valid = key => isCommercialInput(key, inputs?.[key]) && inputs[key] !== null;
    const canPriceLabor = valid('rateCents') && valid('contingencyBps');
    const factor = canPriceLabor ? BigInt(inputs.rateCents) * (unitsPerCent + BigInt(inputs.contingencyBps)) : null;
    const fits = units => roundCurrencyCents(units) <= maxCents;

    function laborFor(hours) {
        if (!validHours(hours)) return result(null, 'hoursUnavailable');
        if (factor === null) return result(null, 'laborInputsUnavailable');
        const min = BigInt(hours.min) * factor;
        const max = BigInt(hours.max) * factor;
        return fits(max) ? result({ min, max }) : result(null, 'outOfRange');
    }

    const packages = Object.fromEntries(Object.entries(effort?.packages ?? {}).map(([name, item]) => [
        name, { hours: validHours(item.value) ? item.value : null, assumptions: item.assumptions,
            requirements: item.intermediates.active, cost: laborFor(item.value) }
    ]));
    const expenses = Object.fromEntries(EXPENSE_KEYS.map(key => [
        key, valid(key) ? BigInt(inputs[key]) * unitsPerCent : null
    ]));
    const values = Object.values(expenses);
    const fixed = values.some(value => value === null)
        ? result(null, 'expenseInputsUnavailable') : result(values.reduce((total, value) => total + value, 0n));
    const hours = validHours(effort?.total?.value) ? effort.total.value : null;
    const labor = laborFor(hours);
    let total;
    if (!labor.value || fixed.value === null) {
        total = result(null, labor.reason ?? fixed.reason);
    } else {
        const min = labor.value.min + fixed.value;
        const max = labor.value.max + fixed.value;
        total = fits(max) ? result({ min, max }) : result(null, 'outOfRange');
    }

    return { hours, packages, labor, expenses, fixed, total };
}
