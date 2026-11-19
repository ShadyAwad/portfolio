const TAU = 2 * Math.PI;
const palette = ['#527bd3', '#668fec', '#429cd4', '#58cddc', '#89e8ee', '#d5faff'];
export const particleCount = 3900;
export const lowCount = 1500;

export function createField(count = particleCount) {
    let seed = 83197;
    const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const spread = () => rand() + rand() + rand() - 1.5;
    return Array.from({ length: count }, () => {
        const reach = .08 + .98 * rand() ** .65;
        const dust = rand() < .22;
        const phase = rand() * TAU;
        const arm = (rand() < .5 ? 0 : Math.PI) + (dust ? rand() * TAU : spread() * (.25 + .55 * reach));
        const tint = Math.min(5, Math.max(0, Math.floor((1 - reach) * 5 + rand() * 2 + spread())));
        return {
            reach, phase, arm, speed: (.19 + rand() * .065) / (.48 + reach),
            inner: reach * (.035 + rand() ** 2 * .51), height: spread() * (.018 + reach * .045),
            color: rand() < .04 ? palette[5] : palette[tint], size: .55 + 1.15 * rand() ** 3,
            opacity: (.36 + rand() * .63) * (dust ? .62 : 1), mist: rand() < .055,
            grainX: spread() * (.006 + reach * .022), grainY: spread() * (.004 + reach * .014),
            dx: 0, dy: 0, x: 0, y: 0, screenX: 0, screenY: 0
        };
    });
}

// A particle follows a closed stream tube. Its outbound and inbound paths flank
// the same spiral arm. Nothing wraps from the rim back to the nucleus.
export function project(p, time, scale, cx, cy) {
    const phase = p.phase + time * p.speed;
    const cross = Math.sin(phase);
    const r = p.inner + (p.reach - p.inner) * (.5 - .5 * Math.cos(phase));
    const angle = p.arm + 4.6 * Math.log1p(3.8 * r) + .39 * cross + .085 * Math.sin(8 * r + p.arm + time * .14);
    const u = Math.cos(angle) * r;
    const v = Math.sin(angle) * r * .63 + p.height * (1 + cross * .38);
    p.x = cx + scale * (.949 * u + .315 * v);
    p.y = cy + scale * (-.315 * u + .949 * v);
}

// All forces use projected CSS pixels and a finite support. The exponential
// relaxation integrates the same decay over equal amounts of elapsed time.
export function displace(p, hand, pulse, radius, dt) {
    let tx = 0, ty = 0, shimmer = 0;
    if (hand.strength > .002) {
        const x = p.x - hand.x, y = p.y - hand.y;
        const influence = Math.max(0, 1 - (x * x + y * y) / (radius * radius));
        const w = influence * influence * hand.strength;
        const twist = hand.spin * (1.2 + .75 * hand.speed);
        tx = (-.37 * x - twist * y + hand.vx * radius * .14) * w;
        ty = (-.37 * y + twist * x + hand.vy * radius * .14) * w;
        shimmer = w * .25;
    }
    if (pulse.age < 1) {
        const x = p.x - pulse.x, y = p.y - pulse.y, distance = Math.hypot(x, y);
        const band = Math.max(0, 1 - Math.abs(distance / radius - pulse.age * 1.25) / .19);
        const strength = band * (1 - pulse.age) ** 2;
        const k = strength * 13 / Math.max(1, distance);
        tx += x * k; ty += y * k; shimmer += strength * .6;
    }
    const ease = -Math.expm1(-dt * 12);
    p.dx += (tx - p.dx) * ease;
    p.dy += (ty - p.dy) * ease;
    p.screenX = p.x + p.dx;
    p.screenY = p.y + p.dy;
    return shimmer;
}
