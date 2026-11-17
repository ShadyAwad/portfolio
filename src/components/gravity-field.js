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

export function projectStellarDepth(star, seconds, geometry, panX = 0, panY = 0) {
    const progress = (star.phase + seconds * star.speed) % 1;
    const scale = 1 / (1.42 - progress * .96);
    const { width, height } = geometry;
    const dx = (star.x * width - panX) * scale;
    const dy = (star.y * height - panY) * scale;
    return {
        x: width * .5 + dx, y: height * .47 + dy, dx, dy, scale,
        opacity: Math.min(1, progress / .085, (1 - progress) / .2),
        streak: clamp((progress - .56) / .35, 0, 1)
    };
}

export function lensProximity(distance, radius) {
    const approach = clamp(1 - (distance - radius) / 63, 0, 1);
    return approach * approach * (3 - 2 * approach);
}

export const pulseDuration = .82;

export function pulseWeight(distance, radius, influence, age) {
    if (age <= 0 || age >= pulseDuration || distance <= radius || distance >= influence) return 0;
    const progress = age / pulseDuration;
    const span = influence - radius;
    const ring = radius + span * (.08 + progress * .66);
    const band = Math.max(0, 1 - Math.abs(distance - ring) / (span * .26));
    return Math.sin(Math.PI * progress) * band * band;
}

export function resistBoundary(value, min, max) {
    const band = Math.min(9, (max - min) / 2);
    if (!band) return min;
    if (value < min + band) return min + band * Math.exp((value - min - band) / band);
    if (value > max - band) return max - band * Math.exp((max - band - value) / band);
    return value;
}

// Artistic screen-space approximation. Its envelope and slope reach zero at the boundary.
export function projectStar(x, y, center, radius, influence, strength = 1, pulseAge = 0) {
    const dx = x - center.x;
    const dy = y - center.y;
    const distance = Math.hypot(dx, dy);
    if (distance >= influence) return { x, y, stretch: 0 };
    if (distance <= radius) return null;
    const envelope = (1 - (distance - radius) / (influence - radius)) ** 2;
    const pulse = pulseAge ? pulseWeight(distance, radius, influence, pulseAge) : 0;
    const push = radius * .86 * envelope * (strength + pulse * .92);
    const tangent = push * .44;
    return {
        x: x + (dx * push - dy * tangent) / distance,
        y: y + (dy * push + dx * tangent) / distance,
        stretch: envelope * (1 + pulse * .85)
    };
}

export function settledOffset(offset, velocity, seconds) {
    const damping = 2.35;
    return (offset + (velocity + damping * offset) * seconds) * Math.exp(-damping * seconds);
}
