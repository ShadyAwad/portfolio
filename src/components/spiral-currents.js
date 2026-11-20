import { createField, displace, lowCount, particleCount, project } from './current-particles.js';

// 1.0 preserves the original orbit rate. 0.7 runs autonomous paths at 70%.
export const GALAXY_ORBIT_SPEED_MULTIPLIER = .7;

export function mountCurrents(canvas, { grid, quality, reset } = {}) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return () => {};
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const events = new AbortController();
    const options = { signal: events.signal };
    let particles;
    let light = document.documentElement.dataset.theme === 'light';
    const hand = { x: 0, y: 0, vx: 0, vy: 0, strength: 0, speed: 0, spin: 0 };
    const pulse = { x: 0, y: 0, age: 1 };
    let width, height, scale, radius, cx, cy, bloom;
    let raf, last, time = 0, detail = 1, pressure = 0, low = innerWidth < 650;
    let hover = false, drag, direction = 1, stamp = 0, pageActive = true;

    const mist = document.createElement('canvas');
    mist.width = mist.height = 32;
    const brush = mist.getContext('2d');
    const gas = brush.createRadialGradient(16, 16, 0, 16, 16, 16);
    gas.addColorStop(0, '#44bbee80'); gas.addColorStop(.38, '#308bd540'); gas.addColorStop(1, '#316ac500');
    brush.fillStyle = gas; brush.fillRect(0, 0, 32, 32);

    function setQuality(value) {
        low = value;
        pressure = 0;
        quality?.setAttribute('aria-pressed', String(low));
    }
    function render(dt) {
        const ease = -Math.expm1(-dt * 8);
        detail += ((low ? 0 : 1) - detail) * ease;
        hand.strength += ((hover || drag ? 1 : 0) - hand.strength) * ease;
        hand.spin += ((drag ? direction : 0) - hand.spin) * ease;
        hand.speed *= Math.exp(-dt * 3);
        hand.vx *= Math.exp(-dt * 3); hand.vy *= Math.exp(-dt * 3);
        pulse.age = Math.min(1, pulse.age + dt);
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = bloom;
        ctx.fillRect(cx - scale, cy - scale, scale * 2, scale * 2);
        const count = detail < .002 ? lowCount : particleCount;
        for (let i = 0; i < count; i++) {
            const p = particles[i], prevX = p.screenX, prevY = p.screenY;
            project(p, time * GALAXY_ORBIT_SPEED_MULTIPLIER, scale, cx, cy);
            if (grid && (p.x < -radius || p.x > width + radius)) continue;
            const glow = displace(p, hand, pulse, radius, dt);
            const alpha = Math.min(1, p.opacity + glow) * (i < lowCount ? 1 : detail);
            const size = p.size * Math.min(1.16, .61 + width / 2000);
            if (p.mist) {
                const spread = size * (12 + p.reach * 12);
                ctx.globalAlpha = alpha * .19;
                ctx.drawImage(mist, p.screenX - spread / 2, p.screenY - spread / 2, spread, spread);
            }
            ctx.globalAlpha = alpha;
            ctx.fillStyle = light ? p.lightColor : p.color;
            ctx.fillRect(p.screenX, p.screenY, size, size);
            // A fine companion grain resolves substructure without a separate orbit solve.
            ctx.globalAlpha = alpha * .66;
            ctx.fillRect(p.screenX + scale * p.grainX, p.screenY + scale * p.grainY, size * .74, size * .74);
            if (i % 11 === 0 && dt > 0 && prevX && Math.abs(prevX - p.screenX) + Math.abs(prevY - p.screenY) < 12) {
                ctx.globalAlpha = alpha * .35;
                ctx.strokeStyle = ctx.fillStyle;
                ctx.beginPath(); ctx.moveTo(prevX, prevY); ctx.lineTo(p.screenX, p.screenY); ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;
    }

    function frame(now) {
        const elapsed = now - last;
        const capped = low || (grid && !hover && !drag && pulse.age >= 1 && hand.strength < .01);
        if (!capped || elapsed >= 1000 / 30 - 1) {
            const start = performance.now();
            last = now;
            const dt = Math.min(.12, elapsed / 1000);
            time += dt;
            render(dt);
            pressure = Math.max(0, pressure + (performance.now() - start > 11 || elapsed > 35 ? 1 : -1));
            if (!low && !capped && pressure > 18) setQuality(true);
        }
        raf = requestAnimationFrame(frame);
    }
    function release() {
        if (drag && canvas.hasPointerCapture(drag.id)) canvas.releasePointerCapture(drag.id);
        drag = undefined;
        hover = false;
    }
    function sync() {
        cancelAnimationFrame(raf);
        release();
        hand.spin = hand.strength = hand.vx = hand.vy = hand.speed = 0;
        pulse.age = 1;
        if (canvas.hidden || document.hidden || !pageActive) return;
        if (motion.matches) {
            for (const p of particles) p.dx = p.dy = 0;
            detail = low ? 0 : 1;
        }
        render(0);
        last = performance.now();
        if (!motion.matches) raf = requestAnimationFrame(frame);
    }
    function resize() {
        width = grid ? Math.max(0, Math.floor(grid.getBoundingClientRect().left)) : innerWidth;
        height = innerHeight;
        if (grid) {
            canvas.hidden = width < 48;
            canvas.style.width = width + 'px';
            if (canvas.hidden) { sync(); return; }
        }
        particles ??= createField();
        const dpr = Math.min(devicePixelRatio, width < 650 ? 1 : 1.35);
        canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        scale = Math.min(width * .56, height * .86);
        if (grid) scale = Math.min(490, Math.max(200, width * 1.7), height * .68);
        radius = Math.max(55, Math.min(138, scale * .29));
        cx = width * (grid ? .46 : .52); cy = height * (grid ? .43 : .54);
        updateBloom();
        sync();
    }
    function updateBloom() {
        bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * .62);
        bloom.addColorStop(0, light ? '#17498170' : '#65dcea70'); bloom.addColorStop(.055, light ? '#28558b50' : '#2994be50');
        bloom.addColorStop(.24, '#153d7630'); bloom.addColorStop(1, '#0b245000');
    }
    const theme = new MutationObserver(() => {
        light = document.documentElement.dataset.theme === 'light';
        if (canvas.hidden) return;
        updateBloom();
        if (motion.matches && !document.hidden) render(0);
    });
    theme.observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});
    canvas.addEventListener('pointermove', e => {
        if (!e.isPrimary || motion.matches) return;
        const dt = Math.max(12, e.timeStamp - stamp), k = 1 / dt;
        hand.vx = Math.max(-1, Math.min(1, (e.clientX - hand.x) * k));
        hand.vy = Math.max(-1, Math.min(1, (e.clientY - hand.y) * k));
        hand.speed = Math.min(1, Math.hypot(hand.vx, hand.vy));
        hand.x = e.clientX; hand.y = e.clientY; stamp = e.timeStamp;
        if (drag && Math.hypot(hand.x - drag.x, hand.y - drag.y) > 5) drag.moved = true;
        hover = true;
    }, options);
    canvas.addEventListener('pointerdown', e => {
        if (!e.isPrimary || e.button !== 0 || motion.matches) return;
        hand.x = e.clientX; hand.y = e.clientY; stamp = e.timeStamp;
        drag = { id: e.pointerId, x: hand.x, y: hand.y, moved: false };
        direction = hand.x > cx ? 1 : -1;
        canvas.setPointerCapture(e.pointerId);
    }, options);
    canvas.addEventListener('pointerup', e => {
        if (drag?.id !== e.pointerId) return;
        if (!drag.moved) Object.assign(pulse, { x: e.clientX, y: e.clientY, age: 0 });
        release();
    }, options);
    canvas.addEventListener('lostpointercapture', release, options);
    canvas.addEventListener('pointerleave', () => { if (!drag) hover = false; }, options);
    canvas.addEventListener('keydown', e => {
        if ((e.key === 'Enter' || e.key === ' ') && !motion.matches) {
            e.preventDefault(); Object.assign(pulse, { x: cx, y: cy, age: 0 });
        }
    }, options);
    quality?.addEventListener('click', () => { setQuality(!low); if (motion.matches) sync(); }, options);
    reset?.addEventListener('click', () => {
        time = 0;
        for (const p of particles) p.dx = p.dy = 0;
        sync();
    }, options);
    window.addEventListener('resize', resize, options);
    motion.addEventListener('change', sync, options);
    document.addEventListener('visibilitychange', sync, options);
    window.addEventListener('pagehide', () => { pageActive = false; sync(); }, options);
    window.addEventListener('pageshow', () => { pageActive = true; sync(); }, options);
    setQuality(low);
    resize();
    return () => { cancelAnimationFrame(raf); release(); theme.disconnect(); events.abort(); };
}
