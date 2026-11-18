/* =========================================================
   Қазақ даласының қорғаны — ойын қозғалтқышы (Phaser 3)
   Жанр: Vampire Survivors (автоатака, толқындар, XP, жақсартулар)
         + босстарда bullet hell (5- және 10-кезең)
   BootScene  — графиканы кодпен салады
   StageScene — бір кезеңнің ойын циклі
   ========================================================= */
'use strict';

const WORLD_W = 2400, WORLD_H = 1600;
const PLAYER_SIZE = 56;

/* Кейіпкердің дөңгелек суреті: фото болса — бет тұсы қиылады, жоқ болса — түсті дөңгелек + инициал */
function heroCanvas(hero, img, size) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'), r = size / 2;
  const col = '#' + hero.color.toString(16).padStart(6, '0');
  x.save(); x.beginPath(); x.arc(r, r, r - 3, 0, Math.PI * 2); x.closePath(); x.clip();
  x.fillStyle = col; x.fillRect(0, 0, size, size);
  if (img && img.naturalWidth) {
    const f = Object.assign({ x: 0.5, y: 0.38, size: 0.62 }, hero.face || {});
    const d = img.naturalWidth * f.size;
    x.drawImage(img, f.x * img.naturalWidth - d / 2, f.y * img.naturalHeight - d / 2, d, d, 0, 0, size, size);
  } else {
    const ini = hero.name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    x.fillStyle = 'rgba(255,255,255,.92)'; x.font = 'bold ' + Math.round(size * 0.36) + 'px "Segoe UI", Arial, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ini, r, r + 1);
  }
  x.restore();
  x.lineWidth = 4; x.strokeStyle = col; x.beginPath(); x.arc(r, r, r - 2, 0, Math.PI * 2); x.stroke();
  x.lineWidth = 1.5; x.strokeStyle = 'rgba(0,0,0,.55)'; x.beginPath(); x.arc(r, r, r - 0.75, 0, Math.PI * 2); x.stroke();
  return c;
}

class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }
  create() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    const tex = (key, w, h, draw) => { g.clear(); draw(g); g.generateTexture(key, w, h); };
    const C = Phaser.Display.Color;

    STAGES.forEach((st, i) => {
      const n = i + 1, c = st.enemy, light = C.IntegerToColor(c).lighten(18).color, dark = C.IntegerToColor(c).darken(15).color;
      const eyes = (g, cx, cy, gap, r) => { g.fillStyle(0xffffff, 0.95); g.fillCircle(cx - gap, cy, r); g.fillCircle(cx + gap, cy, r); g.fillStyle(0x000000); g.fillCircle(cx - gap, cy, r * 0.5); g.fillCircle(cx + gap, cy, r * 0.5); };
      tex('en_g_' + n, 30, 30, g => { g.fillStyle(c); g.fillCircle(15, 15, 13); g.lineStyle(2, 0x000000, 0.45); g.strokeCircle(15, 15, 13); eyes(g, 15, 12, 5, 3); });
      tex('en_r_' + n, 26, 26, g => { g.fillStyle(light); g.fillTriangle(13, 1, 25, 24, 1, 24); g.lineStyle(2, 0x000000, 0.45); g.strokeTriangle(13, 1, 25, 24, 1, 24); eyes(g, 13, 16, 4, 2.5); });
      tex('en_t_' + n, 44, 44, g => { g.fillStyle(dark); g.fillRoundedRect(2, 2, 40, 40, 9); g.lineStyle(3, 0x000000, 0.5); g.strokeRoundedRect(2, 2, 40, 40, 9); eyes(g, 22, 18, 8, 4); g.fillStyle(0x000000, 0.6); g.fillRect(13, 29, 18, 4); });
      tex('en_a_' + n, 30, 30, g => { g.fillStyle(c); g.fillPoints([{ x: 15, y: 1 }, { x: 29, y: 15 }, { x: 15, y: 29 }, { x: 1, y: 15 }], true); g.lineStyle(2, 0x000000, 0.45); g.strokePoints([{ x: 15, y: 1 }, { x: 29, y: 15 }, { x: 15, y: 29 }, { x: 1, y: 15 }], true); eyes(g, 15, 14, 5, 2.5); });
      tex('boss_' + n, 96, 96, g => {
        g.fillStyle(dark); g.fillCircle(48, 48, 44); g.lineStyle(5, 0x000000, 0.55); g.strokeCircle(48, 48, 44);
        g.fillStyle(0xFFD24A); for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.42; g.fillTriangle(48 + Math.cos(a) * 30, 48 + Math.sin(a) * 30, 48 + Math.cos(a - 0.15) * 48, 48 + Math.sin(a - 0.15) * 48, 48 + Math.cos(a + 0.15) * 48, 48 + Math.sin(a + 0.15) * 48); }
        eyes(g, 48, 44, 14, 8); g.fillStyle(0x000000, 0.7); g.fillRect(32, 62, 32, 6);
      });
    });
    tex('gem', 14, 16, g => { g.fillStyle(0x4FC3F7); g.fillPoints([{ x: 7, y: 0 }, { x: 14, y: 6 }, { x: 7, y: 16 }, { x: 0, y: 6 }], true); g.fillStyle(0xB3E9FF); g.fillTriangle(7, 1, 12, 6, 7, 6); });
    tex('gem_big', 20, 22, g => { g.fillStyle(0x7C4DFF); g.fillPoints([{ x: 10, y: 0 }, { x: 20, y: 8 }, { x: 10, y: 22 }, { x: 0, y: 8 }], true); g.fillStyle(0xD1C4FF); g.fillTriangle(10, 1, 17, 8, 10, 8); });
    tex('arrow', 26, 8, g => { g.fillStyle(0x6B4A1E); g.fillRect(0, 3, 20, 2); g.fillStyle(0xEDEDED); g.fillTriangle(18, 0, 26, 4, 18, 8); g.fillStyle(0xC0392B); g.fillTriangle(0, 0, 5, 3, 0, 3); g.fillTriangle(0, 8, 5, 5, 0, 5); });
    tex('lance', 40, 10, g => { g.fillStyle(0x8D6E63); g.fillRect(0, 4, 30, 3); g.fillStyle(0xE0E0E0); g.fillTriangle(28, 0, 40, 5, 28, 10); });
    tex('blade', 26, 26, g => { g.fillStyle(0xE8E8E8); g.fillPoints([{ x: 13, y: 0 }, { x: 17, y: 13 }, { x: 13, y: 26 }, { x: 9, y: 13 }], true); g.fillStyle(0xFFD24A); g.fillRect(5, 12, 16, 3); });
    tex('book', 24, 20, g => { g.fillStyle(0x6A5ACD); g.fillRoundedRect(0, 0, 24, 20, 3); g.fillStyle(0xFFF3C4); g.fillRect(3, 3, 8, 14); g.fillRect(13, 3, 8, 14); g.fillStyle(0x6A5ACD); g.fillRect(11, 2, 2, 16); });
    tex('ebullet', 14, 14, g => { g.fillStyle(0xFF3B3B); g.fillCircle(7, 7, 7); g.fillStyle(0xFFE0E0); g.fillCircle(7, 7, 3); });
    tex('heart', 28, 26, g => { g.fillStyle(0xE5484D); g.fillCircle(8, 9, 7); g.fillCircle(20, 9, 7); g.fillTriangle(1.5, 11, 26.5, 11, 14, 25); });
    tex('shield', 28, 30, g => { g.fillStyle(0x3FA7D6); g.fillRoundedRect(3, 2, 22, 16, 4); g.fillTriangle(3, 14, 25, 14, 14, 29); g.lineStyle(2, 0x0F4C6B); g.strokeRoundedRect(3, 2, 22, 16, 4); });
    tex('keruen', 30, 30, g => { g.fillStyle(0x8D6E63); g.fillCircle(15, 17, 12); g.fillStyle(0xFFD24A); g.fillCircle(15, 17, 6); g.fillStyle(0x5D4037); g.fillRect(11, 2, 8, 6); });
    tex('dauyl', 30, 30, g => { g.fillStyle(0x263238); g.fillCircle(15, 17, 12); g.fillStyle(0xFF7043); g.fillTriangle(15, 0, 20, 8, 10, 8); g.fillStyle(0xFFFFFF, 0.8); g.fillCircle(11, 13, 3); });
    tex('artifact', 40, 40, g => {
      const pts = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 8 : 18, a = -Math.PI / 2 + i * Math.PI / 5; pts.push({ x: 20 + r * Math.cos(a), y: 20 + r * Math.sin(a) }); }
      g.fillStyle(0xFFD24A); g.fillPoints(pts, true); g.lineStyle(2.5, 0x7A5200); g.strokePoints(pts, true);
    });
    tex('trap', 34, 34, g => { g.fillStyle(0x2a2a2a, 0.95); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const x = 3 + i * 10, y = 4 + j * 10; g.fillTriangle(x, y + 9, x + 8, y + 9, x + 4, y); } });
    tex('gate_closed', 70, 110, g => { g.fillStyle(0x777777); g.fillRect(0, 20, 14, 90); g.fillRect(56, 20, 14, 90); g.fillRect(0, 10, 70, 18); g.fillTriangle(0, 10, 70, 10, 35, 0); g.fillStyle(0x555555, 0.8); g.fillRect(14, 28, 42, 82); });
    tex('gate_open', 70, 110, g => { g.fillStyle(0x46C46B); g.fillRect(0, 20, 14, 90); g.fillRect(56, 20, 14, 90); g.fillRect(0, 10, 70, 18); g.fillTriangle(0, 10, 70, 10, 35, 0); g.fillStyle(0xC8FFD6, 0.45); g.fillRect(14, 28, 42, 82); });
    tex('ally', 24, 24, g => { g.fillStyle(0x8E5A2B); g.fillCircle(12, 12, 10); g.lineStyle(2, 0xFFD24A); g.strokeCircle(12, 12, 10); });
    // сирек қарулар
    tex('axe', 26, 26, g => { g.fillStyle(0x6D4C41); g.fillRect(11, 4, 4, 22); g.fillStyle(0xCFD8DC); g.fillTriangle(15, 2, 26, 6, 15, 14); g.fillTriangle(11, 2, 0, 6, 11, 14); g.lineStyle(1.5, 0x455A64); g.strokeTriangle(15, 2, 26, 6, 15, 14); g.strokeTriangle(11, 2, 0, 6, 11, 14); });
    tex('eagle', 34, 20, g => { g.fillStyle(0x5D4037); g.fillTriangle(0, 4, 17, 10, 6, 16); g.fillTriangle(34, 4, 17, 10, 28, 16); g.fillStyle(0x795548); g.fillEllipse(17, 10, 14, 9); g.fillStyle(0xFFF8E1); g.fillCircle(24, 8, 3.5); g.fillStyle(0xFFB300); g.fillTriangle(27, 7, 32, 9, 27, 10); });
    g.destroy();
    if (window.APP) APP.engineReady();
  }
}

