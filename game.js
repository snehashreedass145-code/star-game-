/* game.js
   Starfall - simple polished falling objects game
   Controls: Left / Right arrows (or touch), Space to pause
   Place audio assets in assets/: collect.mp3, hit.mp3, bg-music.mp3
*/

(() => {
  // --- Config
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  let W = canvas.width;
  let H = canvas.height;
  // scaling for high-dpi
  function scaleCanvas(){
    const ratio = window.devicePixelRatio || 1;
    canvas.width = W * ratio;
    canvas.height = H * ratio;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  scaleCanvas();
  window.addEventListener('resize', () => {
    // keep canvas size fixed visually but adjust for layout
    const rect = canvas.getBoundingClientRect();
    W = Math.max(600, rect.width);
    H = Math.max(360, rect.height);
    scaleCanvas();
  });

  // --- DOM
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('startBtn');
  const gameOverEl = document.getElementById('gameOver');
  const restartBtn = document.getElementById('restartBtn');
  const scoreEl = document.getElementById('score');
  const highEl = document.getElementById('highscore');
  const finalScore = document.getElementById('finalScore');
  const finalHigh = document.getElementById('finalHigh');
  const muteBtn = document.getElementById('muteBtn');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const shareBtn = document.getElementById('shareBtn');

  // --- Audio
  const audio = {
    bg: new Audio('bg-music.mp3'),
    collect: new Audio('collect.wav'),
    hit: new Audio('hit.wav'),
  };
  audio.bg.loop = true;
  audio.bg.volume = 0.35;
  audio.collect.volume = 0.9;
  audio.hit.volume = 0.8;

  let muted = false;
  function setMuted(v){
    muted = v;
    for(const a of Object.values(audio)) a.muted = muted;
    muteBtn.textContent = muted ? '🔇 Muted' : '🔊 Music';
  }
  setMuted(false);

  muteBtn.addEventListener('click', () => setMuted(!muted));

  fullscreenBtn.addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch (e) { console.warn(e); }
  });

  shareBtn.addEventListener('click', async () => {
    const url = location.href;
    try {
      await navigator.clipboard.writeText(url);
      shareBtn.textContent = 'Copied!';
      setTimeout(()=> shareBtn.textContent = 'Copy play link', 1400);
    } catch(e) {
      alert('Copy link: ' + url);
    }
  });

  // --- Game state
  let state = 'menu'; // 'running', 'paused', 'over'
  let score = 0;
  let highscore = parseInt(localStorage.getItem('starfall-high') || '0', 10);
  highEl.textContent = highscore;

  // Player
  const player = {
    x: 460,
    y: 540,
    w: 72,
    h: 18,
    speed: 420,
    color: '#7dd3fc',
    vx: 0
  };

  // Input
  const keys = { left:false, right:false, space:false };
  window.addEventListener('keydown', e => {
    if (e.code === 'ArrowLeft') keys.left = true;
    if (e.code === 'ArrowRight') keys.right = true;
    if (e.code === 'Space') {
      e.preventDefault();
      if (state === 'running') togglePause();
      else if (state === 'menu') startGame();
    }
  });
  window.addEventListener('keyup', e => {
    if (e.code === 'ArrowLeft') keys.left = false;
    if (e.code === 'ArrowRight') keys.right = false;
  });

  // Touch support
  let touchX = null;
  canvas.addEventListener('touchstart', (ev) => {
    ev.preventDefault();
    const t = ev.touches[0];
    touchX = t.clientX;
  }, {passive:false});
  canvas.addEventListener('touchmove', (ev) => {
    ev.preventDefault();
    const t = ev.touches[0];
    touchX = t.clientX;
  }, {passive:false});
  canvas.addEventListener('touchend', (ev) => {
    touchX = null;
  });

  // Falling entities
  const stars = [];
  const meteors = [];
  let spawnTimer = 0;
  let spawnInterval = 900; // ms
  let difficultyTimer = 0;

  function spawnEntity(){
    // random x
    const x = Math.random() * (W - 40) + 20;
    // 70% star, 30% meteor
    if (Math.random() < 0.68) {
      stars.push({
        x, y: -20, r: 12 + Math.random()*10,
        vy: 140 + Math.random()*180,
        wobble: Math.random()*Math.PI*2,
      });
    } else {
      meteors.push({
        x, y: -60, r: 18 + Math.random()*18,
        vy: 200 + Math.random()*260 + score*1.2,
        rot: Math.random()*Math.PI,
        vr: (Math.random()-0.5)*3
      });
    }
  }

  // Helpers
  function rectOverlap(ax,ay,aw,ah,bx,by,br){
    // circle (b) vs rect (a)
    const cx = Math.max(ax, Math.min(bx, ax+aw));
    const cy = Math.max(ay, Math.min(by, ay+ah));
    const dx = bx - cx;
    const dy = by - cy;
    return (dx*dx + dy*dy) < (br*br);
  }

  // Game flow
  function startGame(){
    // reset
    score = 0;
    scoreEl.textContent = score;
    stars.length = 0;
    meteors.length = 0;
    spawnTimer = 0;
    spawnInterval = 900;
    difficultyTimer = 0;
    state = 'running';
    overlay.classList.remove('visible');
    gameOverEl.classList.remove('visible');
    audio.bg.play().catch(()=>{/* autoplay blocked; user can press play */});
    lastTime = performance.now();
    loop(lastTime);
  }

  function gameOver(){
    state = 'over';
    audio.bg.pause();
    audio.hit.currentTime = 0; if (!muted) audio.hit.play().catch(()=>{});
    if (score > highscore) {
      highscore = score;
      localStorage.setItem('starfall-high', highscore);
      highEl.textContent = highscore;
    }
    finalScore.textContent = score;
    finalHigh.textContent = highscore;
    gameOverEl.classList.add('visible');
  }

  restartBtn.addEventListener('click', startGame);
  startBtn.addEventListener('click', startGame);

  // Pause
  function togglePause(){
    if (state !== 'running') return;
    state = 'paused';
    overlay.querySelector('.overlay-card h2').textContent = 'Paused';
    overlay.querySelector('.overlay-card .lead').textContent = 'Press Space to resume';
    overlay.classList.add('visible');
  }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && state === 'paused') {
      overlay.classList.remove('visible');
      state = 'running';
      lastTime = performance.now();
      loop(lastTime);
    }
  });

  // Main loop
  let lastTime = 0;
  function loop(now){
    if (state !== 'running') return;
    const dt = Math.min(40, now - lastTime) / 1000; // seconds
    update(dt);
    render();
    lastTime = now;
    requestAnimationFrame(loop);
  }

  // Update
  function update(dt){
    // input
    const left = keys.left;
    const right = keys.right;
    if (touchX !== null){
      const rect = canvas.getBoundingClientRect();
      const tx = touchX - rect.left;
      if (tx < player.x + player.w/2 - 6) player.vx = -player.speed;
      else if (tx > player.x + player.w/2 + 6) player.vx = player.speed;
      else player.vx = 0;
    } else {
      player.vx = (right?1:0) * player.speed - (left?1:0) * player.speed;
    }

    player.x += player.vx * dt;
    player.x = Math.max(6, Math.min(W - player.w - 6, player.x));

    // spawn logic
    spawnTimer += dt*1000;
    difficultyTimer += dt*1000;
    if (difficultyTimer > 8000 && spawnInterval > 380) {
      spawnInterval -= 80;
      difficultyTimer = 0;
    }
    if (spawnTimer > spawnInterval) {
      spawnEntity();
      spawnTimer = 0;
    }

    // update stars
    for (let i = stars.length - 1; i >= 0; i--) {
      const s = stars[i];
      s.y += s.vy * dt;
      s.wobble += dt * 3;
      s.x += Math.sin(s.wobble) * 12 * dt;
      if (s.y - s.r > H + 40) stars.splice(i,1);
      else {
        if (rectOverlap(player.x, player.y, player.w, player.h, s.x, s.y, s.r)) {
          // collect
          stars.splice(i,1);
          score += 10;
          scoreEl.textContent = score;
          audio.collect.currentTime = 0;
          if (!muted) audio.collect.play().catch(()=>{});
        }
      }
    }

    // update meteors
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.y += m.vy * dt;
      m.rot += m.vr * dt;
      if (m.y - m.r > H + 80) meteors.splice(i,1);
      else {
        if (rectOverlap(player.x, player.y, player.w, player.h, m.x, m.y, m.r)) {
          // hit
          gameOver();
          return;
        }
      }
    }
  }

  // Render
  function drawRoundedRect(x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
  }

  function render(){
    // background
    ctx.fillStyle = '#041428';
    ctx.fillRect(0,0,W,H);

    // subtle stars background
    for (let i=0;i<60;i++){
      const px = (i*77)%W;
      const py = (i*47)%H;
      ctx.fillStyle = 'rgba(255,255,255,0.02)';
      ctx.fillRect(px,py,1.2,1.2);
    }

    // draw player (rounded bar)
    ctx.save();
    ctx.fillStyle = 'linear-gradient(0deg,#7dd3fc,#6ee7b7)';
    // subtle glow
    ctx.shadowColor = 'rgba(125,211,252,0.12)';
    ctx.shadowBlur = 20;
    drawRoundedRect(player.x, player.y, player.w, player.h, 8);
    ctx.fillStyle = '#7dd3fc';
    ctx.fill();
    ctx.restore();

    // draw stars
    for (const s of stars) {
      ctx.save();
      ctx.translate(s.x, s.y);
      // star shape
      ctx.beginPath();
      for (let i=0;i<5;i++){
        const a = i * Math.PI * 2 / 5 - Math.PI/2;
        const r1 = s.r;
        const r2 = s.r * 0.5;
        ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
        ctx.lineTo(Math.cos(a + Math.PI/5) * r2, Math.sin(a + Math.PI/5) * r2);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,240,130,0.98)';
      ctx.shadowBlur = 18;
      ctx.shadowColor = 'rgba(255,226,120,0.5)';
      ctx.fill();
      ctx.restore();
    }

    // draw meteors
    for (const m of meteors) {
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.rot);
      ctx.beginPath();
      ctx.arc(0,0,m.r,0,Math.PI*2);
      ctx.fillStyle = '#e07a5f';
      ctx.shadowBlur = 30;
      ctx.shadowColor = 'rgba(224,122,95,0.6)';
      ctx.fill();
      // tail
      ctx.globalAlpha = 0.6;
      ctx.fillRect(-m.r*3, m.r*0.4, m.r*2.6, m.r*0.9);
      ctx.restore();
    }

    // score back panel (drawn on canvas for sheen)
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    ctx.fillRect(8,8,160,46);
    ctx.restore();
  }

  // initial canvas size adapt
  (function initCanvasSize(){
    const rect = canvas.getBoundingClientRect();
    W = rect.width || canvas.width;
    H = rect.height || canvas.height;
    scaleCanvas();
  })();

  // show menu by default
  overlay.classList.add('visible');

  // Play background when user interacts (some browsers block autoplay)
  function resumeAudioOnInteraction(){
    audio.bg.play().catch(()=>{});
    window.removeEventListener('pointerdown', resumeAudioOnInteraction);
    window.removeEventListener('keydown', resumeAudioOnInteraction);
  }
  window.addEventListener('pointerdown', resumeAudioOnInteraction);
  window.addEventListener('keydown', resumeAudioOnInteraction);

  // simple animation while on menu
  let menuAnim = 0;
  function menuLoop(t){
    if (state === 'menu') {
      menuAnim += t * 0.001;
      // draw a faint preview to the canvas
      ctx.clearRect(0,0,W,H);
      // soft gradient
      ctx.fillStyle = 'linear-gradient(180deg,#071428,#041223)';
      ctx.fillRect(0,0,W,H);
      // draw a few floating stars
      for (let i=0;i<12;i++){
        const x = 100 + (Math.sin(menuAnim*0.6 + i)*0.5 + 0.5) * (W - 220);
        const y = 60 + (i*33)%H;
        ctx.beginPath();
        ctx.arc(x,y, 8 + (i%3),0,Math.PI*2);
        ctx.fillStyle = 'rgba(255,238,160,0.06)';
        ctx.fill();
      }
    }
    requestAnimationFrame(menuLoop);
  }
  requestAnimationFrame(menuLoop);

  // expose small debug
  window.__starfall = { startGame, gameOver, audio };

})();
