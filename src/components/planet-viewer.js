import { modelAssets, viewerInteraction } from './model-assets.js';

const viewerUrl = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js';
let runtime;

function loadViewerRuntime() {
    if (customElements.get('model-viewer')) return Promise.resolve();
    runtime ??= new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.type = 'module';
        script.src = viewerUrl;
        const timeout = setTimeout(() => finish(false), 15000);
        function finish(loaded) {
            clearTimeout(timeout);
            script.remove();
            if (loaded && customElements.get('model-viewer')) resolve();
            else reject(new Error('Model Viewer unavailable'));
        }
        script.addEventListener('load', () => finish(true), { once: true });
        script.addEventListener('error', () => finish(false), { once: true });
        document.head.append(script);
    }).catch(error => {
        runtime = undefined;
        throw error;
    });
    return runtime;
}

// The same runtime and lifecycle serve the standalone card and the miniature site.
export function mountModelViewer(target, { asset, mode, description, standalone = false, onStatus = () => {} }) {
    const events = new AbortController();
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let viewer, viewerEvents, visible = false, pending = false, status = 'idle';
    const inView = () => visible && !document.hidden && !target.closest('[hidden]');

    function updateInteraction() {
        if (!viewer) return;
        const { controls, rotate } = viewerInteraction(mode, {
            ready: status === 'ready', visible: inView(), documentHidden: document.hidden, reduced: motion.matches
        });
        viewer.toggleAttribute('camera-controls', controls);
        viewer.toggleAttribute('auto-rotate', rotate);
        // Model Viewer manages its own keyboard target in the shadow tree.
        viewer.inert = status !== 'ready' || !inView();
    }

    function setStatus(next) {
        status = next;
        onStatus(next, motion.matches);
        updateInteraction();
    }

    function releaseViewer() {
        viewerEvents?.abort();
        viewerEvents = undefined;
        viewer?.removeAttribute('auto-rotate');
        viewer?.remove();
        viewer = undefined;
    }

    function unavailable() {
        releaseViewer();
        setStatus('unavailable');
    }

    async function sync() {
        if (!inView()) {
            if (viewer) {
                releaseViewer();
                setStatus('idle');
            }
            return;
        }
        if (pending || viewer || status === 'unavailable') return;
        pending = true;
        setStatus('loading');
        try {
            await loadViewerRuntime();
            if (events.signal.aborted || !inView()) return;
            const Viewer = customElements.get('model-viewer');
            viewer = new Viewer();
            viewerEvents = new AbortController();
            if (standalone) {
                viewer.id = 'ship-viewer';
                viewer.setAttribute('ar', '');
            }
            for (const [name, value] of Object.entries(asset.defaults)) viewer.setAttribute(name, value);
            if (standalone) viewer.setAttribute('rotation-per-second', '15deg');
            viewer.setAttribute('alt', description);
            viewer.setAttribute('touch-action', 'pan-y');
            viewer.setAttribute('interaction-prompt', 'none');
            if (!standalone) {
                viewer.setAttribute('auto-rotate-delay', '650');
                viewer.setAttribute('disable-zoom', '');
                viewer.setAttribute('disable-pan', '');
                viewer.setAttribute('disable-tap', '');
            }
            viewer.addEventListener('load', () => setStatus('ready'), { signal: viewerEvents.signal });
            viewer.addEventListener('error', unavailable, { signal: viewerEvents.signal });
            viewer.inert = true;
            target.append(viewer);
            viewer.setAttribute('src', import.meta.env.BASE_URL + asset.path);
        } catch {
            if (!events.signal.aborted) unavailable();
        } finally {
            pending = false;
            if (!events.signal.aborted && !viewer && status === 'loading') setStatus('idle');
        }
    }

    const observer = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting && entry.intersectionRatio > 0;
        sync();
    }, { threshold: [0, .01] });
    observer.observe(target);
    document.addEventListener('visibilitychange', sync, { signal: events.signal });
    motion.addEventListener('change', () => setStatus(status), { signal: events.signal });
    return {
        setMode(next) { mode = next; setStatus(status); },
        destroy() {
            events.abort();
            observer.disconnect();
            releaseViewer();
        }
    };
}

export function mountPlanetViewer(card) {
    const controller = mountModelViewer(card.querySelector('.canvas-wrapper'), {
        asset: modelAssets.planet, mode: 'orbit', description: '3D planet', standalone: true,
        onStatus: status => { card.dataset.viewer = status; }
    });
    return controller.destroy;
}
