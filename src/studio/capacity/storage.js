import { readAssumption } from './assumptions.js';
import { available, unavailable, count, exactNumber } from './result.js';

const safeResult = (bytes, basis, intermediates = {}) => {
    const value = exactNumber(bytes);
    return value === null ? unavailable('bytes/month', 'numeric-range', basis, intermediates)
        : available(value, 'bytes/month', basis, intermediates);
};

export function modelStorageGrowth(usage, engineering, assumptions) {
    const read = key => readAssumption(assumptions, key);
    const records = count(usage?.records);
    const uploads = count(usage?.uploads);
    function component(volume, bytesEach, enabled = true, dimensions = 1) {
        const basis = { enabled, bytesEach, dimensions };
        const intermediate = { count: volume };
        if (enabled === false || (enabled === true && volume === 0)) {
            return available(0, 'bytes/month', basis, intermediate);
        }
        if (enabled !== true || volume === null || bytesEach === null || dimensions === null) {
            return unavailable('bytes/month', 'missing-or-invalid-input', basis, intermediate);
        }
        return safeResult(BigInt(volume) * BigInt(bytesEach) * BigInt(dimensions), basis, intermediate);
    }

    const structured = component(records, read('recordBytes'));
    const audit = component(read('auditRecords'), read('auditBytes'), engineering?.audit ?? null);
    const files = component(uploads, read('uploadBytes'));
    const vectors = component(read('vectorCount'), read('vectorElementBytes'), engineering?.semantic ?? null, read('vectorDimensions'));
    const rawInputs = { structured: structured.value, audit: audit.value, files: files.value, vectors: vectors.value };
    const raw = Object.values(rawInputs).some(value => value === null)
        ? unavailable('bytes/month', 'component-unavailable', {}, rawInputs)
        : safeResult(Object.values(rawInputs).reduce((sum, value) => sum + BigInt(value), 0n), {}, rawInputs);

    const overheadPercent = read('dbOverheadPercent');
    const indexPercent = read('indexPercent');
    const metadataBytes = read('objectMetadataBytes');
    const extraReplicas = read('extraReplicas');
    const backupCopies = read('backupCopies');
    const basis = { overheadPercent, indexPercent, metadataBytes, extraReplicas, backupCopies };
    const estimated = estimateTotal();
    return { structured, audit, files, vectors, raw, estimated };

    function estimateTotal() {
        if (raw.value === null) return unavailable('bytes/month', 'raw-storage-unavailable', basis);
        const db = BigInt(structured.value) + BigInt(audit.value) + BigInt(vectors.value);
        if ((db && (overheadPercent === null || indexPercent === null)) ||
            (uploads && metadataBytes === null)) {
            return unavailable('bytes/month', 'storage-assumption-unavailable', basis, { databaseBytes: Number(db) });
        }
        // Each percentage is applied to raw DB bytes and rounded up separately.
        const percent = value => (db * BigInt(value ?? 0) + 99n) / 100n;
        const overhead = percent(overheadPercent);
        const indexes = percent(indexPercent);
        const metadata = BigInt(uploads ?? 0) * BigInt(metadataBytes ?? 0);
        const primary = BigInt(raw.value) + overhead + indexes + metadata;
        const components = {
            databaseBytes: Number(db), overhead: exactNumber(overhead), indexes: exactNumber(indexes),
            metadata: exactNumber(metadata), primary: exactNumber(primary)
        };
        if (primary && (extraReplicas === null || backupCopies === null)) {
            return unavailable('bytes/month', 'storage-assumption-unavailable', basis, components);
        }
        const replication = primary * BigInt(extraReplicas ?? 0);
        const backups = primary * BigInt(backupCopies ?? 0);
        return safeResult(primary + replication + backups, basis, {
            ...components, replication: exactNumber(replication), backups: exactNumber(backups)
        });
    }
}
