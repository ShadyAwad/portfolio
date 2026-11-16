export const accentPresets = Object.freeze({
    cyan: '#0899bd', violet: '#8055dc', emerald: '#17a472', coral: '#e3665a', amber: '#d58b16'
});
export const appearanceOptions = Object.freeze({
    accent: Object.freeze(['template', ...Object.keys(accentPresets), 'custom']),
    style: Object.freeze(['minimal', 'soft', 'bold']),
    typography: Object.freeze(['modern', 'editorial', 'technical']),
    density: Object.freeze(['comfortable', 'compact'])
});
export const appearanceDefaults = Object.freeze({
    accent: 'template', customAccent: accentPresets.cyan, style: 'minimal', typography: 'modern', density: 'comfortable'
});

export function normalizeAccent(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return /^#[\da-f]{6}$/i.test(trimmed) ? trimmed.toLowerCase() : null;
}

const rgb = hex => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
const mix = (from, to, fraction) => from.map((channel, index) => Math.round(channel + (to[index] - channel) * fraction));
const hex = color => '#' + color.map(channel => channel.toString(16).padStart(2, '0')).join('');
const white = [255, 255, 255];
const black = [0, 0, 0];
const luminance = color => color.reduce((total, channel, index) => {
    const srgb = channel / 255;
    return total + [0.2126, 0.7152, 0.0722][index] * (srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4);
}, 0);

function ratio(a, b) {
    const first = luminance(a);
    const second = luminance(b);
    return (Math.max(first, second) + .05) / (Math.min(first, second) + .05);
}

function contrastTone(source, target, surfaces, minimum) {
    for (let step = 0; step <= 20; step++) {
        const tone = mix(source, target, step / 20);
        if (surfaces.every(surface => ratio(tone, surface) >= minimum)) return tone;
    }
    return target;
}

export function appearancePalette(visual, dark) {
    if (visual.accent === 'template') return null;
    const source = visual.accent === 'custom' ? visual.customAccent : accentPresets[visual.accent];
    const base = rgb(source);
    const surfaces = (dark ? ['#1b2639', '#111928', '#3a2a25'] : ['#ffffff', '#eff2f8', '#f1e3d4']).map(rgb);
    const tint = mix(surfaces[0], base, dark ? .2 : .12);
    const target = dark ? white : black;
    const ink = contrastTone(base, target, [...surfaces, tint], 4.5);
    const fill = contrastTone(base, target, surfaces, 3);
    const heroFill = contrastTone(base, white, [rgb('#39265b')], 3);
    const foreground = color => ratio(color, white) >= ratio(color, black) ? '#ffffff' : '#000000';
    return { source, ink: hex(ink), fill: hex(fill), tint: hex(tint),
        onAccent: foreground(fill), heroFill: hex(heroFill), onHero: foreground(heroFill) };
}
