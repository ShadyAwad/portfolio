export const modelAssets = Object.freeze({
    planet: Object.freeze({
        id: 'planet',
        name: Object.freeze(['Planet', 'كوكب']),
        path: 'assets/Planet.glb',
        category: 'astronomy',
        defaults: Object.freeze({ exposure: '1.2', 'camera-orbit': '0deg 75deg 108%', 'rotation-per-second': '12deg' })
    })
});

export const modelModes = Object.freeze(['static', 'drag', 'orbit']);
export const findModelAsset = id => typeof id === 'string' && Object.hasOwn(modelAssets, id) ? modelAssets[id] : undefined;

export function viewerInteraction(mode, { ready, visible, documentHidden, reduced }) {
    const active = ready && visible && !documentHidden;
    return {
        controls: active && (mode === 'drag' || mode === 'orbit'),
        rotate: active && mode === 'orbit' && !reduced
    };
}
