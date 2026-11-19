const TAU = 2 * Math.PI;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Stops are in disk radii. Arm scatter perturbs the local colour as well as its density.
const spectral = [[0, 255, 240, 166], [.13, 255, 202, 102], [.25, 255, 151, 122], [.42, 248, 108, 177],
[.60, 203, 96, 214], [.77, 140, 109, 225], [1, 102, 151, 237]];

function colour(t) {
    let i = 1;
    while (i < spectral.length - 1 && t > spectral[i][0]) i++;
    const a = spectral[i - 1], b = spectral[i], f = clamp((t - a[0]) / (b[0] - a[0]), 0, 1);
    return 'rgb(' + [1, 2, 3].map(k => Math.round(a[k] + (b[k] - a[k]) * f)).join(' ') + ')';
}

export function createGrains(count, seed = 0x817193) {
    const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const scatter = () => random() + random() + random() - 1.5;
    return Array.from({ length: count }, () => {
        const core = random() < .22;
        const r = core ? .27 * random() ** 1.8 : .025 + .975 * random() ** .79;
        const arm = random() < .53 ? 0 : Math.PI;
        const dust = random() < .28;
        const angle = core || dust ? random() * TAU : arm + 3.55 * Math.log1p(4.5 * r)
            + .15 * Math.sin(11 * r + arm) + scatter() * (.34 + .50 * r);
        const band = clamp(Math.floor(r * 3 + scatter() * .55), 0, 2);
        return {
            r, angle, band, color: random() < .037 ? '#e8ecff' : colour(r + scatter() * .095),
            size: .0024 + .0056 * random() ** 3, alpha: (.42 + .57 * random()) * (1 - r ** 4) * (dust ? .65 : 1)
        };
    });
}

// Differential libration is bounded so that adjacent arm fragments stay connected at any uptime.
export const orbit = (t, band) => t * .014 + (.14 - .037 * band) * Math.sin(t * (.14 - .028 * band) + band);

export function gutterPlacement(contentRight, width, height) {
    const room = width - contentRight;
    if (room < 82 || height < 230) return null;
    return { x: contentRight + room * .51, y: height * .34, radius: Math.min(99, (room - 16) * .46) };
}

function bake(radius) {
    const side = Math.ceil(2 * radius);
    const plates = Array.from({ length: 3 }, () => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = side;
        const ctx = canvas.getContext('2d');
        ctx.translate(side / 2, side / 2);
        return ctx;
    });
    const grains = createGrains(radius < 135 ? 4700 : 14500);
    for (const g of grains) {
        const ctx = plates[g.band], x = Math.cos(g.angle) * g.r * radius, y = Math.sin(g.angle) * g.r * radius;
        const size = Math.max(.62, g.size * radius);
        ctx.fillStyle = g.color;
        // A broad, very low-opacity footprint builds patchy dust along the stellar lanes.
        ctx.globalAlpha = g.alpha * .036;
        ctx.fillRect(x - size * 2.4, y - size * 2.4, size * 5.8, size * 5.8);
        ctx.globalAlpha = g.alpha;
        ctx.fillRect(x, y, size, size);
    }
    const ctx = plates[0], glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * .32);
    glow.addColorStop(0, '#fff0ae'); glow.addColorStop(.12, '#ffd790d9');
    glow.addColorStop(.43, '#ffba8660'); glow.addColorStop(1, '#f2899900');
    ctx.globalAlpha = .85; ctx.fillStyle = glow;
    ctx.fillRect(-radius * .32, -radius * .32, radius * .64, radius * .64);
    return plates.map(p => p.canvas);
}

