import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../docs/shared/home.js', import.meta.url), 'utf8');

const playback = readFileSync(new URL('../docs/shared/playback.js', import.meta.url), 'utf8');

function setup({reduce = false, saveData = false, mobile = false, blocked = false} = {}) {
  class Element {
    listeners = new Map();
    attributes = new Map();
    hidden = false;
    textContent = '';
    offsetLeft = 0;
    offsetWidth = 100;
    scrollLeft = 0;
    clientWidth = 500;
    style = {setProperty() {}, removeProperty() {}};
    classList = {add() {}, remove() {}};
    addEventListener(type, fn) {
      this.listeners.set(type, [...(this.listeners.get(type) || []), fn]);
    }
    emit(type, event = {}) { for (const fn of this.listeners.get(type) || []) fn(event); }
    setAttribute(key, value) { this.attributes.set(key, value); }
    hasAttribute(key) { return this.attributes.has(key); }
    removeAttribute(key) { this.attributes.delete(key); }
    focus() { document.activeElement = this; }
    contains(element) { return element === this; }
    scrollTo({left}) { this.scrollLeft = left; }
  }
  const document = new Element();
  document.hidden = false;
  const tabs = Array.from({length: 5}, (_, index) => Object.assign(new Element(), {offsetLeft: index * 100}));
  const videos = tabs.map(() => {
    const video = Object.assign(new Element(), {
      blocked, attempts: 0, paused: true, readyState: 0, currentTime: 0, duration: 8,
      dataset: {src: 'desktop.mp4', mobileSrc: 'mobile.mp4'},
      load() { this.attributes.set('src', this.src); this.readyState = 1; },
      play() { this.attempts++; if (this.blocked) return Promise.reject(Object.assign(new Error('Autoplay blocked'), {name: 'NotAllowedError'})); this.paused = false; this.emit('play'); return Promise.resolve(); },
      pause() { this.paused = true; this.emit('pause'); },
      closest() { return new Element(); }
    });
    return video;
  });
  const panels = videos.map((video, i) => Object.assign(new Element(), {hidden: i !== 0, querySelector: () => video}));
  const toggle = new Element();
  const label = new Element();
  const icon = new Element();
  toggle.querySelector = selector => selector === 'span' ? icon : label;
  const count = Object.assign(new Element(), {textContent: '01'});
  const reel = new Element();
  reel.querySelectorAll = selector => selector === '[role="tab"]' ? tabs : panels;
  reel.querySelector = selector => selector === '[data-reel-toggle]' ? toggle : new Element();
  reel.contains = element => [...tabs, ...panels, toggle].includes(element);
  document.querySelector = selector => selector === '[data-location-reel]' ? reel : selector === '[data-reel-current]' ? count : null;
  const reduced = Object.assign(new Element(), {matches: reduce});
  let observe;
  const window = new Element();
  const context = vm.createContext({window,
    document, navigator: {connection: {saveData}},
    matchMedia: query => query.includes('prefers-reduced-motion') ? reduced : {matches: mobile},
    IntersectionObserver: class { constructor(fn) { observe = fn; } observe() {} }
  });
  vm.runInContext(playback, context);
  vm.runInContext(source, context);
  return {
    window, tabs, videos, panels, toggle, label, count, document, reduced,
    visible(value = true) { observe([{isIntersecting: value, intersectionRatio: value ? 1 : 0}]); },
    end(index) { videos[index].currentTime = 8; videos[index].paused = true; videos[index].emit('ended'); },
    selected() { return panels.findIndex(panel => !panel.hidden); }
  };
}

test('plays two complete lists and wraps from last to first', () => {
  const app = setup();
  app.visible();
  for (let i = 0; i < 10; i++) {
    app.end(i % 5);
    assert.equal(app.selected(), (i + 1) % 5);
    assert.equal(app.videos[app.selected()].paused, false);
    assert.equal(app.count.textContent, String(app.selected() + 1).padStart(2, '0'));
  }
});

test('clicking the last scene still wraps and does not move focus', () => {
  const app = setup();
  app.visible();
  app.tabs[4].focus();
  app.tabs[4].emit('click');
  app.end(4);
  assert.equal(app.selected(), 0);
  assert.equal(app.document.activeElement, app.tabs[4]);
});

test('keyboard selection keeps playlist enabled', () => {
  const app = setup();
  app.visible();
  let prevented = false;
  app.tabs[0].emit('keydown', {key: 'End', preventDefault() { prevented = true; }});
  assert.equal(prevented, true);
  assert.equal(app.document.activeElement, app.tabs[4]);
  app.end(4);
  assert.equal(app.selected(), 0);
});

