import { createStellarLayers, projectStellarDepth } from './stellar-perspective.js';

const colors = {
    dark: ['#879fc8', '#b8d5fa', '#f2e7da'],
    light: ['#7d8ea9', '#506f9b', '#646782']
};

export function mountStarfield(canvas, motion, active) {
    const context = canvas.getContext('2d', { desynchronized: true });
    if (!context) return { sync() {}, destroy() {} };
    const events = new AbortController();
    const { signal } = events;
    const root = document.documentElement;
    const layers = createStellarLayers();
    let geometry, pixelRatio, timer, lastTick, seconds = 0;
    let panX = 0, panY = 0, pointer;
    let palette = colors[root.dataset.theme] ?? colors.dark;

    const canAnimate = () => active() && !motion.matches;
    const interval = () => geometry.compact ? 1000 / 15 : 50;

    function draw() {
        if (!geometry || !active()) return;
        const { width, height, compact } = geometry;
        const trails = !compact && !motion.matches;
        panX += ((pointer ? (pointer.x / width - .5) * 25 : 0) - panX) * .16;
        panY += ((pointer ? (pointer.y / height - .5) * 18 : 0) - panY) * .16;
        context.clearRect(0, 0, width, height);
        for (let layer = 0; layer < layers.length; layer++) {
            context.fillStyle = palette[layer];
            context.strokeStyle = palette[layer];
            const stars = layers[layer];
            const count = compact ? Math.round(stars.length * .41) : stars.length;
            for (let i = 0; i < count; i++) {
                const star = stars[i];
                const { x, y, dx, dy, scale, opacity, streak } = projectStellarDepth(star, seconds, geometry, panX, panY);
                if (opacity < .025 || x < -7 || y < -7 || x > width + 7 || y > height + 7) continue;
                const size = Math.min(3.5, star.size * scale);
                const alpha = star.brightness * opacity * (.72 + .27 * streak)
                    * (.94 + .06 * Math.sin(star.twinkle + seconds * .87));
                if (trails && streak > .1) {
                    const length = Math.min(.0105, 7 / Math.max(1, Math.hypot(dx, dy))) * streak;
                    context.globalAlpha = alpha * .34;
                    context.lineWidth = Math.max(.55, size * .48);
                    context.beginPath();
                    context.moveTo(x - dx * length, y - dy * length);
                    context.lineTo(x, y);
                    context.stroke();
                }
                context.globalAlpha = alpha;
                context.fillRect(x - size / 2, y - size / 2, size, size);
            }
        }
        context.globalAlpha = 1;
    }

    function tick() {
        timer = undefined;
        if (!canAnimate()) return;
        const now = performance.now();
        seconds += Math.min(.12, (now - lastTick) / 1000);
        lastTick = now;
        draw();
        timer = setTimeout(tick, interval());
    }

    function resize() {
        const width = innerWidth, height = innerHeight;
        const compact = width < 600;
        const ratio = Math.min(devicePixelRatio || 1, compact ? 1 : 1.35);
        if (geometry?.width === width && geometry.height === height && pixelRatio === ratio) return;
        geometry = { width, height, compact };
        pixelRatio = ratio;
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        if (!canAnimate()) draw();
    }

    function sync() {
        clearTimeout(timer);
        pointer = undefined;
        panX = panY = 0;
        if (!active()) return;
        if (motion.matches) seconds = 0;
        draw();
        if (!canAnimate()) return;
        lastTick = performance.now();
        timer = setTimeout(tick, interval());
    }

    window.addEventListener('pointermove', event => {
        if (event.isPrimary && event.pointerType !== 'touch' && canAnimate()) {
            pointer = { x: event.clientX, y: event.clientY };
        }
    }, { signal, passive: true });
    root.addEventListener('pointerleave', () => { pointer = undefined; }, { signal });
    window.addEventListener('resize', resize, { signal, passive: true });
    const theme = new MutationObserver(() => {
        palette = colors[root.dataset.theme] ?? colors.dark;
        if (!canAnimate()) draw();
    });
    theme.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    resize();

    return { sync, destroy() { clearTimeout(timer); events.abort(); theme.disconnect(); } };
}
