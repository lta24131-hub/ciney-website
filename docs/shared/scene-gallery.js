(() => {
const $ = selector => document.querySelector(selector);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = value => Math.min(1, Math.max(0, value));
function stickyTop() { return $('.header').getBoundingClientRect().height; }
function storyProgress(story, stage) {
  const rect = story.getBoundingClientRect();
  return clamp((stickyTop() - rect.top) / Math.max(1, rect.height - stage.getBoundingClientRect().height));
}
const sceneSection = $('#scenes');
const sceneStage = $('.scene-sticky');
const sceneTrack = $('.scene-gallery');
let sceneLayoutKey = '';
let sceneTravel = 0;
function nearestMobileScene() {
  const cards = [...sceneTrack.children];
  const origin = cards[0].offsetLeft;
  return cards.reduce((closest, card, i) => Math.abs(card.offsetLeft - origin - sceneTrack.scrollLeft) < Math.abs(cards[closest].offsetLeft - origin - sceneTrack.scrollLeft) ? i : closest, 0);
}
function scrollToMobileScene(index) {
  const cards = [...sceneTrack.children];
  sceneTrack.scrollTo({left:cards[index].offsetLeft - cards[0].offsetLeft, behavior:reducedMotion.matches ? 'instant' : 'smooth'});
}
function updateMobileScenes() {
  if (window.innerWidth >= 900) return;
  const cards = [...sceneTrack.children];
  const index = nearestMobileScene();
  $('.scene-mobile-position').textContent = String(index + 1).padStart(2, '0') + ' / ' + String(cards.length).padStart(2, '0');
  sceneSection.style.setProperty('--scene-progress', (index + 1) / cards.length);
  $('#scene-scroll-label').textContent = window.matchMedia('(hover: hover) and (pointer: fine)').matches ? 'Drag to explore' : 'Swipe to explore';
}
sceneTrack.addEventListener('scroll', updateMobileScenes, {passive:true});
let sceneDrag = null;
sceneTrack.addEventListener('dragstart', event => event.preventDefault());
sceneTrack.addEventListener('pointerdown', event => {
  if (event.target.closest('button')) return;
  if (window.innerWidth >= 900 || event.pointerType !== 'mouse' || event.button !== 0) return;
  event.preventDefault();
  sceneDrag = {id:event.pointerId, x:event.clientX, left:sceneTrack.scrollLeft};
  sceneTrack.classList.add('is-dragging');
  sceneTrack.setPointerCapture(event.pointerId);
});
sceneTrack.addEventListener('pointermove', event => {
  if (!sceneDrag || event.pointerId !== sceneDrag.id) return;
  sceneTrack.scrollLeft = sceneDrag.left + sceneDrag.x - event.clientX;
});
function finishSceneDrag(event) {
  if (!sceneDrag || event.pointerId !== sceneDrag.id) return;
  const pointerId = sceneDrag.id;
  const index = nearestMobileScene();
  sceneDrag = null;
  sceneTrack.classList.remove('is-dragging');
  if (sceneTrack.hasPointerCapture(pointerId)) sceneTrack.releasePointerCapture(pointerId);
  scrollToMobileScene(index);
}
sceneTrack.addEventListener('pointerup', finishSceneDrag);
sceneTrack.addEventListener('pointercancel', finishSceneDrag);
sceneTrack.addEventListener('lostpointercapture', finishSceneDrag);
sceneTrack.addEventListener('keydown', event => {
  if (window.innerWidth >= 900 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const cards = [...sceneTrack.children];
  const nearest = nearestMobileScene();
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1 : Math.max(0, Math.min(cards.length - 1, nearest + (event.key === 'ArrowRight' ? 1 : -1)));
  scrollToMobileScene(index);
});
function renderSceneStrip() {
  const enabled = window.innerWidth >= 900 && window.innerHeight >= 560 && !reducedMotion.matches;
  const layoutKey = [enabled, window.innerWidth, window.innerHeight, stickyTop(), sceneStage.offsetHeight].join(':');
  if (layoutKey !== sceneLayoutKey) {
    sceneLayoutKey = layoutKey;
    sceneSection.classList.toggle('is-scroll-strip', enabled);
    sceneTrack.tabIndex = window.innerWidth < 900 ? 0 : -1;
    if (window.innerWidth >= 900) sceneTrack.scrollLeft = 0;
    sceneTrack.style.transform = '';
    sceneSection.style.height = '';
    if (enabled) {
      sceneTravel = Math.max(0, sceneTrack.scrollWidth - sceneSection.clientWidth);
      sceneSection.style.height = (sceneStage.offsetHeight + sceneTravel / 2) + 'px';
    }
  }
  if (!enabled) { updateMobileScenes(); return; }
  const progress = storyProgress(sceneSection, sceneStage);
  sceneTrack.style.transform = 'translate3d(' + (-sceneTravel * progress).toFixed(2) + 'px,0,0)';
  sceneSection.style.setProperty('--scene-progress', progress);
  sceneSection.dataset.progress = progress.toFixed(3);
  $('#scene-scroll-label').textContent = progress > .98 ? 'Keep scrolling' : 'Scroll to explore';
}

let queued = false;
function queue() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; renderSceneStrip(); });
}
window.addEventListener('scroll', queue, {passive:true});
window.addEventListener('resize', queue);
window.addEventListener('pageshow', queue);
reducedMotion.addEventListener('change', queue);
new ResizeObserver(queue).observe(sceneStage);
renderSceneStrip();
})();
