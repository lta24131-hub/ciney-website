(() => {
  const dialog = document.querySelector('.move-dialog');
  if (!dialog) return;
  const video = dialog.querySelector('video');
  const title = dialog.querySelector('h2');
  let opener;
  document.querySelectorAll('[data-move-src]').forEach(button => {
    button.addEventListener('click', () => {
      opener = button;
      title.textContent = button.dataset.moveTitle;
      video.setAttribute('aria-label', button.dataset.moveTitle);
      video.poster = button.dataset.movePoster;
      video.src = button.dataset.moveSrc;
      video.muted = true;
      video.loop = true;
      dialog.showModal();
      video.play().catch(() => {});
    });
  });
  dialog.querySelector('[data-move-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    video.pause();
    video.removeAttribute('src');
    video.load();
    opener?.focus({ preventScroll: true });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) video.pause();
  });
})();
