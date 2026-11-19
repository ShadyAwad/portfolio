import '../../src/components/galaxy.css';
import { mountGalaxy } from '../../src/components/spiral-galaxy.js';
import { mountStarfield } from '../../src/components/starfield.js';

const canvas = document.querySelector('canvas');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const active = () => !document.hidden;
const place = (w, h) => ({ x: w * .5, y: h * .52, radius: Math.min(w * .42, h * .53, 410) });
const galaxy = mountGalaxy(canvas, motion, place, active);
const scene = mountStarfield(canvas, motion, active, galaxy);
const events = new AbortController(), options = { signal: events.signal };
document.querySelector('#reset').addEventListener('click', galaxy.reset, options);
document.addEventListener('visibilitychange', scene.sync, options);
motion.addEventListener('change', scene.sync, options);
scene.sync();
if (import.meta.hot) import.meta.hot.dispose(() => { events.abort(); scene.destroy(); });
