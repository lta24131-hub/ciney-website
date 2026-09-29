(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 760px)');
  const items = [...document.querySelectorAll('[data-field-video]')].map(video => ({
    video, box: video.closest('.field-media'), button: video.closest('.field-media').querySelector('[data-field-toggle]'),
    visible: false, pausedByUser: reduced.matches || Boolean(navigator.connection?.saveData), loaded: false
  }));
  function update(item) {
    const paused = item.video.paused;
    item.button.querySelector('[data-field-label]').textContent = paused ? 'Play' : 'Pause';
    item.button.querySelector('span').textContent = paused ? '▶' : 'Ⅱ';
    item.button.setAttribute('aria-label', `${paused ? 'Play' : 'Pause'} ${item.video.getAttribute('aria-label')}`);
  }
  function load(item) {
    if (item.loaded) return;
    item.loaded = true;
    item.video.src = mobile.matches ? item.video.dataset.mobileSrc : item.video.dataset.src;
    item.video.load();
  }
  function sync(item) {
    if (item.visible && !document.hidden && !document.querySelector('dialog[open]') && !item.pausedByUser) {
      load(item);
      item.video.play().catch(() => update(item));
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
    item.button.hidden = false;
    item.button.addEventListener('click', () => {
      item.pausedByUser = !item.video.paused;
      if (item.pausedByUser) item.video.pause();
      else { load(item); item.video.play().catch(() => update(item)); }
    });
    item.video.addEventListener('playing', () => item.box.classList.add('has-video'));
    ['play', 'pause'].forEach(event => item.video.addEventListener(event, () => update(item)));
    item.video.addEventListener('error', () => {
      item.box.classList.remove('has-video');
      item.loaded = false;
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
