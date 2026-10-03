// Approved preference: URL plus guarded storage. Initialize before CSS/body paint.
(() => {
  const root = document.documentElement;
  const normalize = value => {
    if (value === 'bright') return 'light';
    return ['light', 'dark', 'system'].includes(value) ? value : null;
  };
  const query = new URLSearchParams(location.search);
  const explicit = normalize(query.get('theme'));
  const storedMode = () => {
    try { return normalize(localStorage.getItem('portfolio-approved-theme')); } catch { return null; }
  };
  let mode = explicit || storedMode() || 'system';
  const remember = () => {
    try { localStorage.setItem('portfolio-approved-theme', mode); } catch { /* URL remains the fallback. */ }
  };
  function replaceModeURL() {
    try {
      const url = new URL(location.href);
      url.searchParams.set('theme', mode);
      history.replaceState(history.state, '', url);
    } catch { /* Colors still work in restricted documents. */ }
  }
  const restored = storedMode();
  if (performance.getEntriesByType('navigation')[0]?.type === 'back_forward' && restored) {
    mode = restored;
    replaceModeURL();
  } else if (query.get('theme') === 'bright') replaceModeURL();
  remember();
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  function apply() {
    const systemMode = media.matches ? 'dark' : 'light';
    root.dataset.mode = mode;
    root.dataset.resolved = mode === 'system' ? systemMode : mode;
    if (!document.body) return;
    document.querySelectorAll('.preview-theme').forEach(select => { select.value = mode; });
    for (const link of document.querySelectorAll('a[href]')) {
      const href = link.getAttribute('href');
      if (href.startsWith('#')) continue;
      try {
        const url = new URL(href, location.href);
        if (url.origin === location.origin && url.pathname.endsWith('/')) {
          url.searchParams.set('theme', mode);
          link.href = url.href;
        }
      } catch { /* Leave native anchors available. */ }
    }
  }
  window.portfolioTheme = {
    get mode() { return mode; },
    get resolved() { return root.dataset.resolved; },
    get fontsLoaded() {
      return ['Cabinet Grotesk', 'Satoshi'].every(name => [...document.fonts].some(face => face.family.replace(/["']/g, '') === name && face.status === 'loaded'));
    },
    setMode(value) {
      const next = normalize(value);
      if (!next) return;
      mode = next;
      remember();
      replaceModeURL();
      apply();
    }
  };
  apply();
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.querySelectorAll('.preview-theme').forEach(select => {
      select.addEventListener('change', event => window.portfolioTheme.setMode(event.target.value));
    });
    const menu = document.querySelector('#contact-menu');
    menu.addEventListener('focusin', event => {
      if (event.target.closest('.appearance-control')) event.target.scrollIntoView({ block: 'nearest' });
    });
  });
  window.addEventListener('pageshow', event => {
    const saved = storedMode();
    if (event.persisted && saved && saved !== mode) window.portfolioTheme.setMode(saved);
    else apply();
  });
  const onSystemChange = () => { if (mode === 'system') apply(); };
  if (media.addEventListener) media.addEventListener('change', onSystemChange);
  else media.addListener(onSystemChange);
})();
