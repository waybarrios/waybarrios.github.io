    (function () {
      var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var progress = document.querySelector('.scroll-progress');
      var hero = document.querySelector('.hero');
      var navLinks = document.querySelectorAll('.site-header nav a[href^="#"]');
      var navSections = [];
      var frame = 0;
      var i;
      var supportsScrollTimeline = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('animation-timeline: scroll()');
      var supportsViewTimeline = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('animation-timeline: view()');
      var root = document.documentElement;
      var themeToggle = document.getElementById('theme-toggle');
      var colorSchemeMeta = document.querySelector('meta[name="color-scheme"]');
      var themeColorMeta = document.querySelector('meta[name="theme-color"]');

      for (i = 0; i < navLinks.length; i += 1) {
        var section = document.querySelector(navLinks[i].getAttribute('href'));
        if (section) navSections.push({ link: navLinks[i], section: section });
      }

      function updateHero(ratio) {
        if (supportsViewTimeline) return;
        var compact = window.innerWidth <= 620;
        var values = compact
          ? { portraitX: 0, portraitY: -14, portraitScale: .04, portraitFade: .1 }
          : { portraitX: -18, portraitY: -26, portraitScale: .08, portraitFade: .12 };
        hero.style.setProperty('--hero-scroll', ratio.toFixed(3));
        hero.style.setProperty('--portrait-x', (ratio * values.portraitX).toFixed(2) + 'px');
        hero.style.setProperty('--portrait-y', (ratio * values.portraitY).toFixed(2) + 'px');
        hero.style.setProperty('--portrait-scale', (1 + ratio * values.portraitScale).toFixed(4));
        hero.style.setProperty('--portrait-opacity', (1 - ratio * values.portraitFade).toFixed(4));
      }

      function updateNavigation() {
        var activeIndex = -1;
        var marker = Math.min(180, window.innerHeight * .3);
        for (var index = 0; index < navSections.length; index += 1) {
          if (navSections[index].section.getBoundingClientRect().top <= marker) activeIndex = index;
        }
        for (var linkIndex = 0; linkIndex < navSections.length; linkIndex += 1) {
          var active = linkIndex === activeIndex;
          navSections[linkIndex].link.classList.toggle('is-active', active);
          if (active) navSections[linkIndex].link.setAttribute('aria-current', 'location');
          else navSections[linkIndex].link.removeAttribute('aria-current');
        }
      }

      function render() {
        var distance = document.documentElement.scrollHeight - window.innerHeight;
        var pageRatio = distance > 0 ? window.scrollY / distance : 0;
        var heroRatio = hero ? Math.min(1, Math.max(0, window.scrollY / Math.max(1, hero.offsetHeight))) : 0;
        if (progress && !supportsScrollTimeline) progress.style.transform = 'scaleX(' + Math.min(1, Math.max(0, pageRatio)) + ')';
        if (!reducedMotion && hero) updateHero(heroRatio);
        updateNavigation();
        frame = 0;
      }

      function syncThemeToggle() {
        var isDark = root.dataset.theme === 'dark';
        if (themeToggle) {
          themeToggle.setAttribute('aria-pressed', String(isDark));
          themeToggle.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
        }
      }

      function applyTheme(next) {
        root.dataset.theme = next;
        try { localStorage.setItem('theme', next); } catch (e) {}
        if (colorSchemeMeta) colorSchemeMeta.content = next === 'dark' ? 'dark' : 'light';
        if (themeColorMeta) themeColorMeta.content = next === 'dark' ? '#171613' : '#f5f3ed';
        syncThemeToggle();
      }

      if (themeToggle) {
        themeToggle.addEventListener('click', function () {
          var next = root.dataset.theme === 'dark' ? 'light' : 'dark';
          if (reducedMotion || !document.startViewTransition) { applyTheme(next); return; }
          var cleanup = function () { root.classList.remove('theme-transitioning'); };
          root.classList.add('theme-transitioning');
          var transition = document.startViewTransition(function () { applyTheme(next); });
          if (transition.finished) transition.finished.then(cleanup, cleanup); else setTimeout(cleanup, 700);
          if (transition.ready) {
            transition.ready.then(function () {
              var rect = themeToggle.getBoundingClientRect();
              var x = rect.left + rect.width / 2;
              var y = rect.top + rect.height / 2;
              var radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
              root.animate(
                { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + radius + 'px at ' + x + 'px ' + y + 'px)'] },
                { duration: 540, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' }
              );
            }).catch(function () {});
          }
        });
      }
      syncThemeToggle();

      function schedule() {
        if (!frame) frame = window.requestAnimationFrame(render);
      }

      window.addEventListener('scroll', schedule, { passive: true });
      window.addEventListener('resize', schedule, { passive: true });
      window.addEventListener('pageshow', schedule);
      window.addEventListener('load', schedule);
      window.requestAnimationFrame(function () { window.requestAnimationFrame(render); });

      /* GSAP ScrollTrigger: editorial reveals + animated counters */
      if (!reducedMotion && typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);

        /* Split section headings into words (marianmarton-style word cascade) */
        document.querySelectorAll('.section-heading').forEach(function (heading) {
          heading.querySelectorAll('.section-title-line').forEach(function (line) {
            var words = line.textContent.trim().split(/\s+/);
            line.textContent = '';
            for (var w = 0; w < words.length; w += 1) {
              if (w > 0) line.appendChild(document.createTextNode(' '));
              var word = document.createElement('span');
              word.className = 'title-word';
              word.textContent = words[w];
              line.appendChild(word);
            }
          });
        });

        /* Split the hero name into characters (marianmarton-style letter cascade) */
        document.querySelectorAll('.hero h1').forEach(function (title) {
          title.setAttribute('aria-label', title.textContent.replace(/\s+/g, ' ').trim());
          title.querySelectorAll('.title-line').forEach(function (line) {
            var text = line.textContent;
            line.textContent = '';
            for (var c = 0; c < text.length; c += 1) {
              var mask = document.createElement('span');
              mask.className = 'title-char';
              mask.setAttribute('aria-hidden', 'true');
              mask.textContent = text.charAt(c) === ' ' ? '\u00a0' : text.charAt(c);
              line.appendChild(mask);
            }
          });
          var chars = title.querySelectorAll('.title-char');
          gsap.from(chars, {
            yPercent: 120, rotate: 3, duration: .7, ease: 'expo.out',
            stagger: .045, delay: .15
          });
        });

        document.querySelectorAll('.section-heading').forEach(function (heading) {
          var lines = heading.querySelectorAll('.section-title-line > span');
          if (lines.length) {
            gsap.from(lines, {
              yPercent: 115, rotate: 1.5, duration: .64, ease: 'expo.out', stagger: .12,
              scrollTrigger: { trigger: heading, start: 'top 82%', once: true }
            });
          }
          var badge = heading.querySelector('.idx-badge');
          if (badge) {
            gsap.from(badge, {
              scale: 0, opacity: 0, duration: .5, ease: 'back.out(2.2)', delay: .2,
              scrollTrigger: { trigger: heading, start: 'top 82%', once: true }
            });
          }
          var note = heading.querySelector('.section-note');
          if (note) {
            gsap.from(note, {
              y: 18, opacity: 0, duration: .56, delay: .18, ease: 'power2.out',
              scrollTrigger: { trigger: heading, start: 'top 82%', once: true }
            });
          }
        });

        /* Bio manifesto: each paragraph's words cascade in from a mask (marianmarton style) */
        document.querySelectorAll('.prose p').forEach(function (paragraph) {
          var fragment = document.createDocumentFragment();
          var wordEls = [];
          Array.prototype.slice.call(paragraph.childNodes).forEach(function (node) {
            if (node.nodeType === 3) {
              var parts = node.textContent.split(/(\s+)/);
              parts.forEach(function (part) {
                if (!part) return;
                if (/^\s+$/.test(part)) {
                  fragment.appendChild(document.createTextNode(part));
                } else {
                  var mask = document.createElement('span');
                  mask.className = 'word-mask';
                  var word = document.createElement('span');
                  word.className = 'word';
                  word.textContent = part;
                  mask.appendChild(word);
                  fragment.appendChild(mask);
                  wordEls.push(word);
                }
              });
            } else {
              var elementMask = document.createElement('span');
              elementMask.className = 'word-mask';
              node.classList.add('word');
              elementMask.appendChild(node);
              fragment.appendChild(elementMask);
              wordEls.push(node);
            }
          });
          paragraph.textContent = '';
          paragraph.appendChild(fragment);
          gsap.from(wordEls, {
            yPercent: 115, duration: .5, ease: 'expo.out', stagger: .018,
            scrollTrigger: { trigger: paragraph, start: 'top 85%', once: true }
          });
        });

        function batchRows(selector, tweenConfig) {
          ScrollTrigger.batch(selector, {
            start: 'top 92%',
            once: true,
            onEnter: function (batch) {
              gsap.from(batch, tweenConfig);
            }
          });
        }
        batchRows('.publication, .publication-archive, .all-publications', {
          y: 26, opacity: 0, duration: .58, ease: 'power2.out', stagger: .07, overwrite: true
        });
        batchRows('.project', {
          y: 26, opacity: 0, duration: .58, ease: 'power2.out', stagger: .07, overwrite: true
        });

        gsap.from('.availability', {
          y: 22, opacity: 0, duration: .6, ease: 'power2.out',
          scrollTrigger: { trigger: '.availability', start: 'top 88%', once: true }
        });

        document.querySelectorAll('[data-count]').forEach(function (el) {
          var end = parseFloat(el.dataset.count);
          var format = el.dataset.format || 'plain';
          var prefix = el.dataset.prefix || '';
          var suffix = el.dataset.suffix || '';
          var state = { val: 0 };
          gsap.to(state, {
            val: end, duration: 1.5, ease: 'power2.out',
            scrollTrigger: { trigger: el, start: 'top 94%', once: true },
            onUpdate: function () {
              var text = format === 'decimal'
                ? state.val.toFixed(1)
                : Math.round(state.val).toLocaleString('en-US');
              el.textContent = prefix + text + suffix;
            }
          });
        });

        window.addEventListener('load', function () { ScrollTrigger.refresh(); });
      }

      /* Lenis smooth scroll (editorial glide; native scroll when reduced motion) */
      if (!reducedMotion && typeof window.Lenis !== 'undefined') {
        var lenis = new Lenis({ duration: 1.15 });
        if (typeof window.ScrollTrigger !== 'undefined') {
          lenis.on('scroll', ScrollTrigger.update);
          gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
          gsap.ticker.lagSmoothing(0);
        }
        for (var linkIndex = 0; linkIndex < navLinks.length; linkIndex += 1) {
          navLinks[linkIndex].addEventListener('click', function (event) {
            var id = this.getAttribute('href');
            if (id && id.charAt(0) === '#') {
              event.preventDefault();
              lenis.scrollTo(id, { offset: -100, duration: 1.25 });
            }
          });
        }
      }
    })();
