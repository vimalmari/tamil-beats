// ══ TAMIL BEATS — Full Featured MP3 Player ══

// ── DOM ──
const audio        = document.getElementById('audioPlayer');
const cfAudio      = document.getElementById('crossfadeAudio');
const playBtn      = document.getElementById('playBtn');
const prevBtn      = document.getElementById('prevBtn');
const nextBtn      = document.getElementById('nextBtn');
const shuffleBtn   = document.getElementById('shuffleBtn');
const repeatBtn    = document.getElementById('repeatBtn');
const progressBar  = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
const progressThumb= document.getElementById('progressThumb');
const currentTimeEl= document.getElementById('currentTime');
const durationTimeEl=document.getElementById('durationTime');
const volumeSlider = document.getElementById('volumeSlider');
const playerTitle  = document.getElementById('playerTitle');
const playerCatEl  = document.getElementById('playerCategory');
const playerThumb  = document.getElementById('playerThumb');
const songListEl   = document.getElementById('songList');
const emptyState   = document.getElementById('emptyState');
const songCountEl  = document.getElementById('songCount');
const pageTitleEl  = document.getElementById('pageTitle');
const searchInput  = document.getElementById('searchInput');
const fileUpload   = document.getElementById('fileUpload');
const modalOverlay = document.getElementById('modalOverlay');
const modalDesc    = document.getElementById('modalDesc');
const modalClose   = document.getElementById('modalClose');
const hamburger    = document.getElementById('hamburger');
const sidebar      = document.getElementById('sidebar');
const backdrop     = document.getElementById('sidebarBackdrop');
const speedSelect  = document.getElementById('speedSelect');
const artUpload    = document.getElementById('artUpload');
const artPreview   = document.getElementById('artPreview');
const installBtn   = document.getElementById('installBtn');

// Now Playing
const npOverlay  = document.getElementById('nowPlayingOverlay');
const npClose    = document.getElementById('npClose');
const npArt      = document.getElementById('npArt');
const npTitle    = document.getElementById('npTitle');
const npCat      = document.getElementById('npCat');
const npBar      = document.getElementById('npBar');
const npFill     = document.getElementById('npFill');
const npCurrent  = document.getElementById('npCurrent');
const npDuration = document.getElementById('npDuration');
const npPlay     = document.getElementById('npPlay');
const npPrev     = document.getElementById('npPrev');
const npNext     = document.getElementById('npNext');
const npShuffle  = document.getElementById('npShuffle');
const npRepeat   = document.getElementById('npRepeat');
const npSpeed    = document.getElementById('npSpeed');
const npSleepLbl = document.getElementById('npSleepLabel');
const npCanvas   = document.getElementById('npVisualizer');

// Panels
const eqOverlay    = document.getElementById('eqOverlay');
const sleepOverlay = document.getElementById('sleepOverlay');
const themeOverlay = document.getElementById('themeOverlay');
const queueOverlay = document.getElementById('queueOverlay');
const sleepStatus  = document.getElementById('sleepStatus');
const queueListEl  = document.getElementById('queueList');

// ── STATE ──
let songs         = [];
let filteredSongs = [];
let queue         = [];       // ordered list for playback
let currentSongId = null;
let isPlaying     = false;
let isShuffle     = false;
let isRepeat      = false;
let activeCategory= 'all';
let pendingFiles  = [];
let pendingArtBlob= null;
let db            = null;
let sleepTimer    = null;
let sleepEnd      = null;
let sleepInterval = null;
let crossfadeActive = false;

// Audio context for visualizer + EQ
let audioCtx, analyser, source, gainNode;
let eqFilters = [];
let vizAnimId;

const catNames  = {all:'All Songs',melody:'🎶 Melody',beat:'🥁 Beat Songs',breakup:'💔 Break Up',love:'❤️ Love Songs',mass:'🔥 Mass / Kuthu',devotional:'🙏 Devotional'};
const catEmojis = {melody:'🎶',beat:'🥁',breakup:'💔',love:'❤️',mass:'🔥',devotional:'🙏'};

