import { clamp, fieldGeometry, homePosition, projectStar, settledOffset } from './gravity-field.js';

const palette = {
    dark: { star: '#bedaff', warm: '#f3c197', cool: '#adc9f2', core: '#02030a', rim: '#b6a386' },
    light: { star: '#587199', warm: '#966343', cool: '#4d719f', core: '#43516a', rim: '#71829d' }
};
const wrap = (value, length) => ((value % length) + length) % length;

export function mountGravityBackground(canvas, motion, active) {
    const context = canvas.getContext('2d', { desynchronized: true });
    if (!context) return { sync() {}, destroy() {} };
    const events = new AbortController();
    const { signal } = events;
    const root = document.documentElement;
    const grid = document.getElementById('portfolio-grid');
    const stars = Array.from({ length: 160 }, () => ({
        x: Math.random(), y: Math.random(), depth: Math.random(),
        size: .45 + Math.random() ** 2 * 1.18, phase: Math.random() * Math.PI * 2
    }));
    // A sparse group of fixed stars near the initial lens emphasizes its motion even in a narrow gutter.
    const neighbours = [[-27,-63],[13,-44],[-15,-29],[40,-28],[-33,-12],[24,-9],[-26,18],[48,24],[-9,34],[17,52],[-35,65]];
    let geometry, pixelRatio, timer, lastTick, seconds = 0;
    let centre, drag, release, pointer, parallaxX = 0, parallaxY = 0, glow = 0;
    let colors = palette.dark;

    const canAnimate = () => active() && !motion.matches;
    const interval = () => geometry.compact ? 1000 / 15 : 50;
    const bare = target => target === document.body || target === root || target === grid;
    const inWell = (x, y) => centre && Math.hypot(x - centre.x, y - centre.y) < geometry.radius + 9;
    const limitX = value => geometry.topGutter ? clamp(value, geometry.width - 126, geometry.width - 18) : clamp(value, 18, 125);
    const limitY = value => clamp(value, 18, Math.max(18, geometry.height - 18));

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
            context.ellipse(star.x, star.y, size * (.55 + star.stretch), size * .52,
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

    function drawWell(strength) {
        const r = geometry.radius;
        context.save();
        context.translate(centre.x, centre.y);
        context.rotate(-.32);
        const shimmer = Math.sin(seconds * .72);
        arc(r * 1.22, r * 1.29, Math.PI * 1.04, Math.PI * 1.96, colors.cool, .24 * strength);
        arc(r * 1.19, r * 1.16, .18, Math.PI * .94, colors.cool, .14);
        arc(r * 2.72, r * .45, Math.PI, Math.PI * 2, colors.cool, .22);
        context.globalAlpha = 1;
        context.fillStyle = colors.core;
        context.beginPath();
        context.arc(0, 0, r, 0, Math.PI * 2);
        context.fill();
        arc(r, r, 3.3, 5.9, colors.rim, .42, .8);
        for (let band = 0; band < 3; band++) {
            arc(r * (2.18 + band * .31), r * (.28 + band * .1), 0, Math.PI,
                band === 2 ? colors.cool : colors.warm, (.28 - band * .064) * strength, .7);
        }
        arc(r * 2.28, r * .31, .48 + shimmer * .24, 1.74 + shimmer * .25, colors.warm, .62 * strength, 1.15);
        arc(r * 1.26, r * 1.3, 4.05 + shimmer * .22, 4.6 + shimmer * .22, colors.cool, .46 * strength, .75);
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
        parallaxX += ((pointer ? (pointer.x / width - .5) * 16 : 0) - parallaxX) * .16;
        parallaxY += ((pointer ? (pointer.y / height - .5) * 12 : 0) - parallaxY) * .16;
        glow += ((drag || (pointer?.bare && inWell(pointer.x, pointer.y)) ? 1 : 0) - glow) * .26;
        const strength = 1 + glow * .25;
        context.clearRect(0, 0, width, height);
        context.fillStyle = colors.star;
        const count = compact ? 76 : stars.length;
        for (let i = 0; i < count; i++) {
            const star = stars[i];
            const x = wrap(star.x * width + seconds * (.76 + star.depth * 1.28) - parallaxX * star.depth, width);
            const y = wrap(star.y * height + seconds * (.25 + star.depth * .55) - parallaxY * star.depth, height);
            const brightness = .16 + star.depth * .39 + Math.sin(star.phase + seconds * (.7 + star.depth * .32)) * .055;
            renderStar(x, y, star.size, brightness, strength);
        }
        neighbours.forEach(([x, y], index) => {
            renderStar(home.x + x + Math.sin(seconds * .35 + index) * 3,
                home.y + y + Math.sin(seconds * .19 + index) * 4, .95 + index % 3 * .28, .37 + index % 3 * .05, strength);
        });
        drawWell(strength);
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
