import { configuration, ENGINEERING_KEYS } from './configuration.js';

const bindings = new WeakMap();

// The planner is optional. Bind its controls independently of the renderer.
export function bindArchitectureInputs(root) {
    if (!root || bindings.has(root)) return;
    const events = new AbortController();
    const inputs = [...root.querySelectorAll('input')];
    let editingInput;
    function sync(state, previous) {
        for (const input of inputs) {
            if (input === editingInput) continue;
            const key = input.name;
            if (ENGINEERING_KEYS.includes(key)) {
                input.checked = state.engineering[key];
            } else if (Object.hasOwn(state.usage, key) && (!previous || state.usage[key] !== previous.usage[key])) {
                input.value = state.usage[key] ?? '';
            }
        }
    }
    root.addEventListener('input', ({ target }) => {
        const key = target.name;
        if (ENGINEERING_KEYS.includes(key)) {
            configuration.update({ engineering: { [key]: target.checked } });
        } else if (Object.hasOwn(configuration.getState().usage, key)) {
            const value = target.value === '' && key === 'requests' ? null : target.valueAsNumber || 0;
            // A blank number can be part of an edit, even when the model uses zero.
            editingInput = target;
            try {
                configuration.update({ usage: { [key]: value } });
            } finally {
                editingInput = undefined;
            }
        }
    }, { signal: events.signal });
    const unsubscribe = configuration.subscribe(sync);
    sync(configuration.getState());
    bindings.set(root, () => {
        events.abort();
        unsubscribe();
        bindings.delete(root);
    });
}

export function unbindArchitectureInputs(root) {
    bindings.get(root)?.();
}
