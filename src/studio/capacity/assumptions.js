// Values are finite, bounded and nullable. Null means “unknown”, not zero.
export const assumptionSchema = Object.freeze({
    requestsPerUser: [0, 1e9, 10],
    peakHourFraction: [1 / 24, 1, .15],
    burstMultiplier: [1, 1e6, 2],
    serviceSeconds: [.001, 86400, .5],
    workerProcesses: [0, 1e9, 1, true],
    slotsPerProcess: [1, 1e9, 4, true],
    targetUtilization: [.01, .99, .7],
    recordBytes: [1, Number.MAX_SAFE_INTEGER, 2048, true],
    auditRecords: [0, 1e9, null, true],
    auditBytes: [1, Number.MAX_SAFE_INTEGER, 512, true],
    uploadBytes: [1, Number.MAX_SAFE_INTEGER, 5242880, true],
    vectorCount: [0, 1e9, null, true],
    vectorDimensions: [1, 1e6, 1536, true],
    vectorElementBytes: [2, 8, 4, true],
    dbOverheadPercent: [0, 10000, 25, true],
    indexPercent: [0, 10000, 30, true],
    objectMetadataBytes: [0, Number.MAX_SAFE_INTEGER, 1024, true],
    extraReplicas: [0, 1000, 0, true],
    backupCopies: [0, 1000, 0, true]
});
Object.values(assumptionSchema).forEach(Object.freeze);

export const capacityDefaults = Object.freeze(Object.fromEntries(
    Object.entries(assumptionSchema).map(([key, [, , value]]) => [key, value])
));

export function validAssumption(key, value) {
    const [min, max, , integer] = assumptionSchema[key];
    return value === null || (typeof value === 'number' && Number.isFinite(value) &&
        value >= min && value <= max && (!integer || Number.isSafeInteger(value)) &&
        (key !== 'vectorElementBytes' || [2, 4, 8].includes(value)));
}

// Models accept a partial assumption object. Missing or invalid fields remain unavailable.
export function readAssumption(assumptions, key) {
    const value = assumptions?.[key];
    return validAssumption(key, value) ? value : null;
}
