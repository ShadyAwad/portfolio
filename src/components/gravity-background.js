import {
    clamp, fieldGeometry, homePosition, lensProximity, projectStar, projectStellarDepth,
    pulseDuration, resistBoundary, settledOffset
} from './gravity-field.js';

const palette = {
    dark: { stars: ['#8099c6', '#b3d1f8', '#eee4db'], warm: '#f3c69d', cool: '#9bbcef', core: '#010208', rim: '#cbab91' },
    light: { stars: ['#8798b3', '#58739b', '#626481'], warm: '#a26942', cool: '#4c6e9b', core: '#283249', rim: '#86738b' }
};

export function mountGravityBackground(canvas, motion, active) {
    const context = canvas.getContext('2d', { desynchronized: true });
    if (!context) return { sync() {}, destroy() {} };
    const events = new AbortController();
    const { signal } = events;
    const root = document.documentElement;
    const grid = document.getElementById('portfolio-grid');
    const layers = [100, 73, 49].map((count, layer) => Array.from({ length: count }, () => ({
        x: (Math.random() - .5) * 1.49, y: (Math.random() - .5) * 1.52,
        phase: Math.random(), speed: .027 + Math.random() * .014 + layer * .005,
        size: .67 + Math.random() * .38 + layer * .27,
        brightness: .27 + Math.random() * .17 + layer * .105,
        twinkle: Math.random() * Math.PI * 2
    })));
    // Stars near the home position drift independently of the moving lens.
    const neighbours = [[-49,-14],[-33,8],[-28,-26],[-16,21],[-5,-25],[12,-29],[21,12],[33,-9],[37,24],[59,-14],[64,18]];
    let geometry, pixelRatio, timer, lastTick, seconds = 0;
    let centre, drag, release, pointer, parallaxX = 0, parallaxY = 0, glow = 0;
    let pulseStart = -Infinity;
    let colors = palette.dark;

    const canAnimate = () => active() && !motion.matches;
    const interval = () => geometry.compact ? 1000 / 15 : 50;
    const bare = target => target === document.body || target === root || target === grid;
    const inWell = (x, y) => centre && Math.hypot(x - centre.x, y - centre.y) < geometry.radius + 9;
    const horizontal = () => [Math.max(10, geometry.home.x - 110), Math.min(geometry.width - 10, geometry.home.x + 115)];
    const vertical = () => [geometry.radius, Math.max(geometry.radius, geometry.height - geometry.radius)];

    function renderStar(x, y, size, brightness, strength, pulseAge, trail) {
        if (brightness < .012 || x < -6 || y < -6 || x > geometry.width + 6 || y > geometry.height + 6) return;
        const dx = x - centre.x, dy = y - centre.y;
        if (Math.abs(dx) >= geometry.influence || Math.abs(dy) >= geometry.influence ||
            dx * dx + dy * dy >= geometry.influence ** 2) {
            context.globalAlpha = brightness;
            if (trail?.streak > .08) {
                const length = Math.min(.0065, 4.6 / Math.hypot(trail.dx, trail.dy)) * trail.streak;
                context.globalAlpha = brightness * .29;
                context.lineWidth = Math.max(.6, size * .56);
                context.beginPath();
                context.moveTo(x - trail.dx * length, y - trail.dy * length);
                context.lineTo(x, y);
                context.stroke();
                context.globalAlpha = brightness;
            }
            context.fillRect(x - size / 2, y - size / 2, size, size);
            return;
        }
        const star = projectStar(x, y, centre, geometry.radius, geometry.influence, strength, pulseAge);
        if (!star) return;
        context.globalAlpha = brightness;
        if (star.stretch < .12) context.fillRect(star.x - size / 2, star.y - size / 2, size, size);
        else {
            context.beginPath();
            context.ellipse(star.x, star.y, size * (.57 + star.stretch * strength), size * .48,
                Math.atan2(dy, dx) + Math.PI / 2, 0, Math.PI * 2);
            context.fill();
        }
    }

    function arc(rx, ry, start, end, tint, alpha, width = .7) {
        context.globalAlpha = alpha;
        context.strokeStyle = tint;
        context.lineWidth = width;
        context.beginPath();
        context.ellipse(0, 0, rx, ry, 0, start, end);
        context.stroke();
    }

    function drawWell(highlight, pulseAge) {
        const r = geometry.radius;
        context.save();
        context.translate(centre.x, centre.y);
        context.rotate(-.19);
        const breathing = Math.sin(seconds * .61);
        const flash = pulseAge ? Math.sin(Math.PI * Math.min(1, pulseAge / pulseDuration)) * .12 : 0;
        const rim = 1 + highlight * .17 + flash;

        // The far side bends up behind the silhouette. The bright side is shorter and offset.
        arc(r * 1.21, r * (1.34 + breathing * .035), 3.39, 6.08, colors.cool, .29 * rim, .72);
        arc(r * 1.15, r * 1.29, 3.94, 5.19, colors.cool, .49 * rim, .85);
        arc(r * 2.7, r * .42, Math.PI, Math.PI * 2, colors.cool, .25, .65);

        context.globalAlpha = 1;
        context.fillStyle = colors.core;
        context.beginPath();
        context.arc(0, 0, r, 0, Math.PI * 2);
        context.fill();
        arc(r, r, 3.44, 5.47, colors.rim, .35, .7);
        arc(r * 1.16, r * 1.14, .34, 1.94, colors.cool, .20, .7);

        // Thin foreground strands with a broad, faint edge. The bright filaments travel along them.
        arc(r * 2.67, r * .38, .13, 3.04, colors.warm, .11 * rim, 2.7);
        arc(r * 2.65, r * .35, .1, 3.05, colors.warm, .6 * rim, .86);
        arc(r * 2.28, r * .25, .2, 2.98, colors.warm, .34 * rim, .68);
        arc(r * 2.92, r * .50, .25, 2.70, colors.cool, .21 * rim, .62);
        for (let filament = 0; filament < 2; filament++) {
            const progress = (seconds * (.24 + filament * .16) + filament * .57) % 1;
            const start = .18 + progress * 2.53;
            const intensity = Math.sin(Math.PI * progress) * (.86 + .14 * Math.sin(seconds * 2.4 + filament));
            arc(r * (2.63 - filament * .36), r * (.35 - filament * .09), start, start + .25,
                filament ? colors.cool : colors.warm, .68 * intensity * rim, 1.05);
        }
        context.restore();
    }

    function draw() {
        if (!geometry || !active()) return;
        const { width, height, home, compact } = geometry;
        const resting = homePosition(geometry, seconds);
        if (drag) centre = { x: drag.x, y: drag.y };
        else if (release && seconds - release.at < 4) {
            const time = seconds - release.at;
            centre = { x: clamp(resting.x + settledOffset(release.x, release.vx, time), ...horizontal()),
                y: clamp(resting.y + settledOffset(release.y, release.vy, time), ...vertical()) };
        } else {
            release = undefined;
            centre = resting;
        }
        parallaxX += ((pointer ? (pointer.x / width - .5) * 25 : 0) - parallaxX) * .16;
        parallaxY += ((pointer ? (pointer.y / height - .5) * 18 : 0) - parallaxY) * .16;
        const emphasis = drag ? 1.75 : pointer?.bare ? lensProximity(Math.hypot(pointer.x - centre.x, pointer.y - centre.y), geometry.radius) : 0;
        glow += (emphasis - glow) * .26;
        const strength = 1 + glow * .25;
        const pulseAge = seconds - pulseStart < pulseDuration ? seconds - pulseStart : 0;
        context.clearRect(0, 0, width, height);
        for (let layer = 0; layer < layers.length; layer++) {
            context.strokeStyle = context.fillStyle = colors.stars[layer];
            const stars = layers[layer];
            const count = compact ? Math.round(stars.length * .44) : stars.length;
            for (let i = 0; i < count; i++) {
                const star = stars[i];
                const projection = projectStellarDepth(star, seconds, geometry, parallaxX, parallaxY);
                const size = Math.min(2.8, star.size * projection.scale);
                const brightness = star.brightness * projection.opacity * (.69 + .23 * projection.streak)
                    * (.94 + .06 * Math.sin(star.twinkle + seconds * .87));
                renderStar(projection.x, projection.y, size, brightness, strength, pulseAge,
                    motion.matches || compact ? undefined : projection);
            }
        }
        const localScale = compact ? .68 : 1;
        context.fillStyle = colors.stars[1];
        neighbours.forEach(([x, y], index) => {
            renderStar(home.x + x * localScale + Math.sin(seconds * .32 + index) * 3,
                home.y + y * localScale + Math.sin(seconds * .17 + index) * 3,
                (1 + index % 3 * .35) * localScale, .42 + index % 3 * .06, strength, pulseAge);
        });
        drawWell(glow, pulseAge);
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
        const ratio = Math.min(devicePixelRatio || 1, width < 600 ? 1 : 1.35);
        if (geometry?.width === width && geometry.height === height && pixelRatio === ratio) return;
        resetInteraction();
        geometry = fieldGeometry(width, height);
        pixelRatio = ratio;
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        draw();
    }

    function resetInteraction() {
        if (drag?.kind === 'pointer' && canvas.hasPointerCapture(drag.id)) canvas.releasePointerCapture(drag.id);
        root.removeAttribute('data-gravity-dragging');
        drag = release = pointer = undefined;
        parallaxX = parallaxY = glow = 0;
        pulseStart = -Infinity;
    }

    function sync() {
        clearTimeout(timer);
        timer = undefined;
        resetInteraction();
        if (!active()) return;
        if (motion.matches) seconds = 0;
        draw();
        if (!canAnimate()) return;
        lastTick = performance.now();
        timer = setTimeout(tick, interval());
    }

    function begin(target, x, y, id, kind, now) {
        if (!canAnimate() || drag || !bare(target) || !inWell(x, y)) return false;
        drag = { kind, id, x: centre.x, y: centre.y, dx: centre.x - x, dy: centre.y - y, vx: 0, vy: 0, now, down: now, startX: x, startY: y, moved: false };
        root.setAttribute('data-gravity-dragging', '');
        release = undefined;
        return true;
    }

    function move(x, y, now) {
        drag.moved ||= Math.hypot(x - drag.startX, y - drag.startY) > 5;
        if (!drag.moved) return;
        const nextX = resistBoundary(x + drag.dx, ...horizontal()), nextY = resistBoundary(y + drag.dy, ...vertical());
        const time = Math.max(.012, (now - drag.now) / 1000);
        drag.vx = drag.vx * .4 + clamp((nextX - drag.x) / time, -140, 140) * .6;
        drag.vy = drag.vy * .4 + clamp((nextY - drag.y) / time, -140, 140) * .6;
        drag.x = nextX;
        drag.y = nextY;
        drag.now = now;
    }

    function end(now, cancelled, x, y) {
        if (!cancelled && !drag.moved && now - drag.down < 500 &&
            Math.hypot(x - drag.startX, y - drag.startY) <= 5 &&
            bare(document.elementFromPoint(x, y))) pulseStart = seconds;
        const home = homePosition(geometry, seconds);
        const tossed = !cancelled && now - drag.now < 100;
        release = { x: drag.x - home.x, y: drag.y - home.y, at: seconds, vx: tossed ? drag.vx : 0, vy: tossed ? drag.vy : 0 };
        drag = undefined;
        root.removeAttribute('data-gravity-dragging');
    }

    window.addEventListener('pointerdown', event => {
        if (!event.isPrimary || event.pointerType === 'touch' || event.button !== 0) return;
        if (begin(event.target, event.clientX, event.clientY, event.pointerId, 'pointer', event.timeStamp)) {
            canvas.setPointerCapture(event.pointerId);
        }
    }, { signal });
    window.addEventListener('pointermove', event => {
        if (!event.isPrimary || event.pointerType === 'touch' || !canAnimate()) return;
        pointer = { x: event.clientX, y: event.clientY, bare: bare(event.target) };
        if (drag?.kind !== 'pointer' || drag.id !== event.pointerId) return;
        move(event.clientX, event.clientY, event.timeStamp);
        event.preventDefault();
    }, { signal });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        window.addEventListener(type, event => {
            if (drag?.kind === 'pointer' && drag.id === event.pointerId) end(event.timeStamp, type !== 'pointerup', event.clientX, event.clientY);
        }, { signal });
    }
    window.addEventListener('touchstart', event => {
        if (event.touches.length !== 1 || !canAnimate() || drag) return;
        const { clientX, clientY, identifier } = event.changedTouches[0];
        if (!inWell(clientX, clientY)) return;
        // Touch hit slop can choose a nearby card container even in the gutter.
        // Only allow that adjustment from bare space; actual controls keep their hit area.
        const target = event.target.matches?.('.bento-item') ? document.elementFromPoint(clientX, clientY) : event.target;
        if (begin(target, clientX, clientY, identifier, 'touch', event.timeStamp)) event.preventDefault();
    }, { signal, passive: false });
    window.addEventListener('touchmove', event => {
        if (drag?.kind !== 'touch') return;
        const touch = Array.from(event.changedTouches).find(touch => touch.identifier === drag.id);
        if (touch) move(touch.clientX, touch.clientY, event.timeStamp);
    }, { signal, passive: true });
    for (const type of ['touchend', 'touchcancel']) {
        window.addEventListener(type, event => {
            if (drag?.kind !== 'touch') return;
            const touch = Array.from(event.changedTouches).find(touch => touch.identifier === drag.id);
            if (touch) end(event.timeStamp, type === 'touchcancel', touch.clientX, touch.clientY);
        }, { signal, passive: true });
    }
    root.addEventListener('pointerleave', () => { pointer = undefined; }, { signal });
    window.addEventListener('blur', () => { if (drag) end(performance.now(), true); }, { signal });
    window.addEventListener('resize', resize, { signal, passive: true });
    const theme = new MutationObserver(() => {
        colors = root.dataset.theme === 'light' ? palette.light : palette.dark;
        if (!canAnimate()) draw();
    });
    colors = root.dataset.theme === 'light' ? palette.light : palette.dark;
    theme.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    resize();

    return { sync, destroy() { clearTimeout(timer); events.abort(); resetInteraction(); theme.disconnect(); } };
}
