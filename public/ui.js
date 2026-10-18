(() => {
  const sidebar = document.querySelector('.site-navigation');
  const panel = sidebar.querySelector('#navigation-panel');
  const button = sidebar.querySelector('.menu-toggle');
  const content = document.querySelector('main');
  // Keep this complementary to the desktop media query in production.css/detail.css.
  const compact = matchMedia('(max-width:1199px), (hover:none), (pointer:coarse), (pointer:none)');
  const masthead = sidebar.querySelector('.masthead-links');
  const compactOnly = [...sidebar.querySelectorAll('.profile-links,.navigation-panel>.resume-link')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let open = false;
  let animation;
  function close(restoreFocus = true) {
    animation?.cancel();
    open = false;
    content.inert = false;
    panel.hidden = compact.matches;
    button.setAttribute('aria-expanded', 'false');
    if (restoreFocus && compact.matches) button.focus({ preventScroll:true });
  }
  function keepFocusVisible() {
    if (panel.contains(document.activeElement)) document.activeElement.scrollIntoView({ block:'nearest', inline:'nearest' });
  }
  function sync() {
    const active = document.activeElement;
    animation?.cancel();
    open = false;
    content.inert = false;
    // Reveal the destination, transfer focus, then hide the old control. CSS must not hide it first.
    button.hidden = false;
    panel.hidden = false;
    if (compact.matches && (panel.contains(active) || masthead?.contains(active))) button.focus({ preventScroll:true });
    else if (!compact.matches && (active === button || compactOnly.some(node => node.contains(active)))) {
      (panel.querySelector('[aria-current]') || panel.querySelector('a')).focus({ preventScroll:true });
    }
    panel.hidden = compact.matches;
    button.hidden = !compact.matches;
    if (masthead) masthead.hidden = compact.matches;
    for (const node of compactOnly) node.hidden = !compact.matches;
    button.setAttribute('aria-expanded', 'false');
    keepFocusVisible();
  }
  sidebar.dataset.enhanced = 'true';
  sync();
  window.portfolioMenu = { close };
  button.addEventListener('click', () => {
    if (open) { close(); return; }
    open = true;
    content.inert = true;
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    animation?.cancel();
    if (!reduced.matches && panel.animate) animation = panel.animate([{opacity:0,transform:'translateY(4px)'},{opacity:1,transform:'none'}],{duration:200,easing:'cubic-bezier(0.23,1,0.32,1)'});
  });
  // Native fragment navigation still dismisses the sheet if navigation.js fails.
  panel.addEventListener('click', event => {
    if (event.target.closest('a[href^="#"]') && !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && open && compact.matches) { event.preventDefault(); close(); }
  });
  document.addEventListener('pointerdown', event => {
    if (open && compact.matches && !panel.contains(event.target) && !button.contains(event.target)) close(panel.contains(document.activeElement));
  });
  document.addEventListener('focusin', event => {
    if (open && compact.matches && !panel.contains(event.target) && event.target !== button) close(false);
  });
  compact.addEventListener('change', sync);
  reduced.addEventListener('change', () => animation?.cancel());
  // The sheet also changes height with rotation, dynamic browser chrome and text reflow.
  if (window.ResizeObserver) new ResizeObserver(keepFocusVisible).observe(panel);
  document.querySelectorAll('.copy-email').forEach(copyButton => {
    const scope = copyButton.closest('.copy-scope');
    const status = scope.querySelector('.copy-status');
    const fallback = scope.querySelector('.email-fallback');
    const input = fallback.querySelector('input');
    const email = copyButton.dataset.email;
    input.value = email;
    copyButton.addEventListener('click', async () => {
      copyButton.disabled = true;
      copyButton.setAttribute('aria-busy', 'true');
      status.textContent = '';
      try {
        if (!navigator.clipboard || (document.featurePolicy && !document.featurePolicy.allowsFeature('clipboard-write'))) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(email);
        status.textContent = 'Email copied.';
        fallback.hidden = true;
      } catch {
        status.textContent = 'Copy unavailable. Select the address and copy it manually.';
        fallback.hidden = false;
        input.focus();
        input.select();
      } finally {
        copyButton.disabled = false;
        copyButton.removeAttribute('aria-busy');
      }
    });
  });
})();
