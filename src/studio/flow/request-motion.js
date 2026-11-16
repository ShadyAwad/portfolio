export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export const proximity = (point, socket, radius) => clamp(1 - distance(point, socket) / radius, 0, 1);
export const easeTravel = t => t ** 3 * (10 + t * (-15 + 6 * t));

export function magnet(point, socket, radius, reduced = false) {
    if (reduced) return point;
    const t = proximity(point, socket, radius);
    return mix(point, socket, .82 * t * t * (3 - 2 * t));
}

// Carry the spring's actual release tangent, then arrive with zero velocity.
export function handoff(from, to, velocity, duration) {
    const limit = distance(from, to) * .75;
    const speed = Math.hypot(velocity.x, velocity.y) * duration;
    const carry = speed ? duration * Math.min(1, limit / speed) : 0;
    const tangent = { x: velocity.x * carry, y: velocity.y * carry };
    return t => {
        const point = mix(from, to, easeTravel(t));
        const weight = t * (1 - t) ** 3;
        return { x: point.x + tangent.x * weight, y: point.y + tangent.y * weight };
    };
}

export function landingFrames(delivered) {
    const strength = delivered ? .075 : .052;
    return Array.from({ length: 13 }, (_, frame) => {
        const t = frame / 12;
        return { offset: t, scale: frame === 12 ? 1 : 1 + strength * Math.sin(8 * t) * Math.exp(-3.6 * t) };
    });
}

export function captures(point, socket, velocity, recent) {
    const predicted = recent ? {
        x: point.x + clamp(velocity.x, -1.7, 1.7) * 65,
        y: point.y + clamp(velocity.y, -1.7, 1.7) * 65
    } : point;
    return distance(point, socket) < 54 ||
        (distance(point, socket) < 134 && distance(predicted, socket) < 54);
}

export function spring(body, target, elapsed) {
    const dt = clamp(elapsed, .001, .034);
    const steps = Math.ceil(dt / .008);
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
        for (const axis of ['x', 'y']) {
            body.velocity[axis] += ((target[axis] - body.position[axis]) * 365 - body.velocity[axis] * 27) * h;
            body.position[axis] += body.velocity[axis] * h;
        }
    }
    return distance(body.position, target) < .45 && Math.hypot(body.velocity.x, body.velocity.y) < 7;
}

export function channel(from, to, bend) {
    const length = distance(from, to) || 1;
    const middle = {
        x: (from.x + to.x) / 2 + (from.y - to.y) / length * bend,
        y: (from.y + to.y) / 2 + (to.x - from.x) / length * bend
    };
    return t => mix(mix(from, middle, t), mix(middle, to, t), t);
}

export function createFrameLoop(request, cancel) {
    let handle;
    let callback;
    const stop = () => {
        if (handle !== undefined) cancel(handle);
        handle = callback = undefined;
    };
    const tick = time => {
        handle = undefined;
        const work = callback;
        if (work?.(time) && callback === work && handle === undefined) handle = request(tick);
    };
    return {
        start(work) {
            if (work === callback && handle !== undefined) return;
            stop();
            callback = work;
            handle = request(tick);
        },
        stop
    };
}
