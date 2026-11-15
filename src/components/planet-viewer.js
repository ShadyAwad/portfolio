const viewerUrl = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js';

export function mountPlanetViewer(card) {
    const viewer = card.querySelector('model-viewer');
    const events = new AbortController();
    const { signal } = events;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    let loader;
    let started = false;
    const updateRotation = () => viewer.toggleAttribute('auto-rotate',
        card.dataset.viewer === 'ready' && visible && !document.hidden && !motion.matches);
    const unavailable = () => {
        card.dataset.viewer = 'unavailable';
        updateRotation();
    };
    const loadAsset = () => {
        if (!customElements.get('model-viewer')) {
            unavailable();
            return;
        }
        viewer.setAttribute('src', import.meta.env.BASE_URL + 'assets/Planet.glb');
    };
    viewer.addEventListener('load', () => {
        card.dataset.viewer = 'ready';
        updateRotation();
    }, { signal });
    viewer.addEventListener('error', unavailable, { signal });
    document.addEventListener('visibilitychange', updateRotation, { signal });
    motion.addEventListener('change', updateRotation, { signal });
    const observer = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        updateRotation();
        if (!visible || started) return;
        started = true;
        if (customElements.get('model-viewer')) {
            loadAsset();
            return;
        }
        loader = document.createElement('script');
        loader.type = 'module';
        loader.src = viewerUrl;
        loader.addEventListener('load', loadAsset, { once: true, signal });
        loader.addEventListener('error', unavailable, { once: true, signal });
        document.head.append(loader);
    });
    observer.observe(card);
    return () => {
        events.abort();
        observer.disconnect();
        loader?.remove();
        viewer.removeAttribute('auto-rotate');
    };
}
