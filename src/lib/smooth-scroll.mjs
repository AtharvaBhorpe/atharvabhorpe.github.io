// Lenis smooths wheel scrolling on GSAP's ticker, so scrolling and the robot floor
// share one clock. Touch keeps native scrolling; reduced motion keeps native everything.
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { gsap } from 'gsap';

export const scroll = { lenis: null };

gsap.ticker.lagSmoothing(0);
gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
  // Nested scrollers (menu panel, wide diagrams) keep their own wheel scrolling.
  const lenis = new Lenis({ allowNestedScroll: true });
  const raf = time => lenis.raf(time * 1000);
  gsap.ticker.add(raf, false, true); // prioritised: scroll settles before anything draws
  // navigation.js scrolls anchor links natively; settle any in-flight easing first or Lenis overrides it.
  const settle = e => { if (e.target.closest?.('a[href*="#"]')) lenis.scrollTo(lenis.actualScroll, { immediate: true }); };
  document.addEventListener('click', settle, true);
  scroll.lenis = lenis;
  return () => { document.removeEventListener('click', settle, true); gsap.ticker.remove(raf); lenis.destroy(); scroll.lenis = null; };
});
