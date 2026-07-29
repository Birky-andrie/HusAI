import { useEffect, useRef } from 'react';
import liquidGlass from '../../lib/liquidGlass.js';

const MAX_DRAG = 190; // px from home before resistance takes over
const RETURN_TAU = 0.26; // seconds; larger = slower drift home
const LENS_SIZE = 64; // px, the roaming hover lens — see useHoverLens
const LENS_TAU = 0.085; // seconds; small = the lens tracks the cursor tightly

/**
 * The hero's "Listening…" pill: real liquid-glass refraction, draggable, and it
 * eases back to where it started when released.
 *
 * Interaction notes that matter more than they look:
 *
 * - **Grab offset is preserved.** The pill moves by the pointer's delta from
 *   where it was picked up, so it never jumps to centre itself under the cursor.
 * - **Rubber-banding past the limit.** Rather than clamping hard at MAX_DRAG —
 *   which reads as the element jamming — resistance grows with distance, so it
 *   keeps responding while making clear there is nothing further out there.
 * - **The return is interruptible.** Grabbing mid-flight picks the pill up from
 *   wherever it currently is, because the drag reads live position rather than
 *   a stored target. An animation that had to finish before it could be caught
 *   again would feel like a cutscene.
 * - **Return is exponential, not linear**, and derived from elapsed time rather
 *   than a per-frame constant, so it decelerates naturally and lands the same
 *   way regardless of refresh rate.
 *
 * Stays aria-hidden: it is an ambient flourish that conveys nothing and does
 * nothing, so exposing a draggable control to assistive tech would be noise.
 * Nothing here is keyboard-reachable for the same reason.
 */

/**
 * The roaming hover lens — the Apple Control Center / Dynamic Island behavior
 * where the glass visibly bulges and catches a prismatic highlight wherever the
 * cursor currently is, distinct from the pill's own fixed rim-bend.
 *
 * The efficient trick: the lens is a small, FIXED-SIZE circle, so its
 * displacement map is generated exactly once (on first hover) and never again
 * — moving it afterward is a pure `transform`, which the compositor handles
 * for free. Regenerating a canvas-rasterised map every pointermove frame was
 * never on the table; this sidesteps that entirely by never resizing the lens.
 *
 * Deliberately absent while dragging: the base pill already owns pointer
 * capture during a drag, and a lens still hunting a stale cursor position
 * while the whole pill is being thrown around would read as broken, not fluid.
 */
function useHoverLens(hostRef, lensRef, dragRef) {
  useEffect(() => {
    const host = hostRef.current;
    const lens = lensRef.current;
    if (!host || !lens) return undefined;
    // A cursor-chasing highlight is pure decoration riding on continuous
    // motion — exactly what reduced-motion asks to be removed, not softened.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    if (window.matchMedia?.('(prefers-reduced-transparency: reduce)').matches) return undefined;
    // No hover concept on touch — a finger IS the pointer, there's nothing to chase.
    if (!window.matchMedia?.('(pointer: fine)').matches) return undefined;

    let glass = null;
    const ensureLens = () => {
      if (glass) return;
      // `border` is a FRACTION OF THE SMALLER SIDE. On the wide pill that's
      // the height, so even 0.24 leaves the large width dimension mostly
      // clear — thin rim almost for free. On a circle, width IS the smaller
      // side, so the same fraction eats a much bigger share of the whole
      // shape: 0.34 here left only a ~20px clear island inside a 64px circle,
      // which is why the first two attempts read as a saturated marble rather
      // than glass with a fringed edge. 0.14 is the equivalent-looking ratio
      // for a circle — an inset of ~9px, leaving a ~46px clear center with
      // color confined to a proper thin ring at the true curvature.
      glass = liquidGlass(lens, {
        scale: -66,
        chroma: 12,
        border: 0.14,
        mapBlur: 8,
        blur: 2,
        // Down from 1.9: measured against the label directly under the lens,
        // this plus the CSS glint pushed the backdrop bright enough to crush
        // "Listening…" to 2.96:1 — re-measure after touching this value.
        saturate: 1.4,
        fallbackBlur: 10,
      });
    };

    const target = { x: LENS_SIZE / 2, y: LENS_SIZE / 2 };
    const current = { x: target.x, y: target.y };
    let active = false;
    let raf = 0;
    let last = 0;

    const apply = () => {
      lens.style.transform = `translate3d(${(current.x - LENS_SIZE / 2).toFixed(1)}px, ${(current.y - LENS_SIZE / 2).toFixed(1)}px, 0)`;
    };

    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const k = 1 - Math.exp(-dt / LENS_TAU);
      current.x += (target.x - current.x) * k;
      current.y += (target.y - current.y) * k;
      apply();
      const settled = Math.hypot(target.x - current.x, target.y - current.y) < 0.3;
      if (active || !settled) raf = requestAnimationFrame(tick);
      else raf = 0;
    };

    const setTarget = (clientX, clientY) => {
      const r = host.getBoundingClientRect();
      target.x = clientX - r.left;
      target.y = clientY - r.top;
    };

    const onEnter = (e) => {
      if (dragRef.current) return;
      ensureLens();
      setTarget(e.clientX, e.clientY);
      // Materialize where the cursor actually entered, not at the pill's
      // center — arriving from an old position would read as a jump-cut.
      current.x = target.x;
      current.y = target.y;
      apply();
      host.classList.add('lens-active');
      active = true;
      last = performance.now();
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onMove = (e) => {
      if (!active || dragRef.current) return;
      setTarget(e.clientX, e.clientY);
    };
    const onLeave = () => {
      active = false;
      host.classList.remove('lens-active');
    };

    host.addEventListener('pointerenter', onEnter);
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      host.removeEventListener('pointerenter', onEnter);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      glass?.destroy();
    };
  }, [hostRef, lensRef, dragRef]);
}

