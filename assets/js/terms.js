/* ==========================================================================
   terms.js: inline term explainers (DESIGN 12.3)
   Last updated: 2026-09-25
   --------------------------------------------------------------------------
   What it does
     In the HTML every marked term is a plain link to the glossary or the member list on lab.html:
       <a class="term" href="lab.html#term-d-mail" data-term="d-mail">D-mail</a>
     With JS and the Popover API, each becomes <button type="button" class="term" popovertarget="tip-d-mail">, and the
     explainer (<div class="tip" id="tip-d-mail" popover>, 1-2 spoiler-safe sentences, in index.html) opens beside
     it. Enter or Space opens (a real button), Esc or a click elsewhere closes (popover light dismiss), and focus
     never leaves the term, so it is where Esc leaves it.
     Placement: CSS anchor positioning (the invoker is the popover's implicit anchor: position-area, with flips);
     where that is missing, the tip is placed under the term here and follows it on scroll.
     The open term carries .is-open (its tonal plate), from the popover's own toggle event.
   Fallback
     No JS, no Popover API or a missing tip: the term stays a link to lab.html.
   ========================================================================== */

export function initTerms() {
  const links = [...document.querySelectorAll('a.term[data-term]')];
  const probe = document.createElement('div');
  if (!links.length || typeof probe.showPopover !== 'function') return null;
  const anchored = CSS.supports?.('position-area: bottom') ?? false;
  let openFor = null;                                   // the button whose tip is open

  const buttons = [];
  for (const a of links) {
    const tip = document.getElementById(`tip-${a.dataset.term}`);
    if (!tip) continue;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = a.className;
    b.dataset.term = a.dataset.term;
    b.setAttribute('popovertarget', tip.id);
    b.dataset.href = a.getAttribute('href');           // kept for QA: where the no-JS link pointed
    b.append(...a.childNodes);
    a.replaceWith(b);
    b.addEventListener('click', () => { openFor = b; }); // runs before the popover toggles: the invoker for placement
    buttons.push(b);
  }

  function place(tip, btn) {
    if (anchored || !btn) return;
    const r = btn.getBoundingClientRect();
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let left = Math.min(Math.max(8, r.left), innerWidth - w - 8);
    let top = r.bottom + 8;
    if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 8);
    tip.classList.add('is-placed');
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }
  let raf = 0;
  const follow = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const open = document.querySelector('.tip:popover-open');
      if (open && openFor) place(open, openFor);
    });
  };

  document.querySelectorAll('.tip[popover]').forEach((tip) => {
    tip.addEventListener('toggle', (e) => {
      const src = e.source instanceof HTMLElement ? e.source : openFor;   // ToggleEvent.source where supported
      if (e.newState === 'open') {
        openFor = src || openFor;
        buttons.forEach((b) => b.classList.toggle('is-open', b === openFor));
        place(tip, openFor);
        if (!anchored) { addEventListener('scroll', follow, { passive: true }); addEventListener('resize', follow); }
      } else {
        buttons.forEach((b) => { if (b.getAttribute('popovertarget') === tip.id) b.classList.remove('is-open'); });
        if (!anchored) { removeEventListener('scroll', follow); removeEventListener('resize', follow); }
      }
    });
  });
  return { count: buttons.length };
}
