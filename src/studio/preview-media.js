import { findModelAsset } from '../components/model-assets.js';
import { mountModelViewer } from '../components/planet-viewer.js';

const placements = {
    saas: ['Interactive media', 'وسائط تفاعلية'],
    ecommerce: ['3D product showcase', 'عرض المنتج ثلاثي الأبعاد'],
    landing: ['Explore the launch visual', 'استكشف المجسّم الرئيسي'],
    'internal-tool': ['Asset inspection', 'فحص الأصل']
};

export const mediaCopy = {
    enabled: ['Interactive 3D Content', 'محتوى تفاعلي ثلاثي الأبعاد'],
    asset: ['3D asset', 'المجسّم'],
    mode: ['Interaction', 'طريقة التفاعل'],
    static: ['Static', 'ثابت'],
    drag: ['Drag to rotate', 'اسحب للتدوير'],
    orbit: ['Auto orbit', 'دوران تلقائي']
};

const hints = {
    idle: ['3D loads when in view.', 'يُحمّل المجسّم عند ظهوره على الشاشة.'],
    loading: ['Loading 3D model…', 'جارٍ تحميل المجسّم…'],
    unavailable: ['Interactive 3D is unavailable. Showing a planet illustration.', 'العرض التفاعلي غير متاح. تُعرض صورة توضيحية للكوكب.'],
    static: ['Fixed 3D view.', 'عرض ثلاثي الأبعاد ثابت.'],
    drag: ['Drag, swipe horizontally, or use the arrow keys.', 'اسحب أو مرّر أفقيًا أو استخدم مفاتيح الأسهم.'],
    orbit: ['Slow rotation. Drag or use arrow keys to inspect.', 'دوران بطيء. اسحب أو استخدم مفاتيح الأسهم للفحص.'],
    reduced: ['Auto rotation is paused for reduced motion. Drag or use arrow keys.', 'الدوران التلقائي متوقف لتقليل الحركة. اسحب أو استخدم مفاتيح الأسهم.']
};

export function previewMediaSlot(template, label) {
    return `<section class="studio-media" data-preview-media="${template}" inert aria-hidden="true">
        <div class="studio-media-clip"><div class="studio-media-card">
            <div class="studio-media-copy"><h5>${label(placements[template])}</h5><p data-media-name></p>
            <p class="studio-media-status" role="status"></p></div>
            <div class="studio-media-stage"><div class="studio-media-poster" aria-hidden="true"><i></i></div></div>
        </div></div>
    </section>`;
}

export function mountPreviewMedia(slot, label) {
    const stage = slot.querySelector('.studio-media-stage');
    const name = slot.querySelector('[data-media-name]');
    const status = slot.querySelector('[role="status"]');
    let viewer, selection, mode;

    function renderStatus(state, reduced = false) {
        slot.dataset.viewer = state;
        const key = state === 'ready' ? (mode === 'orbit' && reduced ? 'reduced' : mode) : state;
        const message = label(hints[key]);
        if (status.textContent !== message) status.textContent = message;
    }

    function destroy() {
        viewer?.destroy();
        viewer = undefined;
        selection = undefined;
    }

    return {
        render(settings) {
            const asset = findModelAsset(settings.asset);
            const enabled = settings.enabled && Boolean(asset);
            slot.toggleAttribute('data-media-enabled', enabled);
            slot.inert = !enabled;
            slot.setAttribute('aria-hidden', String(!enabled));
            if (!enabled) {
                destroy();
                return;
            }
            if (selection === asset.id) {
                if (settings.mode !== mode) {
                    mode = settings.mode;
                    viewer.setMode(mode);
                }
                return;
            }
            destroy();
            selection = asset.id;
            mode = settings.mode;
            const description = label(asset.name);
            name.textContent = description;
            renderStatus('idle');
            viewer = mountModelViewer(stage, { asset, mode, description, onStatus: renderStatus });
        },
        destroy
    };
}
