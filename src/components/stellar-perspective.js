export function createStellarLayers(counts = [101, 79, 60]) {
    return counts.map((count, layer) => Array.from({ length: count }, () => ({
        x: (Math.random() - .5) * 1.65,
        y: (Math.random() - .5) * 1.72,
        phase: Math.random(),
        speed: .038 + Math.random() * .018 + layer * .007,
        size: .65 + Math.random() * .39 + layer * .25,
        brightness: .32 + Math.random() * .21 + layer * .10,
        twinkle: Math.random() * Math.PI * 2
    })));
}

export function projectStellarDepth(star, seconds, geometry, panX = 0, panY = 0) {
    const progress = (star.phase + seconds * star.speed) % 1;
    const scale = 1 / (1.55 - progress * 1.16);
    const { width, height } = geometry;
    const dx = (star.x * width - panX) * scale;
    const dy = (star.y * height - panY) * scale;
    return {
        x: width * .5 + dx,
        y: height * .5 + dy,
        dx, dy, scale,
        opacity: Math.min(1, progress / .095, (1 - progress) / .115),
        streak: Math.max(0, Math.min(1, (progress - .51) / .39))
    };
}