export function mountGalaxy(canvas, motion, place, active) {
    const hit = document.createElement('button');
    hit.type = 'button';
    hit.className = 'galaxy-orbit';
    hit.setAttribute('aria-label', 'Illuminate spiral galaxy');
    hit.lang = 'en';
    canvas.after(hit);
    const events = new AbortController(), options = { signal: events.signal };
    const sparks = createGrains(48, 9216);
    let pose, plates, resolution, drag, yaw = 0, pitch = 0, targetX = 0, targetY = 0, pulse = 0, last = 0;
    let expensive = 0, lean = false, proximity = 0, warmth = 0;
    function reset() {
        if (drag && hit.hasPointerCapture(drag.id)) hit.releasePointerCapture(drag.id);
        drag = undefined; yaw = pitch = targetX = targetY = pulse = 0;
        last = 0;
        proximity = warmth = 0;
    }
    function resize(width, height, ratio) {
        pose = place(width, height);
        hit.hidden = !pose || motion.matches;
        if (!pose) { plates = undefined; resolution = 0; reset(); return; }
        const { x, y, radius } = pose;
        Object.assign(hit.style, { left: x - radius + 'px', top: y - radius * .68 + 'px', width: 2 * radius + 'px', height: 1.36 * radius + 'px' });
        const pixels = Math.ceil(radius * ratio * 1.35);
        if (pixels !== resolution) { plates = bake(pixels); resolution = pixels; }
    }
    const enabled = () => pose && active() && !motion.matches;
    hit.addEventListener('pointerdown', e => {
        if (!enabled() || !e.isPrimary || e.button !== 0) return;
        drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
        hit.setPointerCapture(e.pointerId);
    }, options);
    hit.addEventListener('pointermove', e => {
        if (!enabled() || !e.isPrimary) return;
        const origin = drag || pose, scale = drag ? 1.8 : 1;
        targetX = clamp((e.clientX - origin.x) / pose.radius, -1, 1) * scale;
        targetY = clamp((e.clientY - origin.y) / pose.radius, -1, 1) * scale;
        proximity = drag ? 1 : Math.max(0, 1 - Math.hypot(targetX, targetY));
    }, options);
    const settle = () => { drag = undefined; targetX = targetY = proximity = 0; };
    hit.addEventListener('lostpointercapture', settle, options);
    hit.addEventListener('pointerleave', () => { if (!drag) settle(); }, options);
    hit.addEventListener('click', () => { if (enabled()) pulse = 1; }, options);

    function draw(ctx, time, light) {
        if (!pose) return;
        const start = performance.now(), dt = clamp(time - last, 0, .2), ease = 1 - Math.exp(-7 * dt);
        last = time;
        yaw += (targetX - yaw) * ease; pitch += (targetY - pitch) * ease;
        warmth += (proximity - warmth) * ease;
        pulse *= Math.exp(-2.8 * dt);
        const { x, y, radius: r } = pose;
        ctx.save();
        ctx.translate(x, y); ctx.rotate(-.32 + yaw * .115); ctx.scale(1, .59 + pitch * .055);
        ctx.globalCompositeOperation = light ? 'multiply' : 'screen';
        for (let band = 2; band >= 0; band--) {
            ctx.save(); ctx.rotate(orbit(time, band));
            ctx.globalAlpha = (light ? .66 : .88) + .04 * warmth + (band === 0 ? .08 * pulse : 0);
            ctx.drawImage(plates[band], -r, -r, 2 * r, 2 * r);
            ctx.restore();
        }
        const count = lean ? 12 : sparks.length;
        for (let i = 0; i < count; i++) {
            const s = sparks[i], a = s.angle + orbit(time, s.band) + .09 * Math.sin(time * .24 + i) + yaw * .04 * s.r;
            const px = Math.cos(a) * r * s.r, py = Math.sin(a) * r * s.r;
            ctx.fillStyle = s.color;
            ctx.globalAlpha = (light ? .32 : .54) * s.alpha * (.75 + .25 * Math.sin(i + time * .7) + pulse * .28);
            ctx.fillRect(px, py, Math.max(.7, r * s.size * 1.5), Math.max(1, r * s.size * 2));
        }
        ctx.restore();
        // Sustained draw pressure reduces spark detail once for this mount.
        if (!lean) {
            expensive = Math.max(0, expensive + (performance.now() - start > 2 ? 1 : -1));
            lean = expensive >= 8;
        }
    }
    return {
        resize, draw, reset, sync() { reset(); hit.hidden = !enabled(); },
        destroy() { reset(); events.abort(); hit.remove(); plates = undefined; }
    };
}
