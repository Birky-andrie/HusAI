/**
 * The landing page's light-beam backdrop.
 *
 * CSS adaptation of the 21st.dev "ethereal beams" reference, whose original is
 * a three.js/react-three-fiber shader. That would have added roughly 200KB
 * gzipped to the first page a visitor loads, to draw a background.
 *
 * What makes the reference read as expensive is not glow — it is *lit geometry*.
 * The shader displaces stacked planes with Perlin noise and lights them with a
 * directional light, so brightness comes from surface normals: a plane turned
 * toward the light goes near-white, its neighbour turned away goes near-black,
 * and the boundary between them is a hard crease. Reproduced here by butting
 * the beams edge to edge (no gaps) and giving each one an independent
 * across-width gradient, so most shared edges land on a brightness
 * discontinuity — which is exactly what a crease is.
 *
 * Purely decorative: aria-hidden, no pointer target, and the motion stops
 * entirely under prefers-reduced-motion (see landing.css).
 */
const BEAM_COUNT = 10;

export default function HeroBeams() {
  return (
    <div className="lp-beams" aria-hidden="true">
      {Array.from({ length: BEAM_COUNT }).map((_, i) => {
        // Three uncorrelated low-discrepancy sequences: width, and the light
        // level at each of the beam's two edges. Deterministic on purpose —
        // Math.random() would reshuffle the composition on every render.
        const p = (i * 0.6180339887) % 1;
        const q = (i * 0.3819660113 + 0.5) % 1;
        const r = (i * 0.7548776662 + 0.25) % 1;
        return (
          <i
            key={i}
            style={{
              '--w': (0.62 + p * 0.85).toFixed(3),
              // Edge light levels. The wide spread is what produces contrast
              // between neighbours; a narrow one just looks like a soft wash.
              '--a': (0.03 + q * 0.5).toFixed(3),
              '--b': (0.03 + r * 0.58).toFixed(3),
              '--d': `${(9 + p * 8).toFixed(2)}s`,
              // Negative delays start every cycle mid-flight, so the field is
              // already in motion on first paint instead of swelling in unison.
              '--delay': `${(-p * 15).toFixed(2)}s`,
              '--sd': `${(6.5 + r * 5).toFixed(2)}s`,
              '--sdelay': `${(-r * 12).toFixed(2)}s`,
            }}
          >
            <span />
          </i>
        );
      })}
    </div>
  );
}
