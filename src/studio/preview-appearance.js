import { appearanceDefaults, appearanceOptions, appearancePalette, normalizeAccent } from './appearance.js';
import './preview-appearance.css';

const copy = {
    title: ['Appearance', 'المظهر'], accent: ['Accent', 'لون التمييز'],
    template: ['Template default', 'لون القالب'], cyan: ['Cyan', 'سماوي'], violet: ['Violet', 'بنفسجي'],
    emerald: ['Emerald', 'زمردي'], coral: ['Coral', 'مرجاني'], amber: ['Amber', 'كهرماني'],
    custom: ['Custom', 'مخصص'], picker: ['Pick a custom accent', 'اختر لون تمييز مخصصًا'],
    hex: ['Custom HEX', 'رمز اللون المخصص'], invalid: ['Enter a color like #0899BD.', 'أدخل رمز لون مثل #0899BD.'],
    style: ['Style', 'النمط'], minimal: ['Minimal', 'بسيط'], soft: ['Soft', 'ناعم'], bold: ['Bold', 'جريء'],
    typography: ['Typography', 'الخط'], modern: ['Modern', 'حديث'], editorial: ['Editorial', 'تحريري'],
    technical: ['Technical', 'تقني'], density: ['Density', 'الكثافة'],
    comfortable: ['Comfortable', 'مريحة'], compact: ['Compact', 'مضغوطة'],
    reset: ['Reset appearance', 'إعادة ضبط المظهر']
};

export function mountPreviewAppearance(toolbar, preview, store, signal) {
    const details = document.createElement('details');
    details.className = 'studio-appearance';
    const selects = Object.entries(appearanceOptions).map(([key, choices]) =>
        `<label><span data-appearance-copy="${key}"></span><select name="${key}">${choices.map(choice =>
            `<option value="${choice}" data-appearance-copy="${choice}"></option>`).join('')}</select></label>`).join('');
    details.innerHTML = '<summary><span data-appearance-copy="title"></span><i aria-hidden="true"></i></summary>' +
        '<div class="studio-appearance-controls">' + selects +
        '<div class="studio-appearance-custom"><input type="color" data-appearance-picker>' +
        '<label><span data-appearance-copy="hex"></span><input type="text" data-appearance-hex autocapitalize="off"' +
        ' spellcheck="false" placeholder="#RRGGBB" aria-describedby="studio-appearance-error" dir="ltr"></label>' +
        '<small id="studio-appearance-error" role="status"></small></div>' +
        '<button type="button" data-appearance-reset data-appearance-copy="reset"></button></div>';
    toolbar.after(details);
    const fields = [...details.querySelectorAll('select')];
    const picker = details.querySelector('[data-appearance-picker]');
    const input = details.querySelector('[data-appearance-hex]');
    const error = details.querySelector('[role="status"]');
    const swatch = details.querySelector('summary i');
    let invalidMessage = '';
    let lastPalette;

    function setError(invalid) {
        if (invalid) input.setAttribute('aria-invalid', 'true');
        else input.removeAttribute('aria-invalid');
        error.textContent = invalid ? invalidMessage : '';
    }

    details.addEventListener('change', event => {
        const { target } = event;
        if (fields.includes(target)) {
            if (target.name === 'accent') {
                input.value = store.getState().visual.customAccent;
                setError(false);
            }
            store.update({ visual: { [target.name]: target.value } });
        }
        if (target === input && normalizeAccent(input.value)) input.value = store.getState().visual.customAccent;
    }, { signal });
    details.addEventListener('input', ({ target }) => {
        if (target !== picker && target !== input) return;
        const customAccent = normalizeAccent(target.value);
        setError(!customAccent);
        if (!customAccent) return;
        if (target === picker) input.value = customAccent;
        store.update({ visual: { accent: 'custom', customAccent } });
    }, { signal });
    details.querySelector('[data-appearance-reset]').addEventListener('click', () => {
        input.value = appearanceDefaults.customAccent;
        setError(false);
        store.update({ visual: appearanceDefaults });
    }, { signal });

    return {
        localize(label) {
            details.querySelectorAll('[data-appearance-copy]').forEach(node => { node.textContent = label(copy[node.dataset.appearanceCopy]); });
            picker.setAttribute('aria-label', label(copy.picker));
            invalidMessage = label(copy.invalid);
            if (input.hasAttribute('aria-invalid')) setError(true);
        },
        render(visual, dark) {
            for (const field of fields) {
                if (field.value !== visual[field.name]) field.value = visual[field.name];
            }
            if (picker.value !== visual.customAccent) picker.value = visual.customAccent;
            if (document.activeElement !== input && input.value !== visual.customAccent && !input.hasAttribute('aria-invalid')) {
                input.value = visual.customAccent;
            }
            for (const key of ['style', 'typography', 'density']) {
                if (preview.dataset[key] !== visual[key]) preview.dataset[key] = visual[key];
            }
            const key = [visual.accent, visual.customAccent, dark].join();
            if (key === lastPalette) return;
            lastPalette = key;
            const palette = appearancePalette(visual, dark);
            for (const name of ['source', 'ink', 'fill', 'tint', 'onAccent', 'heroFill', 'onHero']) {
                const property = '--appearance-' + name;
                if (palette) preview.style.setProperty(property, palette[name]);
                else preview.style.removeProperty(property);
            }
            swatch.style.background = palette?.source ?? '';
            swatch.hidden = visual.accent === 'template';
        }
    };
}
