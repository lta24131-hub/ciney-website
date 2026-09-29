import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const code = file => readFileSync(new URL('../docs/' + file, import.meta.url), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));
class MediaEvent {
  constructor(type) { this.type = type; }
  stopImmediatePropagation() { this.stopped = true; }
}
class Element {
  listeners = [];
  attributes = new Map();
  dataset = {};
  style = {setProperty() {}, removeProperty() {}};
  classList = {add() {}, remove() {}, toggle() {}};
  addEventListener(type, fn, capture = false) { this.listeners.push({type, fn, capture}); }
  dispatchEvent(event) {
    const listeners = this.listeners.filter(item => item.type === event.type).sort((a,b) => Number(b.capture) - Number(a.capture));
    for (const item of listeners) { item.fn(event); if (event.stopped) break; }
  }
  emit(type) { this.dispatchEvent(new MediaEvent(type)); }
  getAttribute(key) { return this.attributes.get(key) || null; }
  setAttribute(key, value) { this.attributes.set(key, String(value)); }
  hasAttribute(key) { return this.attributes.has(key); }
  removeAttribute(key) { this.attributes.delete(key); }
}
class Video extends Element {
  paused = true; readyState = 0; currentTime = 0; duration = 8; playbackRate = 1;
  error = null; attempts = 0;
  set src(value) { this.setAttribute('src', value); }
  get src() { return this.getAttribute('src') || ''; }
  load() { this.error = null; this.readyState = 0; this.currentTime = 0; this.pause(); }
  play() {
    this.attempts++;
    if (this.error) return Promise.reject(new Error('Unsupported source'));
    this.paused = false;
    this.emit('play');
    return Promise.resolve();
  }
  pause() { const changed = !this.paused; this.paused = true; if (changed) this.emit('pause'); }
  fail(code = 4) { this.error = {code}; this.pause(); this.emit('error'); }
  ready() { this.readyState = 4; this.emit('loadedmetadata'); this.emit('loadeddata'); this.emit('canplay'); }
}
function setup() {
  const document = Object.assign(new Element(), {baseURI:'https://example.com/ciney-website/two-wheel/', hidden:false});
  const window = new Element();
  const requests = [], objects = new Map(), revoked = [], timers = new Map();
  let nextObject = 0, nextTimer = 0;
  class MediaURL extends URL {
    static createObjectURL(blob) { const id = 'blob:clip-' + ++nextObject; objects.set(id, blob); return id; }
    static revokeObjectURL(id) { revoked.push(id); objects.delete(id); }
  }
  const context = vm.createContext({document, window, URL:MediaURL, Blob, AbortController, Event:MediaEvent,
    setTimeout(fn) { timers.set(++nextTimer, fn); return nextTimer; },
    clearTimeout(id) { timers.delete(id); },
    fetch(url, options) { return new Promise((resolve, reject) => requests.push({url, options, resolve, reject})); }
  });
  vm.runInContext(code('shared/playback.js'), context);
  return {document, window, requests, objects, revoked, context, timers, api:window.CineyPlayback,
    respond(index = 0, bytes = new Uint8Array([0,0,0,32,102,116,121,112])) {
      requests[index].resolve({ok:true, status:200, arrayBuffer:async () => bytes.buffer});
      return bytes;
    }
  };
}

test('error 4 fetches identical complete bytes and resumes through the owner', async () => {
  const app = setup(), video = new Video();
  app.api.register(video, () => video.play());
  let terminalErrors = 0;
  video.addEventListener('error', () => terminalErrors++);
  app.api.source(video, '../shared/field/clip.mp4?v=2');
  video.currentTime = 3; video.playbackRate = 2.5;
  video.fail();
  assert.equal(terminalErrors, 0);
  assert.equal(app.api.recovering(video), true);
  assert.equal(app.requests[0].url, 'https://example.com/ciney-website/shared/field/clip.mp4?v=2&_playback=buffered-1');
  assert.equal(app.requests[0].options.cache, 'no-store');
  const bytes = app.respond();
  await settle();
  const blob = app.objects.get(video.src);
  assert.equal(video.preload, 'auto');
  assert.equal(blob.type, 'video/mp4');
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), bytes);
  video.ready();
  assert.equal(video.currentTime, 3);
  assert.equal(video.playbackRate, 2.5);
  assert.equal(video.paused, false);
  assert.equal(app.api.recovering(video), false);
  assert.equal(app.timers.size, 0);
});

test('working direct playback is unchanged and does not fetch a second copy', () => {
  const app = setup(), video = new Video();
  app.api.register(video, () => video.play());
  app.api.source(video, 'mobile.mp4');
  video.ready();
  assert.equal(video.src, 'mobile.mp4');
  assert.equal(video.paused, false);
  assert.equal(app.requests.length, 0);
});

