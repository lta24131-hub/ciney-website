(() => {
  const players = new Set();
  function resumeAll() {
    if (!document.hidden) players.forEach(resume => resume());
  }
  window.CineyPlayback = {
    register(video, resume) {
      // Set both the initial attribute and the live property before attaching media.
      video.defaultMuted = true;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      const recover = () => {
        if (!document.hidden && video.paused && !video.error) resume();
      };
      // A first play() can be rejected before media is ready or user activation.
      // The owning controller still decides visibility, pause preference and dialogs.
      video.addEventListener('loadeddata', recover);
      video.addEventListener('canplay', recover);
      players.add(recover);
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
})();
