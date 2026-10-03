
const sidebar = document.querySelector('.detail-sidebar,.rail');
const scrollRegion = document.querySelector('.page-scroll');
const dock = document.querySelector('.phone-dock');
const strip = dock.querySelector('nav');
const menu = document.querySelector('#contact-menu');
const menuButton = document.querySelector('.say-hi');
const sectionLinks = [...sidebar.querySelectorAll('[data-section]')];
const allLinks = [...document.querySelectorAll('[data-section]')];
let activeSection;
let wasCompact;
let swiping = false;
let pointerStart;
let revealAfter = 0;
// Move only the strip, never the article. Manual swipes keep their chosen position.
function revealLink(link) {
  const tab = link.getBoundingClientRect(), rail = strip.getBoundingClientRect();
  if (tab.left < rail.left + 5) strip.scrollLeft += tab.left - rail.left - 5;
  else if (tab.right > rail.right - 5) strip.scrollLeft += tab.right - rail.right + 5;
}
strip.addEventListener('pointerdown', event => { pointerStart = [event.clientX, event.clientY]; });
strip.addEventListener('pointermove', event => {
  if (pointerStart) {
    const dx = Math.abs(event.clientX - pointerStart[0]), dy = Math.abs(event.clientY - pointerStart[1]);
    if (dx > 8 && dx > dy) swiping = true;
  }
}, { passive:true });
for (const type of ['pointerup', 'pointercancel']) window.addEventListener(type, () => {
  pointerStart = null;
  if (swiping) { swiping = false; revealAfter = performance.now() + 800; }
}, { passive:true });
strip.addEventListener('wheel', event => {
  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) revealAfter = performance.now() + 800;
}, { passive:true });
strip.addEventListener('focusin', event => {
  if (event.target.matches('a')) revealLink(event.target);
});
// A breakpoint can hide the focused link before the resize event runs.
for (const region of [sidebar, dock]) region.addEventListener('focusout', event => {
  if (!event.relatedTarget && !region.getClientRects().length) requestAnimationFrame(() => {
    if (document.activeElement === document.body) {
      const visibleNav = dock.getClientRects().length ? strip : sidebar;
      visibleNav.querySelector('[aria-current]').focus({ preventScroll:true });
    }
  });
});
function updateNavigation() {
  const current = sectionLinks.find(link => link.dataset.section === portfolioNavigation.current());
  const compact = dock.getClientRects().length > 0;
  for (const link of allLinks) {
    if (link.dataset.section === current.dataset.section) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
  const dockCurrent = strip.querySelector('[aria-current]');
  if (compact && (activeSection !== current.dataset.section || !wasCompact) && !swiping && performance.now() >= revealAfter) revealLink(dockCurrent);
  if (!compact) {
    const hadFocus = menu.contains(document.activeElement) || dock.contains(document.activeElement);
    if (menu.matches(':popover-open')) menu.hidePopover();
    if (hadFocus) current.focus({ preventScroll:true });
  } else if (sidebar.contains(document.activeElement)) dockCurrent.focus({ preventScroll:true });
  activeSection = current.dataset.section;
  wasCompact = compact;
}
allLinks.forEach(link => link.addEventListener('click', event => {
  if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) revealAfter = 0;
}));
(scrollRegion || window).addEventListener('scroll', updateNavigation, { passive:true });
window.addEventListener('resize', updateNavigation);
window.visualViewport?.addEventListener('resize', updateNavigation);
new ResizeObserver(updateNavigation).observe(document.querySelector('.detail-shell,.stage'));
updateNavigation();
menu.addEventListener('beforetoggle', event => {
  menuButton.setAttribute('aria-expanded', String(event.newState === 'open'));
});
menu.addEventListener('toggle', event => {
  const open = event.newState === 'open';
  if (open) {
    menu.querySelector('.copy-status').textContent = '';
    menu.querySelector('.email-fallback').hidden = true;
    if (!menu.contains(document.activeElement)) menu.querySelector('a').focus({ preventScroll:true });
  } else if (menu.contains(document.activeElement) && dock.getClientRects().length) menuButton.focus({ preventScroll:true });
});
document.querySelectorAll('.copy-email').forEach(copyButton => {
  const scope = copyButton.closest('.copy-scope');
  const copyStatus = scope.querySelector('.copy-status');
  const fallback = scope.querySelector('.email-fallback');
  const email = copyButton.dataset.email;
  fallback.querySelector('input').value = email;
  copyButton.addEventListener('click', async () => {
    copyButton.disabled = true;
    copyButton.setAttribute('aria-busy', 'true');
    copyStatus.textContent = '';
    try {
      if (!navigator.clipboard || (document.featurePolicy && !document.featurePolicy.allowsFeature('clipboard-write'))) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(email);
      copyStatus.textContent = 'Email copied.';
      fallback.hidden = true;
    } catch {
      copyStatus.textContent = 'Copy unavailable. Select the address and copy it manually.';
      fallback.hidden = false;
      if (!menu.contains(scope) || menu.matches(':popover-open')) {
        fallback.querySelector('input').focus({ preventScroll:menu.contains(scope) });
        fallback.querySelector('input').select();
        if (menu.contains(scope)) fallback.scrollIntoView({ block:'nearest' });
      }
    } finally {
      copyButton.disabled = false;
      copyButton.removeAttribute('aria-busy');
    }
  });
});
