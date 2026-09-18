// Homepage enhancements. Content, stores, QR codes and galleries also work without JS.
(() => {
    const homepage = document.querySelector('.home-main');
    if (!homepage) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const revealItems = homepage.querySelectorAll('.reveal');
    let revealObserver;

    if ('IntersectionObserver' in window && !reducedMotion.matches) {
        revealObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                entry.target.classList.remove('will-reveal');
                revealObserver.unobserve(entry.target);
            });
        }, { threshold: 0.06 });

        revealItems.forEach(item => {
            // Don't hide content that's already on screen or reached by a deep link.
            if (item.getBoundingClientRect().top <= window.innerHeight) return;
            item.classList.add('will-reveal');
            revealObserver.observe(item);
        });

        // A keyboard jump into a section must never land in invisible content.
        homepage.addEventListener('focusin', event => {
            const section = event.target.closest('.will-reveal');
            if (!section) return;
            section.classList.remove('will-reveal');
            revealObserver.unobserve(section);
        });
    }

    homepage.querySelectorAll('[data-gallery]').forEach(gallery => {
        const track = gallery.querySelector('.gallery-track');
        const slides = [...track.children];
        const controls = gallery.querySelector('.gallery-controls');
        const previous = gallery.querySelector('[data-previous]');
        const next = gallery.querySelector('[data-next]');
        const count = gallery.querySelector('.gallery-count');
        let current = 0;
        let scrollFrame;

        const updateControls = () => {
            scrollFrame = null;
            if (!track.clientWidth) return;
            current = Math.max(0, Math.min(slides.length - 1, Math.round(track.scrollLeft / track.clientWidth)));
            const label = `${current + 1} / ${slides.length}`;
            if (count.textContent !== label) count.textContent = label;
            previous.disabled = current === 0;
            next.disabled = current === slides.length - 1;
        };

        const goTo = index => {
            const target = Math.max(0, Math.min(slides.length - 1, index));
            track.scrollTo({ left: target * track.clientWidth, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
        };

        previous.addEventListener('click', () => goTo(current - 1));
        next.addEventListener('click', () => goTo(current + 1));
        track.addEventListener('keydown', event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            if (event.key === 'Home') goTo(0);
            else if (event.key === 'End') goTo(slides.length - 1);
            else goTo(current + (event.key === 'ArrowRight' ? 1 : -1));
        });
        track.addEventListener('scroll', () => {
            if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateControls);
        }, { passive: true });
        if ('ResizeObserver' in window) new ResizeObserver(updateControls).observe(track);
        gallery.classList.add('is-enhanced');
        controls.hidden = false;
        updateControls();
    });

    // Pointer-driven depth only on desktop, up to 22px horizontally and 18px vertically.
    // No continuous animation loop.
    const art = homepage.querySelector('.hero-art');
    const hero = homepage.querySelector('.home-hero');
    const pointerCapable = window.matchMedia('(min-width: 1000px) and (hover: hover)');
    let pointerFrame;
    const resetDepth = () => {
        window.cancelAnimationFrame(pointerFrame);
        pointerFrame = null;
        art.style.removeProperty('--pointer-x');
        art.style.removeProperty('--pointer-y');
    };
    hero.addEventListener('pointermove', event => {
        if (reducedMotion.matches || !pointerCapable.matches || event.pointerType === 'touch') return;
        window.cancelAnimationFrame(pointerFrame);
        pointerFrame = window.requestAnimationFrame(() => {
            const bounds = hero.getBoundingClientRect();
            art.style.setProperty('--pointer-x', `${((event.clientX - bounds.left) / bounds.width - 0.5) * 44}px`);
            art.style.setProperty('--pointer-y', `${((event.clientY - bounds.top) / bounds.height - 0.5) * 36}px`);
        });
    }, { passive: true });
    hero.addEventListener('pointerleave', resetDepth);
    pointerCapable.addEventListener('change', resetDepth);
    reducedMotion.addEventListener('change', () => {
        if (reducedMotion.matches) {
            revealObserver?.disconnect();
            revealItems.forEach(item => item.classList.remove('will-reveal'));
            resetDepth();
        }
    });
})();
