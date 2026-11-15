import { channelPath, positionNode } from './layout.js';

export function buildUniverseScene(graph) {
    const nodes = graph.nodes.map(component => ({ id: component.id, ...positionNode(component) }));
    const positions = new Map(nodes.map(node => [node.id, node]));
    const channels = graph.edges.filter(edge => positions.has(edge.from) && positions.has(edge.to))
        .map(edge => ({ ...edge, path: channelPath(positions.get(edge.from), positions.get(edge.to)) }));
    return { nodes, channels };
}

export function universeKeyTarget(nodes, current, key, rtl) {
    const index = nodes.findIndex(node => node.id === current);
    const last = nodes.length - 1;
    if (key === 'Home' || key === 'Escape') return nodes.find(node => node.id === 'browser')?.id ?? nodes[0]?.id;
    if (key === 'End') return nodes[last]?.id;
    if (key === 'ArrowDown' || key === (rtl ? 'ArrowLeft' : 'ArrowRight')) return nodes[Math.min(index + 1, last)]?.id;
    if (key === 'ArrowUp' || key === (rtl ? 'ArrowRight' : 'ArrowLeft')) return nodes[Math.max(index - 1, 0)]?.id;
}