test('duplicate media errors produce only one buffered request', async () => {
  const app = setup(), video = new Video();
  app.api.register(video, () => {});
  app.api.source(video, 'clip.mp4');
  video.fail(); video.fail();
  assert.equal(app.requests.length, 1);
  app.respond(); await settle();
});

test('switching chapter aborts the old request and cannot attach its late response', async () => {
  const app = setup(), video = new Video();
  app.api.register(video, () => video.play());
  app.api.source(video, 'old.mp4'); video.fail();
  app.api.source(video, 'new.mp4'); video.fail();
  assert.equal(app.requests[0].options.signal.aborted, true);
  app.respond(1); await settle();
  const selected = video.src;
  app.respond(0); await settle();
  assert.equal(video.src, selected);
  assert.equal(app.objects.size, 1);
  video.ready();
  app.api.source(video, 'third.mp4');
  assert.deepEqual(app.revoked, [selected]);
});

for (const code of [2, 3, 4]) {
  test(`a failed fallback for error ${code} reaches Retry once, with no retry loop`, async () => {
    const app = setup(), video = new Video();
    app.api.register(video, () => {});
    let errors = 0;
    video.addEventListener('error', () => errors++);
    app.api.source(video, 'clip.mp4'); video.fail(code);
    app.requests[0].reject(new Error('Network failed'));
    await settle();
    assert.equal(errors, 1);
    assert.equal(app.api.recovering(video), false);
    assert.equal(app.requests.length, 1);
    app.api.retry(video); video.fail(code);
    assert.equal(app.requests.length, 2);
    app.respond(1); await settle();
  });
}

test('decode errors in the buffered copy are terminal, not an infinite fetch loop', async () => {
  const app = setup(), video = new Video();
  app.api.register(video, () => {});
  let errors = 0;
  video.addEventListener('error', () => errors++);
  app.api.source(video, 'clip.mp4'); video.fail();
  app.respond(); await settle(); video.fail();
  assert.equal(errors, 1);
  assert.equal(app.requests.length, 1);
  assert.equal(app.api.recovering(video), false);
});

test('partial responses are rejected instead of passed to the decoder', async () => {
  const app = setup(), video = new Video();
  app.api.register(video, () => {});
  let errors = 0;
  video.addEventListener('error', () => errors++);
  app.api.source(video, 'clip.mp4'); video.fail();
  app.requests[0].resolve({ok:true, status:206}); await settle();
  assert.equal(errors, 1); assert.equal(app.objects.size, 0);
});

test('closing a modal while fetching prevents later autoplay and frees its request', async () => {
  const app = setup(), video = new Video(), dialog = new Element();
  const player = app.api.dialog(video, dialog);
  app.api.source(video, 'film.mp4'); dialog.open = true; player.play(); video.fail();
  dialog.open = false; dialog.emit('close');
  assert.equal(app.requests[0].options.signal.aborted, true);
  const attempts = video.attempts;
  app.respond(); await settle(); video.ready();
  assert.equal(video.attempts, attempts);
  assert.equal(video.src, '');
  assert.equal(app.objects.size, 0);
});

test('an open modal recovers, but native pause survives focus and clicks', async () => {
  const app = setup(), video = new Video(), dialog = new Element();
  const player = app.api.dialog(video, dialog);
  app.api.source(video, 'film.mp4'); dialog.open = true; player.play(); video.fail();
  app.respond(); await settle(); video.ready();
  assert.equal(video.paused, false);
  video.pause(); app.document.emit('click'); app.window.emit('focus'); video.emit('canplay');
  assert.equal(video.paused, true);
  const blob = video.src;
  dialog.open = false; dialog.emit('close');
  assert.ok(app.revoked.includes(blob));
});

function fieldSetup() {
  const app = setup(), video = new Video(), box = new Element(), button = new Element();
  const label = new Element(), icon = new Element();
  video.dataset = {src:'desktop.mp4', mobileSrc:'mobile.mp4'};
  video.closest = () => box;
  box.querySelector = () => button;
  button.querySelector = selector => selector === 'span' ? icon : label;
  app.document.querySelectorAll = selector => selector === '[data-field-video]' ? [video] : [];
  app.document.querySelector = () => null;
  let intersect;
  Object.assign(app.context, {navigator:{}, matchMedia:() => Object.assign(new Element(), {matches:false}),
    IntersectionObserver:class { constructor(fn) { intersect = fn; } observe() {} }});
  vm.runInContext(code('shared/field.js'), app.context);
  return Object.assign(app, {video, button, label,
    visible(value = true) { intersect([{target:video, isIntersecting:value, intersectionRatio:value ? 1 : 0}]); }
  });
}

