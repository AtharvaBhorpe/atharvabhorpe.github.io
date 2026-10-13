// One landing/selection rule for both scroll containers and all native section links.
(() => {
  const links = () => [...document.querySelectorAll('[data-section]')];
  const heading = id => document.getElementById(id);
  function fragment(hash) {
    try { return decodeURIComponent(hash.slice(1)); } catch { return ''; }
  }
  // Article headings and project subsections land directly; section cards include their padding.
  const target = node => node.closest('.article-shell .prose') || node.tagName === 'H3' ? node : node.closest('.panel') || node;
  function port() {
    const region = document.querySelector('.page-scroll');
    const rect = region?.getBoundingClientRect();
    const visual = window.visualViewport;
    return { region, top: Math.max(rect?.top || 0, visual?.offsetTop || 0), bottom: Math.min(rect?.bottom || innerHeight, (visual?.offsetTop || 0) + (visual?.height || innerHeight)) };
  }
  window.portfolioNavigation = {
    current() {
      const sections = [...new Set(links().map(link => link.dataset.section))];
      const { region, top, bottom } = port();
      let current = sections[0];
      for (const id of sections) if (target(heading(id)).getBoundingClientRect().top <= top + Math.min(48, (bottom - top) / 5)) current = id;
      const scroller = region || document.scrollingElement;
      if (scroller.scrollHeight > scroller.clientHeight && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1) current = sections.at(-1);
      return current;
    }
  };
  function margins() {
    for (const id of new Set(links().map(link => link.dataset.section))) {
      const node = heading(id);
      node.style.scrollMarginTop = (node.getBoundingClientRect().top - target(node).getBoundingClientRect().top + 8) + 'px';
    }
  }
  function land(id, focus) {
    const node = heading(id);
    if (!node || !links().some(link => link.dataset.section === id)) return;
    const { region, top } = port();
    const delta = target(node).getBoundingClientRect().top - top - 8;
    const behavior = focus && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant';
    if (region) region.scrollTo({ top: region.scrollTop + delta, behavior });
    else window.scrollTo({ top: scrollY + delta, behavior });
    if (focus) {
      if (!node.hasAttribute('tabindex')) node.tabIndex = -1;
      node.focus({ preventScroll: true });
    }
    window.updateNavigation();
  }
  document.addEventListener('DOMContentLoaded', () => {
    const hint = document.querySelector('.section-scroll-hint');
    if (hint) {
      const nav = document.querySelector('.phone-dock nav');
      const observer = new ResizeObserver(() => {
        hint.hidden = nav.clientWidth === 0 || nav.scrollWidth <= nav.clientWidth + 1;
      });
      observer.observe(nav);
      // Link widths also change after fonts load or the active section changes.
      nav.querySelectorAll('a').forEach(link => observer.observe(link));
    }
    margins();
    links().forEach(link => link.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.hasAttribute('download') || (link.target && link.target.toLowerCase() !== '_self')) return;
      const pageURL = location.href.split('#')[0];
      if (link.href.split('#')[0] !== pageURL || fragment(link.hash) !== link.dataset.section) return;
      event.preventDefault();
      for (const menu of document.querySelectorAll('.contact-menu:popover-open,.contents-menu:popover-open')) menu.hidePopover();
      try { history.replaceState(history.state, '', pageURL + link.hash); } catch { /* Scrolling still works when history writes are blocked. */ }
      land(link.dataset.section, true);
    }));
    new ResizeObserver(margins).observe(document.querySelector('.content,.case-study'));
    document.fonts.ready.then(() => {
      margins();
      if (performance.getEntriesByType('navigation')[0]?.type !== 'back_forward') land(fragment(location.hash), false);
      window.updateNavigation();
    });
  });
  window.addEventListener('hashchange', () => land(fragment(location.hash), false));
})();
