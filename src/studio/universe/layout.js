export const space = Object.freeze({ width: 640, height: 520 });
const slots = {
    browser: [320, 260, 'core'],
    api: [320, 132, 'satellite'],
    auth: [197, 106, 'shield'],
    postgres: [183, 284, 'planet'],
    tenant: [94, 378, 'tenant'],
    vectors: [242, 428, 'crystal'],
    objects: [450, 163, 'crystal'],
    queue: [458, 313, 'queue'],
    redis: [556, 241, 'broker'],
    workers: [546, 424, 'worker'],
    integration: [408, 55, 'external']
};

export function positionNode({ id, type }) {
    // Known components keep their slots even when their neighbors disappear.
    // A reserved inner orbit gives future component IDs a deterministic position.
    const hash = [...id].reduce((value, character) => (Math.imul(value, 31) + character.codePointAt(0)) >>> 0, 0);
    const angle = hash / 2 ** 32 * 2 * Math.PI;
    const [x, y, appearance] = slots[id] ?? [
        Math.round(320 + 82 * Math.cos(angle)), Math.round(260 + 82 * Math.sin(angle)), type
    ];
    return { x, y, appearance };
}

export function channelPath(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    return `M ${from.x} ${from.y} Q ${(from.x + to.x) / 2 + dy * .23} ${(from.y + to.y) / 2 - dx * .23} ${to.x} ${to.y}`;
}
