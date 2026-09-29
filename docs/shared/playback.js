(() => {
  const players = new Set();
  const media = new Map();
  const recovering = video => Boolean(media.get(video)?.pending);

  function reset(video) {
    const state = media.get(video);
    if (!state) throw new Error('Register the player before loading media');
    state.generation++;
    state.controller?.abort();
    clearTimeout(state.timer);
    if (state.objectURL) URL.revokeObjectURL(state.objectURL);
    Object.assign(state, {controller:null, timer:null, objectURL:null, pending:false, tried:false});
    return state;
  }
  function source(video, file) {
    const state = reset(video);
    state.source = file;
    video.src = file;
    video.load();
  }
  function clear(video) {
    reset(video).source = '';
    video.removeAttribute('src');
    video.load();
  }
  async function buffer(video, state) {
    const generation = state.generation;
    const controller = state.controller = new AbortController();
    const current = () => generation === state.generation;
    state.pending = true;
    state.tried = true;
    // Fetch the complete file through the ordinary request path. Some desktop
    // environments reject media-element requests despite supporting the codec.
    const url = new URL(state.source, document.baseURI);
    url.searchParams.set('_playback', 'buffered-1');
    const position = video.currentTime || 0;
    const rate = video.playbackRate;
    const timer = state.timer = setTimeout(() => controller.abort(), 45000);
    video.dispatchEvent(new Event('buffering'));
    try {
      const response = await fetch(url.href, {cache:'no-store', signal:controller.signal});
      if (!response.ok || response.status === 206) throw new Error('Incomplete video response');
      const bytes = await response.arrayBuffer();
      if (!current()) return;
      if (!bytes.byteLength) throw new Error('Empty video response');
      const type = /\.webm$/i.test(url.pathname) ? 'video/webm' : 'video/mp4';
      state.objectURL = URL.createObjectURL(new Blob([bytes], {type}));
      state.position = position;
      // Lazy players otherwise keep preload="none" after load() cancels the
      // failed play request, so loadeddata would never trigger their recovery.
      video.preload = 'auto';
      video.src = state.objectURL;
      video.load();
      video.playbackRate = rate;
      // loadeddata resumes through the owner, which knows whether this chapter,
      // viewport or dialog is still active. Never autoplay from a stale fetch.
    } catch (error) {
      if (!current()) return;
      state.pending = false;
      video.dispatchEvent(new Event('error'));
    } finally {
      clearTimeout(timer);
      if (current()) state.controller = null;
    }
  }
  function resumeAll() {
    if (!document.hidden) players.forEach(resume => resume());
  }
  window.CineyPlayback = {
    source, clear, recovering,
    retry(video) { source(video, media.get(video).source); },
    register(video, resume, {gestures = true, muted = true} = {}) {
      if (media.has(video)) return;
      const state = {source:'', generation:0, pending:false, tried:false};
      media.set(video, state);
      // Set both the initial attribute and the live property before attaching media.
      if (muted) {
        video.defaultMuted = true;
        video.muted = true;
        video.setAttribute('muted', '');
      }
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.addEventListener('error', event => {
        if (![2, 3, 4].includes(video.error?.code) || !state.source) return;
        if (state.pending && !state.objectURL) { event.stopImmediatePropagation(); return; }
        if (state.tried) { state.pending = false; return; }
        event.stopImmediatePropagation();
        buffer(video, state);
      }, true);
      video.addEventListener('loadedmetadata', () => {
        if (state.objectURL && state.position > 0 && Number.isFinite(video.duration)) {
          video.currentTime = Math.min(state.position, Math.max(0, video.duration - .05));
          state.position = 0;
        }
      });
      const recover = () => {
        if (!state.pending && !document.hidden && video.paused && !video.error) resume();
      };
      // A first play() can be rejected before media is ready or user activation.
      // The owning controller still decides visibility, pause preference and dialogs.
      video.addEventListener('loadeddata', () => { state.pending = false; recover(); });
      video.addEventListener('canplay', recover);
      if (gestures) players.add(recover);
    },
    dialog(video, dialog) {
      let wanted = false;
      const resume = () => {
        if (wanted && dialog.open && !document.hidden && !recovering(video)) video.play().catch(() => {});
      };
      this.register(video, resume, {gestures:false, muted:false});
      video.addEventListener('play', () => { wanted = true; });
      video.addEventListener('pause', () => { if (!recovering(video) && !video.error) wanted = false; });
      dialog.addEventListener('close', () => { wanted = false; clear(video); });
      return {play() { wanted = true; resume(); }};
    }
  };
  // Bubble after each control applies its pause/play choice; never undo a pause.
  document.addEventListener('click', resumeAll);
  document.addEventListener('keydown', event => {
    if (event.target.closest?.('button, a, input, textarea, select, [contenteditable]')) return;
    resumeAll();
  });
  window.addEventListener('pageshow', resumeAll);
  window.addEventListener('focus', resumeAll);
  window.addEventListener('pagehide', event => {
    if (!event.persisted) media.forEach((state, video) => reset(video));
  });
})();
