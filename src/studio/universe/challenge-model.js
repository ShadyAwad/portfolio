import { MAX_USAGE } from '../configuration.js';
import { assumptionSchema, validAssumption } from '../capacity/assumptions.js';
import { modelApiWorkload } from '../capacity/api-workload.js';
import { modelQueueCapacity } from '../capacity/queue.js';
import { modelStorageGrowth } from '../capacity/storage.js';
import { SECONDS_PER_DAY } from '../capacity/result.js';

export const stages = Object.freeze(['create', 'architect', 'challenge']);
export const scenarioFields = Object.freeze({
    api: Object.freeze(['users', 'requestsPerUser', 'peakHourFraction', 'burstMultiplier']),
    queue: Object.freeze(['jobRate', 'serviceSeconds', 'effectiveSlots', 'targetUtilization']),
    storage: Object.freeze(['records', 'auditRecords', 'uploads', 'vectorCount'])
});
export const scenarioMetrics = Object.freeze({
    api: Object.freeze(['dailyRequests', 'peakHour', 'burstRps']),
    queue: Object.freeze(['arrival', 'capacity', 'utilization', 'backlog', 'requiredConcurrency']),
    storage: Object.freeze(['structured', 'audit', 'files', 'vectors', 'raw', 'estimated'])
});

export function stageVisibility(current, requested = current) {
    const stage = stages.includes(requested) ? requested : stages.includes(current) ? current : 'create';
    return { stage, graph: stage !== 'create', controls: stage === 'challenge', summary: stage === 'create' };
}

const usageFields = ['users', 'records', 'uploads'];

export function scenarioBounds(key) {
    if (key === 'jobRate') return [0, MAX_USAGE * 2 / SECONDS_PER_DAY, 'any'];
    if (key === 'effectiveSlots') return [0, MAX_USAGE, 1];
    if (usageFields.includes(key)) return [0, MAX_USAGE, 1];
    const [min, max, , integer] = assumptionSchema[key];
    return [min, max, integer ? 1 : 'any'];
}

export function parseScenarioValue(key, input) {
    if (input === '') return null;
    const value = Number(input);
    const [min, max, step] = scenarioBounds(key);
    if (!Number.isFinite(value) || value < min || value > max || (step === 1 && !Number.isSafeInteger(value))) return undefined;
    if (key === 'jobRate') {
        const daily = value * SECONDS_PER_DAY;
        // Accept integral daily workloads, allowing only floating-point conversion error.
        if (Math.abs(daily - Math.round(daily)) > Math.max(1, daily) * Number.EPSILON * 2) return undefined;
    }
    return value;
}

export function updateScenario(draft, scenario, key, value) {
    if (!Object.hasOwn(scenarioFields, scenario) || !scenarioFields[scenario].includes(key)) return draft;
    if (value === undefined || (value !== null && parseScenarioValue(key, String(value)) === undefined)) return draft;
    return { ...draft, [scenario]: { ...draft[scenario], [key]: value } };
}

export function resetScenario(draft, scenario) {
    const next = { ...draft };
    delete next[scenario];
    return next;
}

export function scenarioValues(state, scenario, draft = {}) {
    const { usage, capacity } = state;
    const defaults = { ...capacity, users: usage.users, records: usage.records, uploads: usage.uploads,
        jobRate: usage.jobs === null || usage.notifications === null ? null : (usage.jobs + usage.notifications) / SECONDS_PER_DAY,
        effectiveSlots: capacity.workerProcesses === null || capacity.slotsPerProcess === null ? null
            : capacity.workerProcesses * capacity.slotsPerProcess };
    return Object.fromEntries(scenarioFields[scenario].map(key => [key, Object.hasOwn(draft, key) ? draft[key] : defaults[key]]));
}

export function queueStatus(result, target) {
    const { backlog, utilization } = result;
    // Backlog and the no-spare-capacity warning use the queue model's exact arithmetic.
    if (backlog.warnings.includes('sustained-overload')) return 'overloaded';
    if (utilization.warnings.includes('no-spare-capacity')) return 'saturated';
    if (utilization.value === null || !validAssumption('targetUtilization', target) || result.requiredConcurrency.value === null) return 'unavailable';
    return result.requiredConcurrency.value > result.concurrency.value ? 'elevated' : 'nominal';
}

export function modelScenario(state, scenario, draft) {
    const values = scenarioValues(state, scenario, draft);
    const { usage, capacity, engineering } = state;
    if (scenario === 'api') {
        const metrics = modelApiWorkload({ ...usage, users: values.users, requests: null }, { ...capacity, ...values });
        return { values, metrics, node: 'api', status: metrics.burstRps.value === null ? 'unavailable' : 'traffic' };
    }
    if (scenario === 'queue') {
        const daily = values.jobRate === null ? null : Math.round(values.jobRate * SECONDS_PER_DAY);
        const slotsEdited = Object.hasOwn(draft ?? {}, 'effectiveSlots');
        // Split the total over the existing count inputs so neither exceeds its validated bounds.
        const metrics = modelQueueCapacity({
            jobs: daily === null ? null : Math.min(daily, MAX_USAGE),
            notifications: daily === null ? null : Math.max(0, daily - MAX_USAGE)
        }, {
            ...capacity, ...values,
            workerProcesses: slotsEdited ? values.effectiveSlots : capacity.workerProcesses,
            slotsPerProcess: slotsEdited ? 1 : capacity.slotsPerProcess
        });
        return { values, metrics, node: 'queue', status: queueStatus(metrics, values.targetUtilization) };
    }
    const metrics = modelStorageGrowth({ ...usage, ...values }, engineering, { ...capacity, ...values });
    return { values, metrics, node: 'postgres', status: metrics.raw.value === null ? 'unavailable' : 'growth' };
}
