// The graph is a routed tree. A preorder row per node leaves an unobstructed
// branch rail to its children and reserves space inside each node for edge labels.
export function layoutArchitecture(graph, rtl = false, compact = false) {
    const width = compact ? 290 : 480;
    const boxWidth = compact ? 200 : 288;
    const indent = compact ? 25 : 48;
    const padding = compact ? 10 : 14;
    const boxHeight = 56, rowHeight = 70;
    const positions = new Map();
    const edges = [];
    const visited = new Set();

    function visit(id, depth) {
        if (visited.has(id)) return;
        visited.add(id);
        const left = padding + depth * indent;
        const x = rtl ? width - left - boxWidth : left;
        const y = padding + positions.size * rowHeight;
        positions.set(id, { x, y, width: boxWidth, height: boxHeight });
        for (const edge of graph.edges.filter(item => item.from === id)) {
            visit(edge.to, depth + 1);
            const child = positions.get(edge.to);
            const rail = rtl ? x + boxWidth - 10 : x + 10;
            const end = rtl ? child.x + boxWidth + 3 : child.x - 3;
            const center = child.y + boxHeight / 2;
            edges.push({ ...edge, path: `M ${rail} ${y + boxHeight} V ${center} H ${end}` });
        }
    }
    if (graph.nodes.length) visit(graph.nodes[0].id, 0);
    return { width, height: positions.size * rowHeight + padding, positions, edges };
}
