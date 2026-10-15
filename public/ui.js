(() => {
  const sidebar = document.querySelector('.site-navigation');
  const panel = sidebar.querySelector('#navigation-panel');
  const button = sidebar.querySelector('.menu-toggle');
  const content = document.querySelector('main');
  const compact = matchMedia('(max-width:1199px)');
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
  function sync() {
    const hadFocus = panel.contains(document.activeElement);
    animation?.cancel();
    panel.hidden = compact.matches && !open;
    content.inert = compact.matches && open;
    button.setAttribute('aria-expanded', String(compact.matches && open));
    if (compact.matches && panel.hidden && hadFocus) button.focus({ preventScroll:true });
    else if (!compact.matches && document.activeElement === button) (panel.querySelector('[aria-current]') || panel.querySelector('a')).focus({ preventScroll:true });
  }
  sidebar.dataset.enhanced = 'true';
  button.hidden = false;
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
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && open && compact.matches) { event.preventDefault(); close(); }
  });
  document.addEventListener('pointerdown', event => {
    if (open && compact.matches && !panel.contains(event.target) && !button.contains(event.target)) close(false);
  });
  document.addEventListener('focusin', event => {
    if (open && compact.matches && !panel.contains(event.target) && event.target !== button) close(false);
  });
  compact.addEventListener('change', sync);
  reduced.addEventListener('change', () => animation?.cancel());
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