test('focused play/pause control does not disable automatic transitions', () => {
  const app = setup();
  app.visible();
  app.toggle.focus();
  app.end(0);
  assert.equal(app.selected(), 1);
  assert.equal(app.document.activeElement, app.toggle);
});

test('explicit pause survives selection and does not advance', () => {
  const app = setup();
  app.visible();
  app.toggle.emit('click');
  app.tabs[4].emit('click');
  app.end(4);
  assert.equal(app.selected(), 4);
  assert.equal(app.videos[4].paused, true);
  app.toggle.emit('click');
  app.end(4);
  assert.equal(app.selected(), 0);
});

test('focused scene content stays visible until the user resumes', () => {
  const app = setup();
  app.visible();
  app.panels[0].focus();
  app.end(0);
  assert.equal(app.selected(), 0);
  assert.equal(app.label.textContent, 'Play');
  app.toggle.focus();
  app.toggle.emit('click');
  app.end(0);
  assert.equal(app.selected(), 1);
});

test('offscreen or hidden pages pause without advancing', () => {
  const app = setup();
  app.visible();
  app.visible(false);
  app.end(0);
  assert.equal(app.selected(), 0);
  app.visible();
  app.document.hidden = true;
  app.document.emit('visibilitychange');
  app.end(0);
  assert.equal(app.selected(), 0);
  assert.ok(app.videos.every(video => video.paused));
  app.document.hidden = false;
  app.document.emit('visibilitychange');
  assert.equal(app.videos[0].paused, false);
});

for (const preference of ['reduce', 'saveData']) {
  test(`${preference} starts paused; explicit Play starts the playlist`, () => {
    const app = setup({[preference]: true});
    app.visible();
    assert.ok(app.videos.every(video => video.paused));
    app.toggle.emit('click');
    app.end(0);
    assert.equal(app.selected(), 1);
  });
}

test('returning to a previously loaded scene resets its time', () => {
  const app = setup();
  app.visible();
  app.videos[0].currentTime = 5;
  app.tabs[4].emit('click');
  app.end(4);
  assert.equal(app.videos[0].currentTime, 0);
  assert.ok(app.videos.slice(1).every(video => video.paused));
});

test('stale ended events from an inactive scene are ignored', () => {
  const app = setup();
  app.visible();
  app.tabs[3].emit('click');
  app.end(0);
  assert.equal(app.selected(), 3);
});

test('a failed clip can be retried without breaking the playlist', () => {
  const app = setup({mobile: true});
  app.visible();
  assert.equal(app.videos[0].src, 'mobile.mp4');
  app.videos[0].emit('error');
  assert.equal(app.label.textContent, 'Retry');
  app.toggle.emit('click');
  app.end(0);
  assert.equal(app.selected(), 1);
});

test('enabling reduced motion pauses current playback', () => {
  const app = setup();
  app.visible();
  app.reduced.matches = true;
  app.reduced.emit('change');
  assert.ok(app.videos.every(video => video.paused));
});


test('blocked autoplay recovers after user activation without clicking each film', async () => {
  const app = setup({blocked:true});
  app.visible();
  await Promise.resolve();
  assert.equal(app.videos[0].paused, true);
  app.videos.forEach(video => { video.blocked = false; });
  app.document.emit('click');
  assert.equal(app.videos[0].paused, false);
  assert.ok(app.videos.slice(1).every(video => video.paused));
  assert.equal(app.videos[0].muted, true);
  assert.equal(app.videos[0].defaultMuted, true);
  assert.equal(app.videos[0].playsInline, true);
});

test('readiness recovery does not require another viewport crossing', async () => {
  const app = setup({blocked:true});
  app.visible();
  await Promise.resolve();
  app.videos[0].blocked = false;
  app.videos[0].emit('canplay');
  assert.equal(app.videos[0].paused, false);
});

test('global recovery never undoes a user pause or starts offscreen clips', () => {
  const app = setup();
  app.visible();
  app.toggle.emit('click');
  app.document.emit('click');
  app.videos[0].emit('canplay');
  assert.ok(app.videos.every(video => video.paused));
  app.toggle.emit('click');
  app.visible(false);
  app.document.emit('click');
  app.window.emit('pageshow');
  assert.ok(app.videos.every(video => video.paused));
});

for (const preference of ['reduce', 'saveData']) {
  test(`recovery respects ${preference} until explicit opt-in`, () => {
    const app = setup({[preference]:true});
    app.visible();
    app.document.emit('click');
    app.videos[0].emit('canplay');
    assert.ok(app.videos.every(video => video.paused));
    app.toggle.emit('click');
    assert.equal(app.videos[0].paused, false);
  });
}