class StageScene extends Phaser.Scene {
  constructor() { super('stage'); }

  init(data) {
    this.st = data.stage;
    this.cfg = STAGES[this.st - 1];
    this.hero = data.hero;
    this.mods = data.mods || {};
    this.t = 0; this.elapsed = 0;
    this.score = 0; this.kills = 0;
    this.lives = 3 + (this.hero.bonus === 'lifePlus' ? 1 : 0) + (this.mods.lives || 0);
    this.maxLives = Math.max(5, this.lives);
    this.livesLost = 0; this.artifacts = 0; this.artNames = [];
    this.invulnUntil = 0; this.shieldUntil = 0; this.cdUntil = 0; this.cdTotal = 1;
    this.slowUntil = 0; this.confuseUntil = 0; this.invisUntil = 0; this.revealUntil = 0; this.dashUntil = 0; this.alliesUntil = 0; this.knockUntil = 0;
    this.facing = new Phaser.Math.Vector2(1, 0);
    this.ended = false; this.dead = false; this.gateOpen = false; this.timeWarned = false;
    this.boss = null; this.bossSpawned = false; this.bossDead = false;
    this.zone = null; this.marks = null; this.zoneOutside = false;
    this.god = !!(window.APP && APP.adminGod);
    // кейіпкер көрсеткіштері
    this.ps = {
      speed: 150 + this.hero.sp * 22,
      pickR: 75 * (this.hero.bonus === 'magnet' ? 1.6 : 1),
      cdMul: 1, dmgMul: this.hero.bonus === 'dmgPlus' ? 1.15 : 1,
      armor: this.hero.df * 0.03,
      iframe: 1500 + this.hero.df * 80 + (this.hero.bonus === 'longShield' ? 1000 : 0)
    };
    this.level = 1; this.xp = 0; this.xpNeed = 5; this.pendingLevels = 0;
    this.weapons = {}; this.passives = {};
    // кейінгі кезеңдерде бастапқы қару күштірек (әр кезең 1-деңгейден басталады)
    this.weapons[this.hero.weapon] = { lvl: 1 + Math.floor((this.st - 1) / 3), next: 0, ang: 0 };
    this.spawnAcc = 0; this.nextWave = 30; this.waveNo = 0; this.nextPickup = 22;
    this.reliefMul = 1; this.calmUntil = 0;   // медициналық көмектен кейінгі жеңілдік
  }

  create() {
    const cfg = this.cfg, st = this.st;
    const rng = new Phaser.Math.RandomDataGenerator(['kdq-map-' + st]);   // карта (қабырға, қақпа) тұрақты
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H).setBackgroundColor(cfg.bg);

    const deco = this.add.graphics().setDepth(0);
    const dark = Phaser.Display.Color.IntegerToColor(cfg.bg).darken(12).color;
    deco.fillStyle(dark, 0.35);
    for (let i = 0; i < 320; i++) deco.fillEllipse(rng.between(0, WORLD_W), rng.between(0, WORLD_H), rng.between(6, 22), rng.between(3, 9));
    deco.lineStyle(6, Phaser.Display.Color.IntegerToColor(cfg.wall).darken(10).color, 1).strokeRect(3, 3, WORLD_W - 6, WORLD_H - 6);

    this.spawn = { x: WORLD_W / 2, y: WORLD_H / 2 };

    // кедергілер (тастар) — карта тұрақты
    this.walls = this.physics.add.staticGroup();
    this.wallRects = [];
    const wallStroke = Phaser.Display.Color.IntegerToColor(cfg.wall).darken(25).color;
    let tries = 0;
    for (let i = 0; i < 8 && tries < 300; tries++) {
      const w = rng.between(70, 190), h = rng.between(60, 170);
      const cx = rng.between(200, WORLD_W - 200), cy = rng.between(160, WORLD_H - 160);
      const R = new Phaser.Geom.Rectangle(cx - w / 2 - 120, cy - h / 2 - 120, w + 240, h + 240);
      if (this.wallRects.some(o => Phaser.Geom.Intersects.RectangleToRectangle(o, R))) continue;
      if (Phaser.Math.Distance.Between(cx, cy, this.spawn.x, this.spawn.y) < 320) continue;
      const r = this.add.rectangle(cx, cy, w, h, cfg.wall).setStrokeStyle(3, wallStroke).setDepth(2);
      this.walls.add(r); this.wallRects.push(new Phaser.Geom.Rectangle(cx - w / 2, cy - h / 2, w, h)); i++;
    }

    // қақпа — карта бойынша тұрақты, ортадан алыс
    const ga = rng.realInRange(0, Math.PI * 2);
    this.gatePos = this.freePosFrom(() => ({ x: WORLD_W / 2 + Math.cos(ga) * 900 + rng.between(-80, 80), y: WORLD_H / 2 + Math.sin(ga) * 560 + rng.between(-60, 60) }), 60);
    this.gate = this.add.image(this.gatePos.x, this.gatePos.y, 'gate_closed').setDepth(3);
    this.gateLabel = this.add.text(this.gatePos.x, this.gatePos.y - 72, 'ЖАБЫҚ', this.txtStyle(16)).setOrigin(0.5).setDepth(4);

