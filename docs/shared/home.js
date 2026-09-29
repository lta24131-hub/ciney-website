(() => {
  const header = document.querySelector('.family-home .site-header');
  if (header) {
    const syncHeader = () => header.classList.toggle('is-scrolled', window.scrollY > 40);
    addEventListener('scroll', syncHeader, {passive:true});
    addEventListener('pageshow', syncHeader);
    syncHeader();
  }
  const reel = document.querySelector('[data-location-reel]');
  if (!reel) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 760px)');
  const tabs = [...reel.querySelectorAll('[role="tab"]')];
  const panels = [...reel.querySelectorAll('[role="tabpanel"]')];
  const videos = panels.map(panel => panel.querySelector('video'));
  const stage = reel.querySelector('.reel-stage');
  const strip = reel.querySelector('.reel-tabs');
  const toggle = reel.querySelector('[data-reel-toggle]');
  const count = document.querySelector('[data-reel-current]');
  let active = 0;
  let visible = false;
  let pausedByUser = reduced.matches || Boolean(navigator.connection?.saveData);
  let failed = false;

  function updateButton() {
    const paused = videos[active].paused;
    toggle.querySelector('[data-reel-label]').textContent = failed ? 'Retry' : paused ? 'Play' : 'Pause';
    toggle.querySelector('span').textContent = paused ? '▶' : 'Ⅱ';
    toggle.setAttribute('aria-label', `${failed ? 'Retry' : paused ? 'Play' : 'Pause'} scene films`);
  }
  function load(video) {
    if (video.hasAttribute('src')) return;
    video.src = mobile.matches ? video.dataset.mobileSrc : video.dataset.src;
    video.load();
  }
  function sync() {
    videos.forEach((video, index) => {
      if (index === active && visible && !document.hidden && !pausedByUser && !failed) {
        load(video);
        video.play().catch(() => { if (index === active) updateButton(); });
      } else video.pause();
    });
    updateButton();
  }
  function keepTabVisible(index) {
    const tab = tabs[index];
    const left = tab.offsetLeft - strip.offsetLeft;
    if (left < strip.scrollLeft || left + tab.offsetWidth > strip.scrollLeft + strip.clientWidth) {
      strip.scrollTo({left: Math.max(0, left - (strip.clientWidth - tab.offsetWidth) / 2), behavior: reduced.matches ? 'instant' : 'smooth'});
    }
  }
  function select(index) {
    active = (index + panels.length) % panels.length;
    failed = false;
    panels.forEach((panel, i) => {
      const selected = i === active;
      panel.hidden = !selected;
      tabs[i].setAttribute('aria-selected', String(selected));
      tabs[i].tabIndex = selected ? 0 : -1;
      tabs[i].style.removeProperty('--reel-progress');
      videos[i].pause();
    });
    const video = videos[active];
    if (video.readyState) video.currentTime = 0;
    count.textContent = String(active + 1).padStart(2, '0');
    keepTabVisible(active);
    sync();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(index));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      select(next);
      tabs[next].focus({preventScroll:true});
    });
  });
  videos.forEach((video, index) => {
    window.CineyPlayback.register(video, sync);
    video.addEventListener('playing', () => {
      video.closest('.field-media').classList.add('has-video');
      if (index === active) { failed = false; updateButton(); }
    });
    ['play', 'pause'].forEach(event => video.addEventListener(event, () => {
      if (index === active) updateButton();
    }));
    video.addEventListener('timeupdate', () => {
      if (index === active && Number.isFinite(video.duration) && video.duration > 0) {
        tabs[index].style.setProperty('--reel-progress', String(video.currentTime / video.duration));
      }
    });
    video.addEventListener('ended', () => {
      if (index !== active || !visible || document.hidden || pausedByUser) return;
      // Keep focused scene content available instead of hiding it under a keyboard user.
      // Focus on the persistent scene tabs or playback button does not stop the playlist.
      if (panels[active].contains(document.activeElement)) {
        pausedByUser = true;
        updateButton();
        return;
      }
      // Choosing a scene changes the playlist position, not its playback mode.
      // Reduced-motion/data-saving users start paused and can explicitly opt in via Play.
      // Automatic scene changes do not move keyboard focus to the next tab.
      select(active + 1);
    });
    video.addEventListener('error', () => {
      video.closest('.field-media').classList.remove('has-video');
      if (index === active) { failed = true; updateButton(); }
    });
  });
  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    const video = videos[active];
    if (failed) { video.removeAttribute('src'); failed = false; pausedByUser = false; }
    else pausedByUser = !video.paused;
    sync();
  });
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting && entries[0].intersectionRatio > .15;
    sync();
  }, {threshold:[0,.15,.5]}).observe(stage);
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', () => { pausedByUser = reduced.matches; sync(); });
  updateButton();
})();
