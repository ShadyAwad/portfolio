export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function fieldGeometry(width, height) {
    const compact = width < 600;
    // The portfolio grid is capped at 1320px. Use the top gutter until the side can fit the disk.
    const sideRoom = (width - 1320) / 2 + 14;
    const topGutter = sideRoom < 150;
    const radius = compact ? 8.5 : topGutter ? 18 : 21;
    const home = topGutter
        ? { x: compact ? width - 63 : clamp(width * .24, 125, 345), y: compact ? 14 : width <= 1030 ? 19 : 33 }
        : { x: Math.min(85, sideRoom * .52), y: Math.max(61, height * .29) };
    return { width, height, compact, topGutter, radius, influence: compact ? 67 : 117, home };
}

export function homePosition(geometry, seconds) {
    const { home, topGutter, compact } = geometry;
    return {
        x: home.x + Math.sin(seconds * .29) * (compact ? 8 : topGutter ? 17 : 9),
        y: home.y + Math.sin(seconds * .23) * (compact ? 2 : topGutter ? 3 : 17)
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
