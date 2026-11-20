# M9 background design

The pre-M7 starfield at `2a9b862` advanced each star toward the viewer along its depth axis. Inverse-depth projection made near stars grow and accelerate outward from the vanishing point. Its 30 ms draw check lived in a continuous animation-frame loop, and stars changed position abruptly at the end of their travel. M8.1 at `de99fac` retains the color and depth bands but drifts stars across the canvas at fixed planar velocities.

M9 will advance stars through bounded depth in the existing capped Canvas 2D loop. Stars will fade at both ends of their travel, and the nearest visible stars will have short trails. Pointer input will shift projection gently. The existing disk, lens radius, and exposed-background hit testing will remain the basis of the interaction. Proximity will ease in, a click or tap will send a short pulse through the local field, and dragging will resist near its bounds before settling on release. Separate filaments will travel along the disk at different rates.

The CSS comet will keep its randomized 48–74 second timer and choose a trajectory and brightness once per passage. Motion, pointer capture, and the comet will use the existing visibility and reduced-motion lifecycle. Browser comparisons will use the same viewport for the historical build, M8.1, and M9.
