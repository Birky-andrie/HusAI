import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Document Picture-in-Picture wrapper (Chrome/Edge 116+). Unlike video PiP,
 * this gives us a real always-on-top OS window that can host arbitrary DOM —
 * we portal the FloatingCoach into it so the VA keeps the transcript and
 * Lifeline visible above Zoom/Meet/CRMs without Alt+Tabbing.
 *
 * Notes:
 * - `open()` must run within a user gesture (we call it inside the Start Call
 *   click, before any await that could consume the activation).
 * - The PiP document starts with no styles: we copy every same-origin rule
 *   from the main document so our existing classes just work.
 * - Chrome renders its own title bar with drag + close + "back to tab";
 *   closing (any path) fires `pagehide`, which resets our state.
 */
export default function usePipWindow() {
  const supported = typeof window !== 'undefined' && 'documentPictureInPicture' in window;
  const [pipWindow, setPipWindow] = useState(null);
  const pipRef = useRef(null);

  const close = useCallback(() => {
    pipRef.current?.close();
    pipRef.current = null;
    setPipWindow(null);
  }, []);

  const open = useCallback(
    async ({ width = 340, height = 460 } = {}) => {
      if (!supported || pipRef.current) return pipRef.current;
      const win = await window.documentPictureInPicture.requestWindow({ width, height });

      for (const sheet of document.styleSheets) {
        try {
          const css = [...sheet.cssRules].map((rule) => rule.cssText).join('\n');
          const style = win.document.createElement('style');
          style.textContent = css;
          win.document.head.appendChild(style);
        } catch {
          // Cross-origin stylesheet — reference it instead of inlining.
          if (sheet.href) {
            const link = win.document.createElement('link');
            link.rel = 'stylesheet';
            link.href = sheet.href;
            win.document.head.appendChild(link);
          }
        }
      }
      win.document.body.classList.add('pip-body');

      win.addEventListener('pagehide', () => {
        pipRef.current = null;
        setPipWindow(null);
      });

      pipRef.current = win;
      setPipWindow(win);
      return win;
    },
    [supported]
  );

  useEffect(
    () => () => {
      pipRef.current?.close();
      pipRef.current = null;
    },
    []
  );

  return { supported, pipWindow, open, close };
}
