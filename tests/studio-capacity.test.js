import test from 'node:test';
import assert from 'node:assert/strict';
import { capacityDefaults } from '../src/studio/capacity/assumptions.js';
import { modelApiWorkload } from '../src/studio/capacity/api-workload.js';
import { modelQueueCapacity } from '../src/studio/capacity/queue.js';
import { modelStorageGrowth } from '../src/studio/capacity/storage.js';
import { defaultEffortAssumptions, estimateEngineeringEffort } from '../src/studio/capacity/effort.js';
import { modelCapacity } from '../src/studio/capacity/index.js';
import { createConfigurationStore } from '../src/studio/configuration.js';
import { priceProject } from '../src/studio/pricing.js';

const close = (actual, expected, tolerance = 1e-9) =>
    assert(Math.abs(actual - expected) <= tolerance, `expected ${actual} within ${tolerance} of ${expected}`);

test('API workload yields independently calculated daily, mean, busiest hour and illustrative burst', () => {
    const result = modelApiWorkload({ users: 12000, requests: null }, {
        requestsPerUser: 18, peakHourFraction: .15, burstMultiplier: 2.5
    });
    assert.equal(result.dailyRequests.value, 216000);
    close(result.average.value, 2.5);
    close(result.peakHour.value, 9);
    close(result.burstRps.value, 22.5);
    assert.equal(result.peakHour.intermediates.requestsInPeakHour, 32400);
    assert.equal(result.burstRps.status, 'warning');
});

test('API distinguishes explicit zero, auto, missing parameters and unsafe quantities', () => {
    const zero = modelApiWorkload({ users: 12000, requests: 0 }, capacityDefaults);
    for (const result of Object.values(zero)) assert.equal(result.value, 0);
    const zeroAuto = modelApiWorkload({ users: 0, requests: null }, capacityDefaults);
    assert.equal(zeroAuto.dailyRequests.value, 0);
    assert.equal(modelApiWorkload({ users: 100, requests: null }, {}).average.value, null);
    assert.equal(modelApiWorkload({ users: null, requests: null }, capacityDefaults).dailyRequests.value, null);
    assert.equal(modelApiWorkload({ users: Infinity, requests: -1 }, capacityDefaults).dailyRequests.value, null);
    const badBurst = modelApiWorkload({ requests: 86400 }, { peakHourFraction: 1 / 24, burstMultiplier: NaN });
    assert.equal(badBurst.peakHour.value, 1);
    assert.equal(badBurst.burstRps.value, null);
    assert.equal(modelApiWorkload({ users: 1e9, requests: null }, { requestsPerUser: 1e9 }).dailyRequests.value, null);
    assert.equal(modelApiWorkload({ requests: Number.MAX_SAFE_INTEGER }, capacityDefaults).dailyRequests.value, Number.MAX_SAFE_INTEGER);
    assert.equal(modelApiWorkload({ requests: Number.MAX_SAFE_INTEGER }, { peakHourFraction: 1, burstMultiplier: 1e6 }).burstRps.value, null);
});

test('queue distinguishes process count, effective slots and sustained overload', () => {
    const assumptions = { workerProcesses: 2, slotsPerProcess: 2, serviceSeconds: .5, targetUtilization: .7 };
    for (const [jobs, utilization, backlog, target, status] of [
        [345600, .5, 0, 3, 'ok'], [691200, 1, 0, 6, 'warning'], [864000, 1.25, 172800, 8, 'warning']
    ]) {
        const model = modelQueueCapacity({ jobs: jobs - 1, notifications: 1 }, assumptions);
        assert.equal(model.concurrency.value, 4);
        assert.equal(model.capacity.value, 8);
        close(model.utilization.value, utilization);
        assert.equal(model.utilization.status, status);
        assert.equal(model.backlog.value, backlog);
        assert.equal(model.requiredConcurrency.value, target);
    }
});

test('queue handles exact ceilings, missing inputs, zero slots, and safe integer overflow', () => {
    const exact = modelQueueCapacity({ jobs: 518400, notifications: 0 }, {
        workerProcesses: 3, slotsPerProcess: 1, serviceSeconds: .35, targetUtilization: .7
    });
    assert.equal(exact.requiredConcurrency.value, 3);
    const zero = modelQueueCapacity({ jobs: 0, notifications: 0 }, capacityDefaults);
    assert.equal(zero.utilization.value, 0);
    assert.equal(zero.requiredConcurrency.value, 0);
    const disabled = modelQueueCapacity({ jobs: 100, notifications: 0 }, { workerProcesses: 0, slotsPerProcess: 4 });
    assert.equal(disabled.capacity.value, 0);
    assert.equal(disabled.utilization.value, null);
    assert.equal(disabled.backlog.value, 100);
    const missing = modelQueueCapacity({ jobs: 0, notifications: null }, capacityDefaults);
    assert.equal(missing.arrival.value, null);
    const invalid = modelQueueCapacity({ jobs: 100, notifications: 0 }, { ...capacityDefaults, serviceSeconds: -1, targetUtilization: 1 });
    assert.equal(invalid.capacity.value, null);
    assert.equal(invalid.requiredConcurrency.value, null);
    assert.equal(modelQueueCapacity({ jobs: Number.MAX_SAFE_INTEGER, notifications: 1 }, capacityDefaults).arrival.value, null);
    assert.equal(modelQueueCapacity({ jobs: 1e9, notifications: 1e9 }, {
        ...capacityDefaults, workerProcesses: 1e9, slotsPerProcess: 1e9
    }).concurrency.value, null);
});

const smallStorage = {
    recordBytes: 2000, auditRecords: 20, auditBytes: 500, uploadBytes: 1000000, vectorCount: 10,
    vectorDimensions: 768, vectorElementBytes: 4,
    dbOverheadPercent: 25, indexPercent: 30, objectMetadataBytes: 100, extraReplicas: 1, backupCopies: 1
};

