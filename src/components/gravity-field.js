export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function fieldGeometry(width, height) {
    const compact = width < 600;
    const radius = compact ? 13 : 18;
    const topGutter = width < 1340;
    const home = topGutter ? { x: width - (compact ? 48 : 64), y: compact ? 24 : 28 }
        : { x: clamp((width - 1320) / 2 + 2, 18, 39), y: height * .27 };
    return { width, height, compact, topGutter, radius, influence: compact ? 78 : 112, home };
}

export function homePosition(geometry, seconds) {
    const { home, topGutter } = geometry;
    return {
        x: home.x + Math.sin(seconds * .31) * (topGutter ? 13 : 9),
        y: home.y + Math.sin(seconds * .24) * (topGutter ? 4 : 17)
    };
}

// Artistic screen-space approximation. Its envelope and slope reach zero at the boundary.
export function projectStar(x, y, center, radius, influence, strength = 1) {
    const dx = x - center.x;
    const dy = y - center.y;
    const distance = Math.hypot(dx, dy);
    if (distance >= influence) return { x, y, stretch: 0 };
    if (distance <= radius) return null;
    const envelope = (1 - (distance - radius) / (influence - radius)) ** 2;
    const push = radius * .86 * envelope * strength;
    const tangent = push * .44;
    return {
        x: x + (dx * push - dy * tangent) / distance,
        y: y + (dy * push + dx * tangent) / distance,
        stretch: envelope
    };
}

export function settledOffset(offset, velocity, seconds) {
    const damping = 2.35;
    return (offset + (velocity + damping * offset) * seconds) * Math.exp(-damping * seconds);
}
