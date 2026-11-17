import { clamp, fieldGeometry, homePosition, projectStar, settledOffset } from './gravity-field.js';

const palette = {
    dark: { stars: ['#8099c6', '#b3d1f8', '#eee4db'], warm: '#f3c69d', cool: '#9bbcef', core: '#010208', rim: '#cbab91' },
    light: { stars: ['#8798b3', '#58739b', '#626481'], warm: '#a26942', cool: '#4c6e9b', core: '#283249', rim: '#86738b' }
};
const wrap = (value, length) => ((value % length) + length) % length;

export function mountGravityBackground(canvas, motion, active) {
    const context = canvas.getContext('2d', { desynchronized: true });
    if (!context) return { sync() {}, destroy() {} };
    const events = new AbortController();
    const { signal } = events;
    const root = document.documentElement;
    const grid = document.getElementById('portfolio-grid');
    const layers = [[], [], []];
    for (let i = 0; i < 200; i++) {
        const x = Math.random(), y = Math.random(), depth = Math.random();
        // A bounded radial drift recalls perspective travel, with smaller, slower distant stars.
        const travel = .7 + 5.8 * depth ** 2;
        layers[depth > .88 ? 2 : depth > .45 ? 1 : 0].push({
            x, y, vx: .38 + (x - .5) * travel, vy: .18 + (y - .5) * travel * .62,
            size: .63 + depth ** 2.3 * 1.9, phase: Math.random() * Math.PI * 2,
            brightness: .15 + depth ** 1.8 * .59, parallax: .16 + depth ** 2 * .84,
            twinkle: .025 + depth * .03, frequency: .57 + depth * .34
        });
    }
    // Stars near the home position drift independently of the moving lens.
    const neighbours = [[-49,-14],[-33,8],[-28,-26],[-16,21],[-5,-25],[12,-29],[21,12],[33,-9],[37,24],[59,-14],[64,18]];
    let geometry, pixelRatio, timer, lastTick, seconds = 0;
    let centre, drag, release, pointer, parallaxX = 0, parallaxY = 0, glow = 0;
    let colors = palette.dark;

    const canAnimate = () => active() && !motion.matches;
    const interval = () => geometry.compact ? 1000 / 15 : 50;
    const bare = target => target === document.body || target === root || target === grid;
    const inWell = (x, y) => centre && Math.hypot(x - centre.x, y - centre.y) < geometry.radius + 9;
    const limitX = value => clamp(value, Math.max(10, geometry.home.x - 110),
        Math.min(geometry.width - 10, geometry.home.x + 115));
    const limitY = value => clamp(value, geometry.radius, Math.max(geometry.radius, geometry.height - geometry.radius));

    function renderStar(x, y, size, brightness, strength) {
        const dx = x - centre.x, dy = y - centre.y;
        if (Math.abs(dx) >= geometry.influence || Math.abs(dy) >= geometry.influence ||
            dx * dx + dy * dy >= geometry.influence ** 2) {
            context.globalAlpha = brightness;
            context.fillRect(x, y, size, size);
            return;
        }
        const star = projectStar(x, y, centre, geometry.radius, geometry.influence, strength);
        if (!star) return;
        context.globalAlpha = brightness;
        if (star.stretch < .12) context.fillRect(star.x, star.y, size, size);
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

    function drawWell(highlight) {
        const r = geometry.radius;
        context.save();
        context.translate(centre.x, centre.y);
        context.rotate(-.19);
        const phase = seconds * .88;
        const breathing = Math.sin(seconds * .61);
        const rim = 1 + highlight * .15;

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
            const progress = (phase / Math.PI + filament * .57) % 1;
            const start = .18 + progress * 2.53;
            const intensity = Math.sin(Math.PI * progress);
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
            centre = { x: limitX(resting.x + settledOffset(release.x, release.vx, time)),
                y: limitY(resting.y + settledOffset(release.y, release.vy, time)) };
        } else {
            release = undefined;
            centre = resting;
        }
        parallaxX += ((pointer ? (pointer.x / width - .5) * 25 : 0) - parallaxX) * .16;
        parallaxY += ((pointer ? (pointer.y / height - .5) * 18 : 0) - parallaxY) * .16;
        const emphasis = drag ? 1.75 : pointer?.bare && inWell(pointer.x, pointer.y) ? .8 : 0;
        glow += (emphasis - glow) * .26;
        const strength = 1 + glow * .25;
        context.clearRect(0, 0, width, height);
        for (let layer = 0; layer < layers.length; layer++) {
            context.fillStyle = colors.stars[layer];
            const stars = layers[layer];
            const count = compact ? Math.round(stars.length * .45) : stars.length;
            for (let i = 0; i < count; i++) {
                const star = stars[i];
                const x = wrap(star.x * width + seconds * star.vx - parallaxX * star.parallax, width);
                const y = wrap(star.y * height + seconds * star.vy - parallaxY * star.parallax, height);
                const brightness = star.brightness + Math.sin(star.phase + seconds * star.frequency) * star.twinkle;
                renderStar(x, y, star.size, brightness, strength);
            }
        }
        const localScale = compact ? .68 : 1;
        context.fillStyle = colors.stars[1];
        neighbours.forEach(([x, y], index) => {
            renderStar(home.x + x * localScale + Math.sin(seconds * .32 + index) * 3,
                home.y + y * localScale + Math.sin(seconds * .17 + index) * 3,
                (1 + index % 3 * .35) * localScale, .42 + index % 3 * .06, strength);
        });
        drawWell(glow);
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
        drag = { kind, id, x: centre.x, y: centre.y, dx: centre.x - x, dy: centre.y - y, vx: 0, vy: 0, now };
        root.setAttribute('data-gravity-dragging', '');
        release = undefined;
        return true;
    }

    function move(x, y, now) {
        const nextX = limitX(x + drag.dx), nextY = limitY(y + drag.dy);
        const time = Math.max(.012, (now - drag.now) / 1000);
        drag.vx = drag.vx * .4 + clamp((nextX - drag.x) / time, -140, 140) * .6;
        drag.vy = drag.vy * .4 + clamp((nextY - drag.y) / time, -140, 140) * .6;
        drag.x = nextX;
        drag.y = nextY;
        drag.now = now;
    }

    function end(now, cancelled) {
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
            if (drag?.kind === 'pointer' && drag.id === event.pointerId) end(event.timeStamp, type !== 'pointerup');
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
            if (drag?.kind === 'touch' && Array.from(event.changedTouches).some(touch => touch.identifier === drag.id)) {
                end(event.timeStamp, type === 'touchcancel');
            }
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
