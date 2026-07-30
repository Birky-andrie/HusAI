import { motion, useReducedMotion } from 'framer-motion';

// Bidirectional scroll reveal for the landing page, built on Framer Motion's
// whileInView. With viewport.once=false, Framer Motion animates back toward
// `initial` the moment the element leaves the trigger region and replays
// forward the next time it re-enters — no manual reset logic needed.
//
// `margin` on the viewport is negative on the bottom edge, so the reveal
// fires a little before the element's bottom edge would otherwise cross into
// view. That "adjust the trigger early" is what keeps a large drop distance
// from reading as a jarring pop-in: motion is already underway by the time
// the element is prominent on screen, rather than snapping from 0 to 1 right
// at the edge.
const EASE = [0.16, 1, 0.3, 1]; // ease-out-quint: fast start, smooth settle, no bounce

export default function ScrollReveal({
  as = 'div',
  className,
  children,
  delay = 0,
  distance = 64,
  amount = 0.2,
  once = false,
  // Elements with no scroll room after them (the last block(s) on a page)
  // can never satisfy a bottom-shrunk trigger region — once the page hits
  // max scroll, the element is stuck partially past the shrunk edge forever.
  // Pass margin={null} (see LandingFooter.jsx) for those.
  margin = '0px 0px -14% 0px',
  ...rest
}) {
  const reduceMotion = useReducedMotion();
  const Tag = motion[as] || motion.div;

  if (reduceMotion) {
    const Static = as;
    return (
      <Static className={className} {...rest}>
        {children}
      </Static>
    );
  }

  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: distance }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount, margin: margin || '0px' }}
      transition={{ duration: 0.7, delay, ease: EASE }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
