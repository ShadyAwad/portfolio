const option = (id, en, ar) => Object.freeze({ id, label: Object.freeze([en, ar]) });

export const previewLayouts = Object.freeze({
    saas: Object.freeze([
        option('sidebar', 'Sidebar navigation', 'تنقّل جانبي'),
        option('top', 'Top navigation', 'تنقّل علوي')
    ]),
    ecommerce: Object.freeze([
        option('product', 'Product focus', 'تركيز على المنتج'),
        option('catalog', 'Catalog', 'الكتالوج')
    ]),
    landing: Object.freeze([
        option('split', 'Split hero', 'واجهة منقسمة'),
        option('centered', 'Centered hero', 'واجهة في المنتصف')
    ]),
    'internal-tool': Object.freeze([
        option('table', 'Table workspace', 'مساحة الجدول'),
        option('overview', 'Overview dashboard', 'لوحة نظرة عامة')
    ])
});

export const layoutDefaults = Object.freeze(Object.fromEntries(Object.entries(previewLayouts)
    .map(([template, options]) => [template, options[0].id])));

export function isPreviewLayout(template, value) {
    return previewLayouts[template].some(option => option.id === value);
}
