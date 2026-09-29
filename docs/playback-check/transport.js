const videos = [...document.querySelectorAll('video')];
const errors = new Map();
const transfers = new Map();
const expected = {
  buffered: '135347bb7c4f5340525b2ec6739852c8f98014c0d6fd1d8b7de8c4e67196a4e9',
  webm: '68cdb1739b62988daed40a4f0c55e89da911208727bcae648ce609843eeb9a18'
};
let busy = false;
function report() {
  const lines = videos.map((v, i) => `${i + 1}. ${v.id}: ${!v.paused ? 'playing' : 'paused'}; time=${v.currentTime.toFixed(1)}s; ready=${v.readyState}; error=${v.error ? `${v.error.code} ${v.error.message}` : errors.get(v.id) || 'none'}`);
  document.querySelector('#result').textContent = [
    'Playback check V2',
    `Browser: ${navigator.userAgent}`,
    `MP4/H264: ${videos[0].canPlayType('video/mp4; codecs="avc1.640028"') || 'unsupported'}`,
    `WebM/VP9: ${videos[0].canPlayType('video/webm; codecs="vp9"') || 'unsupported'}`,
    `WebM/VP8: ${videos[0].canPlayType('video/webm; codecs="vp8"') || 'unsupported'}`,
    ...lines, ...transfers.values()
  ].join('\n');
  videos.forEach(v => {
    document.querySelector('#' + v.id + '-state').textContent = v.error ? '加载或解码失败' : !v.paused && v.currentTime > 0 ? '正在播放 ' + v.currentTime.toFixed(1) + ' 秒' : errors.has(v.id) ? errors.get(v.id) : v.hasAttribute('src') && v.readyState < 2 ? '正在加载…' : '已暂停';
  });
}
function play(v, src) {
  if (v.src.startsWith('blob:')) URL.revokeObjectURL(v.src);
  v.muted = true;
  v.defaultMuted = true;
  v.src = src;
  v.load();
  v.play().catch(e => { errors.set(v.id, e.name + ': ' + e.message); report(); });
}
async function download(v) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(v.dataset.file + '?check=transport-2', {cache: 'no-store', signal: controller.signal});
    const bytes = await response.arrayBuffer();
    const sha = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
    transfers.set(v.id, `${v.id} download: HTTP ${response.status}; type=${response.headers.get('content-type')}; bytes=${bytes.byteLength}; exact=${sha === expected[v.id]}; first=${[...new Uint8Array(bytes).slice(0, 16)].map(n => n.toString(16).padStart(2, '0')).join('')}`);
    if (!response.ok || sha !== expected[v.id]) throw new Error('Downloaded content does not match the video');
    play(v, URL.createObjectURL(new Blob([bytes], {type: v.id === 'webm' ? 'video/webm' : 'video/mp4'})));
  } catch (e) {
    errors.set(v.id, e.name + ': ' + e.message);
    if (!transfers.has(v.id)) transfers.set(v.id, `${v.id} download: ${e.name}: ${e.message}`);
  } finally { clearTimeout(timer); report(); }
}
videos.forEach(v => ['playing', 'pause', 'timeupdate', 'error', 'loadeddata', 'waiting'].forEach(name => v.addEventListener(name, report)));
document.querySelector('#start').addEventListener('click', async () => {
  if (busy) return;
  busy = true;
  errors.clear(); transfers.clear();
  play(videos[0], videos[0].dataset.file + '?check=transport-2');
  play(videos[3], embeddedClip);
  await Promise.allSettled([download(videos[1]), download(videos[2])]);
  busy = false; report();
});
document.querySelector('#copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(document.querySelector('#result').textContent); document.querySelector('#copy').textContent = '已复制'; }
  catch { document.querySelector('#copy').textContent = '请选中下方结果复制'; }
});
report();
