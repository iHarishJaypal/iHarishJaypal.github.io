    (() => {
      const menuBtn = document.getElementById('menuBtn');
      const navLinks = document.getElementById('navLinks');
      const year = document.getElementById('year');
      year.textContent = new Date().getFullYear();
      menuBtn.addEventListener('click', () => {
        const isOpen = navLinks.classList.toggle('open');
        menuBtn.setAttribute('aria-expanded', String(isOpen));
        menuBtn.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
      });
      navLinks.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
        menuBtn.setAttribute('aria-label', 'Open navigation');
      }));
      if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const observer = new IntersectionObserver(entries => entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        }), { threshold: 0.12 });
        document.querySelectorAll('.reveal').forEach(section => observer.observe(section));
      } else {
        document.querySelectorAll('.reveal').forEach(section => section.classList.add('visible'));
      }
    })();
