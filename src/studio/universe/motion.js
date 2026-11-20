export function mountUniverseMotion(stage, onSuspend) {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const events = new AbortController();
    const options = { signal: events.signal };
    let visible = false;
    let frame = 0;
    let point;

    const canAnimate = () => visible && !stage.closest('[hidden]') && !document.hidden && !media.matches;
    function reset() {
        cancelAnimationFrame(frame);
        frame = 0;
        stage.style.removeProperty('--universe-x');
        stage.style.removeProperty('--universe-y');
    }
    function suspend() {
        reset();
        for (const element of stage.querySelectorAll('.universe-enter')) element.classList.remove('universe-enter');
        onSuspend();
    }
    const observer = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (!visible) suspend();
    });
    observer.observe(stage);

    stage.addEventListener('pointermove', event => {
        if (event.pointerType !== 'mouse' || !canAnimate()) return;
        point = { x: event.clientX, y: event.clientY };
        if (frame) return;
        frame = requestAnimationFrame(() => {
            frame = 0;
            if (!canAnimate()) return;
            const bounds = stage.getBoundingClientRect();
            stage.style.setProperty('--universe-x', `${(point.x - bounds.left) / bounds.width * 12 - 6}px`);
            stage.style.setProperty('--universe-y', `${(point.y - bounds.top) / bounds.height * 12 - 6}px`);
        });
    }, options);
    stage.addEventListener('pointerleave', reset, options);
    const suspendIfNeeded = () => { if (!canAnimate()) suspend(); };
    document.addEventListener('visibilitychange', suspendIfNeeded, options);
    media.addEventListener('change', suspendIfNeeded, options);
    return {
        canAnimate,
        suspend,
        destroy() {
            reset();
            events.abort();
            observer.disconnect();
        }
    };
}
