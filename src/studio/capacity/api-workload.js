import { readAssumption } from './assumptions.js';
import { SECONDS_PER_DAY, SECONDS_PER_HOUR, available, count, safeMagnitude, unavailable } from './result.js';

export function modelApiWorkload(usage, assumptions) {
    const users = count(usage?.users);
    const override = count(usage?.requests);
    const requestsPerUser = readAssumption(assumptions, 'requestsPerUser');
    const fraction = readAssumption(assumptions, 'peakHourFraction');
    const multiplier = readAssumption(assumptions, 'burstMultiplier');
    const auto = usage?.requests === null;
    const source = auto ? 'active-users' : 'daily-override';
    const basis = { users, requestsPerUser, source };
    const daily = auto && users !== null && requestsPerUser !== null ? users * requestsPerUser : override;
    const dailyValid = daily !== null && safeMagnitude(daily);
    const dailyRequests = !dailyValid
        ? unavailable('requests/day', daily === null ? 'missing-or-invalid-input' : 'numeric-range', basis)
        : available(daily, 'requests/day', basis);
    const average = dailyValid
        ? available(daily / SECONDS_PER_DAY, 'requests/s', { secondsPerDay: SECONDS_PER_DAY }, { daily })
        : unavailable('requests/s', 'daily-workload-unavailable', { secondsPerDay: SECONDS_PER_DAY });
    const peakBasis = { fraction, secondsPerHour: SECONDS_PER_HOUR };
    const peak = dailyValid && fraction !== null ? daily * fraction / SECONDS_PER_HOUR : null;
    const peakHour = peak === null ? unavailable('requests/s', 'peak-input-unavailable', peakBasis, { daily: dailyRequests.value })
        : available(peak, 'requests/s', peakBasis, { daily, requestsInPeakHour: daily * fraction });
    const burst = peak !== null && multiplier !== null ? peak * multiplier : null;
    const burstRps = burst !== null && safeMagnitude(burst)
        ? available(burst, 'requests/s', { multiplier }, { peakHourRps: peak }, ['illustrative-burst'])
        : unavailable('requests/s', burst === null ? 'burst-input-unavailable' : 'numeric-range', { multiplier }, { peakHourRps: peak });
    return { dailyRequests, average, peakHour, burstRps };
}
