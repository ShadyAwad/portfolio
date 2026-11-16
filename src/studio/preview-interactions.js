import { createPreviewAction } from './preview-trace.js';

export function bindPreviewInteractions(preview, signal, demoConfirmation, { template, offer, clear, trace }) {
    function updateCart(store, action) {
        const count = store.querySelector('[data-cart-count]');
        const total = store.querySelector('[data-cart-total]');
        const clear = store.querySelector('[data-cart-clear]');
        const nextCount = action === 'clear' ? 0 : Number(count.textContent) + 1;
        const nextTotal = action === 'clear' ? 0 : Number(total.textContent.slice(1)) + action;
        count.textContent = nextCount;
        total.textContent = '$' + nextTotal;
        clear.disabled = nextCount === 0;
        store.querySelector('[data-preview-action="checkout"]').disabled = nextCount === 0;
    }

    preview.addEventListener('click', event => {
        const button = event.target.closest('button');
        if (!button) return;
        const { previewJump, storeCategory, cartAdd, previewAction } = button.dataset;
        const store = button.closest('.mock-store');
        if (previewAction) {
            const context = previewAction === 'checkout' ? {
                count: Number(store.querySelector('[data-cart-count]').textContent),
                total: Number(store.querySelector('[data-cart-total]').textContent.slice(1))
            } : { filter: preview.querySelector('[data-record-filter]')?.value };
            offer(createPreviewAction(template(), previewAction, context));
        } else if (button.hasAttribute('data-preview-trace')) {
            trace();
        } else if (storeCategory) {
            for (const control of store.querySelectorAll('[data-store-category]')) {
                control.setAttribute('aria-pressed', String(control === button));
            }
            for (const product of store.querySelectorAll('[data-category]')) {
                product.hidden = storeCategory !== 'all' && product.dataset.category !== storeCategory;
            }
        } else if (cartAdd) {
            updateCart(store, Number(cartAdd));
            clear();
        } else if (button.hasAttribute('data-cart-clear')) {
            updateCart(store, 'clear');
            clear();
            store.querySelector('[data-preview-section="cart"]').focus();
        } else if (previewJump) {
            const navigation = button.closest('.mock-nav');
            if (navigation) {
                navigation.querySelector('[aria-current]')?.removeAttribute('aria-current');
                button.setAttribute('aria-current', 'location');
            }
            preview.querySelector('[data-preview-section="' + previewJump + '"]')?.focus();
        } else if (button.hasAttribute('data-preview-start')) {
            const target = preview.querySelector('[data-studio-module="conversion"].is-active input')
                ?? preview.querySelector('[data-preview-section="features"]');
            target?.focus();
        }
    }, { signal });
    preview.addEventListener('change', event => {
        if (event.target.matches('[data-preview-workspace-select]')) {
            clear();
            const name = preview.querySelector('[data-workspace-name]');
            if (name) name.textContent = event.target.value;
            return;
        }
        if (!event.target.matches('[data-record-filter]')) return;
        const { value } = event.target;
        clear();
        for (const row of preview.querySelectorAll('[data-record-status]')) {
            row.hidden = value !== 'all' && row.dataset.recordStatus !== value;
        }
    }, { signal });
    preview.addEventListener('submit', event => {
        if (!event.target.matches('[data-preview-demo]')) return;
        event.preventDefault();
        event.target.querySelector('[role="status"]').textContent = demoConfirmation();
    }, { signal });
}
