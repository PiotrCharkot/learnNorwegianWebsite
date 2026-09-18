// Progressive enhancement: navigation links stay available without JavaScript.
(() => {
    const header = document.querySelector('.site-header');
    if (!header) return;
    const toggle = header.querySelector('.site-nav-toggle');
    const panel = header.querySelector('.site-nav-panel');
    const brand = header.querySelector('.site-nav-brand');
    if (!toggle || !panel || !brand) return;

    // Keep this breakpoint in sync with navigation.css.
    const mobile = window.matchMedia('(max-width: 1100px)');
    const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';
    const setOpen = (open, restoreFocus = false) => {
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? toggle.dataset.closeLabel : toggle.dataset.openLabel);
        if (restoreFocus) toggle.focus({ preventScroll: true });
        panel.hidden = mobile.matches && !open;
    };
    const syncLayout = () => {
        // Never leave keyboard focus on a control that becomes hidden at a breakpoint.
        if (mobile.matches) {
            toggle.hidden = false;
            setOpen(false, panel.contains(document.activeElement));
        } else {
            if (document.activeElement === toggle) brand.focus({ preventScroll: true });
            setOpen(false);
            toggle.hidden = true;
        }
    };

    toggle.addEventListener('click', () => setOpen(!isOpen()));
    header.addEventListener('keydown', event => {
        if (event.key === 'Escape' && mobile.matches && isOpen()) {
            event.preventDefault();
            setOpen(false, true);
        }
    });
    panel.addEventListener('click', event => {
        if (mobile.matches && event.target.closest('a')) setOpen(false);
    });
    document.addEventListener('click', event => {
        if (mobile.matches && isOpen() && !header.contains(event.target)) setOpen(false);
    });
    header.addEventListener('focusout', event => {
        if (mobile.matches && isOpen() && !header.contains(event.relatedTarget)) setOpen(false);
    });
    mobile.addEventListener('change', syncLayout);
    window.addEventListener('pageshow', syncLayout);
    syncLayout();
    header.dataset.navReady = '';
})();
