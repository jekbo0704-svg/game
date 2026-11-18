/* =========================================================
   Қазақ даласының қорғаны — интерфейс, тапсырмалар, админ
   Барлық мәтін textContent арқылы шығады (XSS-тен қорғау)
   ========================================================= */
'use strict';

/* ---------- көмекші функциялар ---------- */
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'attrs') for (const [a, b] of Object.entries(v)) el.setAttribute(a, b);
    else el[k] = v;
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  return el;
}
const $ = id => document.getElementById(id);
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* сақтау мүмкін емес */ } }
};
const sess = {
  get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (e) { } }
};
const fmtTime = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
const stars = (n, max = 3) => '★'.repeat(n) + '☆'.repeat(max - n);
const difficulty = s => STAGES[s - 1].boss ? 'BOSS' : '★'.repeat(Math.ceil(s / 2));
const normalize = s => String(s).toLowerCase().replace(/i/g, 'і').replace(/[\s.,!?«»"'’\-–—()]/g, '');
const hexColor = c => '#' + c.toString(16).padStart(6, '0');
const initials = name => name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const livesFor = c => Math.floor(c / CORRECT_PER_LIFE);

// questions.js-те синтаксис қатесі болса (үтір/жақша), ойын ақ экранмен құламай, сұрақсыз ашылады
if (typeof QUESTIONS === 'undefined') {
  window.QUESTIONS = [];
  window.QUESTION_ERRORS = ['questions.js файлында синтаксис қатесі бар (үтір, жақша немесе тырнақша). F12 → Console-да жол нөмірі жазылған.'];
  console.error(QUESTION_ERRORS[0]);
}

const ADMIN_PIN = '1465';   // демо PIN. 3-аптада сервер жағындағы рөлмен ауыстырылады
const TYPE_NAME = { one: '① Бір дұрыс жауап', match: '② Сәйкестендіру', order: '③ Хронологиялық рет', fill: '⑥ Бос орынды толтыру' };

const APP = {
  game: null, scene: null, ready: false,
  user: store.get('kdq_user', null),
  progress: { maxCleared: 0, stars: {}, fails: {}, blessing: {} },   // loadUser() әр ойыншыға бөлек жүктейді
  wrong: {},
  heroIdx: 0,
  run: null,
  modalOpen: false,
  admin: sess.get('kdq_admin') === '1',
  adminGod: false, adminShowAnswers: false, quizOverride: 0,
  godThreshold: Number(store.get('kdq_god_th', GOD_HELP_AFTER)) || GOD_HELP_AFTER,
  unlockAll: store.get('kdq_unlock_all', false),
  pinFails: 0, pinLockUntil: 0,

  // прогресс әр ойыншы атына бөлек сақталады (шығып, басқа атпен кірсең — жаңа прогресс)
  userKey(k) { return k + ':' + (this.user ? String(this.user.name).trim().toLowerCase() : '_guest'); },
  loadUser(migrate) {
    if (CLOUD.on) { if (!this.user) { this.progress = { maxCleared: 0, stars: {}, fails: {}, blessing: {} }; this.wrong = {}; } return; }   // серверден onCloudUser жүктейді
    const key = this.userKey('kdq_progress');
    // ескі нұсқадағы ортақ прогресті қазір кірген ойыншыға бір рет көшіру
    if (migrate && this.user && store.get(key, null) == null && store.get('kdq_progress', null)) {
      store.set(key, store.get('kdq_progress', {})); store.set(this.userKey('kdq_wrong'), store.get('kdq_wrong', {}));
      try { localStorage.removeItem('kdq_progress'); localStorage.removeItem('kdq_wrong'); } catch (e) { }
    }
    this.progress = Object.assign({ maxCleared: 0, stars: {}, fails: {}, blessing: {} }, store.get(key, {}));
    this.wrong = store.get(this.userKey('kdq_wrong'), {});
  },
  saveProgress() { if (CLOUD.on) CLOUD.save({ progress: this.progress }); else store.set(this.userKey('kdq_progress'), this.progress); },
  saveWrong() { if (CLOUD.on) CLOUD.save({ wrong: this.wrong }); else store.set(this.userKey('kdq_wrong'), this.wrong); },

  /* ================= МУЗЫКА =================
     HTML5 Audio: file:// арқылы да жұмыс істейді. Браузер дыбысты тек
     пайдаланушы бірінші рет басқаннан кейін ғана ойнатады, сондықтан
     музыка алғашқы басудан/пернеден кейін басталады.                   */
  music: {
    tracks: {}, want: null, unlocked: false, duck: 1,
    muted: !!store.get('kdq_muted', false),
    vol: Math.min(1, Math.max(0, Number(store.get('kdq_vol', (typeof MUSIC !== 'undefined' ? MUSIC.volume : 0.5))))),
    init() {
      if (typeof MUSIC === 'undefined') return;
      ['menu', 'game'].forEach(k => {
        if (!MUSIC[k]) return;
        const a = new Audio(); a.loop = true; a.preload = 'auto'; a.volume = 0;
        a.addEventListener('error', () => { a._bad = true; });
        a.src = MUSIC[k]; this.tracks[k] = a;
      });
      const unlock = () => { this.unlocked = true; this.apply(); };
      window.addEventListener('pointerdown', unlock, true);
      window.addEventListener('keydown', unlock, true);
      setInterval(() => this.tick(), 50);
    },
    play(k, restart) {
      if (this.want === k && !restart) return;
      this.want = k;
      const a = this.tracks[k];
      if (a && restart && a.paused) { try { a.currentTime = 0; } catch (e) { } }
      this.apply();
    },
    apply() {
      if (!this.unlocked || this.muted) return;
      const a = this.tracks[this.want];
      if (a && !a._bad && a.paused) { const p = a.play(); if (p && p.catch) p.catch(() => { }); }
    },
    tick() {
      const duck = typeof MUSIC !== 'undefined' && this.duck < 1 ? MUSIC.duck : 1;
      Object.entries(this.tracks).forEach(([k, a]) => {
        if (a._bad) return;
        const target = (k === this.want && !this.muted && this.unlocked) ? this.vol * duck : 0;
        const v = a.volume, step = 0.04;
        a.volume = Math.abs(target - v) <= step ? target : v + Math.sign(target - v) * step;
        if (target === 0 && a.volume === 0 && !a.paused) a.pause();
        if (target > 0 && a.paused) { const p = a.play(); if (p && p.catch) p.catch(() => { }); }
      });
    }
  },

  /* ================= ДЫБЫС ЭФФЕКТІЛЕРІ =================
     Web Audio арқылы кодпен жасалады (файл керек емес). Деңгейі музыкадан бөлек. */
  sfx: {
    ctx: null, out: null, last: {}, nbuf: null,
    vol: Math.min(1, Math.max(0, Number(store.get('kdq_sfx', 0.6)))),
    init() {
      const unlock = () => {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        this.ctx = new AC(); this.out = this.ctx.createGain(); this.out.connect(this.ctx.destination); this.setVol();
      };
      window.addEventListener('pointerdown', unlock, true);
      window.addEventListener('keydown', unlock, true);
    },
    setVol() { if (this.out) this.out.gain.value = APP.music.muted ? 0 : this.vol * 0.7; },
    tone(type, f1, f2, dur, vol, delay) {
      const c = this.ctx, t0 = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f1, t0); o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(this.out); o.start(t0); o.stop(t0 + dur + 0.03);
    },
    noise(dur, vol, fFrom, fTo, ftype) {
      const c = this.ctx, t0 = c.currentTime;
      if (!this.nbuf) { this.nbuf = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = this.nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.nbuf; f.type = ftype || 'lowpass';
      f.frequency.setValueAtTime(fFrom, t0); f.frequency.exponentialRampToValueAtTime(Math.max(20, fTo), t0 + dur);
      g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      s.connect(f); f.connect(g); g.connect(this.out); s.start(t0); s.stop(t0 + dur + 0.03);
    },
    play(name) {
      if (!this.ctx || this.ctx.state !== 'running' || this.vol <= 0 || APP.music.muted) return;
      const now = performance.now(), gap = { kill: 45, gem: 30, hurt: 200, levelup: 300 }[name] || 80;
      if (now - (this.last[name] || 0) < gap) return;
      this.last[name] = now;
      switch (name) {
        case 'kill': this.tone('square', 320, 90, 0.09, 0.18); this.noise(0.06, 0.12, 2200, 400); break;
        case 'gem': { this.streak = now - (this.gemAt || 0) < 400 ? Math.min((this.streak || 0) + 1, 12) : 0; this.gemAt = now;
          const k = Math.pow(1.06, this.streak); this.tone('sine', 880 * k, 1320 * k, 0.07, 0.16); break; }
        case 'hurt': this.tone('sawtooth', 220, 70, 0.25, 0.3); break;
        case 'levelup': [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.14, 0.2, i * 0.07)); break;
        case 'pickup': this.tone('triangle', 600, 1200, 0.15, 0.22); break;
        case 'zone': [392, 523, 784].forEach((f, i) => this.tone('sine', f, f, 0.18, 0.2, i * 0.08)); break;
        case 'w_arrow': case 'w_spread': this.noise(0.08, 0.16, 4000, 1500, 'bandpass'); break;
        case 'w_lance': case 'w_aibalta': case 'w_burkit': this.noise(0.14, 0.18, 1800, 500, 'bandpass'); break;
        case 'w_nova': this.tone('sine', 160, 60, 0.3, 0.26); this.noise(0.2, 0.1, 800, 200); break;
        case 'w_qamshy': this.noise(0.05, 0.28, 6000, 3000, 'highpass'); this.tone('square', 1400, 900, 0.03, 0.1); break;
        case 'w_naizagai': this.noise(0.25, 0.3, 3000, 200); this.tone('sawtooth', 90, 40, 0.3, 0.16); break;
        case 'w_ort': this.noise(0.12, 0.07, 1200, 600); break;
      }
    }
  },

  toggleMute() {
    this.music.muted = !this.music.muted; store.set('kdq_muted', this.music.muted);
    this.music.apply(); this.sfx.setVol(); this.refreshSound();
  },
  setVolume(v) {
    this.music.vol = Math.min(1, Math.max(0, v)); store.set('kdq_vol', this.music.vol);
    if (this.music.vol > 0 && this.music.muted) { this.music.muted = false; store.set('kdq_muted', false); }
    this.music.apply(); this.sfx.setVol(); this.refreshSound();
  },
  setSfxVolume(v) {
    this.sfx.vol = Math.min(1, Math.max(0, v)); store.set('kdq_sfx', this.sfx.vol);
    if (this.sfx.vol > 0 && this.music.muted) { this.music.muted = false; store.set('kdq_muted', false); this.music.apply(); }
    this.sfx.setVol(); this.refreshSound(); this.sfx.play('gem');
  },
  refreshSound() {
    document.querySelectorAll('.vol-row input[type=range]').forEach(r => r.dispatchEvent(new Event('sync')));
    const b = $('sound'); if (!b) return;
    const off = this.music.muted || (this.music.vol === 0 && this.sfx.vol === 0);
    b.textContent = off ? '🔇' : '🔊'; b.classList.toggle('off', off);
    b.setAttribute('aria-label', off ? 'Дыбысты қосу (M)' : 'Дыбысты өшіру (M)'); b.title = b.getAttribute('aria-label');
  },
  slider(id, label, get, set) {
    const icon = h('button', { class: 'vol-icon', type: 'button' }), pct = h('b', { class: 'vol-pct' });
    const r = h('input', { id, type: 'range', min: 0, max: 100, step: 5, value: Math.round(get() * 100), attrs: { 'aria-label': label } });
    const paint = () => { const v = Number(r.value); r.style.setProperty('--p', v + '%'); pct.textContent = v + '%'; icon.textContent = v === 0 ? '🔇' : v < 50 ? '🔉' : '🔊'; icon.title = v === 0 ? 'Қосу' : 'Өшіру'; };
    r.addEventListener('input', () => { set(r.value / 100); paint(); });
    r.addEventListener('sync', () => { r.value = Math.round(get() * 100); paint(); });
    icon.addEventListener('click', () => { if (Number(r.value) > 0) { r.dataset.prev = r.value; set(0); } else set((Number(r.dataset.prev) || 50) / 100); r.value = Math.round(get() * 100); paint(); });
    paint();
    return h('div', { class: 'vol-row' },
      h('div', { class: 'vol-head' }, h('span', { text: label }), pct),
      h('div', { class: 'vol-ctl' }, icon, h('span', { class: 'vol-min', text: '−' }), r, h('span', { class: 'vol-min', text: '+' })));
  },
  volumeRow() {
    return h('div', { class: 'vol-box' },
      this.slider('vol', '🎵 Музыка', () => this.music.muted ? 0 : this.music.vol, v => this.setVolume(v)),
      this.slider('sfxvol', '🔔 Дыбыс эффектілері', () => this.music.muted ? 0 : this.sfx.vol, v => this.setSfxVolume(v)));
  },

  /* ================= ІСКЕ ҚОСУ ================= */
  init() {
    // CANVAS рендер: index.html файлды екі рет басып ашқанда (file://) фотолар WebGL-де бұғатталады
    this.game = new Phaser.Game({
      type: Phaser.CANVAS, parent: 'game-root', backgroundColor: '#14202a',
      scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
      physics: { default: 'arcade', arcade: { debug: false } },
      scene: [BootScene, StageScene]
    });
    this.loadPhotos();
    this.music.init();
    this.sfx.init();
    $('sound').addEventListener('click', () => this.toggleMute());
    this.refreshSound();
    let clicks = [];
    $('logo').addEventListener('click', () => {
      if (this.admin) { this.toggleAdmin(); return; }
      const now = Date.now(); clicks = clicks.filter(t => now - t < 4000); clicks.push(now);
      if (clicks.length >= 5) { clicks = []; this.askPin(); }
    });
    $('h-pause').addEventListener('click', () => this.pauseMenu());
    $('ability-btn').addEventListener('click', () => this.scene && this.scene.useAbility());
    window.addEventListener('keydown', e => {
      if (/^[mMьЬ]$/.test(e.key) && !/INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) { this.toggleMute(); return; }
      if (e.key === 'Escape') {
        if (!$('admin').hidden) { this.toggleAdmin(false); return; }
        if (this.scene && !this.modalOpen && !this.scene.ended && !this.scene.dead) this.pauseMenu();
      }
      if (this.levelChoices && ['1', '2', '3'].includes(e.key)) { const b = document.querySelectorAll('.lvl-card')[Number(e.key) - 1]; if (b) b.click(); }
    });
    if (QUESTION_ERRORS.length) setTimeout(() => this.toast(QUESTIONS.length ? 'Сұрақтар базасында ' + QUESTION_ERRORS.length + ' қате бар (F12 → Console)' : '⚠ ' + QUESTION_ERRORS[0]), 800);
    this.refreshAdminBadge();
    if (CLOUD.init()) {            // сайтта (Firebase Hosting): Google арқылы кіру
      this.user = null; this.admin = false; sess.set('kdq_admin', null); this.refreshAdminBadge();
      this.showLoading();
      CLOUD.onUser(u => this.onCloudUser(u));
      return;
    }
    this.loadUser(true);           // компьютерде файл ретінде: демо режим
    this.user ? this.showMenu() : this.showLogin();
  },

  showLoading(msg) {
    this.screen(h('div', { class: 'center-card' },
      h('div', { class: 'eyebrow', text: 'GAME HUB CYB26-01' }),
      h('h1', { class: 'title', text: 'Қазақ даласының қорғаны' }),
      h('p', { class: 'muted', text: msg || 'Жүктелуде…' })));
  },

  async onCloudUser(u) {
    if (!u) { this.user = null; this.admin = false; this.refreshAdminBadge(); this.loadUser(); this.showLogin(); return; }
    if (this.user && this.user.uid === u.uid) return;
    this.showLoading('Профиль жүктелуде…');
    try {
      const d = await CLOUD.load(u);
      this.user = { name: d.name, email: d.email, uid: u.uid, mode: 'google' };
      this.progress = Object.assign({ maxCleared: 0, stars: {}, fails: {}, blessing: {} }, d.progress);
      ['stars', 'fails', 'blessing'].forEach(k => { if (!this.progress[k] || typeof this.progress[k] !== 'object') this.progress[k] = {}; });
      this.wrong = d.wrong || {};
      this.admin = false; this.refreshAdminBadge();
      this.showMenu();
    } catch (e) {
      console.error('Профиль жүктелмеді:', e);
      this.screen(h('div', { class: 'center-card' },
        h('h1', { class: 'title', text: 'Қазақ даласының қорғаны' }),
        h('div', { class: 'err', text: 'Серверге қосылу мүмкін болмады. Интернетті тексеріп, қайта көріңіз.' }),
        h('button', { class: 'btn gold wide', text: 'Қайта көру', onclick: () => this.onCloudUser(u) }),
        h('button', { class: 'btn ghost wide', text: 'Шығу', onclick: () => this.logout() })));
    }
  },

  authError(e) {
    const c = (e && e.code) || '';
    if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return 'Кіру терезесі жабылды. Қайта басыңыз.';
    if (c === 'auth/unauthorized-domain') return 'Бұл сайт Firebase-те рұқсат етілмеген (Authorized domains).';
    if (c === 'auth/network-request-failed') return 'Интернет байланысы жоқ.';
    if (c === 'auth/too-many-requests') return 'Тым көп әрекет. Біраз күтіп, қайта көріңіз.';
    return 'Кіру сәтсіз аяқталды' + (c ? ' (' + c + ')' : '') + '.';
  },

  logout() {
    this.admin = false; this.adminGod = false; sess.set('kdq_admin', null); this.refreshAdminBadge(); $('admin').hidden = true;
    if (CLOUD.on) { this.user = null; this.showLoading('Шығу…'); CLOUD.signOut().catch(() => this.showLogin()); return; }
    this.user = null; store.set('kdq_user', null); this.loadUser(); this.showLogin();
  },
  engineReady() { this.ready = true; },

  // кейіпкер фотолары: img/heroes/<id>.jpg
  loadPhotos() {
    HEROES.forEach(hero => {
      hero._img = null; hero._photoOk = false;
      if (!hero.photo) return;
      const img = new Image();
      img.onload = () => { hero._img = img; hero._photoOk = true; };
      img.onerror = () => { hero._photoOk = false; };
      img.src = hero.photo;
    });
  },

  heroPhoto(hero, cls) {
    const box = h('div', { class: 'photo ' + (cls || ''), style: 'background:' + hexColor(hero.color) });
    const fallback = h('span', { class: 'ini', text: initials(hero.name) });
    box.appendChild(fallback);
    if (hero.photo) {
      const img = h('img', { alt: hero.name, src: hero.photo, onerror: () => img.remove(), onload: () => fallback.remove() });
      box.appendChild(img);
    }
    return box;
  },

  /* ================= ЭКРАНДАР ================= */
  screen(...nodes) {
    this.closeModal(true);           // «Кезең аяқталды» терезесі қатып қалмауы үшін
    this.leaveGame();
    $('toasts').textContent = '';
    this._scr = (this._scr || 0) + 1;
    const s = $('screen'); s.textContent = ''; s.hidden = false;
    this.music.play('menu');
    nodes.forEach(n => s.appendChild(n));
    s.scrollTop = 0;
  },
  leaveGame() {
    if (this.scene) { this.game.scene.stop('stage'); this.scene = null; }
    ['hud', 'ability-btn', 'xpbar', 'bossbar', 'minimap', 'wlist', 'zonebar', 'poison'].forEach(id => $(id).hidden = true);
  },

  showLogin(msg) {
    if (CLOUD.on) {
      const err = h('div', { class: 'err', text: msg || '' });
      let busy = false;
      const go = async () => {
        if (busy) return; busy = true; err.textContent = '';
        try { await CLOUD.signIn(); } catch (e) { err.textContent = this.authError(e); }
        busy = false;
      };
      this.screen(h('div', { class: 'center-card' },
        h('div', { class: 'eyebrow', text: 'GAME HUB CYB26-01 · Қазақстан тарихы' }),
        h('h1', { class: 'title', text: 'Қазақ даласының қорғаны' }),
        h('p', { class: 'muted', text: 'Survival · 10 дәуір · 10 кейіпкер' }),
        h('button', { class: 'btn google on wide', onclick: go }, h('b', { text: 'G' }), ' Google арқылы кіру'),
        err,
        h('div', { class: 'note', text: 'Нәтижелерің мен прогресің серверде сақталады. Рейтингте тек атың көрінеді, email ешкімге көрсетілмейді.' })));
      return;
    }
    const name = h('input', { id: 'login-name', type: 'text', maxLength: 24, placeholder: 'Аты-жөніңіз', autocomplete: 'off' });
    const err = h('div', { class: 'err' });
    const go = () => {
      const v = name.value.trim();
      if (!/^[\p{L}\p{N} .\-]{2,24}$/u.test(v)) { err.textContent = 'Атыңызды 2–24 әріппен жазыңыз (әріп, сан, бос орын, нүкте, сызықша).'; return; }
      this.user = { name: v, mode: 'demo' }; store.set('kdq_user', this.user); this.loadUser(); this.showMenu();
    };
    name.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    this.screen(h('div', { class: 'center-card' },
      h('div', { class: 'eyebrow', text: 'GAME HUB CYB26-01 · Қазақстан тарихы' }),
      h('h1', { class: 'title', text: 'Қазақ даласының қорғаны' }),
      h('p', { class: 'muted', text: 'Survival · 10 дәуір · 10 кейіпкер' }),
      h('button', { class: 'btn google', disabled: true }, h('b', { text: 'G' }), ' Google арқылы кіру'),
      h('div', { class: 'note', text: 'Google арқылы кіру тек сайтта (Firebase Hosting) жұмыс істейді. Компьютерде файл ретінде ашқанда — демо режим: атыңызды жазыңыз.' }),
      h('label', { class: 'lbl', htmlFor: 'login-name', text: 'Демо режимде кіру' }), name, err,
      h('button', { class: 'btn gold wide', text: 'Кіру', onclick: go })
    ));
    setTimeout(() => name.focus(), 50);
  },

  showMenu() {
    this.screen(h('div', { class: 'center-card' },
      h('div', { class: 'eyebrow', text: 'GAME HUB CYB26-01' }),
      h('h1', { class: 'title', text: 'Қазақ даласының қорғаны' }),
      h('p', { class: 'muted', text: 'Сәлем, ' + this.user.name + '! Өткен кезең: ' + this.progress.maxCleared + '/10' }),
      this.user.email ? h('div', { class: 'note', text: 'Google: ' + this.user.email }) : null,
      h('div', { class: 'menu' },
        h('button', { class: 'btn gold wide', text: 'Ойнау', onclick: () => this.showHeroes() }),
        h('button', { class: 'btn wide', text: 'Рейтинг', onclick: () => this.showLeaderboard() }),
        h('button', { class: 'btn wide', text: 'Нәтижелерім', onclick: () => this.showResults() }),
        h('button', { class: 'btn wide', text: 'Қалай ойнаймын?', onclick: () => this.showHowTo() }),
        h('button', { class: 'btn ghost wide', text: 'Шығу', onclick: () => this.logout() }),
        this.volumeRow()
      )
    ));
  },

  showHowTo() {
    const rows = [
      ['Қозғалу', 'W A S D немесе ← ↑ → ↓ · телефонда экранды басып ұстау'],
      ['Шабуыл', 'Кейіпкер өзі автоматты түрде атады — сен тек жүресің'],
      ['Арнайы қабілет', 'Пробел немесе экрандағы қабілет батырмасы'],
      ['Тәжірибе', 'Жау өлгенде көк кристалл түседі. Деңгей көтерілгенде 3 жақсартудың бірін таңда (1, 2, 3 пернелері)'],
      ['Мақсат', '3 артефакт жина және ' + fmtTime(STAGE_TIME) + ' тірі қал → қақпа ашылады → қақпаға жет. 5- және 10-кезеңде боссты жең'],
      ['Жан біткенде', QUIZ_COUNT + ' тарихи сұрақ: 3 дұрыс = 1 жан, 6 = 2 жан, 9 = 3 жан'],
      ['Таймер', '1–2 кезең 30 сек → 3–4: 25 → 5–6: 20 → 7–8: 15 → 9–10: 10 сек (әр сұраққа)'],
      ['Құдайдан көмек', this.godThreshold + ' рет жеңілсең, тарих рухы бонус ұсынады'],
      ['Пауза', 'Esc немесе ‖ батырмасы']
    ];
    this.screen(h('div', { class: 'page' },
      this.backBtn(() => this.showMenu()),
      h('h2', { text: 'Қалай ойнаймын?' }),
      h('div', { class: 'tbl' }, h('table', null, h('tbody', null, rows.map(r => h('tr', null, h('th', { text: r[0] }), h('td', { class: 'wrap', text: r[1] }))))))
    ));
  },

  backBtn(fn, label) { return h('button', { class: 'btn ghost back', text: '← ' + (label || 'Артқа'), onclick: fn }); },

  unlocked() { return this.unlockAll && (!CLOUD.on || this.admin); },   // сайтта тек админге
  heroUnlocked(hero) { return this.unlocked() || hero.unlock === 0 || this.progress.maxCleared >= hero.unlock; },
  stageUnlocked(s) { return this.unlocked() || s <= this.progress.maxCleared + 1; },

  showHeroes() {
    const bar = v => h('span', { class: 'bar' }, [1, 2, 3, 4, 5].map(i => h('i', { class: i <= v ? 'on' : '' })));
    const grid = h('div', { class: 'grid' });
    HEROES.forEach((hero, i) => {
      const ok = this.heroUnlocked(hero);
      grid.appendChild(h('button', { class: 'hero' + (ok ? '' : ' locked') + (i === this.heroIdx ? ' sel' : ''), disabled: !ok, onclick: () => { this.heroIdx = i; this.showStages(); } },
        this.heroPhoto(hero, 'big'),
        h('div', { class: 'hero-body' },
          h('b', { class: 'hname', text: hero.name }), h('small', { class: 'era', text: hero.era }),
          h('p', { text: hero.life }),
          h('div', { class: 'stats' }, h('span', { text: 'Жылдамдық' }), bar(hero.sp), h('span', { text: 'Қорғаныс' }), bar(hero.df)),
          h('div', { class: 'kv' }, h('em', { text: 'Қару: ' }), hero.weaponName + ' — ' + WEAPONS[hero.weapon].desc.toLowerCase()),
          h('div', { class: 'kv' }, h('em', { text: 'Пробел: ' }), hero.abilityName + ' — ' + hero.abilityText.toLowerCase()),
          h('div', { class: 'kv' }, h('em', { text: 'Бонус: ' }), hero.bonusText),
          h('div', { class: 'lock', text: ok ? 'Таңдау →' : '🔒 ' + hero.unlock + '-кезеңді өткенде ашылады' }))
      ));
    });
    this.screen(h('div', { class: 'page' }, this.backBtn(() => this.showMenu()), h('h2', { text: 'Кейіпкер таңда' }), grid));
  },

  showStages() {
    const hero = HEROES[this.heroIdx];
    const list = h('div', { class: 'stages' });
    STAGES.forEach((st, i) => {
      const s = i + 1, ok = this.stageUnlocked(s), got = this.progress.stars[s] || 0, fails = this.progress.fails[s] || 0;
      list.appendChild(h('button', { class: 'stage' + (ok ? '' : ' locked') + (st.boss ? ' boss' : ''), disabled: !ok, onclick: () => this.showBriefing(s) },
        h('span', { class: 'num', text: s }),
        h('div', { class: 'st-body' }, h('b', { text: st.name }), h('small', { text: st.years + ' · сұрақ таймері ' + QUIZ_TIME[i] + ' сек' + (st.boss ? ' · босс: ' + st.bossName : '') })),
        h('div', { class: 'st-right' }, h('span', { class: 'diff', text: difficulty(s) }), h('span', { class: 'got', text: ok ? stars(got) : '🔒' }), fails ? h('small', { text: 'Сәтсіз: ' + fails }) : null)
      ));
    });
    this.screen(h('div', { class: 'page' },
      h('div', { class: 'row-head' }, this.backBtn(() => this.showHeroes(), 'Кейіпкерлер'), h('div', { class: 'chosen' }, this.heroPhoto(hero, 'sm'), h('span', { text: hero.name }))),
      h('h2', { text: 'Тарих картасы' }), h('p', { class: 'muted', text: 'Кезеңдер хронология бойынша ашылады' }), list));
  },

  showBriefing(s) {
    const st = STAGES[s - 1], bl = this.progress.blessing[s];
    this.screen(h('div', { class: 'center-card wide' },
      this.backBtn(() => this.showStages(), 'Карта'),
      h('div', { class: 'eyebrow', text: s + '-кезең · ' + difficulty(s) }),
      h('h1', { class: 'title sm', text: st.name }),
      h('p', { class: 'muted', text: st.years }),
      h('h3', { text: 'Тарихи брифинг' }),
      h('ul', { class: 'facts' }, st.facts.map(f => h('li', { text: f }))),
      h('div', { class: 'brief-grid' },
        h('div', null, h('small', { text: 'Жау' }), h('b', { text: st.enemyName })),
        h('div', null, h('small', { text: 'Артефактілер' }), h('b', { text: st.art.join(' · ') })),
        h('div', null, h('small', { text: 'Мақсат' }), h('b', { text: st.boss ? '3 артефакт + боссты жең (' + st.bossName + ')' : '3 артефакт + ' + fmtTime(STAGE_TIME) + ' тірі қал' })),
        h('div', null, h('small', { text: 'Сұрақ таймері' }), h('b', { text: QUIZ_TIME[s - 1] + ' сек' }))),
      st.zone === 'moving' ? h('div', { class: 'zone-note', text: '⚠ Бұл кезеңде қауіпсіз аймақ бар: ол картада жылжиды, сыртында тұрсаң уланасың. Медициналық көмектен кейін аймақ саған келеді.' }) : null,
      st.zone === 'marks' ? h('div', { class: 'zone-note', text: '⚠ Картада 3 қызыл белгі бар: әрқайсысы жау HP-ын +30% көбейтеді. Белгінің үстінде 7 сек тұрсаң, ол жасыл болады.' }) : null,
      bl ? h('div', { class: 'blessing', text: '✦ Құдайдан көмек осы әрекетке: ' + bl.label }) : null,
      h('button', { class: 'btn gold wide', text: 'Бастау', onclick: () => this.startStage(s) })
    ));
  },

  /* ================= ОЙЫН ================= */
  startStage(s) {
    if (!this.ready) { setTimeout(() => this.startStage(s), 100); return; }
    const hero = HEROES[this.heroIdx];
    const bl = this.progress.blessing[s];
    const mods = bl ? bl.mods : {};
    if (bl) { delete this.progress.blessing[s]; this.saveProgress(); }
    this.run = { stage: s, hero, helpUsed: 0, correct: 0, wrong: 0, asked: new Set() };
    this.closeModal(true);
    $('screen').hidden = true; $('toasts').textContent = '';
    ['hud', 'ability-btn', 'xpbar', 'minimap', 'wlist'].forEach(id => $(id).hidden = false);
    $('bossbar').hidden = true;
    $('ability-name').textContent = hero.abilityName;
    if (this.scene) this.game.scene.stop('stage');
    this.game.scene.start('stage', { stage: s, hero, mods });
    this.music.play('game', true);
  },
  stageStarted(scene) { this.scene = scene; scene.god = this.adminGod; this.hud(scene); },

  hud(sc) {
    $('h-stage').textContent = sc.st + '. ' + sc.cfg.name;
    const hh = $('h-hearts'); hh.textContent = '';
    hh.appendChild(h('span', { class: 'hf', text: '♥'.repeat(Math.max(0, sc.lives)) }));
    hh.appendChild(h('span', { class: 'he', text: '♥'.repeat(Math.max(0, sc.maxLives - sc.lives)) }));
    $('h-score').textContent = sc.score;
    $('h-timer').textContent = sc.isBossStage() ? (sc.bossDead ? 'Босс жеңілді' : sc.bossSpawned ? 'БОСС!' : 'Босс ' + fmtTime(Math.max(0, BOSS_AT - sc.elapsed))) : (sc.timeLeft() > 0 ? fmtTime(sc.timeLeft()) : 'Уақыт бітті');
    $('h-lvl').textContent = sc.level;
    $('h-kills').textContent = sc.kills;
    $('h-art').textContent = sc.artifacts + '/3';
    $('h-help').textContent = (this.run ? this.run.helpUsed : 0) + '/' + HELP_LIMIT;
    $('h-god').hidden = !sc.god;
    // аймақ жолағы (3- және 8-кезең)
    const zb = $('zonebar');
    if (sc.zone) {
      zb.hidden = false; zb.className = sc.zoneOutside ? 'bad' : '';
      zb.textContent = sc.zone.returning ? 'Аймақ саған келе жатыр…' : sc.zoneOutside ? '☠ Аймақтан тыс — уланып жатырсың! Көк шеңберге қайт' : sc.zone.state === 'move' ? 'Аймақ жылжып жатыр — бірге жүр' : 'Көк шеңбердің ішінде қал';
    } else if (sc.marks) {
      const red = sc.marks.filter(m => !m.done).length;
      zb.hidden = false; zb.className = red ? 'warn' : 'ok';
      zb.textContent = red ? 'Қызыл белгі: ' + red + '/' + sc.marks.length + ' · жау HP +' + Math.round(red * MARKS.hpPerRed * 100) + '% — әр белгіде 7 сек тұр' : 'Барлық белгі жасыл — жаулар әлсіреді';
    } else zb.hidden = true;
    $('poison').hidden = !sc.zoneOutside;
    $('xp-fill').style.transform = 'scaleX(' + Math.min(1, sc.xp / sc.xpNeed) + ')';
    const left = sc.cdLeft(), pct = left > 0 ? left / sc.cdTotal : 0;
    $('ability-fill').style.transform = 'scaleX(' + (1 - pct) + ')';
    $('ability-btn').classList.toggle('ready', left <= 0);
    $('ability-cd').textContent = left > 0 ? Math.ceil(left / 1000) + 'с' : 'Пробел';
    // қарулар тізімі
    const wl = $('wlist'), sig = JSON.stringify([sc.weapons, sc.passives].map(o => Object.entries(o).map(([k, v]) => k + (v.lvl || v))));
    if (wl.dataset.sig !== sig) {
      wl.dataset.sig = sig; wl.textContent = '';
      Object.entries(sc.weapons).forEach(([k, w]) => wl.appendChild(h('span', { class: 'chip w', text: (k === sc.hero.weapon ? sc.hero.weaponName : WEAPONS[k].name) + ' ' + w.lvl })));
      Object.entries(sc.passives).forEach(([k, l]) => wl.appendChild(h('span', { class: 'chip', text: PASSIVES[k].name + ' ' + l })));
    }
    this.drawMinimap(sc);
  },

  drawMinimap(sc) {
    const c = $('minimap'), x = c.getContext('2d'), W = c.width, H = c.height, kx = W / WORLD_W, ky = H / WORLD_H;
    x.clearRect(0, 0, W, H);
    x.fillStyle = 'rgba(10,16,22,.78)'; x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(255,255,255,.18)'; sc.wallRects.forEach(r => x.fillRect(r.x * kx, r.y * ky, Math.max(2, r.width * kx), Math.max(2, r.height * ky)));
    const v = sc.cameras.main.worldView; x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 1; x.strokeRect(v.x * kx, v.y * ky, v.width * kx, v.height * ky);
    const dot = (px, py, r, col) => { x.fillStyle = col; x.beginPath(); x.arc(px * kx, py * ky, r, 0, Math.PI * 2); x.fill(); };
    sc.arts.forEach(a => dot(a.x, a.y, 4, '#FFD24A'));
    dot(sc.gate.x, sc.gate.y, 4.5, sc.gateOpen ? '#46C46B' : '#888');
    if (sc.boss) dot(sc.boss.x, sc.boss.y, 5, '#FF4B4B');
    if (sc.zone) { x.strokeStyle = '#4FC3F7'; x.lineWidth = 1.5; x.beginPath(); x.ellipse(sc.zone.x * kx, sc.zone.y * ky, sc.zone.r * kx, sc.zone.r * ky, 0, 0, Math.PI * 2); x.stroke(); }
    if (sc.marks) sc.marks.forEach(m => dot(m.x, m.y, 4, m.done ? '#46C46B' : '#E53935'));
    dot(sc.player.x, sc.player.y, 3.5, '#fff');
  },

  bossBar(sc) {
    const bb = $('bossbar');
    if (!sc.boss) { bb.hidden = true; return; }
    bb.hidden = false; $('boss-name').textContent = sc.cfg.bossName;
    $('boss-fill').style.transform = 'scaleX(' + Math.max(0, sc.boss.hp / sc.boss.maxHp) + ')';
  },

  toast(msg) {
    const box = $('toasts');
    while (box.children.length > 3) box.firstChild.remove();
    const t = h('div', { class: 'toast', text: msg });
    box.appendChild(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
  },

  pauseGame() { if (this.scene && this.game.scene.isActive('stage')) this.game.scene.pause('stage'); },
  resumeGame() {
    if (!this.scene || this.modalOpen || !$('admin').hidden) return;
    if (this.game.scene.isPaused('stage')) { this.game.scene.resume('stage'); this.scene.input.keyboard.resetKeys(); }
  },

  openModal(cls, ...nodes) {
    const m = $('modal'); m.textContent = '';
    m.appendChild(h('div', { class: 'modal-card ' + (cls || '') }, ...nodes));
    m.hidden = false; this.modalOpen = true; this.pauseGame();
    this.music.duck = this.scene ? 0.35 : 1;
  },
  closeModal(silent) {
    clearInterval(this.quizTimer); this.levelChoices = null;
    $('modal').hidden = true; $('modal').textContent = ''; this.modalOpen = false;
    this.music.duck = 1;
    if (this.scene) this.hud(this.scene);
    if (!silent) this.resumeGame();
  },

  pauseMenu() {
    if (!this.scene) return;
    this.openModal('', h('h2', { text: 'Пауза' }),
      h('div', { class: 'menu' },
        h('button', { class: 'btn gold wide', text: 'Жалғастыру', onclick: () => this.closeModal() }),
        h('button', { class: 'btn wide', text: 'Қайта бастау', onclick: () => this.startStage(this.run.stage) }),
        h('button', { class: 'btn wide', text: 'Кейіпкерді таңдау', onclick: () => this.showHeroes() }),
        h('button', { class: 'btn ghost wide', text: 'Тарих картасы', onclick: () => this.showStages() })),
      this.volumeRow());
  },

  /* ---------- ДЕҢГЕЙ КӨТЕРУ ---------- */
  levelUp(sc) {
    const choices = sc.rollUpgrades(3);
    this.levelChoices = choices;
    const card = (u, i) => {
      let title, sub, tag;
      if (u.kind === 'weapon') { title = u.key === sc.hero.weapon ? sc.hero.weaponName : WEAPONS[u.key].name; tag = u.isNew ? (WEAPONS[u.key].rare ? '★ СИРЕК ҚАРУ' : 'ЖАҢА ҚАРУ') : 'ҚАРУ · ' + u.lvl + '-деңгей'; sub = u.isNew ? WEAPONS[u.key].desc : 'Зақым +30%, жиірек' + (u.lvl === 3 || u.lvl === 5 ? ', саны +1' : '') + (u.key === 'aura' || u.key === 'nova' || u.key === 'orbit' ? ', аймағы үлкейеді' : ''); }
      else if (u.kind === 'passive') { title = PASSIVES[u.key].name; tag = 'ЖАҚСАРТУ · ' + u.lvl + '/' + PASSIVES[u.key].max; sub = PASSIVES[u.key].desc; }
      else if (u.kind === 'heal') { title = 'Қымыз'; tag = 'ЕМ'; sub = '+1 жан'; }
      else { title = 'Олжа'; tag = 'ҰПАЙ'; sub = '+300 ұпай'; }
      return h('button', { class: 'lvl-card' + (u.isNew ? ' new' : '') + (u.rare ? ' rare' : ''), onclick: () => {
        sc.applyUpgrade(u); this.closeModal();
        if (sc.pendingLevels > 0) setTimeout(() => { if (this.scene === sc && !this.modalOpen) this.levelUp(sc); }, 60);
      } }, h('span', { class: 'key', text: i + 1 }), h('small', { text: tag }), h('b', { text: title }), h('span', { text: sub }));
    };
    this.openModal('dark lvl', h('div', { class: 'eyebrow', text: 'Деңгей ' + sc.level }), h('h2', { text: 'Жақсарту таңда' }),
      h('div', { class: 'lvl-grid' }, choices.map(card)));
  },

  /* ---------- ЖАН БІТКЕНДЕ: 9 СҰРАҚ ---------- */
  onDeath(sc) {
    const run = this.run; this.hud(sc);
    if (run.helpUsed >= HELP_LIMIT) {
      this.openModal('dark', h('h2', { class: 'red', text: 'СІЗ ЖЕҢІЛДІҢІЗ!' }),
        h('p', { text: 'Бұл кезеңдегі медициналық көмек шегі бітті (' + HELP_LIMIT + '/' + HELP_LIMIT + ').' }),
        h('button', { class: 'btn gold wide', text: 'Нәтижені көру', onclick: () => this.fail('Көмек шегі бітті') }));
      return;
    }
    const t = this.quizOverride || QUIZ_TIME[run.stage - 1];
    const start = () => { run.helpUsed++; this.runQuiz(run.stage, QUIZ_COUNT, false, res => this.afterHelp(res)); };
    this.openModal('dark',
      h('div', { class: 'eyebrow', text: 'Барлық жан бітті' }),
      h('h2', { class: 'red', text: 'СІЗ ЖЕҢІЛДІҢІЗ!' }),
      h('p', { text: 'Бірақ тарихи біліміңіз сізді құтқара алады.' }),
      h('div', { class: 'rule' },
        h('div', null, h('b', { text: QUIZ_COUNT }), h('small', { text: 'сұрақ' })),
        h('div', null, h('b', { text: t + ' сек' }), h('small', { text: 'әр сұраққа' })),
        h('div', null, h('b', { text: '3 / 6 / 9' }), h('small', { text: 'дұрыс → 1 / 2 / 3 жан' }))),
      h('button', { class: 'btn gold wide', text: 'Медициналық көмек — тапсырмаларды бастау', onclick: start }),
      h('button', { class: 'btn ghost wide', text: 'Бас тарту', onclick: () => this.fail('Көмектен бас тартты') }));
  },

  afterHelp(res) {
    const sc = this.scene, run = this.run;
    const pts = res.correct * 100 * run.stage * (run.hero.bonus === 'quizX2' ? 2 : 1);
    if (sc) sc.addScore(pts);
    const lives = livesFor(res.correct);
    if (lives > 0) {
      this.openModal('dark ok', h('h2', { class: 'green', text: 'Медициналық көмек көрсетілді' }),
        h('div', { class: 'big-num', text: res.correct + '/' + res.total }),
        h('p', { text: '+' + lives + ' жан · +' + pts + ' ұпай' }),
        h('button', { class: 'btn gold wide', text: 'Ойынды жалғастыру', onclick: () => { sc.revive(lives); this.closeModal(); } }));
    } else {
      this.openModal('dark', h('h2', { class: 'red', text: 'Медициналық көмек көрсетілмеді' }),
        h('div', { class: 'big-num red', text: res.correct + '/' + res.total }),
        h('p', { text: 'Кемінде ' + CORRECT_PER_LIFE + ' дұрыс жауап керек еді.' }),
        h('p', { class: 'muted', text: 'Қате жауап берген сұрақтар келесі жолы бірінші болып шығады.' }),
        h('button', { class: 'btn gold wide', text: 'Нәтижені көру', onclick: () => this.fail('Тапсырма орындалмады') }));
    }
  },

  /* ---------- ТАРИХИ ТАПСЫРМАЛАР ---------- */
  pickQuestions(stage, n, asked) {
    const take = pool => shuffle(pool.filter(q => this.wrong[q.id])).concat(shuffle(pool.filter(q => !this.wrong[q.id])));
    const seen = new Set();
    let list = [];
    const add = arr => arr.forEach(q => { if (!seen.has(q.id)) { seen.add(q.id); list.push(q); } });
    add(take(QUESTIONS.filter(q => q.s === stage && !asked.has(q.id))));
    if (list.length < n) add(take(QUESTIONS.filter(q => q.s < stage && !asked.has(q.id))));
    if (list.length < n) add(take(QUESTIONS.filter(q => q.s === stage)));
    if (list.length < n) add(take(QUESTIONS.filter(q => q.s <= stage)));
    if (list.length < n) add(take(QUESTIONS.slice()));
    const out = [];
    while (out.length < n && list.length) {
      const prev = out.length ? out[out.length - 1].t : null;
      let i = list.findIndex(q => q.t !== prev);
      if (i < 0) i = 0;
      out.push(list.splice(i, 1)[0]);
    }
    return out;
  },

  answerText(q, dir) {
    if (q.t === 'one') return q.o[q.a];
    if (q.t === 'fill') return q.ans;
    if (q.t === 'match') return q.pairs.map(p => p[0] + ' — ' + p[1]).join('; ');
    const ev = dir === 'desc' ? q.events.slice().reverse() : q.events;
    return ev.map(e => e[0] + ' (' + e[1] + ')').join(' → ');
  },

  runQuiz(stage, count, preview, done) {
    const asked = this.run && !preview ? this.run.asked : new Set();
    const qs = this.pickQuestions(stage, count, asked);
    const hero = this.run ? this.run.hero : HEROES[this.heroIdx];
    const secs = (this.quizOverride || QUIZ_TIME[stage - 1]) + (hero.bonus === 'wise' ? 5 : 0);
    let idx = 0, correct = 0;

    const ask = () => {
      const q = qs[idx]; asked.add(q.id);
      let getAnswer, answered = false;
      const dir = q.t === 'order' ? (Math.random() < 0.5 ? 'asc' : 'desc') : null;
      const body = h('div', { class: 'q-body' });
      let title = q.q;

      if (q.t === 'one') {
        let sel = null;
        const opts = shuffle(q.o.map((o, i) => ({ o, ok: i === q.a })));
        if (hero.bonus === 'wise' && opts.length > 2) opts.splice(opts.findIndex(x => !x.ok), 1);
        const box = h('div', { class: 'opts' });
        opts.forEach(x => box.appendChild(h('button', { class: 'opt' + (this.adminShowAnswers && x.ok ? ' hint' : ''), text: x.o, onclick: () => { sel = x; submit(); } })));
        body.appendChild(box); getAnswer = () => sel && sel.ok;
      }
      if (q.t === 'fill') {
        title = 'Бос орынды толтыр:';
        const parts = q.q.split('___');
        const inp = h('input', { id: 'q-fill', type: 'text', maxLength: 40, autocomplete: 'off', placeholder: '...' });
        inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') submit(); });
        body.appendChild(h('div', { class: 'fill' }, h('span', { text: parts[0] || '' }), inp, h('span', { text: parts.slice(1).join('___') || '' })));
        body.appendChild(h('button', { class: 'btn gold', text: 'Жауап беру', onclick: () => submit() }));
        setTimeout(() => inp.focus(), 30);
        getAnswer = () => { const v = normalize(inp.value.slice(0, 40)); return v.length > 0 && q.acc.some(a => normalize(a) === v); };
      }
      if (q.t === 'match') {
        const right = shuffle(q.pairs.map(p => p[1]));
        const sels = q.pairs.map((p, i) => {
          const s = h('select', { id: 'q-m' + i }, h('option', { value: '', text: '— таңда —' }), right.map(r => h('option', { value: r, text: r })));
          body.appendChild(h('div', { class: 'mrow' }, h('span', { text: p[0] }), s));
          return s;
        });
        body.appendChild(h('button', { class: 'btn gold', text: 'Тексеру', onclick: () => submit() }));
        getAnswer = () => sels.every((s, i) => s.value === q.pairs[i][1]);
      }
      if (q.t === 'order') {
        title = (q.q ? q.q + ': ' : '') + (dir === 'asc' ? 'ертеден кешке қарай қой' : 'кештен ертеге қарай қой');
        const want = (dir === 'asc' ? q.events : q.events.slice().reverse()).map(e => e[0]);
        let arr = shuffle(want); let guard = 0;
        while (arr.every((x, i) => x === want[i]) && guard++ < 10) arr = shuffle(want);
        const box = h('div', { class: 'ord' });
        const draw = () => {
          box.textContent = '';
          arr.forEach((it, i) => box.appendChild(h('div', { class: 'ord-row' },
            h('span', { class: 'n', text: i + 1 }), h('span', { class: 'it', text: it }),
            h('button', { class: 'mini', text: '↑', attrs: { 'aria-label': 'Жоғары' }, onclick: () => { if (i > 0) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; draw(); } } }),
            h('button', { class: 'mini', text: '↓', attrs: { 'aria-label': 'Төмен' }, onclick: () => { if (i < arr.length - 1) { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; draw(); } } }))));
        };
        draw();
        body.appendChild(h('div', { class: 'dir', text: dir === 'asc' ? '↓ Жоғарыда — ең ерте, төменде — ең кеш' : '↓ Жоғарыда — ең кеш, төменде — ең ерте' }));
        body.appendChild(box);
        body.appendChild(h('button', { class: 'btn gold', text: 'Тексеру', onclick: () => submit() }));
        getAnswer = () => arr.every((x, i) => x === want[i]);
      }

      const timeBar = h('i'); const timeTxt = h('b', { text: secs + ' сек' });
      const fb = h('div', { class: 'fb', hidden: true });
      const prog = h('div', { class: 'qprog' }, qs.map((_, i) => h('i', { class: i < idx ? (qs[i]._ok ? 'ok' : 'bad') : i === idx ? 'cur' : '' })));
      const submit = timeout => {
        if (answered) return; answered = true; clearInterval(this.quizTimer);
        const ok = !timeout && !!getAnswer();
        q._ok = ok;
        if (ok) { correct++; delete this.wrong[q.id]; if (this.run && !preview) this.run.correct++; }
        else { this.wrong[q.id] = true; if (this.run && !preview) this.run.wrong++; }
        this.saveWrong();
        body.querySelectorAll('button, input, select').forEach(b => b.disabled = true);
        prog.children[idx].className = ok ? 'ok' : 'bad';
        fb.hidden = false; fb.className = 'fb ' + (ok ? 'ok' : 'bad');
        fb.appendChild(h('b', { text: ok ? '✓ Дұрыс!' : (timeout ? '⏱ Уақыт бітті.' : '✗ Қате.') }));
        if (q.t === 'order') fb.appendChild(h('div', { text: (ok ? '' : 'Дұрыс жауап: ') + this.answerText(q, dir) }));
        else {
          if (!ok) fb.appendChild(h('div', { text: 'Дұрыс жауап: ' + this.answerText(q, dir) }));
          if (q.ex) fb.appendChild(h('div', { class: 'muted', text: q.ex }));
        }
        fb.appendChild(h('div', { class: 'muted', text: 'Дұрыс: ' + correct + '/' + (idx + 1) + ' · қазір +' + livesFor(correct) + ' жан' }));
        const last = idx === qs.length - 1;
        const next = h('button', { class: 'btn gold', text: last ? 'Нәтиже' : 'Келесі сұрақ →', onclick: () => { idx++; last ? done({ correct, total: qs.length }) : ask(); } });
        fb.appendChild(next); setTimeout(() => next.focus(), 30);
      };

      this.openModal('dark quiz',
        h('div', { class: 'q-head' }, h('span', { class: 'eyebrow', text: 'Тарихи тапсырма ' + (idx + 1) + '/' + qs.length + ' · дұрыс ' + correct }), h('span', { class: 'qtype', text: TYPE_NAME[q.t] })),
        prog,
        h('div', { class: 'timer' }, timeBar, timeTxt),
        h('div', { class: 'q', text: title }),
        this.adminShowAnswers ? h('div', { class: 'admin-hint', text: 'АДМИН: ' + this.answerText(q, dir) }) : null,
        body, fb);

      const t0 = Date.now(), total = secs * 1000;
      clearInterval(this.quizTimer);
      this.quizTimer = setInterval(() => {
        const left = Math.max(0, total - (Date.now() - t0));
        timeBar.style.transform = 'scaleX(' + left / total + ')';
        timeBar.classList.toggle('low', left < 5000);
        timeTxt.textContent = Math.ceil(left / 1000) + ' сек';
        if (left <= 0) submit(true);
      }, 100);
    };
    if (!qs.length) { done({ correct: 0, total: 0 }); return; }
    qs.forEach(q => delete q._ok);
    ask();
  },

  /* ---------- ЖЕҢІЛІС / ЖЕҢІС ---------- */
  record(result, sc) {
    const run = this.run;
    const r = { name: this.user ? this.user.name : 'Қонақ', hero: run.hero.name, stage: run.stage, result, score: sc ? sc.score : 0,
      kills: sc ? sc.kills : 0, level: sc ? sc.level : 1,
      correct: run.correct, wrong: run.wrong, timeSec: Math.round((sc ? sc.t : 0) / 1000), helpUsed: run.helpUsed, date: new Date().toISOString() };
    if (CLOUD.on) { const test = this.admin; setTimeout(() => CLOUD.saveRun(r, test), 0); }   // прогресс жаңарғаннан кейін жібереді
    else { const runs = store.get('kdq_runs', []); runs.push(r); store.set('kdq_runs', runs.slice(-300)); }
    return r;
  },

  endButtons(s, opts) {
    return h('div', { class: 'menu' },
      opts.next ? h('button', { class: 'btn gold wide', text: 'Келесі кезең →', onclick: () => this.showBriefing(s + 1) }) : null,
      h('button', { class: 'btn ' + (opts.next ? '' : 'gold ') + 'wide', text: opts.next ? 'Қайталау' : 'Қайта бастау', onclick: () => this.startStage(s) }),
      h('button', { class: 'btn wide', text: 'Кейіпкерді таңдау', onclick: () => this.showHeroes() }),
      h('button', { class: 'btn ghost wide', text: 'Тарих картасы', onclick: () => this.showStages() }));
  },

  fail(reason) {
    const sc = this.scene, s = this.run.stage;
    const r = this.record('lose', sc);
    const f = this.progress.fails[s] = (this.progress.fails[s] || 0) + 1;
    this.saveProgress();
    const th = this.godThreshold;
    const showOver = () => {
      const left = f < th ? th - f : GOD_HELP_REPEAT - ((f - th) % GOD_HELP_REPEAT);
      const bl = this.progress.blessing[s];
      this.openModal('dark', h('h2', { class: 'red', text: 'Ойын аяқталды' }),
        h('p', { class: 'muted', text: reason }),
        this.statsTable(r),
        h('p', { class: 'muted', text: 'Осы кезеңдегі сәтсіз әрекет: ' + f + (bl ? '' : ' · «Құдайдан көмекке» дейін: ' + left) }),
        bl ? h('div', { class: 'blessing', text: '✦ Келесі әрекетте: ' + bl.label }) : null,
        this.endButtons(s, { next: false }));
    };
    if (f >= th && (f - th) % GOD_HELP_REPEAT === 0) this.godHelp(s, showOver); else showOver();
  },

  godHelp(s, then) {
    const opts = [
      { label: '+2 жан', mods: { lives: 2 }, d: 'Кезеңді 5 жанмен бастайсың' },
      { label: 'Жаулар 40% баяу', mods: { slow: 0.6 }, d: 'Барлық жау мен босс баяу қозғалады' },
      { label: 'Артефакт жолы', mods: { reveal: true }, d: 'Артефактілерге бағыт үнемі көрсетіледі' }
    ];
    this.openModal('god',
      h('div', { class: 'eyebrow', text: 'Арнайы бонус' }),
      h('h2', { text: '✦ Құдайдан көмек ✦' }),
      h('p', { text: 'Сен бұл кезеңде ' + (this.progress.fails[s]) + ' рет жеңілдің. Бабалар рухы саған бір көмек береді. Біреуін таңда:' }),
      h('div', { class: 'god-opts' }, opts.map(o => h('button', { class: 'god-opt', onclick: () => {
        this.progress.blessing[s] = { label: o.label, mods: o.mods }; this.saveProgress(); then();
      } }, h('b', { text: o.label }), h('small', { text: o.d })))));
  },

  onWin(sc) {
    const run = this.run, s = run.stage;
    const st = 1 + (run.helpUsed === 0 ? 1 : 0) + (sc.livesLost === 0 ? 1 : 0);
    sc.addScore(500 + (sc.livesLost === 0 ? 300 : 0) + sc.level * 20);
    const r = this.record('win', sc);
    const before = this.progress.maxCleared;
    this.progress.maxCleared = Math.max(before, s);
    this.progress.stars[s] = Math.max(this.progress.stars[s] || 0, st);
    this.progress.fails[s] = 0;
    this.saveProgress();
    const newHeroes = before < s ? HEROES.filter(x => x.unlock === s) : [];
    const last = s === 10;
    this.openModal('dark ok',
      h('div', { class: 'eyebrow', text: s + '-кезең · ' + STAGES[s - 1].name }),
      h('h2', { class: 'green', text: last ? 'ЖЕҢІС! Барлық 10 дәуірден өттің' : 'Кезең аяқталды!' }),
      h('div', { class: 'big-stars', text: stars(st) }),
      this.statsTable(r),
      h('p', { class: 'muted', text: 'Табылған артефактілер: ' + sc.artNames.join(', ') }),
      newHeroes.length ? h('div', { class: 'blessing', text: '🔓 Жаңа кейіпкер ашылды: ' + newHeroes.map(x => x.name).join(', ') }) : null,
      this.endButtons(s, { next: !last }));
  },

  statsTable(r) {
    const cells = [['Ұпай', r.score], ['Жау', r.kills], ['Деңгей', r.level], ['Дұрыс', r.correct], ['Қате', r.wrong], ['Уақыт', fmtTime(r.timeSec)], ['Көмек', r.helpUsed + '/' + HELP_LIMIT]];
    return h('div', { class: 'stat-row' }, cells.map(c => h('div', null, h('small', { text: c[0] }), h('b', { text: String(c[1]) }))));
  },

  /* ---------- РЕЙТИНГ / НӘТИЖЕЛЕР ---------- */
  lbTable(rows) {
    return rows.length ? h('div', { class: 'tbl' }, h('table', null,
      h('thead', null, h('tr', null, ['Орын', 'Студент', 'Ойын', 'Ұпай', 'Деңгей'].map(x => h('th', { text: x })))),
      h('tbody', null, rows.map((r, i) => h('tr', { class: r.me ? 'me' : '' },
        h('td', { text: i + 1 }), h('td', { text: r.name }), h('td', { text: 'Қазақ даласының қорғаны' }), h('td', { text: r.score }), h('td', { text: r.level }))))))
      : h('div', { class: 'empty', text: 'Әзірге нәтиже жоқ. Бір кезеңді ойнап шық — атың осында шығады.' });
  },

  showLeaderboard() {
    if (CLOUD.on) {
      const body = h('div', null, h('div', { class: 'empty', text: 'Жүктелуде…' }));
      this.screen(h('div', { class: 'page' }, this.backBtn(() => this.showMenu()), h('h2', { text: 'Рейтинг' }),
        h('p', { class: 'muted', text: 'Бүкіл топтың ортақ рейтингі. Әр ойыншының ең жақсы ұпайы және өткен ең жоғары кезеңі.' }), body));
      CLOUD.leaderboard()
        .then(rows => { body.textContent = ''; body.appendChild(this.lbTable(rows.map(r => ({ name: r.name, score: r.score, level: r.level, me: r.uid === CLOUD.uid })))); })
        .catch(e => { console.warn(e); body.textContent = ''; body.appendChild(h('div', { class: 'empty', text: 'Рейтингті жүктеу мүмкін болмады.' })); });
      return;
    }
    const runs = store.get('kdq_runs', []);
    const best = {};
    runs.forEach(r => {
      const b = best[r.name] || (best[r.name] = { name: r.name, score: 0, level: 0 });
      b.score = Math.max(b.score, r.score);
      if (r.result === 'win') b.level = Math.max(b.level, r.stage);
    });
    const rows = Object.values(best).sort((a, b) => b.score - a.score || b.level - a.level).map(r => Object.assign(r, { me: this.user && r.name === this.user.name }));
    this.screen(h('div', { class: 'page' }, this.backBtn(() => this.showMenu()), h('h2', { text: 'Рейтинг' }),
      h('p', { class: 'muted', text: 'Демо режим: рейтинг тек осы браузерде сақталады. Сайтта (Firebase) бүкіл топ бір кестеде болады.' }),
      this.lbTable(rows)));
  },

  showResults() {
    if (CLOUD.on) {
      this.screen(h('div', { class: 'page' }, this.backBtn(() => this.showMenu()), h('h2', { text: 'Нәтижелерім' }), h('div', { class: 'empty', text: 'Жүктелуде…' })));
      const tok = this._scr;
      CLOUD.myRuns().then(runs => { if (this._scr === tok) this.renderResults(runs); })
        .catch(e => { console.warn(e); if (this._scr === tok) this.toast('Нәтижелерді жүктеу мүмкін болмады'); });
      return;
    }
    this.renderResults(store.get('kdq_runs', []).filter(r => this.user && r.name === this.user.name).reverse());
  },

  renderResults(runs) {
    const tot = runs.reduce((a, r) => ({ c: a.c + r.correct, w: a.w + r.wrong, t: a.t + r.timeSec }), { c: 0, w: 0, t: 0 });
    this.screen(h('div', { class: 'page' }, this.backBtn(() => this.showMenu()), h('h2', { text: 'Нәтижелерім' }),
      h('div', { class: 'stat-row light' },
        h('div', null, h('small', { text: 'Ойындар' }), h('b', { text: runs.length })),
        h('div', null, h('small', { text: 'Дұрыс жауап' }), h('b', { text: tot.c })),
        h('div', null, h('small', { text: 'Қате жауап' }), h('b', { text: tot.w })),
        h('div', null, h('small', { text: 'Ойнаған уақыт' }), h('b', { text: fmtTime(tot.t) }))),
      runs.length ? h('div', { class: 'tbl' }, h('table', null,
        h('thead', null, h('tr', null, ['Күні', 'Кезең', 'Кейіпкер', 'Нәтиже', 'Ұпай', 'Дұрыс', 'Қате', 'Уақыт'].map(x => h('th', { text: x })))),
        h('tbody', null, runs.slice(0, 40).map(r => h('tr', null,
          h('td', { text: new Date(r.date).toLocaleString('kk-KZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) }),
          h('td', { text: r.stage }), h('td', { text: r.hero }), h('td', { class: r.result === 'win' ? 'win' : 'lose', text: r.result === 'win' ? 'Жеңіс' : 'Жеңіліс' }),
          h('td', { text: r.score }), h('td', { text: r.correct }), h('td', { text: r.wrong }), h('td', { text: fmtTime(r.timeSec) }))))))
        : h('div', { class: 'empty', text: 'Әзірге ойын жоқ.' })));
  },

  /* ================= АДМИН-ПАНЕЛЬ ================= */
  askPin() {
    if (CLOUD.on) {   // сайтта: админ рөлі серверде (Firestore → admins/<email>) тексеріледі, PIN жоқ
      if (CLOUD.isAdmin) { this.admin = true; this.refreshAdminBadge(); this.toggleAdmin(true); this.toast('Админ режимі қосылды'); }
      else this.toast(this.user ? 'Бұл аккаунтта админ құқығы жоқ' : 'Алдымен Google арқылы кіріңіз');
      return;
    }
    const now = Date.now();
    const inp = h('input', { id: 'admin-pin', type: 'password', inputMode: 'numeric', maxLength: 8, autocomplete: 'off', placeholder: 'PIN' });
    const err = h('div', { class: 'err' });
    if (now < this.pinLockUntil) err.textContent = 'Тым көп қате әрекет. ' + Math.ceil((this.pinLockUntil - now) / 1000) + ' сек күтіңіз.';
    const check = () => {
      if (Date.now() < this.pinLockUntil) return;
      if (inp.value === ADMIN_PIN) {
        this.pinFails = 0; this.admin = true; sess.set('kdq_admin', '1'); this.refreshAdminBadge();
        this.closeModal(true); this.toggleAdmin(true); this.toast('Админ режимі қосылды');
      } else {
        this.pinFails++; inp.value = '';
        if (this.pinFails >= 5) { this.pinLockUntil = Date.now() + 60000; this.pinFails = 0; err.textContent = '5 қате әрекет. 60 сек бұғатталды.'; }
        else err.textContent = 'PIN қате (' + this.pinFails + '/5)';
      }
    };
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') check(); });
    this.openModal('', h('h2', { text: 'Админ режимі' }), h('p', { class: 'muted', text: 'Тестерлерге арналған басқару панелі. PIN-кодты енгізіңіз.' }), inp, err,
      h('div', { class: 'row2' }, h('button', { class: 'btn gold', text: 'Кіру', onclick: check }), h('button', { class: 'btn', text: 'Болдырмау', onclick: () => this.closeModal() })));
    setTimeout(() => inp.focus(), 30);
  },

  refreshAdminBadge() { $('logo').classList.toggle('is-admin', this.admin); },

  toggleAdmin(force) {
    const p = $('admin');
    const open = force === undefined ? p.hidden : force;
    if (open) { this.renderAdmin(); p.hidden = false; this.pauseGame(); }
    else { p.hidden = true; this.resumeGame(); }
    if (this.scene) this.hud(this.scene);
  },

  renderAdmin() {
    const p = $('admin'); p.textContent = '';
    const sc = this.scene, inGame = !!(sc && !sc.ended && !sc.dead);
    const sec = (title, ...kids) => h('section', null, h('h4', { text: title }), ...kids);
    const btn = (text, fn, dis) => h('button', { class: 'abtn', text, disabled: !!dis, onclick: () => { fn(); if (!$('admin').hidden) this.renderAdmin(); if (this.scene) this.hud(this.scene); } });
    const tog = (text, val, fn) => h('label', { class: 'atog' }, h('input', { type: 'checkbox', checked: val, onchange: e => { fn(e.target.checked); this.renderAdmin(); } }), h('span', { text }));
    const curStage = this.run ? this.run.stage : 1;
    const fails = this.progress.fails[curStage] || 0;

    const stageSel = h('select', { id: 'adm-stage' }, STAGES.map((s, i) => h('option', { value: i + 1, text: (i + 1) + '. ' + s.name, selected: i + 1 === curStage })));
    const heroSel = h('select', { id: 'adm-hero' }, HEROES.map((x, i) => h('option', { value: i, text: x.name, selected: i === this.heroIdx })));
    const timerSel = h('select', { id: 'adm-timer', onchange: e => { this.quizOverride = Number(e.target.value); } },
      [[0, 'Әдепкі (30→10)'], [5, '5 сек'], [10, '10 сек'], [30, '30 сек'], [60, '60 сек']].map(([v, t]) => h('option', { value: v, text: t, selected: this.quizOverride === v })));
    const thInp = h('input', { id: 'adm-th', type: 'number', min: 1, max: 99, value: this.godThreshold });

    // сұрақ базасының статистикасы
    const qstat = h('div', { class: 'qstat' });
    for (let s = 1; s <= 10; s++) {
      const list = QUESTIONS.filter(q => q.s === s);
      const by = t => list.filter(q => q.t === t).length;
      qstat.appendChild(h('div', { class: list.length < QUIZ_COUNT ? 'low' : '' }, h('b', { text: s + '. ' + STAGES[s - 1].name }), h('span', { text: list.length + ' (①' + by('one') + ' ②' + by('match') + ' ③' + by('order') + ' ⑥' + by('fill') + ')' })));
    }

    p.append(
      h('div', { class: 'adm-head' }, h('b', { text: 'АДМИН-ПАНЕЛЬ' }), h('button', { class: 'mini', text: '✕', attrs: { 'aria-label': 'Жабу' }, onclick: () => this.toggleAdmin(false) })),
      h('div', { class: 'adm-state', text: inGame
        ? 'Ойында: ' + sc.st + '-кезең · ' + sc.hero.name + ' · жан ' + sc.lives + ' · деңгей ' + sc.level + ' · жау ' + sc.enemies.getLength() + ' · артефакт ' + sc.artifacts + '/3'
        : 'Қазір ойын жүріп жатқан жоқ' }),
      sec('Ойын ішінде',
        tog('Өлмейтін режим (God mode)', this.adminGod, v => { this.adminGod = v; if (sc) sc.god = v; }),
        h('div', { class: 'agrid' },
          btn('+1 жан', () => { sc.lives = Math.min(sc.lives + 1, sc.maxLives); }, !inGame),
          btn('Жанды бітіру (тест)', () => { this.toggleAdmin(false); sc.adminKillPlayer(); }, !inGame),
          btn('+1 деңгей', () => { sc.adminLevelUp(); }, !inGame),
          btn('Қабілетті зарядтау', () => { sc.cdUntil = 0; }, !inGame),
          btn('Жауларды қату 10с', () => sc.adminFreezeAll(), !inGame),
          btn('Жауларды жою', () => sc.adminKillAll(), !inGame),
          btn('3 артефакт беру', () => sc.adminArtifacts(), !inGame),
          btn('Таймерді өткізу', () => sc.adminSkipTime(), !inGame),
          btn('Боссты шақыру', () => { if (!sc.adminSpawnBoss()) this.toast('Босс тек 5- және 10-кезеңде бар'); }, !inGame),
          btn('Кезеңді өту', () => { this.toggleAdmin(false); sc.win(); }, !inGame))),
      sec('Тарихи тапсырмалар',
        h('label', { class: 'arow' }, h('span', { text: 'Таймер' }), timerSel),
        tog('Дұрыс жауапты көрсету', this.adminShowAnswers, v => { this.adminShowAnswers = v; }),
        btn(QUIZ_COUNT + ' сұрақты сынап көру', () => { const s = Number(stageSel.value); this.toggleAdmin(false); this.runQuiz(s, QUIZ_COUNT, true, res => {
          this.openModal('dark', h('h2', { text: 'Сынақ нәтижесі' }), h('div', { class: 'big-num', text: res.correct + '/' + res.total }),
            h('p', { text: livesFor(res.correct) > 0 ? '+' + livesFor(res.correct) + ' жан берілер еді' : 'Көмек көрсетілмес еді' }),
            h('button', { class: 'btn gold wide', text: 'Жабу', onclick: () => this.closeModal() }));
        }); }),
        h('div', { class: 'arow' }, h('span', { text: 'Сұрақ базасы: ' + QUESTIONS.length + (QUESTION_ERRORS.length ? ' · қате: ' + QUESTION_ERRORS.length : '') })),
        qstat,
        h('p', { class: 'adm-note', text: 'Сұрақ қосу: js/questions.js файлы. Қызыл — ' + QUIZ_COUNT + '-дан аз.' })),
      sec('Құдайдан көмек',
        h('label', { class: 'arow' }, h('span', { text: 'Шек (сәтсіздік)' }), thInp,
          h('button', { class: 'mini', text: 'OK', onclick: () => { const v = Math.max(1, Math.min(99, parseInt(thInp.value, 10) || GOD_HELP_AFTER)); this.godThreshold = v; store.set('kdq_god_th', v); this.renderAdmin(); } })),
        h('div', { class: 'arow' }, h('span', { text: curStage + '-кезеңдегі сәтсіздік: ' + fails })),
        h('div', { class: 'agrid' },
          btn('+1', () => { this.progress.fails[curStage] = fails + 1; this.saveProgress(); }),
          btn('+5', () => { this.progress.fails[curStage] = fails + 5; this.saveProgress(); }),
          btn('0-ге', () => { this.progress.fails[curStage] = 0; this.saveProgress(); }),
          btn('Қазір шақыру', () => { this.toggleAdmin(false); this.godHelp(curStage, () => { this.closeModal(); this.toast('Бонус келесі әрекетте қосылады'); }); }))),
      sec('Прогресс',
        tog('Барлық кейіпкер мен кезеңді ашу', this.unlockAll, v => { this.unlockAll = v; store.set('kdq_unlock_all', v); }),
        h('label', { class: 'arow' }, h('span', { text: 'Кезең' }), stageSel),
        h('label', { class: 'arow' }, h('span', { text: 'Кейіпкер' }), heroSel),
        btn('Осы кезеңді бастау', () => { this.heroIdx = Number(heroSel.value); this.toggleAdmin(false); this.startStage(Number(stageSel.value)); }),
        h('div', { class: 'agrid' },
          btn('Прогресті тастау', () => { this.progress = { maxCleared: 0, stars: {}, fails: {}, blessing: {} }; this.saveProgress(); this.wrong = {}; this.saveWrong(); }),
          btn('Рейтингті тазалау', () => {
            if (!CLOUD.on) { store.set('kdq_runs', []); return; }
            if (!confirm('Бүкіл топтың рейтингі өшіріледі. Сенімдісіз бе?')) return;
            CLOUD.clearLeaderboard().then(() => this.toast('Рейтинг тазаланды')).catch(() => this.toast('Рейтингті тазалау мүмкін болмады'));
          }))),
      h('button', { class: 'abtn danger', text: 'Админ режимінен шығу', onclick: () => {
        this.admin = false; this.adminGod = false; this.adminShowAnswers = false; this.quizOverride = 0; if (sc) sc.god = false;
        sess.set('kdq_admin', null); this.refreshAdminBadge(); this.toggleAdmin(false);
      } }),
      h('p', { class: 'adm-note', text: CLOUD.on ? 'Админ рөлі серверде тексеріледі (Firestore: admins). Админ режимінде ойналған ойындар рейтингке жазылмайды.' : 'Демо режим: PIN браузерде тексеріледі. Сайтта админ рөлі серверде тексеріледі.' })
    );
  }
};

window.APP = APP;
window.addEventListener('DOMContentLoaded', () => APP.init());
