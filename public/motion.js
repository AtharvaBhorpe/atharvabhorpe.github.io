// Visible CSS is the fallback; only offscreen leaf groups receive paused entrances.
(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const elements = [...document.querySelectorAll('[data-reveal]')];
    const animations = new Map();
    const heroAnimations = new Set();
    const bounds = () => ({ top:0, bottom:innerHeight, height:innerHeight });
    const finish = element => {
      element.dataset.revealPlayed = 'true';
      observer?.unobserve(element);
      animations.get(element)?.cancel();
      animations.delete(element);
    };
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const element = entry.target;
        observer.unobserve(element);
        element.dataset.revealPlayed = 'true';
        if (reduced.matches || document.visibilityState === 'hidden' || entry.boundingClientRect.bottom <= bounds().top) finish(element);
        else animations.get(element)?.play();
      }
    }, { threshold:0, rootMargin:'0px 0px 120px 0px' }) : undefined;
    const stopHero = () => { heroAnimations.forEach(animation => animation.cancel()); heroAnimations.clear(); };
    const stop = () => { observer?.disconnect(); elements.forEach(finish); stopHero(); };
    for (const element of elements) {
      if (element.dataset.revealPlayed === 'true') continue;
      if (reduced.matches || !observer || !element.animate || element.getBoundingClientRect().top < bounds().bottom || document.visibilityState === 'hidden') { finish(element); continue; }
      const transform = element.dataset.reveal === 'slide' ? 'translateX(12px)' : element.dataset.reveal === 'media' ? 'scale(1.025)' : element.dataset.reveal === 'rise' ? 'translateY(12px)' : 'none';
      const animation = element.animate([{opacity:0,transform},{opacity:1,transform:'none'}], {
        duration:Number(element.dataset.duration) || 520,
        delay:Math.min(Number(element.dataset.delay) || 0, 240),
        easing:'cubic-bezier(0.22,1,0.36,1)', fill:'backwards'
      });
      animation.pause();
      animation.onfinish = () => finish(element);
      animations.set(element, animation);
      observer.observe(element);
    }
    // Font loading never hides the already painted introduction.
    const atTop = scrollY < 2 && (!location.hash || location.hash === '#home');
    if (atTop && !reduced.matches && performance.getEntriesByType('navigation')[0]?.type !== 'back_forward') {
      for (const element of document.querySelectorAll('[data-hero]')) {
        if (!element.animate || element.getBoundingClientRect().top >= bounds().bottom) continue;
        const media = element.dataset.hero === 'media';
        const animation = element.animate([{transform:media?'scale(1.02)':'translateY(12px)'},{transform:'none'}],{duration:media?700:560,delay:media?80:0,easing:'cubic-bezier(0.22,1,0.36,1)',fill:'backwards'});
        heroAnimations.add(animation);
        animation.onfinish = () => heroAnimations.delete(animation);
      }
    }
    let lastTop = scrollY;
    let lastTime = performance.now();
    const onScroll = () => {
      const next = scrollY;
      const now = performance.now();
      const delta = Math.abs(next - lastTop);
      const rapid = delta > bounds().height / 2 || (now - lastTime < 100 && delta > 100);
      for (const [element, animation] of animations) {
        const rect = element.getBoundingClientRect();
        if (rect.bottom <= bounds().top || (rapid && rect.top < bounds().bottom) || (animation.playState === 'running' && rect.top > bounds().bottom)) finish(element);
      }
      if (rapid) stopHero();
      lastTop = next; lastTime = now;
    };
    const onPreference = () => { if (reduced.matches) stop(); };
    const onVisibility = () => { if (document.visibilityState === 'hidden') stop(); };
    window.addEventListener('scroll', onScroll, { passive:true });
    window.addEventListener('resize', stop);
    reduced.addEventListener('change', onPreference);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', () => {
      stop();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', stop);
      reduced.removeEventListener('change', onPreference);
      document.removeEventListener('visibilitychange', onVisibility);
    }, { once:true });
  });
})();