export default function ListeningPill({ children }) {
  const ref = useRef(null);
  const lensRef = useRef(null);
  const pos = useRef({ x: 0, y: 0 });
  const drag = useRef(null);
  const raf = useRef(0);

  // Real refraction. The pill floats over the moving beam field, which is the
  // condition that makes a displacement-mapped backdrop worth its cost.
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (window.matchMedia?.('(prefers-reduced-transparency: reduce)').matches) return undefined;
    // Pushed harder than the first pass: chroma is what separates the R/G/B
    // displacement channels into a visible spectral fringe, and 4 was too
    // close together to read as color. border/mapBlur are raised together so
    // the neutral (undistorted) zone still comfortably covers the text and
    // icon in the middle — only the rim, where curvature actually is, bends.
    const glass = liquidGlass(el, {
      scale: -70,
      chroma: 14,
      border: 0.24,
      mapBlur: 5,
      blur: 3,
      saturate: 2.2,
      fallbackBlur: 18,
    });
    return () => glass.destroy();
  }, []);

  useHoverLens(ref, lensRef, drag);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const apply = () => {
      el.style.transform = `translate3d(${pos.current.x.toFixed(2)}px, ${pos.current.y.toFixed(2)}px, 0)`;
    };

    // Past the limit the pill keeps moving, but each extra pixel of pointer
    // travel buys less displacement than the last.
    const resist = (v) => {
      const over = Math.abs(v) - MAX_DRAG;
      if (over <= 0) return v;
      return Math.sign(v) * (MAX_DRAG + (over * MAX_DRAG) / (over + MAX_DRAG));
    };

    const onPointerDown = (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      cancelAnimationFrame(raf.current);
      raf.current = 0;
      // Start the drag BEFORE capturing. Capture only keeps events flowing when
      // the pointer outruns the element; it is an enhancement, and letting it
      // throw here would abort the handler and leave the pill unpickup-able.
      drag.current = { id: e.pointerId, px: e.clientX, py: e.clientY, ox: pos.current.x, oy: pos.current.y };
      el.classList.add('dragging');
      el.classList.remove('lens-active'); // the whole pill is about to move; the lens shouldn't hunt a stale point
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* no capture available — the window listeners below still track it */
      }
    };

    const onPointerMove = (e) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      pos.current.x = resist(d.ox + (e.clientX - d.px));
      pos.current.y = resist(d.oy + (e.clientY - d.py));
      apply();
    };

    const release = (e) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      drag.current = null;
      el.classList.remove('dragging');

      // Reduced motion still returns it home, just without the travel.
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        pos.current.x = 0;
        pos.current.y = 0;
        apply();
        return;
      }

      let last = performance.now();
      const step = (now) => {
        const dt = Math.min((now - last) / 1000, 0.05); // clamp after a tab switch
        last = now;
        const k = Math.exp(-dt / RETURN_TAU);
        pos.current.x *= k;
        pos.current.y *= k;
        apply();
        if (Math.hypot(pos.current.x, pos.current.y) > 0.4) {
          raf.current = requestAnimationFrame(step);
        } else {
          pos.current.x = 0;
          pos.current.y = 0;
          apply();
          raf.current = 0;
        }
      };
      raf.current = requestAnimationFrame(step);
    };

    // Move and release live on the window, not the element: a fast drag can
    // outrun the pill, and if pointer capture was unavailable the element would
    // simply stop receiving events and the pill would stick mid-air.
    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      cancelAnimationFrame(raf.current);
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, []);

  return (
    // The slot carries the hero's staggered entrance; the pill inside owns its
    // own transform. One element cannot do both without them overwriting
    // each other mid-animation.
    <div className="lp-wave-slot">
      <div className="lp-hero-wave" ref={ref} aria-hidden="true">
        {children}
        <span className="lp-wave-lens" ref={lensRef} />
      </div>
    </div>
  );
}
