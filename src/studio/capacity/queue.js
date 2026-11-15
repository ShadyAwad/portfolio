import { readAssumption } from './assumptions.js';
import { SECONDS_PER_DAY, available, unavailable, count, exactNumber, safeMagnitude } from './result.js';

// Treat entered decimals as exact for ceiling and overload boundaries.
function fraction(value) {
    const [mantissa, exponent = '0'] = String(value).split('e');
    const [whole, decimal = ''] = mantissa.split('.');
    const scale = decimal.length - Number(exponent);
    const digits = BigInt(whole + decimal);
    return scale < 0 ? [digits * 10n ** BigInt(-scale), 1n] : [digits, 10n ** BigInt(scale)];
}

export function modelQueueCapacity(usage, assumptions) {
    const jobs = count(usage?.jobs);
    const notifications = count(usage?.notifications);
    const total = jobs === null || notifications === null ? null : exactNumber(BigInt(jobs) + BigInt(notifications));
    const serviceSeconds = readAssumption(assumptions, 'serviceSeconds');
    const workerProcesses = readAssumption(assumptions, 'workerProcesses');
    const slotsPerProcess = readAssumption(assumptions, 'slotsPerProcess');
    const target = readAssumption(assumptions, 'targetUtilization');
    const slots = workerProcesses === null || slotsPerProcess === null
        ? null : exactNumber(BigInt(workerProcesses) * BigInt(slotsPerProcess));
    const lambda = total === null ? null : total / SECONDS_PER_DAY;
    const capacity = slots === null ? null : slots === 0 ? 0 : serviceSeconds === null ? null : slots / serviceSeconds;
    const serviceDemand = lambda === null || serviceSeconds === null ? null : lambda * serviceSeconds;
    const utilization = serviceDemand === null || !slots ? null : serviceDemand / slots;
    const service = serviceSeconds === null ? null : fraction(serviceSeconds);
    const demandNumerator = total === null || !service ? null : BigInt(total) * service[0];
    const demandDenominator = service ? BigInt(SECONDS_PER_DAY) * service[1] : null;
    const slack = slots === null || demandNumerator === null ? null : BigInt(slots) * demandDenominator - demandNumerator;
    const backlog = total === null || slots === null || (slots > 0 && slack === null) ? null
        : slots === 0 ? total : slack >= 0n ? 0 : Number(-slack) / Number(service[0]);
    let required = null;
    let requiredOverflow = false;
    if (demandNumerator !== null && target !== null) {
        const [targetNum, targetDen] = fraction(target);
        const numerator = demandNumerator * targetDen;
        const denominator = demandDenominator * targetNum;
        required = exactNumber((numerator + denominator - 1n) / denominator);
        requiredOverflow = required === null;
    }
    const processBasis = { workerProcesses, slotsPerProcess, serviceSeconds };
    const flow = { jobs, notifications, totalJobsPerDay: total };
    const trafficBasis = { secondsPerDay: SECONDS_PER_DAY, notificationJobsPerNotification: 1 };
    const load = { slots, arrivalJobsPerSecond: lambda, capacityJobsPerSecond: capacity };
    const metric = (value, unit, basis, intermediate, warnings = [], missing = 'missing-or-invalid-input') =>
        value !== null && safeMagnitude(value) ? available(value, unit, basis, intermediate, warnings)
            : unavailable(unit, value === null ? missing : 'numeric-range', basis, intermediate);
    return {
        arrival: metric(lambda, 'jobs/s', trafficBasis, flow, [],
            jobs !== null && notifications !== null ? 'numeric-range' : 'missing-or-invalid-input'),
        concurrency: metric(slots, 'slots', processBasis, {}, [],
            workerProcesses !== null && slotsPerProcess !== null ? 'numeric-range' : 'missing-or-invalid-input'),
        capacity: metric(capacity, 'jobs/s', processBasis, { slots }, ['theoretical-capacity']),
        utilization: metric(utilization, 'fraction', processBasis, load,
            slack !== null && slack <= 0n && slots > 0 ? ['no-spare-capacity'] : [], slots === 0 ? 'zero-concurrency' : 'missing-or-invalid-input'),
        backlog: metric(backlog, 'jobs/day', trafficBasis, load, backlog > 0 ? ['sustained-overload'] : []),
        requiredConcurrency: metric(required, 'slots', { target, serviceSeconds }, { arrivalJobsPerSecond: lambda }, [],
            requiredOverflow ? 'numeric-range' : 'missing-or-invalid-input')
    };
}
