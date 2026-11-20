import { StellarPlayback, STELLAR_DURATION } from './stellar-playback.js';
import './stellar-lifecycle.css';

export function mountStellarLifecycle({ inspect = false } = {}) {
    const canvas = document.createElement('canvas');
    canvas.className = 'stellar-lifecycle';
    canvas.setAttribute('aria-hidden', 'true');
    const hit = document.createElement('button');
    hit.type = 'button'; hit.className = 'stellar-activation';
    hit.setAttribute('aria-label', 'Play stellar lifecycle animation');
    document.body.append(canvas, hit);
    const ctx = canvas.getContext('2d');
    if (!ctx) { canvas.remove(); hit.remove(); return () => { } }
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const events = new AbortController(), options = { signal: events.signal };
    const tau = Math.PI * 2, duration = STELLAR_DURATION;
    const knots = [0, .18, .32, .59, .80, .87, .94, 1];
    const dark = ['#607dc5', '#9193d1', '#77b4d3', '#c5e4ee'];
    const pale = ['#304675', '#4c3f73', '#225e7b', '#263e67'];
    let seed = 20261120;
    const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const points = Array.from({ length: 1500 }, () => {
        const a = random() * tau, z = random() * 2 - 1, disc = Math.sqrt(1 - z * z);
        return { a, z, sx: disc * Math.cos(a), sy: z, cloud: Math.sqrt(random()), j: random(), speed: .4 + random(), ray: Math.round(a * 12 / tau) * tau / 12, ink: Math.floor(random() * 4) };
    });

    let w, h, r, cx, cy, left, topY, glow, time = 0, last, timer, light = false, page = true;
    const playback = new StellarPlayback();
    const poseX = new Float64Array(8), poseY = new Float64Array(8);
    function draw(dt) {
        time += dt;
        playback.advance(dt);
        const life = Math.min(.999999, playback.elapsed / duration);
        let k = 0; while (k < 6 && life >= knots[k + 1]) k++;
        const f = (life - knots[k]) / (knots[k + 1] - knots[k]), blend = f * f * (3 - 2 * f);

        ctx.clearRect(0, 0, w, h);
        const colors = light ? pale : dark;
        const resting = playback.state === 'IDLE';
        const count = resting ? 90 : (w < 120 ? 650 : points.length);
        const enter = Math.min(1, playback.elapsed / .8);
        const liveMix = resting ? 0 : playback.state === 'RETURNING' ? 1 - playback.returned / 2 : enter;
        for (let i = 0; i < count; i++) {
            const p = points[i], a = p.a + time * .07 * p.speed;
            const u = Math.cos(a), v = Math.sin(a), rad = p.cloud;
            // Each identity has a position on every path. Interpolate positions, including
            // the final return to the live nebula, so no population is swapped on a cut.
            poseX[0] = u * rad * .92; poseY[0] = v * rad * .78;
            poseX[1] = Math.cos(a + rad * 3.8) * rad * .56; poseY[1] = Math.sin(a + rad * 3.8) * rad * .43;
            poseX[2] = u * rad * .35; poseY[2] = v * rad * (i % 5 ? .085 : .21);
            const ray = p.ray + .06 * Math.sin(time * .36 + rad * 3) + .032 * (p.j - .5);
            poseX[3] = i % 3 ? Math.cos(ray) * rad * rad * .89 : u * rad * .62;
            poseY[3] = i % 3 ? Math.sin(ray) * rad * rad * .85 : v * rad * .065;
            poseX[4] = p.sx * (.48 + .25 * p.j); poseY[4] = p.sy * (.48 + .25 * p.j);
            const shell = 1.03 + .11 * p.j;
            poseX[5] = p.sx * shell; poseY[5] = p.sy * shell;
            poseX[6] = u * rad * (1.23 + .12 * p.j); poseY[6] = v * rad * 1.15;
            poseX[7] = poseX[0]; poseY[7] = poseY[0];
            const alpha = (.32 + .025 * Math.sin(time * .41)) * (1 - liveMix) + (brightness[k] + (brightness[k + 1] - brightness[k]) * blend) * liveMix;
            ctx.globalAlpha = Math.min(1, (.23 + .7 * p.j) * alpha) * .34 * (i < 90 ? 1 : liveMix);
            ctx.fillStyle = colors[p.ink];
            const size = (.48 + p.j * .62) * (inspect ? .90 : .53);
            const idleRadius = i % 4 ? rad * .075 : rad * rad * .30;
            const idleAngle = i % 4 ? p.a + .025 * Math.sin(time * .13 + p.j) : p.ray;
            const px = Math.cos(idleAngle) * idleRadius, py = Math.sin(idleAngle) * idleRadius;
            const lx = poseX[k] + (poseX[k + 1] - poseX[k]) * blend, ly = poseY[k] + (poseY[k + 1] - poseY[k]) * blend;
            ctx.fillRect(cx + r * (px + (lx - px) * liveMix), cy + r * (py + (ly - py) * liveMix), size, size);
        }
        const power = (.34 + .018 * Math.sin(time * .37)) * (1 - liveMix) + (cores[k] + (cores[k + 1] - cores[k]) * blend) * liveMix, halo = r * (.065 + power * .25);
        ctx.globalAlpha = .204; ctx.drawImage(glow, cx - halo, cy - halo, halo * 2, halo * 2);
        ctx.globalAlpha = .44 * (1 - liveMix);
        ctx.fillStyle = light ? '#334c7b' : '#c7efff';
        ctx.fillRect(cx - .5, cy - .5, 1, 1);
        ctx.globalAlpha = 1;
    }
    const brightness = [.12, .25, .72, .78, .68, .56, .045, .12], cores = [.12, .29, .84, 1, .68, .24, .055, .12];
    function palette() {
        light = document.documentElement.dataset.theme === 'light';
        glow = document.createElement('canvas'); glow.width = glow.height = 96;
        const g = glow.getContext('2d'), grad = g.createRadialGradient(48, 48, 0, 48, 48, 48);
        grad.addColorStop(0, light ? '#304c78' : '#e0f6ff'); grad.addColorStop(.13, light ? '#496b99df' : '#a7d9f4ee'); grad.addColorStop(.40, light ? '#46658d55' : '#779be566'); grad.addColorStop(1, '#586da000'); g.fillStyle = grad; g.fillRect(0, 0, 96, 96);
        if (motion.matches && w && !canvas.hidden) draw(0);
    }
    function interval() {
        return playback.state === 'IDLE' ? 100 : 40;
    }

    function tick() {
        const now = performance.now();
        draw(Math.min(.15, (now - last) / 1000));
        last = now;
        timer = setTimeout(tick, interval());
    }

    function sync() {
        hit.disabled = motion.matches;
        clearTimeout(timer);
        if (!page || document.hidden || canvas.hidden) return;
        draw(0);
        last = performance.now();
        if (!motion.matches) timer = setTimeout(tick, interval());
    }

    function fit() {
        const root = document, grid = root.querySelector('#portfolio-grid');
        if (!inspect && !grid) return;
        const edge = inspect ? 0 : grid.getBoundingClientRect().right, room = inspect ? innerWidth : root.documentElement.clientWidth - edge;
        canvas.hidden = !inspect && room < 94;
        hit.hidden = canvas.hidden;
        if (canvas.hidden) { sync(); return }
        w = inspect ? Math.min(room, 760) : Math.min(room, 190); r = w * (inspect ? .232 : .12615); h = Math.ceil(r * 2.85);
        cx = w * .64; cy = h / 2;
        left = inspect ? (innerWidth - w) / 2 : edge + room - w;
        topY = inspect ? (innerHeight - h) / 2 : Math.min(24, innerHeight * .028);
        const ratio = Math.min(devicePixelRatio, 1.35);
        canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio); ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        Object.assign(canvas.style, { width: w + 'px', height: h + 'px', left: left + 'px', top: topY + 'px' });
        const target = Math.max(24, r * .7);
        Object.assign(hit.style, { width: target + 'px', height: target + 'px', left: left + cx - target / 2 + 'px', top: topY + cy - target / 2 + 'px' });
        sync();
    }
    const theme = new MutationObserver(palette);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    palette(); fit();

    hit.addEventListener('click', () => {
        if (motion.matches || canvas.hidden || !playback.activate()) return;
        sync();
    }, options);
    window.addEventListener('resize', fit, options);
    motion.addEventListener('change', () => { if (motion.matches) playback.reset(); sync() }, options);
    document.addEventListener('visibilitychange', sync, options);
    window.addEventListener('pagehide', () => { page = false; sync() }, options);
    window.addEventListener('pageshow', () => { page = true; sync() }, options);
    return () => { clearTimeout(timer); theme.disconnect(); events.abort(); canvas.remove(); hit.remove() };
}