const EQ_BANDS   = [60,170,310,600,1000,3000,6000,12000,14000,16000];
const EQ_LABELS  = ['60','170','310','600','1K','3K','6K','12K','14K','16K'];
const EQ_PRESETS = {
  flat:    [0,0,0,0,0,0,0,0,0,0],
  bass:    [8,7,5,2,0,-1,-2,-2,-2,-2],
  treble:  [-2,-2,-1,0,1,3,5,6,7,8],
  vocal:   [-2,-1,0,3,5,5,3,1,0,-1],
  pop:     [-1,2,4,4,2,-1,-2,-2,0,1]
};

// ── HELPERS ──
const getCurrentSong      = () => songs.find(s => s.id === currentSongId) || null;
const getCurrentQueueIdx  = () => queue.findIndex(s => s.id === currentSongId);
const fmt = sec => {
  if(!sec||isNaN(sec)) return '0:00';
  return `${Math.floor(sec/60)}:${Math.floor(sec%60).toString().padStart(2,'0')}`;
};
const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ══════════════════════════════════════════════
//  INDEXEDDB
// ══════════════════════════════════════════════
function openDB(){
  return new Promise((res,rej)=>{
    const req = indexedDB.open('TamilBeatsDB',2);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if(!d.objectStoreNames.contains('songs')) d.createObjectStore('songs',{keyPath:'id'});
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}
const dbOp = (store,mode,fn) => new Promise((res,rej)=>{
  const tx  = db.transaction(store,mode);
  const req = fn(tx.objectStore(store));
  req.onsuccess = e => res(e.target.result);
  req.onerror   = e => rej(e.target.error);
});
const dbGetAll = () => dbOp('songs','readonly', s=>s.getAll());
const dbPut    = r  => dbOp('songs','readwrite',s=>s.put(r));
const dbDel    = id => dbOp('songs','readwrite',s=>s.delete(id));

async function loadFromDB(){
  songListEl.innerHTML=`<div style="text-align:center;padding:3rem;color:var(--muted)">⏳ Loading songs...</div>`;
  try{
    db = await openDB();
    const recs = await dbGetAll();
    songs = recs.map(r=>({
      id:r.id, name:r.name, category:r.category, duration:r.duration,
      url:URL.createObjectURL(r.blob),
      artUrl: r.artBlob ? URL.createObjectURL(r.artBlob) : null
    }));
  }catch(e){ console.error(e); songs=[]; }
  rebuildQueue();
  renderSongs();
}

// ══════════════════════════════════════════════
//  AUDIO CONTEXT + EQ + VISUALIZER
// ══════════════════════════════════════════════
function initAudioContext(){
  if(audioCtx) return;
  audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  analyser  = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  gainNode  = audioCtx.createGain();

  // Create EQ filter chain
  eqFilters = EQ_BANDS.map((freq,i)=>{
    const f = audioCtx.createBiquadFilter();
    f.type      = i===0?'lowshelf':i===EQ_BANDS.length-1?'highshelf':'peaking';
    f.frequency.value = freq;
    f.gain.value      = 0;
    return f;
  });

  // Connect: source → eq filters → analyser → gainNode → destination
  source = audioCtx.createMediaElementSource(audio);
  let node = source;
  eqFilters.forEach(f=>{ node.connect(f); node=f; });
  node.connect(analyser);
  analyser.connect(gainNode);
  gainNode.connect(audioCtx.destination);
}

function startVisualizer(){
  if(!analyser) return;
  const ctx    = npCanvas.getContext('2d');
  const buf    = new Uint8Array(analyser.frequencyBinCount);
  const draw   = () => {
    vizAnimId = requestAnimationFrame(draw);
    npCanvas.width  = npCanvas.offsetWidth;
    npCanvas.height = npCanvas.offsetHeight;
    analyser.getByteFrequencyData(buf);
    ctx.clearRect(0,0,npCanvas.width,npCanvas.height);
    const bw = npCanvas.width/buf.length*2.5;
    const grad = ctx.createLinearGradient(0,npCanvas.height,0,0);
    grad.addColorStop(0,'rgba(168,85,247,0.8)');
    grad.addColorStop(1,'rgba(236,72,153,0.3)');
    ctx.fillStyle = grad;
    for(let i=0;i<buf.length;i++){
      const h = (buf[i]/255)*npCanvas.height;
      ctx.fillRect(i*bw,npCanvas.height-h,bw-1,h);
    }
  };
  draw();
}

function stopVisualizer(){
  if(vizAnimId) cancelAnimationFrame(vizAnimId);
}

// ══════════════════════════════════════════════
//  EQUALIZER UI
// ══════════════════════════════════════════════
function buildEQBands(){
  const container = document.getElementById('eqBands');
  container.innerHTML = EQ_BANDS.map((freq,i)=>`
    <div class="eq-band">
      <div class="eq-val" id="eqv${i}">0</div>
      <input type="range" class="eq-slider" id="eqs${i}" min="-12" max="12" value="0" step="1"
        oninput="setEQBand(${i},this.value)"/>
      <label>${EQ_LABELS[i]}</label>
    </div>`).join('');
}

function setEQBand(i,val){
  document.getElementById(`eqv${i}`).textContent = (val>0?'+':'')+val;
  if(eqFilters[i]) eqFilters[i].gain.value = parseFloat(val);
}

function applyPreset(name){
  document.querySelectorAll('.preset-btn').forEach(b=>b.classList.toggle('active',b.dataset.preset===name));
  const vals = EQ_PRESETS[name]||EQ_PRESETS.flat;
  vals.forEach((v,i)=>{
    const sl = document.getElementById(`eqs${i}`);
    if(sl){ sl.value=v; setEQBand(i,v); }
  });
}

document.querySelectorAll('.preset-btn').forEach(b=>
  b.addEventListener('click',()=>applyPreset(b.dataset.preset)));

// ══════════════════════════════════════════════
//  UPLOAD
// ══════════════════════════════════════════════
fileUpload.addEventListener('change',e=>{
  const files=Array.from(e.target.files); if(!files.length) return;
  pendingFiles=files; pendingArtBlob=null;
  artPreview.innerHTML='🖼️ Add Album Art (optional)';
  modalDesc.textContent=files.length===1?`Category for "${files[0].name}"`:
    `Category for ${files.length} song(s).`;
  modalOverlay.classList.add('show');
  fileUpload.value='';
});

artUpload.addEventListener('change',e=>{
  const f=e.target.files[0]; if(!f) return;
  pendingArtBlob=f;
  const url=URL.createObjectURL(f);
  artPreview.innerHTML=`<img src="${url}" style="max-height:100px;border-radius:8px"/>`;
});

document.querySelectorAll('.cat-btn').forEach(btn=>
  btn.addEventListener('click',()=>{
    const cat=btn.dataset.cat;
    modalOverlay.classList.remove('show');
    addSongs(pendingFiles,cat,pendingArtBlob);
    pendingFiles=[]; pendingArtBlob=null;
  }));

modalClose.addEventListener('click',()=>{
  modalOverlay.classList.remove('show');
  pendingFiles=[]; pendingArtBlob=null;
});

function addSongs(files,category,artBlob){
  let done=0;
  files.forEach(file=>{
    const blob=file;
    const url =URL.createObjectURL(blob);
    const name=file.name.replace(/\.[^/.]+$/,'');
    const id  =Date.now()+'_'+Math.random().toString(36).slice(2);
    const tmp =new Audio(url);
    const artUrl = artBlob ? URL.createObjectURL(artBlob) : null;

    const finish=dur=>{
      const song={id,name,category,duration:dur,url,artUrl};
      songs.push(song);
      dbPut({id,name,category,duration:dur,blob,artBlob:artBlob||null});
      done++;
      if(done===files.length){ rebuildQueue(); renderSongs(); }
    };
    tmp.addEventListener('loadedmetadata',()=>finish(tmp.duration));
    tmp.addEventListener('error',()=>finish(0));
  });
}

// ══════════════════════════════════════════════
//  QUEUE
// ══════════════════════════════════════════════
function rebuildQueue(){
  // Queue = filtered songs in current view order
  queue = [...filteredSongs];
}

function renderQueue(){
  if(!queue.length){ queueListEl.innerHTML=`<p style="color:var(--muted);text-align:center;padding:2rem">No songs in queue</p>`; return; }
  queueListEl.innerHTML = queue.map((s,i)=>{
    const playing = s.id===currentSongId;
    return `
    <div class="queue-item ${playing?'q-playing':''}" data-id="${s.id}" draggable="true">
      <span class="q-drag">⠿</span>
      <div class="q-art">${s.artUrl?`<img src="${s.artUrl}"/>`:(catEmojis[s.category]||'🎵')}</div>
      <span class="q-name" onclick="loadAndPlay('${s.id}')">${esc(s.name)}</span>
      <button class="q-remove" onclick="removeFromQueue(${i})" title="Remove">✕</button>
    </div>`;
  }).join('');
  initQueueDrag();
}

function removeFromQueue(i){
  queue.splice(i,1);
  renderQueue();
}

// Drag to reorder queue
function initQueueDrag(){
  let dragging=null;
  queueListEl.querySelectorAll('.queue-item').forEach(item=>{
    item.addEventListener('dragstart',()=>{ dragging=item; setTimeout(()=>item.classList.add('dragging'),0); });
    item.addEventListener('dragend',()=>{ item.classList.remove('dragging'); dragging=null; });
    item.addEventListener('dragover',e=>{ e.preventDefault();
      const rect=item.getBoundingClientRect();
      const mid =rect.top+rect.height/2;
      if(e.clientY<mid) queueListEl.insertBefore(dragging,item);
      else queueListEl.insertBefore(dragging,item.nextSibling);
    });
    item.addEventListener('drop',()=>{
      // rebuild queue array from DOM order
      const ids=[...queueListEl.querySelectorAll('.queue-item')].map(el=>el.dataset.id);
      queue=ids.map(id=>songs.find(s=>s.id===id)).filter(Boolean);
    });
  });
}

// ══════════════════════════════════════════════
//  RENDER SONGS
// ══════════════════════════════════════════════
function renderSongs(){
  const q=searchInput.value.toLowerCase().trim();
  filteredSongs=songs.filter(s=>{
    const c=activeCategory==='all'||s.category===activeCategory;
    const k=!q||s.name.toLowerCase().includes(q);
    return c&&k;
  });
  songCountEl.textContent=`${filteredSongs.length} song${filteredSongs.length!==1?'s':''}`;
  rebuildQueue();
  if(!filteredSongs.length){ songListEl.innerHTML=''; emptyState.classList.add('show'); return; }
  emptyState.classList.remove('show');
  songListEl.innerHTML=filteredSongs.map((s,i)=>{
    const p=s.id===currentSongId;
    const art=s.artUrl?`<img src="${s.artUrl}"/>`:(catEmojis[s.category]||'🎵');
    return `
    <div class="song-item ${p?'playing':''}" onclick="playSongFromList(${i})">
      <div class="song-num">${p?'▶':i+1}</div>
      <div class="song-art ${p?'playing-art':''}">${art}</div>
      <div class="song-info">
        <div class="song-name">${esc(s.name)}</div>
        <div class="song-cat-tag">${catNames[s.category]||s.category}</div>
      </div>
      <div class="song-duration">${fmt(s.duration)}</div>
      <button class="song-menu-btn" onclick="deleteSong(event,${i})" title="Remove">🗑</button>
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════════
//  PLAYBACK
// ══════════════════════════════════════════════
function playSongFromList(idx){
  const s=filteredSongs[idx]; if(!s) return;
  if(s.id===currentSongId&&isPlaying){ pauseSong(); return; }
  loadAndPlay(s.id);
}

function loadAndPlay(songId){
  const song=songs.find(s=>s.id===songId); if(!song) return;

  // Crossfade: if a song is playing, fade out current, fade in new
  if(isPlaying && currentSongId && currentSongId!==songId){
    doCrossfade(song);
    return;
  }

  doLoad(song);
}

function doLoad(song){
  initAudioContext();
  if(audioCtx.state==='suspended') audioCtx.resume();
  currentSongId=song.id;
  audio.src=song.url;
  audio.playbackRate=parseFloat(speedSelect.value);
  audio.play()
    .then(()=>{ isPlaying=true; updatePlayBtn(); updatePlayerBar(song); renderSongs(); updateNP(); })
    .catch(e=>console.warn(e));
}

function doCrossfade(nextSong){
  if(crossfadeActive) return;
  crossfadeActive=true;
  const dur=2; // seconds
  let t=0;
  const origVol=audio.volume;
  const tick=setInterval(()=>{
    t+=0.1;
    audio.volume=Math.max(0,origVol*(1-t/dur));
    if(t>=dur){
      clearInterval(tick);
      audio.pause(); audio.volume=origVol;
      crossfadeActive=false;
      doLoad(nextSong);
    }
  },100);
}

function pauseSong(){ audio.pause(); isPlaying=false; updatePlayBtn(); stopVisualizer(); }

function updatePlayBtn(){
  playBtn.textContent=isPlaying?'⏸':'▶';
  npPlay.textContent =isPlaying?'⏸':'▶';
}

function updatePlayerBar(song){
  playerTitle.textContent   =song.name;
  playerCatEl.textContent   =catNames[song.category]||song.category;
  if(song.artUrl){
    playerThumb.innerHTML=`<img src="${song.artUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:12px"/>`;
  } else {
    playerThumb.textContent=catEmojis[song.category]||'🎵';
  }
  playerThumb.classList.add('playing-anim');
  updateMediaSession(song);
}

function updateNP(){
  const s=getCurrentSong(); if(!s) return;
  npTitle.textContent=s.name;
  npCat.textContent  =catNames[s.category]||s.category;
  if(s.artUrl){
    npArt.innerHTML=`<img src="${s.artUrl}" style="width:100%;height:100%;object-fit:cover"/>`;
  } else {
    npArt.textContent=catEmojis[s.category]||'🎵';
  }
  npArt.classList.toggle('playing',isPlaying);
  npShuffle.classList.toggle('active',isShuffle);
  npRepeat.classList.toggle('active',isRepeat);
  if(isPlaying) startVisualizer();
}

// ── Media Session API (lock screen controls) ──
function updateMediaSession(song){
  if(!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata=new MediaMetadata({
    title:  song.name,
    artist: 'Tamil Beats',
    album:  catNames[song.category]||song.category,
    artwork: song.artUrl?[{src:song.artUrl,sizes:'512x512'}]:[]
  });
  navigator.mediaSession.setActionHandler('play',  ()=>{ audio.play(); isPlaying=true; updatePlayBtn(); });
  navigator.mediaSession.setActionHandler('pause', ()=>pauseSong());
  navigator.mediaSession.setActionHandler('previoustrack',()=>playPrev());
  navigator.mediaSession.setActionHandler('nexttrack',    ()=>playNext());
}

// ── Controls ──
playBtn.addEventListener('click',()=>{
  if(!currentSongId){ const f=queue[0]||songs[0]; if(f) loadAndPlay(f.id); return; }
  if(isPlaying) pauseSong();
  else{ audio.play(); isPlaying=true; updatePlayBtn(); updateNP(); startVisualizer(); }
});

npPlay.addEventListener('click',()=>playBtn.click());
nextBtn.addEventListener('click',playNext);
prevBtn.addEventListener('click',playPrev);
npNext.addEventListener('click',playNext);
npPrev.addEventListener('click',playPrev);

function playNext(){
  if(!queue.length) return;
  const idx=getCurrentQueueIdx();
  let next=isShuffle?Math.floor(Math.random()*queue.length):(idx===-1?0:(idx+1)%queue.length);
  loadAndPlay(queue[next].id);
}
function playPrev(){
  if(!queue.length) return;
  if(audio.currentTime>3){audio.currentTime=0;return;}
  const idx=getCurrentQueueIdx();
  const prev=idx<=0?queue.length-1:idx-1;
  loadAndPlay(queue[prev].id);
}

shuffleBtn.addEventListener('click',()=>{
  isShuffle=!isShuffle;
  shuffleBtn.classList.toggle('active',isShuffle);
  npShuffle.classList.toggle('active',isShuffle);
});
npShuffle.addEventListener('click',()=>shuffleBtn.click());

repeatBtn.addEventListener('click',()=>{
  isRepeat=!isRepeat; audio.loop=isRepeat;
  repeatBtn.classList.toggle('active',isRepeat);
  npRepeat.classList.toggle('active',isRepeat);
});
npRepeat.addEventListener('click',()=>repeatBtn.click());

// Speed
speedSelect.addEventListener('change',()=>{ audio.playbackRate=parseFloat(speedSelect.value); npSpeed.value=speedSelect.value; });
npSpeed.addEventListener('change',()=>{ speedSelect.value=npSpeed.value; speedSelect.dispatchEvent(new Event('change')); });

// ── Audio events ──
audio.addEventListener('timeupdate',()=>{
  if(!audio.duration) return;
  const pct=(audio.currentTime/audio.duration)*100;
  progressFill.style.width=pct+'%';
  progressThumb.style.left=pct+'%';
  npFill.style.width=pct+'%';
  currentTimeEl.textContent=fmt(audio.currentTime);
  npCurrent.textContent    =fmt(audio.currentTime);
});
audio.addEventListener('loadedmetadata',()=>{
  durationTimeEl.textContent=fmt(audio.duration);
  npDuration.textContent    =fmt(audio.duration);
  const s=getCurrentSong(); if(s) s.duration=audio.duration;
});
audio.addEventListener('ended',()=>{ if(!isRepeat) playNext(); });
audio.addEventListener('play',()=>{ startVisualizer(); npArt.classList.add('playing'); });
audio.addEventListener('pause',()=>{ stopVisualizer(); npArt.classList.remove('playing'); });

// Progress bars
progressBar.addEventListener('click',e=>{
  const r=progressBar.getBoundingClientRect();
  audio.currentTime=((e.clientX-r.left)/r.width)*audio.duration;
});
npBar.addEventListener('click',e=>{
  const r=npBar.getBoundingClientRect();
  audio.currentTime=((e.clientX-r.left)/r.width)*audio.duration;
});

volumeSlider.addEventListener('input',()=>{ audio.volume=volumeSlider.value; });

// ── Delete ──
async function deleteSong(e,idx){
  e.stopPropagation();
  const s=filteredSongs[idx]; if(!s) return;
  const ri=songs.findIndex(x=>x.id===s.id);
  if(s.id===currentSongId){
    audio.pause(); isPlaying=false; currentSongId=null;
    playerTitle.textContent='No song selected'; playerCatEl.textContent='—';
    playerThumb.textContent='♪'; playerThumb.classList.remove('playing-anim');
    updatePlayBtn();
  }
  URL.revokeObjectURL(s.url);
  if(s.artUrl) URL.revokeObjectURL(s.artUrl);
  songs.splice(ri,1);
  await dbDel(s.id);
  rebuildQueue(); renderSongs();
}

// ══════════════════════════════════════════════
//  NOW PLAYING FULLSCREEN
// ══════════════════════════════════════════════
document.getElementById('playerInfoClick').addEventListener('click',()=>{
  if(!currentSongId) return;
  npOverlay.classList.add('open');
  updateNP();
  startVisualizer();
});
npClose.addEventListener('click',()=>{ npOverlay.classList.remove('open'); stopVisualizer(); });

// Swipe to close NP overlay (swipe down)
let npTouchY=0;
npOverlay.addEventListener('touchstart',e=>{ npTouchY=e.touches[0].clientY; },{passive:true});
npOverlay.addEventListener('touchend',e=>{
  const dy=e.changedTouches[0].clientY-npTouchY;
  if(dy>80) npClose.click();
});

// ══════════════════════════════════════════════
//  SWIPE LEFT/RIGHT TO SKIP (main area)
// ══════════════════════════════════════════════
let swipeX=0;
document.querySelector('.main').addEventListener('touchstart',e=>{ swipeX=e.touches[0].clientX; },{passive:true});
document.querySelector('.main').addEventListener('touchend',e=>{
  const dx=e.changedTouches[0].clientX-swipeX;
  if(Math.abs(dx)>60){
    if(dx<0) playNext();
    else     playPrev();
  }
});

// ══════════════════════════════════════════════
//  SLEEP TIMER
// ══════════════════════════════════════════════
document.querySelectorAll('.sleep-opt').forEach(btn=>
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.sleep-opt').forEach(b=>b.classList.remove('active'));
    const mins=parseInt(btn.dataset.mins);
    clearSleepTimer();
    if(mins>0){
      btn.classList.add('active');
      sleepEnd=Date.now()+mins*60000;
      sleepTimer=setTimeout(()=>{ audio.pause(); isPlaying=false; updatePlayBtn(); clearSleepTimer(); },mins*60000);
      sleepInterval=setInterval(updateSleepStatus,1000);
      updateSleepStatus();
    } else {
      sleepStatus.textContent='Timer cancelled';
      npSleepLbl.textContent='';
    }
  }));

function clearSleepTimer(){
  if(sleepTimer)   clearTimeout(sleepTimer);
  if(sleepInterval)clearInterval(sleepInterval);
  sleepTimer=null; sleepEnd=null;
}
function updateSleepStatus(){
  if(!sleepEnd){ sleepStatus.textContent='No timer set'; npSleepLbl.textContent=''; return; }
  const left=Math.max(0,sleepEnd-Date.now());
  const m=Math.floor(left/60000), s=Math.floor((left%60000)/1000);
  const txt=`😴 ${m}:${s.toString().padStart(2,'0')}`;
  sleepStatus.textContent=`Stopping in ${m}m ${s}s`;
  npSleepLbl.textContent=txt;
  if(left===0){ clearSleepTimer(); sleepStatus.textContent='Stopped!'; npSleepLbl.textContent=''; }
}

// ══════════════════════════════════════════════
//  THEME
// ══════════════════════════════════════════════
function applyTheme(t){
  document.body.dataset.theme=t;
  localStorage.setItem('tb_theme',t);
  document.querySelector('meta[name="theme-color"]').content=
    t==='light'?'#f5f5f8':t==='purple'?'#0f0820':t==='red'?'#140608':'#0c0c14';
  document.querySelectorAll('.theme-opt').forEach(b=>b.classList.toggle('active',b.dataset.theme===t));
}
document.querySelectorAll('.theme-opt').forEach(b=>b.addEventListener('click',()=>applyTheme(b.dataset.theme)));
applyTheme(localStorage.getItem('tb_theme')||'dark');

// ══════════════════════════════════════════════
//  PANEL OPEN/CLOSE
// ══════════════════════════════════════════════
const panels={
  equalizerBtn:  {overlay:eqOverlay,   close:'eqClose'},
  sleepBtn:      {overlay:sleepOverlay,close:'sleepClose'},
  themeBtn:      {overlay:themeOverlay,close:'themeClose'},
  queueBtn:      {overlay:queueOverlay,close:'queueClose'},
};
Object.entries(panels).forEach(([btnId,{overlay,close}])=>{
  document.getElementById(btnId).addEventListener('click',()=>{
    overlay.classList.add('show');
    if(btnId==='queueBtn') renderQueue();
    closeSidebar();
  });
  document.getElementById(close).addEventListener('click',()=>overlay.classList.remove('show'));
  overlay.addEventListener('click',e=>{ if(e.target===overlay) overlay.classList.remove('show'); });
});

// ══════════════════════════════════════════════
//  CATEGORY NAV
// ══════════════════════════════════════════════
document.querySelectorAll('.nav-item[data-category]').forEach(item=>{
  item.addEventListener('click',()=>{
    document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));
    item.classList.add('active');
    activeCategory=item.dataset.category;
    pageTitleEl.textContent=catNames[activeCategory]||activeCategory;
    searchInput.value='';
    renderSongs();
    closeSidebar();
  });
});
searchInput.addEventListener('input',renderSongs);

// ══════════════════════════════════════════════
//  SIDEBAR
// ══════════════════════════════════════════════
function openSidebar(){  sidebar.classList.add('open');  backdrop.classList.add('show'); }
function closeSidebar(){ sidebar.classList.remove('open'); backdrop.classList.remove('show'); }
hamburger.addEventListener('click',e=>{ e.stopPropagation(); sidebar.classList.contains('open')?closeSidebar():openSidebar(); });
backdrop.addEventListener('click',closeSidebar);

// ══════════════════════════════════════════════
//  KEYBOARD
// ══════════════════════════════════════════════
document.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) return;
  if(e.code==='Space')     { e.preventDefault(); playBtn.click(); }
  if(e.code==='ArrowRight'){ audio.currentTime=Math.min(audio.currentTime+5,audio.duration||0); }
  if(e.code==='ArrowLeft') { audio.currentTime=Math.max(audio.currentTime-5,0); }
  if(e.code==='ArrowUp')   { audio.volume=Math.min(audio.volume+.1,1); volumeSlider.value=audio.volume; }
  if(e.code==='ArrowDown') { audio.volume=Math.max(audio.volume-.1,0); volumeSlider.value=audio.volume; }
  if(e.code==='KeyN') playNext();
  if(e.code==='KeyP') playPrev();
  if(e.code==='Escape'){ npOverlay.classList.remove('open'); stopVisualizer(); }
});

// ══════════════════════════════════════════════
//  DRAG & DROP
// ══════════════════════════════════════════════
document.addEventListener('dragover',e=>e.preventDefault());
document.addEventListener('drop',e=>{
  e.preventDefault();
  const files=Array.from(e.dataTransfer.files).filter(f=>f.type.startsWith('audio/')||f.name.toLowerCase().endsWith('.mp3'));
  if(!files.length) return;
  pendingFiles=files; pendingArtBlob=null;
  artPreview.innerHTML='🖼️ Add Album Art (optional)';
  modalDesc.textContent=files.length===1?`Category for "${files[0].name}"`:
    `Category for ${files.length} song(s).`;
  modalOverlay.classList.add('show');
});

// ══════════════════════════════════════════════
//  PWA — Install prompt
// ══════════════════════════════════════════════
let deferredPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault(); deferredPrompt=e;
  installBtn.style.display='block';
});
installBtn.addEventListener('click',async()=>{
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  const res=await deferredPrompt.userChoice;
  deferredPrompt=null; installBtn.style.display='none';
});
window.addEventListener('appinstalled',()=>{ installBtn.style.display='none'; });

// ══════════════════════════════════════════════
//  SERVICE WORKER (PWA offline)
// ══════════════════════════════════════════════
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/service-worker.js').then(reg => { console.log('[PWA] SW registered:', reg.scope); setInterval(() => reg.update(), 60000); }).catch(err => console.warn('[PWA] SW failed:', err));
}

// ══════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════
buildEQBands();
loadFromDB();
