(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = matchMedia('(max-width: 760px)').matches;
  const chapters = [
    {file:'unfold-black-v02-4b096a2e',title:'Unfold.',description:'Mount your phone.',alt:'Tribot unfolding and assembly animation'},
    {file:'lift-black-v02-4b096a2e',title:'Set the height.',description:'Manual outer column. Motorized inner lift.',alt:'Tribot manual height adjustment and motorized inner lift'},
    {file:'frame-black-v02-4b096a2e',title:'Turn the frame.',description:'Portrait. Landscape. Pan. Tilt.',alt:'Tribot phone orientation, gimbal pan and tilt'},
    {file:'drive-black-v02-4b096a2e',title:'Drive.',description:'Two drive wheels. One following caster.',alt:'Tribot differential drive and rear caster turning'},
    {file:'fold-black-v02-4b096a2e',title:'Fold.',description:'Pack into three modules.',alt:'Tribot lowering and folding into three modules'}
  ];
  const design=$('#design-video'),story=$('#design'),seek=$('#design-seek');
  const designPanel=$('.chapter-layout'); designPanel.id='design-panel';designPanel.setAttribute('role','tabpanel');designPanel.setAttribute('aria-labelledby','chapter-tab-0');
  let chapter=0,designVisible=false,designPaused=reduced,scrollHigh=0,lastY=scrollY,speedTimer,manualUntil=0,seeking=false;
  function textLines(el,text){el.replaceChildren();if(mobile){el.textContent=text.replaceAll('\n',' ');return;}text.split('\n').forEach((s,i)=>{if(i){el.append(document.createElement('br'));el.append(document.createTextNode(' '));}el.append(document.createTextNode(s));});}
  function safePlay(v){if(document.hidden||$('#film-dialog').open)return;const result=v.play();if(result)result.catch(()=>updatePlay(v));}
  function updatePlay(v){const b=$('#design-play');b.textContent=v.paused?'Play':'Pause';b.setAttribute('aria-label',`${v.paused?'Play':'Pause'} product animation`);}
  function source(v,file,poster){v.parentElement.querySelector('.media-error')?.remove();v.pause();v.poster=poster;v.src=file;v.load();}
  function loadDesign(){if(!design.getAttribute('src'))source(design,`../assets/${chapters[chapter].file}${mobile?'-mobile':''}.mp4`,`../assets/${chapters[chapter].file}.webp`);if(designVisible&&!designPaused)safePlay(design);}
  function selectChapter(index,manual=false){
    if(manual){designPaused=reduced;if(design.ended)design.currentTime=0;manualUntil=Date.now()+2200;const room=story.offsetHeight-$('.design-sticky').offsetHeight;const inStory=story.getBoundingClientRect().top<innerHeight&&story.getBoundingClientRect().bottom>0;if(room>200&&inStory)scrollTo({top:story.offsetTop+room*index/4-$('.header').offsetHeight,behavior:reduced?'instant':'smooth'});scrollHigh=index;}
    if(index===chapter){loadDesign();return;}chapter=index;const c=chapters[index];
    textLines($('#chapter-title'),c.title);$('#chapter-description').textContent=c.description;$('#chapter-number').textContent=`0${index+1} / 05`;
    design.setAttribute('aria-label',c.alt);designPanel.setAttribute('aria-labelledby',`chapter-tab-${index}`);
    document.querySelectorAll('[data-chapter]').forEach((b,i)=>{b.setAttribute('aria-selected',String(i===index));b.tabIndex=i===index?0:-1;});
    const copy=$('.chapter-copy');copy.classList.remove('changing');requestAnimationFrame(()=>copy.classList.add('changing'));
    seek.value=0;$('#design-time').textContent='0:00';source(design,`../assets/${c.file}${mobile?'-mobile':''}.mp4`,`../assets/${c.file}.webp`);if(designVisible&&!designPaused)safePlay(design);
  }
  function wireTabs(selector,choose){const buttons=[...document.querySelectorAll(selector)];buttons.forEach((b,i)=>{b.addEventListener('click',()=>choose(i));b.addEventListener('keydown',e=>{let next;if(e.key==='ArrowRight')next=(i+1)%buttons.length;else if(e.key==='ArrowLeft')next=(i-1+buttons.length)%buttons.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=buttons.length-1;else return;e.preventDefault();buttons[next].focus();choose(next);});});}
  wireTabs('[data-chapter]',i=>selectChapter(i,true));
  const warm=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){loadDesign();warm.unobserve(e.target);}}),{rootMargin:'300px'});warm.observe(design);
  const visible=new IntersectionObserver(entries=>entries.forEach(e=>{designVisible=e.isIntersecting&&e.intersectionRatio>.15;if(designVisible)loadDesign();else design.pause();}),{threshold:[0,.15,.5]});visible.observe(design);
  $('#design-play').addEventListener('click',()=>{designPaused=!design.paused;if(designPaused)design.pause();else{loadDesign();safePlay(design);}});
  for(const v of [design]){v.addEventListener('play',()=>updatePlay(v));v.addEventListener('pause',()=>updatePlay(v));v.addEventListener('error',()=>{if(!v.getAttribute('src')||v.parentElement.querySelector('.media-error'))return;const box=document.createElement('div');box.className='media-error';box.setAttribute('role','status');const label=document.createElement('p');label.textContent='The preview could not load.';const retry=document.createElement('button');retry.textContent='Try again';retry.onclick=()=>{box.remove();v.load();safePlay(v);};box.append(label,retry);v.parentElement.append(box);});}
  design.addEventListener('timeupdate',()=>{if(!seeking&&Number.isFinite(design.duration)){seek.value=String(design.currentTime/design.duration*1000);seek.setAttribute('aria-valuetext',`${Math.round(design.currentTime)} seconds of ${Math.round(design.duration)}`);}const t=Math.floor(design.currentTime);$('#design-time').textContent=`${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`;});
  seek.addEventListener('input',()=>{if(Number.isFinite(design.duration)){seeking=true;design.currentTime=Number(seek.value)/1000*design.duration;}});seek.addEventListener('change',()=>{seeking=false;if(!designPaused)safePlay(design);});seek.addEventListener('blur',()=>{seeking=false;});
  design.addEventListener('ended',()=>{if(chapter<4){scrollHigh=Math.max(scrollHigh,chapter+1);selectChapter(chapter+1);}else{design.currentTime=0;if(designVisible&&!designPaused)safePlay(design);}});
  let scheduled=false;
  function onScroll(){scheduled=false;const y=scrollY,delta=y-lastY;lastY=y;const top=story.getBoundingClientRect().top,room=story.offsetHeight-$('.design-sticky').offsetHeight;
    if(!reduced&&delta>0&&designVisible){design.playbackRate=2.5;$('#speed-label').textContent='2.5×';clearTimeout(speedTimer);speedTimer=setTimeout(()=>{design.playbackRate=1;$('#speed-label').textContent='1×';},160);if(!designPaused)safePlay(design);if(room>200&&Date.now()>manualUntil){const next=Math.min(4,Math.max(0,Math.floor(($('.header').offsetHeight-top)/room*5)));if(next>scrollHigh){scrollHigh=next;selectChapter(next);}}}
    if(!reduced){const h=$('.hero');if(y<h.offsetHeight)$('.product-word').style.transform=`translateY(${Math.min(80,y*.12)}px)`;}
  }
  addEventListener('scroll',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(onScroll);}},{passive:true});
  const dialog=$('#film-dialog'),film=$('#full-film');let opener;
  document.querySelectorAll('[data-film]').forEach(b=>b.addEventListener('click',()=>{opener=b;design.pause();if(!film.getAttribute('src'))film.src='../assets/film-1080-black-v02-4b096a2e.mp4';dialog.showModal();film.play()?.catch(()=>{});}));
  $('#film-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});dialog.addEventListener('close',()=>{film.pause();if(designVisible&&!designPaused)safePlay(design);opener?.focus();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){design.pause();film.pause();}else{if(designVisible&&!designPaused)safePlay(design);}});
  textLines($('#chapter-title'),chapters[0].title);textLines($('#create-title'),'Make it your own.');
  updatePlay(design);
})();