test('storage separates raw bytes and itemized estimates with consistent units', () => {
    const model = modelStorageGrowth({ records: 100, uploads: 2 }, { audit: true, semantic: true }, smallStorage);
    assert.equal(model.structured.value, 200000);
    assert.equal(model.audit.value, 10000);
    assert.equal(model.files.value, 2000000);
    assert.equal(model.vectors.value, 30720);
    assert.equal(model.raw.value, 2240720);
    assert.equal(model.estimated.value, 7119948);
    assert.deepEqual(model.estimated.intermediates, {
        databaseBytes: 240720, overhead: 60180, indexes: 72216, metadata: 200,
        primary: 2373316, replication: 2373316, backups: 2373316
    });
    assert.equal(model.estimated.unit, 'bytes/month');
    close(model.estimated.value / 1024 ** 2, 6.790111541748047);
});

test('vectors cover dimensions, element widths, unknown counts, disabled and zero workloads', () => {
    const usage = { records: 0, uploads: 0 };
    const opts = { audit: false, semantic: true };
    for (const [dimensions, bytes, expected] of [[1,2,20], [768,4,30720], [1536,8,122880]]) {
        const model = modelStorageGrowth(usage, opts, { ...smallStorage, vectorDimensions: dimensions, vectorElementBytes: bytes });
        assert.equal(model.vectors.value, expected);
    }
    assert.equal(modelStorageGrowth(usage, opts, { ...smallStorage, vectorElementBytes: 3 }).raw.value, null);
    assert.equal(modelStorageGrowth(usage, opts, { ...smallStorage, vectorCount: null }).estimated.value, null);
    assert.equal(modelStorageGrowth(usage, { audit: true, semantic: false }, {}).raw.value, null);
    assert.equal(modelStorageGrowth(usage, { audit: false, semantic: false }, {}).estimated.value, 0);
    assert.equal(modelStorageGrowth({ records: null, uploads: 0 }, { audit: false, semantic: false }, {}).structured.value, null);
});

test('storage accepts exact safe boundary and reports overflow or missing overhead', () => {
    const opts = { audit: false, semantic: false };
    const usage = { records: 1, uploads: 0 };
    const recordBytes = Number.MAX_SAFE_INTEGER;
    const safe = modelStorageGrowth(usage, opts, { recordBytes });
    assert.equal(safe.raw.value, recordBytes);
    assert.equal(safe.estimated.value, null);
    assert.equal(modelStorageGrowth({ records: 2, uploads: 0 }, opts, { recordBytes }).structured.value, null);
    const replicated = modelStorageGrowth(usage, opts, {
        recordBytes, dbOverheadPercent: 0, indexPercent: 0, extraReplicas: 1, backupCopies: 0
    });
    assert.equal(replicated.estimated.warnings[0], 'numeric-range');
    const round = modelStorageGrowth(usage, opts, {
        recordBytes: 3, dbOverheadPercent: 1, indexPercent: 1, extraReplicas: 0, backupCopies: 0
    });
    assert.equal(round.estimated.value, 5);
});

test('effort sums package ranges and counts shared RBAC work only once', () => {
    const store = createConfigurationStore({
        usage: { uploads: 0, jobs: 1 }, previewFeatures: { auth: true },
        features: { rbac: true }, engineering: { rbac: true }
    });
    const result = estimateEngineeringEffort(store.getState(), defaultEffortAssumptions);
    assert.deepEqual(result.packages.auth.value, { min: 10, max: 22 });
    assert.deepEqual(result.packages.background.value, { min: 6, max: 12 });
    assert.deepEqual(result.total.value, { min: 56, max: 114 });
    assert.equal(priceProject(store.getState()).total, 175);
});

test('effort accepts explicitly configured ranges and refuses missing or overflowing ranges', () => {
    const state = createConfigurationStore({ usage: { uploads: 0 } }).getState();
    const modified = {
        baseline: { ...defaultEffortAssumptions.baseline, frontend: [2, 3] },
        increments: defaultEffortAssumptions.increments
    };
    assert.deepEqual(estimateEngineeringEffort(state, modified).total.value, { min: 30, max: 59 });
    assert.equal(estimateEngineeringEffort(state, {}).total.value, null);
    assert.equal(estimateEngineeringEffort(state, {
        ...modified, baseline: { ...modified.baseline, frontend: [10, 2] }
    }).packages.frontend.value, null);
    assert.equal(estimateEngineeringEffort(state, {
        ...modified, baseline: { ...modified.baseline, frontend: [0, Number.MAX_SAFE_INTEGER] }
    }).total.value, null);
});

test('canonical configuration validates assumptions and independent model inputs without mutation', () => {
    const store = createConfigurationStore({
        pricingTier: 5, usage: { users: 8640 }, capacity: { requestsPerUser: 10, vectorElementBytes: 3, targetUtilization: Infinity }
    });
    const before = store.getState();
    assert.equal(before.capacity.vectorElementBytes, 4);
    assert.equal(before.capacity.targetUtilization, .7);
    const result = modelCapacity(before, before.capacity, defaultEffortAssumptions);
    assert.equal(result.api.average.value, 1);
    assert.equal(result.api.dailyRequests.value, 86400);
    const next = store.update({ capacity: { serviceSeconds: null } });
    const revised = modelCapacity(next, next.capacity, defaultEffortAssumptions);
    assert.deepEqual(revised.api, result.api);
    assert.equal(revised.queue.capacity.value, null);
    assert.equal(priceProject(next).total, 1400);
    assert.equal(before.capacity.serviceSeconds, .5);
    assert.equal(store.reset().capacity.serviceSeconds, .5);
});
