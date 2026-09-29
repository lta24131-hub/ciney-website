(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 760px)');
  const items = [...document.querySelectorAll('[data-field-video]')].map(video => ({
    video, box: video.closest('.field-media'), button: video.closest('.field-media').querySelector('[data-field-toggle]'),
    visible: false, pausedByUser: reduced.matches || Boolean(navigator.connection?.saveData), loaded: false, failed: false
  }));
  function update(item) {
    const paused = item.video.paused && !(window.CineyPlayback.recovering(item.video) && !item.pausedByUser);
    item.button.querySelector('[data-field-label]').textContent = item.failed ? 'Retry' : paused ? 'Play' : 'Pause';
    item.button.querySelector('span').textContent = paused ? '▶' : 'Ⅱ';
    item.button.setAttribute('aria-label', `${item.failed ? 'Retry' : paused ? 'Play' : 'Pause'} ${item.video.getAttribute('aria-label')}`);
  }
  function load(item) {
    if (item.loaded) return;
    item.loaded = true;
    item.failed = false;
    window.CineyPlayback.source(item.video, mobile.matches ? item.video.dataset.mobileSrc : item.video.dataset.src);
  }
  function sync(item) {
    if (item.visible && !document.hidden && !document.querySelector('dialog[open]') && !item.pausedByUser) {
      load(item);
      if (!window.CineyPlayback.recovering(item.video)) item.video.play().catch(() => update(item));
    } else item.video.pause();
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const item = items.find(item => item.video === entry.target);
      item.visible = entry.isIntersecting && entry.intersectionRatio > .15;
      sync(item);
    });
  }, { threshold: [0, .15, .5] });
  items.forEach(item => {
    window.CineyPlayback.register(item.video, () => sync(item));
    item.button.hidden = false;
    item.button.addEventListener('click', () => {
      item.pausedByUser = !item.video.paused || (window.CineyPlayback.recovering(item.video) && !item.pausedByUser);
      if (item.pausedByUser) item.video.pause();
      else { load(item); if (!window.CineyPlayback.recovering(item.video)) item.video.play().catch(() => update(item)); }
      update(item);
    });
    item.video.addEventListener('playing', () => item.box.classList.add('has-video'));
    ['play', 'pause', 'buffering'].forEach(event => item.video.addEventListener(event, () => update(item)));
    item.video.addEventListener('error', () => {
      item.box.classList.remove('has-video');
      item.loaded = false;
      item.failed = true;
      item.pausedByUser = true;
      item.button.querySelector('[data-field-label]').textContent = 'Retry';
      item.button.setAttribute('aria-label', `Retry ${item.video.getAttribute('aria-label')}`);
    });
    observer.observe(item.video);
  });
  document.addEventListener('visibilitychange', () => items.forEach(sync));
  reduced.addEventListener('change', () => { items.forEach(item => { item.pausedByUser = reduced.matches; sync(item); }); });
  document.querySelectorAll('dialog').forEach(dialog => new MutationObserver(() => items.forEach(sync)).observe(dialog, { attributes: true, attributeFilter: ['open'] }));
})();
