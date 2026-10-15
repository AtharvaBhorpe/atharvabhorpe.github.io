// Shared anchors use the document scroll position on every route.
(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const scroller = document.scrollingElement;
    const links = [...document.querySelectorAll('[data-section]')];
    const ids = [...new Set(links.map(link => link.dataset.section))].filter(id => document.getElementById(id));
    const key = 'portfolio-scroll:' + location.pathname;
    const fragment = hash => { try { return decodeURIComponent(hash.slice(1)); } catch { return ''; } };
    const clearance = () => innerWidth < 1200 ? document.querySelector('.identity-row').getBoundingClientRect().height + 8 : 32;
    const top = () => clearance();
    function current() {
      let selected = ids[0];
      for (const id of ids) if (document.getElementById(id).getBoundingClientRect().top <= top() + 40) selected = id;
      if (scroller.scrollTop > 0 && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) selected = ids.at(-1);
      return selected;
    }
    function update() {
      const selected = current();
      for (const link of links) {
        if (link.dataset.section === selected) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
    }
    function land(id, focus) {
      const node = document.getElementById(id);
      if (!node) return;
      const destination = scroller.scrollTop + node.getBoundingClientRect().top - top();
      const behavior = focus && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant';
      window.scrollTo({ top:destination, behavior });
      if (focus) {
        if (!node.hasAttribute('tabindex')) node.tabIndex = -1;
        node.focus({ preventScroll:true });
      }
      update();
    }
    window.portfolioNavigation = { current, update, land };
    document.addEventListener('click', event => {
      const link = event.target.closest('a[href]');
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search || !url.hash) return;
      const id = fragment(url.hash);
      if (!document.getElementById(id)) return;
      event.preventDefault();
      window.portfolioMenu?.close(false);
      try { if (location.hash !== url.hash) history.pushState(history.state, '', url); } catch { /* Native scrolling remains available. */ }
      land(id, true);
    });
    let restored = false;
    if (['reload','back_forward'].includes(performance.getEntriesByType('navigation')[0]?.type)) {
      try {
        const saved = Number(sessionStorage.getItem(key));
        if (saved > 0) { scroller.scrollTop = saved; restored = true; }
      } catch { /* Scroll restoration is optional when storage is denied. */ }
    }
    const save = () => { try { sessionStorage.setItem(key, String(scroller.scrollTop)); } catch {} };
    window.addEventListener('scroll', update, { passive:true });
    window.addEventListener('pagehide', save);
    window.addEventListener('resize', update);
    window.addEventListener('hashchange', () => land(fragment(location.hash), false));
    document.fonts.ready.then(() => {
      if (!restored && performance.getEntriesByType('navigation')[0]?.type !== 'back_forward') land(fragment(location.hash), false);
      update();
    });
    update();
  });
})();
