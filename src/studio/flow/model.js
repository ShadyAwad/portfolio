import { buildArchitectureGraph } from '../architecture/graph.js';
import { modelScenario } from '../universe/challenge-model.js';
import { scenarios } from './scenarios.js';

export function resolveFlow(state, graph, selected) {
    const options = scenarios[state.applicationType];
    const id = Object.hasOwn(options, selected) ? selected : Object.keys(options)[0];
    const scenario = options[id];
    const projectNodes = new Map(graph.nodes.map(node => [node.id, node]));
    const route = scenario.steps.filter(step => !step.requires || projectNodes.has(step.requires));
    const reference = route.some(step => !projectNodes.has(step.node)) ? buildArchitectureGraph({
        ...state, previewFeatures: { ...state.previewFeatures, jobs: Boolean(scenario.queue),
            auth: Boolean(scenario.auth), conversion: id === 'demo' }
    }) : null;
    const referenceNodes = new Map(reference?.nodes.map(node => [node.id, node]));
    const steps = route.map(step => ({ ...step, component: projectNodes.get(step.node) ?? referenceNodes.get(step.node),
            illustrative: !projectNodes.has(step.node) }));
    return { id, options, scenario, steps };
}

const loads = { normal: 4, elevated: 6, saturated: 8, overloaded: 10 };

export function flowQueue(state, load) {
    return modelScenario(state, 'queue', {
        jobRate: loads[load], effectiveSlots: 4, serviceSeconds: .5, targetUtilization: .7
    });
}

export const initialPlayback = () => ({ index: 0, playing: false });

export function playback(state, action, count) {
    const last = count - 1;
    switch (action) {
        case 'reset': return initialPlayback();
        case 'play': return state.index < last ? { ...state, playing: true } : { index: 0, playing: true };
        case 'pause': return { ...state, playing: false };
        case 'back': return { index: Math.max(0, state.index - 1), playing: false };
        case 'step': return { index: Math.min(last, state.index + 1), playing: false };
        case 'tick': {
            if (!state.playing) return state;
            const index = Math.min(last, state.index + 1);
            return { index, playing: index < last };
        }
        default: return state;
    }
}
