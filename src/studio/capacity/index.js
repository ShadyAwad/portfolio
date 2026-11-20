import { modelApiWorkload } from './api-workload.js';
import { modelQueueCapacity } from './queue.js';
import { modelStorageGrowth } from './storage.js';
import { estimateEngineeringEffort } from './effort.js';

export function modelCapacity(state, assumptions, effortAssumptions) {
    return {
        api: modelApiWorkload(state.usage, assumptions),
        queue: modelQueueCapacity(state.usage, assumptions),
        storage: modelStorageGrowth(state.usage, state.engineering, assumptions),
        effort: estimateEngineeringEffort(state, effortAssumptions)
    };
}