    // ойыншы — дөңгелек фото
    const key = 'hero_' + this.hero.id;
    if (this.textures.exists(key)) this.textures.remove(key);
    this.textures.addImage(key, heroCanvas(this.hero, this.hero._img, PLAYER_SIZE));
    this.player = this.physics.add.image(this.spawn.x, this.spawn.y, key).setDepth(10);
    this.player.setCircle(22, PLAYER_SIZE / 2 - 22, PLAYER_SIZE / 2 - 22).setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.walls);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    // топтар
    this.enemies = this.physics.add.group();
    this.physics.add.collider(this.enemies, this.walls);
    this.bullets = this.physics.add.group();
    this.physics.add.collider(this.bullets, this.walls, b => b.destroy());
    this.physics.add.overlap(this.bullets, this.enemies, (b, e) => this.bulletHit(b, e));
    this.ebullets = [];          // жау оқтары (физикасыз, қолмен жылжиды)
    this.gems = [];              // тәжірибе кристалдары
    this.pickups = [];           // жүрек, қалқан, керуен, дауыл
    this.arts = [];
    this.traps = [];
    this.blades = [];            // айналмалы қарудың суреттері
    this.allies = [];
    this.fires = [];            // «Дала өрті» дақтары

    // артефакт, бонус, тұзақ — ӘР ӘРЕКЕТТЕ ЖАҢА ЖЕРДЕ
    const used = [this.gatePos];
    for (let i = 0; i < 3; i++) {
      const p = this.randomFree(40, 520, used, 420); used.push(p);
      const a = this.add.image(p.x, p.y, 'artifact').setDepth(6); a.artName = cfg.art[i];
      this.tweens.add({ targets: a, scale: 1.18, yoyo: true, repeat: -1, duration: 650, ease: 'Sine.easeInOut' });
      this.arts.push(a);
    }
    this.addPickup('heart', this.randomFree(30, 300, used, 200));
    this.addPickup('shield', this.randomFree(30, 250, used, 200));
    const seeTraps = this.hero.bonus === 'seeTraps';
    for (let i = 0; i < 2 + st; i++) {
      const p = this.randomFree(40, 300, used, 150);
      this.traps.push(this.add.image(p.x, p.y, 'trap').setAlpha(seeTraps ? 1 : 0.45).setDepth(1));
    }
    if (seeTraps) this.traps.forEach(tr => this.add.circle(tr.x, tr.y, 22).setStrokeStyle(2, 0xff4444, 0.8).setDepth(1).setData('trapRing', tr));

    this.fx = this.add.graphics().setDepth(12);
    this.fxLow = this.add.graphics().setDepth(3);   // от дақтары (кейіпкердің астында)
    this.setupZones();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE', false);
    if (this.mods.reveal) this.revealUntil = Infinity;
    if (this.mods.slow) this.time.delayedCall(400, () => this.floatText(this.player.x, this.player.y - 40, 'Жаулар баяу (Құдайдан көмек)', '#ffe08a'));
    if (this.mods.lives) this.time.delayedCall(400, () => this.floatText(this.player.x, this.player.y - 40, '+' + this.mods.lives + ' ♥ (Құдайдан көмек)', '#ffe08a'));
    for (let i = 0; i < 4; i++) this.spawnEnemy('g');
    this.hudTick = 0;
    this.events.once('shutdown', () => this.tweens.killAll());
    if (window.APP) APP.stageStarted(this);
  }

  /* ---------- көмекшілер ---------- */
  txtStyle(size) { return { fontFamily: '"Segoe UI", Arial, sans-serif', fontSize: size + 'px', fontStyle: 'bold', color: '#ffffff', stroke: '#1b1b1b', strokeThickness: 4 }; }
  inWall(x, y, m) { const b = new Phaser.Geom.Rectangle(x - m, y - m, m * 2, m * 2); return this.wallRects.some(r => Phaser.Geom.Intersects.RectangleToRectangle(r, b)); }
  freePosFrom(gen, m) {
    for (let i = 0; i < 60; i++) { const p = gen(); p.x = Phaser.Math.Clamp(p.x, 80, WORLD_W - 80); p.y = Phaser.Math.Clamp(p.y, 80, WORLD_H - 80); if (!this.inWall(p.x, p.y, m)) return p; }
    return { x: WORLD_W - 150, y: WORLD_H / 2 };
  }
  // Math.random — әр әрекетте жаңа орын
  randomFree(margin, minFromPlayer, others, minFromOthers) {
    const px = this.player ? this.player.x : this.spawn.x, py = this.player ? this.player.y : this.spawn.y;
    for (let i = 0; i < 300; i++) {
      const x = Phaser.Math.Between(70, WORLD_W - 70), y = Phaser.Math.Between(70, WORLD_H - 70);
      if (Phaser.Math.Distance.Between(x, y, px, py) < minFromPlayer) continue;
      if (this.inWall(x, y, margin)) continue;
      if (others && others.some(o => Phaser.Math.Distance.Between(x, y, o.x, o.y) < (minFromOthers || 0))) continue;
      return { x, y };
    }
    return { x: Phaser.Math.Between(100, WORLD_W - 100), y: Phaser.Math.Between(100, WORLD_H - 100) };
  }
  floatText(x, y, txt, color) {
    const t = this.add.text(x, y, txt, this.txtStyle(17)).setOrigin(0.5).setDepth(50).setColor(color || '#ffffff');
    this.tweens.add({ targets: t, y: y - 42, alpha: 0, duration: 1100, onComplete: () => t.destroy() });
  }
  ring(x, y, r, color) {
    const c = this.add.circle(x, y, 12, color, 0.3).setDepth(13).setStrokeStyle(3, color, 0.9);
    this.tweens.add({ targets: c, radius: r, alpha: 0, duration: 420, onComplete: () => c.destroy() });
  }
  scoreMul() { return this.hero.bonus === 'score20' ? 1.2 : 1; }
  addScore(n) { this.score += Math.round(n * this.scoreMul()); }
  sfx(n) { if (window.APP && APP.sfx) APP.sfx.play(n); }
  enemyHpMul() { return this.marks ? 1 + this.marks.filter(m => !m.done).length * MARKS.hpPerRed : 1; }
  isBossStage() { return !!this.cfg.boss; }
  // жау шығу жиілігі (жау/сек): уақытпен үздіксіз өседі
  spawnRate() {
    const base = SPAWN_BASE + this.st * SPAWN_PER_STAGE;
    const calm = this.t < this.calmUntil ? HELP_CALM_MUL : 1;
    return base * (1 + this.elapsed / SPAWN_GROWTH) * this.reliefMul * calm;
  }
  timeLeft() { return Math.max(0, STAGE_TIME - this.elapsed); }
  enemyList() { return this.enemies.getChildren(); }

  /* ---------- жаулар ---------- */
  spawnEnemy(kind, pos) {
    if (this.enemies.getLength() >= MAX_ENEMIES) return null;
    const st = this.st;
    if (!kind) {
      const pool = [['g', 5]];
      if (st >= 3) pool.push(['r', 2]);
      if (st >= 4) pool.push(['t', 1.3]);
      if (st >= 6) pool.push(['a', 1.2]);
      let sum = pool.reduce((a, p) => a + p[1], 0), r = Math.random() * sum;
      kind = pool.find(p => (r -= p[1]) < 0)[0];
    }
    let p = pos;
    if (!p) {
      const cam = this.cameras.main.worldView, rad = Math.hypot(cam.width, cam.height) / 2 + 90;
      const moving = this.player.body.velocity.lengthSq() > 100, fa = this.facing.angle();
      for (let i = 0; i < 8; i++) {
        const a = Math.random() * Math.PI * 2;
        // жүріп келе жатқан бағыттың дәл алдынан шығармау (әділ болу үшін)
        if (moving && i < 6 && Math.abs(Phaser.Math.Angle.Wrap(a - fa)) < 0.7) continue;
        p = { x: Phaser.Math.Clamp(this.player.x + Math.cos(a) * rad, 30, WORLD_W - 30), y: Phaser.Math.Clamp(this.player.y + Math.sin(a) * rad, 30, WORLD_H - 30) };
        if (!this.inWall(p.x, p.y, 20)) break;
      }
    }
    const T = {
      g: { hp: 8 + st * 3, spd: 48 + st * 4, r: 13, xp: 1, size: 30 },
      r: { hp: 5 + st * 2, spd: 85 + st * 6, r: 11, xp: 1, size: 26 },
      t: { hp: 30 + st * 10, spd: 38 + st * 3, r: 19, xp: 4, size: 44 },
      a: { hp: 10 + st * 3, spd: 50 + st * 3, r: 13, xp: 2, size: 30 }
    }[kind];
    const e = this.enemies.create(p.x, p.y, 'en_' + kind + '_' + st).setDepth(8);
    e.setCircle(T.r, T.size / 2 - T.r, T.size / 2 - T.r).setCollideWorldBounds(true);
    e.kind = kind; e.hp = e.maxHp = Math.round(T.hp * this.enemyHpMul()); e.spd = T.spd * Phaser.Math.FloatBetween(0.9, 1.1) * (this.mods.slow || 1);
    e.r = T.r; e.xp = T.xp; e.stunUntil = 0; e.kbUntil = 0; e.flashUntil = 0; e.hitCd = {}; e.shootAt = this.t + 1500 + Math.random() * 1500; e.wp = null;
    return e;
  }

  damage(e, dmg, kbFrom) {
    if (!e.active) return;
    e.hp -= dmg; e.flashUntil = this.t + 90;
    if (kbFrom && e !== this.boss && e.kind !== 't') {
      const a = Phaser.Math.Angle.Between(kbFrom.x, kbFrom.y, e.x, e.y);
      e.kbUntil = this.t + 90; e.setVelocity(Math.cos(a) * 240, Math.sin(a) * 240);
    }
    if (e === this.boss) { if (window.APP) APP.bossBar(this); }
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e, silent) {
    if (!e.active) return;
    if (e === this.boss) { this.bossDefeated(); return; }
    if (!silent) {
      this.kills++; this.addScore(5 * this.st); this.sfx('kill');
      this.dropGem(e.x, e.y, e.xp);
      if (Math.random() < 0.012) this.addPickup('heart', { x: e.x, y: e.y });
    }
    e.destroy();
  }

  dropGem(x, y, v) {
    const g = this.add.image(x, y, v >= 3 ? 'gem_big' : 'gem').setDepth(4);
    g.v = v; this.gems.push(g);
    if (this.gems.length > 220) { const o = this.gems.shift(); this.gainXp(o.v); o.destroy(); }
    return g;
  }

  bulletHit(b, e) {
    if (!b.active || !e.active || b.hitSet.has(e)) return;
    b.hitSet.add(e); this.damage(e, b.dmg, b);
    if (--b.pierce <= 0) b.destroy();
  }

  /* ---------- босс (bullet hell) ---------- */
  spawnBoss() {
    this.bossSpawned = true;
    const p = this.randomFree(60, 420, null, 0);
    const b = this.physics.add.image(p.x, p.y, 'boss_' + this.st).setDepth(9);
    b.setCircle(40, 8, 8).setCollideWorldBounds(true);
    this.physics.add.collider(b, this.walls);
    // оқтар боссқа да тиеді (бұрын тек жауларға тиетін)
    this.physics.add.overlap(this.bullets, b, (o1, o2) => this.bulletHit(o1 === b ? o2 : o1, b));
    b.hp = b.maxHp = this.cfg.bossHp; b.stunUntil = 0; b.flashUntil = 0; b.hitCd = {}; b.r = 40;
    b.nextAttack = this.t + 2000; b.pattern = 0; b.spiralLeft = 0; b.spiralAt = 0; b.spiralAng = 0;
    this.boss = b;
    this.bossLabel = this.add.text(b.x, b.y - 62, this.cfg.bossName, this.txtStyle(15)).setOrigin(0.5).setDepth(11);
    this.cameras.main.shake(300, 0.01);
    if (window.APP) { APP.toast('⚠ БОСС шықты: ' + this.cfg.bossName); APP.bossBar(this); }
  }

  bossDefeated() {
    const b = this.boss; if (!b) return;
    this.ring(b.x, b.y, 200, 0xFFD24A);
    for (let i = 0; i < 14; i++) this.dropGem(b.x + Phaser.Math.Between(-60, 60), b.y + Phaser.Math.Between(-60, 60), 3);
    this.addScore(1500 * this.st / 5); this.kills++;
    b.destroy(); this.bossLabel.destroy(); this.boss = null; this.bossDead = true;
    this.ebullets.forEach(o => o.destroy()); this.ebullets = [];
    if (window.APP) { APP.toast('Босс жеңілді!'); APP.bossBar(this); }
    this.checkGate();
  }

  fireEnemyBullet(x, y, ang, speed) {
    if (this.ebullets.length > 260) return;
    const o = this.add.image(x, y, 'ebullet').setDepth(9);
    o.vx = Math.cos(ang) * speed; o.vy = Math.sin(ang) * speed; o.dieAt = this.t + 6000;
    this.ebullets.push(o);
  }

  updateBoss(dt, slowF) {
    const b = this.boss, p = this.player, t = this.t;
    if (!b) return;
    this.bossLabel.setPosition(b.x, b.y - 62);
    const ratio = b.hp / b.maxHp, phase = ratio < 0.33 ? 3 : ratio < 0.66 ? 2 : 1;
    if (b.stunUntil > t) { b.setVelocity(0); b.setAlpha(0.6); return; }
    b.setAlpha(t < b.flashUntil ? 0.6 : 1);
    if (t < this.invisUntil) b.setVelocity(0); else this.physics.moveToObject(b, p, (48 + this.st * 2) * slowF * (this.mods.slow || 1));
    if (Phaser.Math.Distance.Between(b.x, b.y, p.x, p.y) < b.r + 20) this.hitPlayer(b);
    // спираль
    if (b.spiralLeft > 0 && t >= b.spiralAt) {
      b.spiralLeft--; b.spiralAt = t + 95; b.spiralAng += 0.33;
      for (let k = 0; k < 2 + (phase > 1 ? 1 : 0); k++) this.fireEnemyBullet(b.x, b.y, b.spiralAng + k * Math.PI * 2 / (2 + (phase > 1 ? 1 : 0)), 170);
    }
    if (t < b.nextAttack) return;
    const pat = b.pattern++ % 3;
    const aim = Phaser.Math.Angle.Between(b.x, b.y, p.x, p.y);
    if (pat === 0) { const n = 12 + phase * 4; for (let k = 0; k < n; k++) this.fireEnemyBullet(b.x, b.y, k * Math.PI * 2 / n + b.pattern * 0.2, 150 + phase * 20); }
    if (pat === 1) { const n = 5 + phase * 2, spread = 0.9; for (let k = 0; k < n; k++) this.fireEnemyBullet(b.x, b.y, aim - spread / 2 + spread * k / (n - 1), 210); }
    if (pat === 2) { b.spiralLeft = 16 + phase * 6; b.spiralAt = t; }
    b.nextAttack = t + 2700 - phase * 500;
  }

  /* ---------- ойыншы ---------- */
  hitPlayer(src) {
    if (this.ended || this.dead || this.god) return;
    const t = this.t;
    if (t < this.invulnUntil || t < this.shieldUntil) return;
    if (t < this.dashUntil && src && src.hp != null) { this.damage(src, 30 * this.ps.dmgMul, this.player); return; }
    if (Math.random() < this.ps.armor) { this.invulnUntil = t + 500; this.floatText(this.player.x, this.player.y - 34, 'Бөгелді!', '#9fe0ff'); return; }
    this.lives--; this.livesLost++;
    this.invulnUntil = t + this.ps.iframe;
    this.cameras.main.shake(180, 0.008);
    if (src) {
      const ang = Phaser.Math.Angle.Between(src.x, src.y, this.player.x, this.player.y);
      this.player.setVelocity(Math.cos(ang) * 380, Math.sin(ang) * 380); this.knockUntil = t + 150;
    }
    this.floatText(this.player.x, this.player.y - 34, '−1 ♥', '#ff8a8a'); this.sfx('hurt');
    if (this.lives <= 0) this.die();
  }

  die() {
    this.lives = 0; this.dead = true; this.player.setVelocity(0); this.physics.pause();
    if (window.APP) APP.onDeath(this);
  }

  revive(lives) {
    this.lives = Math.min(lives, this.maxLives); this.dead = false;
    this.invulnUntil = this.t + 3000;
    // картадағы БАРЛЫҚ жау өледі, кристалдары ойыншыға ұшады (босс тек есеңгірейді)
    let killed = 0;
    this.enemyList().slice().forEach(e => {
      if (!e.active) return;
      const g = this.dropGem(e.x, e.y, e.xp); if (g) g.pull = true;
      this.kills++; killed++; e.destroy();
    });
    this.gems.forEach(g => g.pull = true);
    this.ebullets.forEach(o => o.destroy()); this.ebullets = [];
    if (this.boss) this.boss.stunUntil = this.t + 4000;
    // жаулар біраз азаяды, бірақ уақытпен өсуі тоқтамайды
    this.reliefMul *= HELP_SPAWN_RELIEF;
    // 3-кезең: аймақ ойыншы тұрған жерге келеді, содан кейін өз жолын жалғастырады
    if (this.zone) { const z = this.zone, m = SAFE_ZONE.radius * 0.6; z.state = 'move'; z.returning = true; z.speed = SAFE_ZONE.returnSpeed; z.tx = Phaser.Math.Clamp(this.player.x, m, WORLD_W - m); z.ty = Phaser.Math.Clamp(this.player.y, m, WORLD_H - m); z.outT = 0; }
    this.calmUntil = this.t + HELP_CALM_SEC * 1000;
    this.nextWave = Math.max(this.nextWave, this.elapsed + HELP_CALM_SEC);
    this.spawnAcc = 0;
    this.physics.resume();
    this.cameras.main.flash(300, 200, 255, 210);
    this.ring(this.player.x, this.player.y, 900, 0x7CFF9B);
    if (killed && window.APP) APP.toast('Медициналық көмек: ' + killed + ' жау жойылды, кристалдар саған ұшып келеді');
    this.floatText(this.player.x, this.player.y - 40, '+' + lives + ' ♥ Медициналық көмек', '#9dffb4');
  }

  win() {
    if (this.ended) return;
    this.ended = true; this.physics.pause();
    if (window.APP) APP.onWin(this);
  }

  checkGate() {
    if (this.gateOpen || this.artifacts < 3) return;
    const ok = this.isBossStage() ? this.bossDead : this.elapsed >= STAGE_TIME;
    if (!ok) return;
    this.gateOpen = true;
    this.gate.setTexture('gate_open'); this.gateLabel.setText('АШЫҚ →').setColor('#c8ffd6');
    this.tweens.add({ targets: this.gate, scale: 1.08, yoyo: true, repeat: -1, duration: 500 });
    if (window.APP) APP.toast('Қақпа ашылды! Картадағы жасыл белгіге жет.');
  }

  /* ---------- тәжірибе және деңгей ---------- */
  gainXp(v) {
    this.xp += v;
    while (this.xp >= this.xpNeed) {
      this.xp -= this.xpNeed; this.level++; this.pendingLevels++; this.sfx('levelup');
      this.xpNeed = Math.round(5 + this.level * 4 + this.level * this.level * 0.35);
    }
  }

  weaponStats(k) {
    const w = this.weapons[k], b = WEAPONS[k], L = w.lvl, extra = Math.floor((L - 1) / 2);
    return {
      dmg: b.dmg * (1 + 0.3 * (L - 1)) * this.ps.dmgMul,
      cd: (b.cd || 0) * (1 - 0.07 * (L - 1)) * this.ps.cdMul,
      count: (b.count || 1) + (k === 'aura' || k === 'nova' || k === 'ort' ? 0 : extra),
      radius: (b.radius || 0) * (1 + 0.12 * (L - 1)),
      speed: b.speed, pierce: b.pierce, tick: b.tick, rot: b.rot
    };
  }

  rollUpgrades(n) {
    const pool = [];
    const owned = Object.keys(this.weapons);
    Object.keys(WEAPONS).forEach(k => {
      if (this.weapons[k]) { if (this.weapons[k].lvl < 5) pool.push({ id: 'w:' + k, kind: 'weapon', key: k, lvl: this.weapons[k].lvl + 1 }); }
      else if (owned.length < MAX_WEAPONS) pool.push({ id: 'w:' + k, kind: 'weapon', key: k, lvl: 1, isNew: true });
    });
    Object.keys(PASSIVES).forEach(k => {
      const l = this.passives[k] || 0;
      if (l < PASSIVES[k].max) pool.push({ id: 'p:' + k, kind: 'passive', key: k, lvl: l + 1 });
    });
    // сирек қарулар: әдепкі тізімде жоқ, тек RARE_CHANCE мүмкіндігімен біреуі қосылады
    const rareNew = pool.filter(u => u.kind === 'weapon' && u.isNew && WEAPONS[u.key].rare);
    const rest = pool.filter(u => !rareNew.includes(u));
    Phaser.Utils.Array.Shuffle(rest);
    const pick = rest.slice(0, n);
    if (rareNew.length && Math.random() < RARE_CHANCE) {
      const r = Phaser.Utils.Array.GetRandom(rareNew); r.rare = true;
      pick.splice(Math.floor(Math.random() * (pick.length < n ? pick.length + 1 : n)), pick.length < n ? 0 : 1, r);
    }
    if (!pick.length) pick.push({ id: 'heal', kind: 'heal' }, { id: 'gold', kind: 'gold' });
    return pick;
  }

  applyUpgrade(u) {
    if (u.kind === 'weapon') {
      if (this.weapons[u.key]) this.weapons[u.key].lvl++;
      else this.weapons[u.key] = { lvl: 1, next: this.t + 300, ang: 0 };
    } else if (u.kind === 'passive') {
      const l = this.passives[u.key] = (this.passives[u.key] || 0) + 1;
      const ps = this.ps;
      if (u.key === 'tulpar') ps.speed *= 1.10;
      if (u.key === 'sauyt') ps.armor += 0.07;
      if (u.key === 'keruen') ps.pickR *= 1.35;
      if (u.key === 'shabyt') ps.cdMul *= 0.92;
      if (u.key === 'kush') ps.dmgMul *= 1.12;
      if (u.key === 'bata') { this.maxLives++; this.lives = Math.min(this.lives + 1, this.maxLives); }
      void l;
    } else if (u.kind === 'heal') this.lives = Math.min(this.lives + 1, this.maxLives);
    else if (u.kind === 'gold') this.addScore(300);
    this.pendingLevels = Math.max(0, this.pendingLevels - 1);
  }

  /* ---------- қарулар ---------- */
  nearest(n, maxD) {
    const p = this.player;
    const list = this.enemyList().map(e => ({ e, d: Phaser.Math.Distance.Between(e.x, e.y, p.x, p.y) })).filter(o => o.d < maxD);
    if (this.boss) { const d = Phaser.Math.Distance.Between(this.boss.x, this.boss.y, p.x, p.y); if (d < maxD) list.push({ e: this.boss, d }); }
    list.sort((a, b) => a.d - b.d);
    return list.slice(0, n).map(o => o.e);
  }

  shoot(tex, ang, s) {
    const p = this.player;
    const b = this.bullets.create(p.x, p.y, tex).setDepth(7);
    b.body.setAllowGravity(false); b.setRotation(ang);
    b.setVelocity(Math.cos(ang) * s.speed, Math.sin(ang) * s.speed);
    b.dmg = s.dmg; b.pierce = s.pierce; b.dieAt = this.t + 1500; b.hitSet = new Set();
    return b;
  }

  hitArea(x, y, r, dmg, key, cd, kb) {
    const t = this.t;
    const targets = this.enemyList().slice(); if (this.boss) targets.push(this.boss);
    targets.forEach(e => {
      if (!e.active) return;
      if (Phaser.Math.Distance.Between(e.x, e.y, x, y) > r + e.r) return;
      if (key) { if ((e.hitCd[key] || 0) > t) return; e.hitCd[key] = t + cd; }
      this.damage(e, dmg, kb ? { x, y } : null);
    });
  }

  updateWeapons(dt) {
    const t = this.t, p = this.player;
    const snap = {}; for (const k in this.weapons) snap[k] = this.weapons[k].next;   // атыс дыбысы үшін
    for (const k of Object.keys(this.weapons)) {
      const w = this.weapons[k], s = this.weaponStats(k);
      if (k === 'arrow' && t >= w.next) {
        const tg = this.nearest(s.count, 650);
        if (!tg.length) { w.next = t + 200; continue; }
        for (let i = 0; i < s.count; i++) { const e = tg[i % tg.length]; this.shoot('arrow', Phaser.Math.Angle.Between(p.x, p.y, e.x, e.y), s); }
        w.next = t + s.cd;
      }
      if (k === 'spread' && t >= w.next) {
        const tg = this.nearest(1, 600);
        if (!tg.length) { w.next = t + 200; continue; }
        const base = Phaser.Math.Angle.Between(p.x, p.y, tg[0].x, tg[0].y), n = s.count, step = 0.2;
        for (let i = 0; i < n; i++) this.shoot('arrow', base + (i - (n - 1) / 2) * step, s);
        w.next = t + s.cd;
      }
      if (k === 'lance' && t >= w.next) {
        const ang = this.facing.angle();
        for (let i = 0; i < s.count; i++) {
          const b = this.shoot('lance', ang, s);
          const off = (i - (s.count - 1) / 2) * 18;
          b.x += Math.cos(ang + Math.PI / 2) * off; b.y += Math.sin(ang + Math.PI / 2) * off;
        }
        w.next = t + s.cd;
      }
      if (k === 'orbit') {
        const tex = this.hero.id === 'farabi' ? 'book' : 'blade';
        while (this.blades.length < s.count) this.blades.push(this.add.image(p.x, p.y, tex).setDepth(11));
        w.ang += dt * 0.001 * s.rot;
        this.blades.forEach((bl, i) => {
          const a = w.ang + i * Math.PI * 2 / this.blades.length;
          bl.setPosition(p.x + Math.cos(a) * s.radius, p.y + Math.sin(a) * s.radius).setRotation(a + Math.PI / 2);
          this.hitArea(bl.x, bl.y, 14, s.dmg, 'orbit' + i, 380, true);
        });
      }
      if (k === 'aura' && t >= w.next) { this.hitArea(p.x, p.y, s.radius, s.dmg, null, 0, false); w.next = t + s.tick; }
      if (k === 'nova' && t >= w.next) {
        this.ring(p.x, p.y, s.radius, 0xFFE08A);
        this.hitArea(p.x, p.y, s.radius, s.dmg, null, 0, true);
        w.next = t + s.cd;
      }
      // ---- сирек қарулар ----
      if (k === 'qamshy' && t >= w.next) {
        const base = this.facing.angle();
        for (let i = 0; i < Math.min(s.count, 4); i++) this.whip(base + i * Math.PI / (s.count > 2 ? 2 : 1), s);
        w.next = t + s.cd;
      }
      if (k === 'aibalta' && t >= w.next) {
        for (let i = 0; i < s.count; i++) {
          const b = this.bullets.create(p.x, p.y, 'axe').setDepth(7);
          b.body.setGravityY(950); b.setVelocity(Phaser.Math.Between(-170, 170), -s.speed - Phaser.Math.Between(0, 120));
          b.setAngularVelocity(720); b.dmg = s.dmg; b.pierce = s.pierce; b.dieAt = t + 2200; b.hitSet = new Set(); b.noWall = true;
        }
        w.next = t + s.cd;
      }
      if (k === 'naizagai' && t >= w.next) {
        const cam = this.cameras.main.worldView;
        const vis = this.enemyList().filter(e => cam.contains(e.x, e.y));
        if (this.boss && cam.contains(this.boss.x, this.boss.y)) vis.push(this.boss);
        if (!vis.length) { w.next = t + 250; continue; }
        Phaser.Utils.Array.Shuffle(vis).slice(0, s.count).forEach(e => { this.bolt(e.x, e.y); this.hitArea(e.x, e.y, 34, s.dmg, null, 0, false); });
        w.next = t + s.cd;
      }
      if (k === 'ort') {
        if (t >= w.next) { this.fires.push({ x: p.x, y: p.y, r: s.radius, until: t + (WEAPONS.ort.life || 3000), id: 'fire' + (this.fireId = (this.fireId || 0) + 1) }); w.next = t + s.cd; }
      }
      if (k === 'burkit' && t >= w.next) {
        const tg = this.nearest(1, 700);
        if (!tg.length) { w.next = t + 250; continue; }
        for (let i = 0; i < s.count; i++) {
          const ang = Phaser.Math.Angle.Between(p.x, p.y, tg[0].x, tg[0].y) + (i - (s.count - 1) / 2) * 0.6;
          const b = this.shoot('eagle', ang, s); b.homing = true; b.dieAt = t + 3000;
        }
        w.next = t + s.cd;
      }
    }
    // атқан қаруға дыбыс
    for (const k in this.weapons) { const w = this.weapons[k]; if (snap[k] !== undefined && w.next !== snap[k] && w.next - t > 300) this.sfx('w_' + k); }
    // от дақтары
    if (this.fires.length) {
      const fs = this.weapons.ort ? this.weaponStats('ort') : null;
      this.fires = this.fires.filter(f => t < f.until);
      if (fs) this.fires.forEach(f => this.hitArea(f.x, f.y, f.r, fs.dmg, f.id, fs.tick, false));
    }
    // бүркіт жауды қуады
    this.bullets.getChildren().forEach(b => {
      if (!b.homing || !b.active) return;
      const tg = this.nearest(1, 600)[0]; if (!tg) return;
      const cur = Math.atan2(b.body.velocity.y, b.body.velocity.x), want = Phaser.Math.Angle.Between(b.x, b.y, tg.x, tg.y);
      const a = Phaser.Math.Angle.RotateTo(cur, want, 0.09), sp = WEAPONS.burkit.speed;
      b.setVelocity(Math.cos(a) * sp, Math.sin(a) * sp); b.setRotation(a);
    });
  }

  // қамшы: алдыңғы жақтағы ұзын аймақ
  whip(ang, s) {
    const p = this.player, len = s.radius, wid = 46;
    const g = this.add.graphics().setDepth(12);
    const cx = p.x + Math.cos(ang) * (len / 2 + 20), cy = p.y + Math.sin(ang) * (len / 2 + 20);
    g.fillStyle(0xFFF3C4, 0.55); g.lineStyle(3, 0x8D6E63, 0.9);
    const pts = [[-len / 2, -wid / 2], [len / 2, -wid / 4], [len / 2, wid / 4], [-len / 2, wid / 2]].map(([lx, ly]) => ({ x: cx + lx * Math.cos(ang) - ly * Math.sin(ang), y: cy + lx * Math.sin(ang) + ly * Math.cos(ang) }));
    g.fillPoints(pts, true); g.strokePoints(pts, true);
    this.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
    const targets = this.enemyList().slice(); if (this.boss) targets.push(this.boss);
    targets.forEach(e => {
      if (!e.active) return;
      const dx = e.x - p.x, dy = e.y - p.y;
      const along = dx * Math.cos(ang) + dy * Math.sin(ang), perp = -dx * Math.sin(ang) + dy * Math.cos(ang);
      if (along > 10 && along < len + 30 + e.r && Math.abs(perp) < wid / 2 + e.r) this.damage(e, s.dmg, p);
    });
  }

  // найзағай эффектісі
  bolt(x, y) {
    const g = this.add.graphics().setDepth(14);
    g.lineStyle(4, 0xB3E5FC, 1);
    let px = x + Phaser.Math.Between(-30, 30), py = y - 260;
    g.beginPath(); g.moveTo(px, py);
    for (let i = 1; i <= 6; i++) { px = x + (i < 6 ? Phaser.Math.Between(-22, 22) : 0); py = y - 260 + i * 260 / 6; g.lineTo(px, py); }
    g.strokePath();
    g.fillStyle(0xE1F5FE, 0.6); g.fillCircle(x, y, 26);
    this.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
  }

  /* ---------- аймақтар: 3-кезең (жылжымалы) және 8-кезең (белгілер) ---------- */
  setupZones() {
    if (this.cfg.zone === 'moving') {
      this.zone = { x: this.spawn.x, y: this.spawn.y, r: SAFE_ZONE.radius, dir: 0, state: 'wait', until: this.t + SAFE_ZONE.wait, tx: 0, ty: 0, speed: SAFE_ZONE.speed, outT: 0, nextPoison: 0, returning: false };
      this.time.delayedCall(600, () => window.APP && APP.toast('Көк шеңбер — қауіпсіз аймақ. Одан шықсаң уланасың!'));
    }
    if (this.cfg.zone === 'marks') {
      this.marks = [];
      const used = [this.gatePos].concat(this.arts.map(a => ({ x: a.x, y: a.y })));
      for (let i = 0; i < MARKS.count; i++) {
        const p = this.randomFree(MARKS.radius, 320, used, 380); used.push(p);
        this.marks.push({ x: p.x, y: p.y, r: MARKS.radius, prog: 0, done: false });
      }
      this.time.delayedCall(600, () => window.APP && APP.toast('Қызыл белгілер жауларды күшейтеді. Әрқайсысында 7 сек тұр!'));
    }
  }

  updateZones(dt) {
    const t = this.t, p = this.player;
    if (this.zone) {
      const z = this.zone, Z = SAFE_ZONE, m = Z.radius * 0.6;
      if (z.state === 'wait' && t >= z.until) {
        // бағыт кезегі: жоғары, сол, төмен, оң; шекарадан шықса — қарама-қарсы жаққа
        const dirs = [[0, -1], [-1, 0], [0, 1], [1, 0]];
        let d = dirs[z.dir % 4], tx = z.x + d[0] * Z.step, ty = z.y + d[1] * Z.step;
        if (tx < m || tx > WORLD_W - m || ty < m || ty > WORLD_H - m) { tx = z.x - d[0] * Z.step; ty = z.y - d[1] * Z.step; }
        z.tx = Phaser.Math.Clamp(tx, m, WORLD_W - m); z.ty = Phaser.Math.Clamp(ty, m, WORLD_H - m);
        z.dir++; z.state = 'move'; z.speed = Z.speed;
      }
      if (z.state === 'move') {
        const dist = Phaser.Math.Distance.Between(z.x, z.y, z.tx, z.ty), stepLen = z.speed * dt / 1000;
        if (dist <= stepLen) { z.x = z.tx; z.y = z.ty; z.state = 'wait'; z.until = t + (z.returning ? 2500 : Z.wait); z.returning = false; }
        else { z.x += (z.tx - z.x) / dist * stepLen; z.y += (z.ty - z.y) / dist * stepLen; }
      }
      const out = Phaser.Math.Distance.Between(p.x, p.y, z.x, z.y) > z.r && !z.returning;
      this.zoneOutside = out;
      if (out) {
        z.outT += dt;
        if (z.outT >= Z.grace && t >= z.nextPoison) { z.nextPoison = t + Z.poisonEvery; this.poisonHit(); }
      } else z.outT = 0;
    }
    if (this.marks) {
      this.marks.forEach(mk => {
        if (mk.done) return;
        if (Phaser.Math.Distance.Between(p.x, p.y, mk.x, mk.y) < mk.r) {
          mk.prog += dt;
          if (mk.prog >= MARKS.hold) {
            mk.done = true; this.sfx('zone'); this.ring(mk.x, mk.y, mk.r * 1.6, 0x46C46B);
            const red = this.marks.filter(m => !m.done).length;
            if (window.APP) APP.toast(red ? 'Белгі жасыл болды! Қалған қызыл белгі: ' + red : 'Барлық белгі жасыл! Жаулар әлсіреді');
            // бар жаулардың HP-ын жаңа деңгейге түсіру
            const k = this.enemyHpMul() / (this.enemyHpMul() + MARKS.hpPerRed);
            this.enemyList().forEach(e => { e.hp = Math.max(1, e.hp * k); e.maxHp = e.maxHp * k; });
          }
        }
      });
    }
  }

  poisonHit() {
    if (this.ended || this.dead || this.god) return;
    this.lives--; this.livesLost++;
    this.cameras.main.shake(140, 0.006);
    this.floatText(this.player.x, this.player.y - 34, '☠ Улану −1 ♥', '#d1b3ff'); this.sfx('hurt');
    if (this.lives <= 0) this.die();
  }

  drawZones(g) {
    if (this.zone) {
      const z = this.zone;
      g.lineStyle(2000, 0x5E35B1, 0.16); g.strokeCircle(z.x, z.y, z.r + 1000);     // сырты — күлгін «у»
      g.lineStyle(6, 0x4FC3F7, 0.95); g.strokeCircle(z.x, z.y, z.r);
      if (z.state === 'move') { g.lineStyle(3, 0x4FC3F7, 0.35); g.strokeCircle(z.tx, z.ty, z.r); }
    }
    if (this.marks) {
      this.marks.forEach(mk => {
        const col = mk.done ? 0x46C46B : 0xE53935;
        g.fillStyle(col, 0.28); g.fillCircle(mk.x, mk.y, mk.r);
        g.lineStyle(3, col, 0.85); g.strokeCircle(mk.x, mk.y, mk.r);
        if (!mk.done && mk.prog > 0) {
          g.lineStyle(7, 0x46C46B, 0.95); g.beginPath();
          g.arc(mk.x, mk.y, mk.r + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * mk.prog / MARKS.hold, false); g.strokePath();
        }
      });
    }
  }

  /* ---------- бонустар ---------- */
  addPickup(type, pos) {
    const o = this.add.image(pos.x, pos.y, type).setDepth(5); o.ptype = type;
    this.tweens.add({ targets: o, y: pos.y - 5, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.easeInOut' });
    this.pickups.push(o);
  }

  takePickup(o) {
    const p = this.player;
    if (o.ptype === 'heart') { this.lives = Math.min(this.lives + 1, this.maxLives); this.floatText(p.x, p.y - 30, '+1 ♥', '#ff8a8a'); }
    if (o.ptype === 'shield') { this.shieldUntil = this.t + 6000; this.floatText(p.x, p.y - 30, 'Қалқан 6 сек', '#9fe0ff'); }
    if (o.ptype === 'keruen') { this.gems.forEach(g => g.pull = true); this.floatText(p.x, p.y - 30, 'Керуен: барлық кристалл', '#b3e9ff'); }
    if (o.ptype === 'dauyl') {
      const cam = this.cameras.main.worldView;
      this.enemyList().slice().forEach(e => { if (cam.contains(e.x, e.y)) this.killEnemy(e); });
      if (this.boss) this.damage(this.boss, this.boss.maxHp * 0.08);
      this.cameras.main.flash(250, 255, 240, 200);
      this.floatText(p.x, p.y - 30, 'Дала дауылы!', '#ffcc80');
    }
    o.destroy();
  }

  /* ---------- арнайы қабілет (Пробел) ---------- */
  cdLeft() { return Math.max(0, this.cdUntil - this.t); }

  useAbility() {
    if (this.ended || this.dead || this.cdLeft() > 0) return;
    const h = this.hero, p = this.player, t = this.t;
    this.cdTotal = h.cd * (h.bonus === 'fastCd' ? 0.7 : 1) * 1000;
    this.cdUntil = t + this.cdTotal;
    const near = r => this.enemyList().filter(e => Phaser.Math.Distance.Between(e.x, e.y, p.x, p.y) < r);
    switch (h.ability) {
      case 'freeze': near(300).forEach(e => e.stunUntil = t + 3000); if (this.boss) this.boss.stunUntil = t + 1200; this.ring(p.x, p.y, 300, 0x9ecbff); break;
      case 'confuse': this.confuseUntil = t + 5000; this.ring(p.x, p.y, 400, 0xffe08a); break;
      case 'dash': this.dashUntil = t + 280; this.invulnUntil = Math.max(this.invulnUntil, t + 450); p.setVelocity(this.facing.x * 780, this.facing.y * 780); break;
      case 'slow': this.slowUntil = t + 8000; this.ring(p.x, p.y, 500, 0xb6a6ff); break;
      case 'reveal': this.revealUntil = Math.max(this.revealUntil, t + 8000); this.gems.forEach(g => g.pull = true); break;
      case 'clearTraps':
        this.traps.slice().forEach(tr => { if (Phaser.Math.Distance.Between(tr.x, tr.y, p.x, p.y) < 450) { this.ring(tr.x, tr.y, 50, 0xffffff); tr.destroy(); this.traps.splice(this.traps.indexOf(tr), 1); } });
        near(260).forEach(e => { e.stunUntil = t + 1000; this.damage(e, 10, p); });
        this.ring(p.x, p.y, 450, 0xffffff); break;
      case 'allies':
        this.alliesUntil = t + 10000; this.allies.forEach(a => a.destroy()); this.allies = [];
        for (let i = 0; i < 2; i++) { const a = this.add.image(p.x, p.y, 'ally').setDepth(9); a.phase = i * Math.PI; this.allies.push(a); }
        break;
      case 'strike': near(200).forEach(e => { e.stunUntil = t + 2000; this.damage(e, 45 * this.ps.dmgMul, p); }); if (this.boss && Phaser.Math.Distance.Between(this.boss.x, this.boss.y, p.x, p.y) < 240) this.damage(this.boss, 60 * this.ps.dmgMul); this.ring(p.x, p.y, 200, 0xff9b5e); break;
      case 'invis': this.invisUntil = t + 4000; break;
    }
    this.floatText(p.x, p.y - 38, h.abilityName, '#ffe08a');
  }

  /* ---------- админ ---------- */
  adminFreezeAll() { this.enemyList().forEach(e => e.stunUntil = this.t + 10000); if (this.boss) this.boss.stunUntil = this.t + 10000; }
  adminKillAll() { this.enemyList().slice().forEach(e => this.killEnemy(e)); if (this.boss) this.bossDefeated(); }
  adminArtifacts() { this.arts.slice().forEach(a => this.pickArtifact(a)); }
  adminKillPlayer() { if (this.dead || this.ended) return; const g = this.god; this.god = false; this.lives = 1; this.invulnUntil = 0; this.shieldUntil = 0; this.dashUntil = 0; this.ps.armor = Math.min(this.ps.armor, 0); this.hitPlayer(null); this.ps.armor = this.hero.df * 0.03 + (this.passives.sauyt || 0) * 0.07; this.god = g; }
  adminLevelUp() { this.gainXp(this.xpNeed - this.xp); }
  adminSkipTime() { this.t = Math.max(this.t, STAGE_TIME * 1000); this.elapsed = this.t / 1000; if (this.isBossStage() && !this.bossSpawned) this.spawnBoss(); this.checkGate(); }
  adminSpawnBoss() { if (!this.boss && !this.bossDead) { if (!this.cfg.boss) return false; this.spawnBoss(); } return true; }

  pickArtifact(a) {
    const name = a.artName; a.destroy(); this.arts.splice(this.arts.indexOf(a), 1);
    this.artifacts++; this.artNames.push(name); this.addScore(250);
    this.ring(this.player.x, this.player.y, 90, 0xFFD24A);
    if (window.APP) APP.toast('Артефакт табылды: ' + name + ' (' + this.artifacts + '/3)');
    if (this.artifacts >= 3) {
      if (this.isBossStage() && !this.bossDead && window.APP) APP.toast(this.bossSpawned ? 'Қақпаны ашу үшін боссты жең!' : 'Қақпа босс жеңілгенде ашылады');
      else if (!this.isBossStage() && this.elapsed < STAGE_TIME && window.APP) APP.toast('Қақпа таймер біткенде ашылады — тірі қал!');
    }
    this.checkGate();
  }

  /* ================= ОЙЫН ЦИКЛІ ================= */
  update(time, delta) {
    if (this.ended || this.dead) return;
    const dt = Math.min(delta, 50);
    this.t += dt; this.elapsed = this.t / 1000;
    const t = this.t, p = this.player, k = this.keys;

    // 1. Енгізу + қозғалыс
    if (Phaser.Input.Keyboard.JustDown(k.SPACE)) this.useAbility();
    if (t >= this.dashUntil && t >= this.knockUntil) {
      let vx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
      let vy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
      const ptr = this.input.activePointer;
      if (!vx && !vy && ptr.isDown) { const wp = ptr.positionToCamera(this.cameras.main), dx = wp.x - p.x, dy = wp.y - p.y; if (Math.hypot(dx, dy) > 16) { vx = dx; vy = dy; } }
      const v = new Phaser.Math.Vector2(vx, vy);
      if (v.lengthSq() > 0) { v.normalize(); this.facing.copy(v); }
      v.scale(this.ps.speed); p.setVelocity(v.x, v.y);
    }
    const invis = t < this.invisUntil;
    p.setAlpha(invis ? 0.35 : (t < this.invulnUntil && Math.floor(t / 90) % 2 ? 0.45 : 1));

    // 2. Жау шығару: үздіксіз + 30 сек сайын толқын + босс
    const bossAlive = !!this.boss;
    // жиілік уақыт өткен сайын тоқтамай өседі (кезең біткенше), көмектен кейін сәл азаяды
    this.spawnAcc += dt / 1000 * this.spawnRate() * (bossAlive ? 0.4 : 1);
    while (this.spawnAcc >= 1) { this.spawnAcc--; this.spawnEnemy(); }
    if (this.elapsed >= this.nextWave) {
      this.nextWave += 30; this.waveNo++;
      const n = Math.round((5 + this.st * 1.5 + this.waveNo * WAVE_GROWTH) * this.reliefMul); for (let i = 0; i < n; i++) this.spawnEnemy();
      if (window.APP) APP.toast('Толқын! ' + this.cfg.enemyName + ' келе жатыр');
    }
    if (this.isBossStage() && !this.bossSpawned && this.elapsed >= BOSS_AT) this.spawnBoss();
    if (!this.isBossStage() && this.elapsed >= STAGE_TIME) {
      if (!this.gateOpen) this.checkGate();
      if (!this.gateOpen && !this.timeWarned && window.APP) { this.timeWarned = true; APP.toast('Уақыт бітті! Қалған артефактілерді тап.'); }
    }

    // 3. Жау AI
    const slowF = t < this.slowUntil ? 0.5 : 1;
    this.enemyList().slice().forEach(e => {
      if (!e.active) return;
      const d = Phaser.Math.Distance.Between(e.x, e.y, p.x, p.y);
      if (d > 1500) { // тым алыстағы жауды ойыншыға жақындату
        const a = Math.random() * Math.PI * 2, cam = this.cameras.main.worldView, rad = Math.hypot(cam.width, cam.height) / 2 + 50;
        e.setPosition(Phaser.Math.Clamp(p.x + Math.cos(a) * rad, 30, WORLD_W - 30), Phaser.Math.Clamp(p.y + Math.sin(a) * rad, 30, WORLD_H - 30)); return;
      }
      if (e.stunUntil > t) { e.setVelocity(0); e.setAlpha(0.55); return; }
      e.setAlpha(t < e.flashUntil ? 0.45 : 1);
      if (e.kbUntil > t) return;
      const spd = e.spd * slowF;
      if (t < this.confuseUntil) { const a = Phaser.Math.Angle.Between(p.x, p.y, e.x, e.y); e.setVelocity(Math.cos(a) * spd, Math.sin(a) * spd); }
      else if (invis) {
        if (!e.wp || Phaser.Math.Distance.Between(e.x, e.y, e.wp.x, e.wp.y) < 15) e.wp = { x: e.x + Phaser.Math.Between(-200, 200), y: e.y + Phaser.Math.Between(-200, 200) };
        this.physics.moveTo(e, e.wp.x, e.wp.y, spd * 0.6);
      } else if (e.kind === 'a') {
        if (d > 300) this.physics.moveToObject(e, p, spd);
        else if (d < 220) { const a = Phaser.Math.Angle.Between(p.x, p.y, e.x, e.y); e.setVelocity(Math.cos(a) * spd, Math.sin(a) * spd); }
        else e.setVelocity(0);
        if (t >= e.shootAt && d < 520) { e.shootAt = t + 2600; this.fireEnemyBullet(e.x, e.y, Phaser.Math.Angle.Between(e.x, e.y, p.x, p.y), 175); }
      } else this.physics.moveToObject(e, p, spd);
      if (!invis && d < e.r + 20) this.hitPlayer(e);
    });
    this.updateBoss(dt, slowF);

    // 4. Қарулар, оқтар
    this.updateWeapons(dt);
    this.bullets.getChildren().slice().forEach(b => { if (t > b.dieAt || b.y > WORLD_H + 50) b.destroy(); });
    const sec = dt / 1000;
    for (let i = this.ebullets.length - 1; i >= 0; i--) {
      const o = this.ebullets[i];
      o.x += o.vx * sec * slowF; o.y += o.vy * sec * slowF;
      if (t > o.dieAt || o.x < 0 || o.y < 0 || o.x > WORLD_W || o.y > WORLD_H) { o.destroy(); this.ebullets.splice(i, 1); continue; }
      if (Phaser.Math.Distance.Between(o.x, o.y, p.x, p.y) < 24) { this.hitPlayer(o); o.destroy(); this.ebullets.splice(i, 1); }
    }

    // 5. Одақтастар (Хақназар)
    if (t < this.alliesUntil) {
      this.allies.forEach((a, i) => { a.phase += dt * 0.004; a.setPosition(p.x + Math.cos(a.phase) * 62, p.y + Math.sin(a.phase) * 62); this.hitArea(a.x, a.y, 16, 14 * this.ps.dmgMul, 'ally' + i, 400, true); });
    } else if (this.allies.length) { this.allies.forEach(a => a.destroy()); this.allies = []; }

    // 6. Кристалдар, бонустар, артефакт, тұзақ, қақпа
    for (let i = this.gems.length - 1; i >= 0; i--) {
      const g = this.gems[i], d = Phaser.Math.Distance.Between(g.x, g.y, p.x, p.y);
      if (d < 24) { this.gainXp(g.v); g.destroy(); this.gems.splice(i, 1); this.sfx('gem'); continue; }
      if (g.pull || d < this.ps.pickR) { const a = Phaser.Math.Angle.Between(g.x, g.y, p.x, p.y), s = (g.pull ? 650 : 420) * sec; g.x += Math.cos(a) * s; g.y += Math.sin(a) * s; }
    }
    for (let i = this.pickups.length - 1; i >= 0; i--) { const o = this.pickups[i]; if (Phaser.Math.Distance.Between(o.x, o.y, p.x, p.y) < (o.ptype === 'heart' ? HEART_PICK_R : 45)) { this.pickups.splice(i, 1); this.sfx('pickup'); this.takePickup(o); } }
    this.arts.slice().forEach(a => { if (Phaser.Math.Distance.Between(a.x, a.y, p.x, p.y) < 34) this.pickArtifact(a); });
    this.traps.forEach(tr => { if (Phaser.Math.Distance.Between(tr.x, tr.y, p.x, p.y) < 26) this.hitPlayer(tr); });
    if (this.gateOpen && Phaser.Math.Distance.Between(this.gate.x, this.gate.y, p.x, p.y) < 55) { this.win(); return; }
    if (this.elapsed >= this.nextPickup) {
      this.nextPickup += 25;
      if (this.pickups.length < 5) {
        const opts = [['shield', 2], ['keruen', 2], ['dauyl', 1]]; if (this.lives < this.maxLives) opts.push(['heart', 3]);
        let sum = opts.reduce((a, o) => a + o[1], 0), r = Math.random() * sum; const type = opts.find(o => (r -= o[1]) < 0)[0];
        const pos = this.freePosFrom(() => { const a = Math.random() * Math.PI * 2, rr = Phaser.Math.Between(250, 700); return { x: p.x + Math.cos(a) * rr, y: p.y + Math.sin(a) * rr }; }, 30);
        this.addPickup(type, pos);
      }
    }

    this.updateZones(dt);
    if (this.ended || this.dead) return;

    // 7. Эффектілер
    const fx = this.fx; fx.clear();
    const fl = this.fxLow; fl.clear(); this.fires.forEach(f => { const a = Math.min(1, (f.until - t) / 600); fl.fillStyle(0xFF7043, 0.4 * a); fl.fillCircle(f.x, f.y, f.r); fl.fillStyle(0xFFCA28, 0.45 * a); fl.fillCircle(f.x, f.y, f.r * 0.55); });
    this.drawZones(fl);
    if (this.weapons.aura) { const s = this.weaponStats('aura'); fx.fillStyle(this.hero.color, 0.13); fx.fillCircle(p.x, p.y, s.radius); fx.lineStyle(2, this.hero.color, 0.5); fx.strokeCircle(p.x, p.y, s.radius); }
    if (t < this.shieldUntil || this.god) { fx.lineStyle(3, this.god ? 0xffd24a : 0x3FA7D6, 0.9); fx.strokeCircle(p.x, p.y, 33); }
    // бағыт көрсеткіші (Пэкман сияқты)
    const fa = this.facing.angle(), fr = PLAYER_SIZE / 2 + 7;
    fx.fillStyle(0xffffff, 0.95);
    fx.fillTriangle(p.x + Math.cos(fa) * (fr + 9), p.y + Math.sin(fa) * (fr + 9), p.x + Math.cos(fa + 0.32) * fr, p.y + Math.sin(fa + 0.32) * fr, p.x + Math.cos(fa - 0.32) * fr, p.y + Math.sin(fa - 0.32) * fr);
    if (t < this.revealUntil) {
      const targets = this.arts.length ? this.arts : (this.gateOpen ? [this.gate] : []);
      targets.forEach(a => {
        const ang = Phaser.Math.Angle.Between(p.x, p.y, a.x, a.y), x = p.x + Math.cos(ang) * 58, y = p.y + Math.sin(ang) * 58;
        fx.fillStyle(0xFFD24A, 1);
        fx.fillTriangle(x + Math.cos(ang) * 12, y + Math.sin(ang) * 12, x + Math.cos(ang + 2.4) * 9, y + Math.sin(ang + 2.4) * 9, x + Math.cos(ang - 2.4) * 9, y + Math.sin(ang - 2.4) * 9);
      });
    }

    // 8. Деңгей көтерілсе — таңдау терезесі
    if (this.pendingLevels > 0 && window.APP && !APP.modalOpen) APP.levelUp(this);

    // 9. HUD
    this.hudTick += dt;
    if (this.hudTick > 100 && window.APP) { this.hudTick = 0; APP.hud(this); }
  }
}