test('real field controller automatically recovers the reported direct-format failure', async () => {
  const app = fieldSetup();
  app.visible(); app.video.fail();
  assert.equal(app.label.textContent, 'Pause');
  app.respond(); await settle(); app.video.ready();
  assert.equal(app.video.paused, false);
  assert.equal(app.label.textContent, 'Pause');
});

for (const action of ['pause', 'scroll', 'hide']) {
  test(`real field controller respects ${action} while the buffered request is pending`, async () => {
    const app = fieldSetup();
    app.visible(); app.video.fail();
    if (action === 'pause') app.button.emit('click');
    if (action === 'scroll') app.visible(false);
    if (action === 'hide') { app.document.hidden = true; app.document.emit('visibilitychange'); }
    app.respond(); await settle(); app.video.ready();
    assert.equal(app.video.paused, true);
    if (action === 'pause') { app.document.emit('click'); assert.equal(app.video.paused, true); app.button.emit('click'); }
    if (action === 'scroll') app.visible();
    if (action === 'hide') { app.document.hidden = false; app.document.emit('visibilitychange'); }
    assert.equal(app.video.paused, false);
  });
}

test('real field controller offers a working Retry after the buffered download fails', async () => {
  const app = fieldSetup();
  app.visible(); app.video.fail();
  app.requests[0].reject(new Error('Offline')); await settle();
  assert.equal(app.label.textContent, 'Retry');
  app.button.emit('click'); app.video.fail(); app.respond(1); await settle(); app.video.ready();
  assert.equal(app.video.paused, false);
});

test('leaving the page releases buffered URLs without breaking back/forward cache', async () => {
  const app = setup(), video = new Video();
  app.api.register(video, () => {}); app.api.source(video, 'clip.mp4'); video.fail();
  app.respond(); await settle();
  const blob = video.src;
  app.window.dispatchEvent(Object.assign(new MediaEvent('pagehide'), {persisted:true}));
  assert.equal(app.objects.size, 1);
  app.window.dispatchEvent(Object.assign(new MediaEvent('pagehide'), {persisted:false}));
  assert.deepEqual(app.revoked, [blob]);
});

function scrollSetup() {
  const app = setup(), video = new Video(), card = new Element();
  const controls = new Map(['[data-preview-toggle]', '.preview-state', '.media-poster', '#demo-timeline', '#demo-time'].map(key => [key, new Element()]));
  card.querySelector = selector => controls.get(selector) || null;
  video.closest = () => card;
  video.dataset.preview = 'first';
  Object.assign(app.context, {video, reducedMotion:{matches:false}, dialog:{open:false}, scenes:[], deliverySize:'desktop',
    stabilityContent:{first:{label:'First'}, next:{label:'Next'}}, mediaVersion:() => '', mediaPoster:key => key + '.jpg',
    requestScene:scene => scene.setActive(true)});
  const page = code('two-wheel/index.html');
  const script = page.slice(page.indexOf('function createScrollPreview(video) {'), page.indexOf("document.querySelectorAll('[data-preview]').forEach(createPreview);"));
  vm.runInContext(script + '\nvar testScene = createScrollPreview(video);', app.context);
  return Object.assign(app, {video, scene:app.context.testScene, toggle:controls.get('[data-preview-toggle]'), timeline:controls.get('#demo-timeline')});
}

test('two-wheel scroll preview recovers and its progress slider still seeks', async () => {
  const app = scrollSetup();
  app.scene.setActive(true); await settle(); app.video.fail();
  app.respond(); await settle(); app.video.ready(); await settle();
  assert.equal(app.video.paused, false);
  assert.equal(app.timeline.disabled, false);
  app.timeline.emit('pointerdown'); app.timeline.value = '500'; app.timeline.emit('input');
  assert.ok(app.video.currentTime > 3.9 && app.video.currentTime < 4.1);
  app.window.emit('pointerup'); app.video.emit('seeked'); await settle();
  assert.equal(app.video.paused, false);
});

test('two-wheel pause during fallback is retained after decoding', async () => {
  const app = scrollSetup();
  app.scene.setActive(true); await settle(); app.video.fail();
  app.toggle.emit('click'); app.respond(); await settle(); app.video.ready(); await settle();
  assert.equal(app.video.paused, true);
  app.toggle.emit('click'); await settle();
  assert.equal(app.video.paused, false);
});

test('two-wheel chapter changes ignore an older buffered response', async () => {
  const app = scrollSetup();
  app.scene.setActive(true); await settle(); app.video.fail();
  app.scene.change('next'); app.video.fail();
  app.respond(1); await settle();
  const chosen = app.video.src;
  app.respond(0); await settle(); app.video.ready(); await settle();
  assert.equal(app.video.src, chosen);
  assert.equal(app.video.dataset.preview, 'next');
  assert.equal(app.video.paused, false);
});
