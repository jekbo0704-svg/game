/* =========================================================
   Firebase: Google арқылы кіру, нәтижелерді серверде сақтау, рейтинг
   ---------------------------------------------------------
   • Firebase SDK мен баптаулар Firebase Hosting-тің /__/firebase/ жолынан
     жүктеледі, сондықтан API кілті GitHub-қа түспейді.
   • Ойын компьютерде файл ретінде ашылса (file://), Firebase жоқ болады,
     сонда ойын бұрынғыдай демо режимде (атпен кіру, браузерде сақтау) жұмыс істейді.
   • Деректерді қорғау — firestore.rules файлында (сервер жағында тексеріледі).
   ========================================================= */
'use strict';

const CLOUD = {
  on: false, auth: null, db: null,
  uid: null, email: null, name: null, isAdmin: false,
  best: 0,                 // рейтингтегі ең жақсы ұпай
  _pending: null, _timer: null,

  init() {
    try {
      if (!/^https?:$/.test(location.protocol)) return false;
      if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length) return false;
      this.auth = firebase.auth();
      this.db = firebase.firestore();
      this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => { });
      this.on = true;
      window.addEventListener('beforeunload', () => this.flush());
      return true;
    } catch (e) { console.warn('Firebase қосылмады, демо режим:', e); this.on = false; return false; }
  },

  ts() { return firebase.firestore.FieldValue.serverTimestamp(); },
  inc(n) { return firebase.firestore.FieldValue.increment(n); },
  cleanName(s) {
    s = String(s || '').replace(/[\u0000-\u001F\u007F<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return s || 'Ойыншы';
  },
  userRef() { return this.db.collection('users').doc(this.uid); },
  lbRef() { return this.db.collection('leaderboard').doc(this.uid); },

  onUser(cb) { this.auth.onAuthStateChanged(cb); },

  async signIn() {
    const p = new firebase.auth.GoogleAuthProvider();
    p.setCustomParameters({ prompt: 'select_account' });
    try { await this.auth.signInWithPopup(p); }
    catch (e) {
      if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) return this.auth.signInWithRedirect(p);
      throw e;
    }
  },

  async signOut() {
    await this.flush();
    this.uid = this.email = this.name = null; this.isAdmin = false; this.best = 0;
    return this.auth.signOut();
  },

  // кіргеннен кейін: профильді жүктеу немесе жаңасын жасау
  async load(u) {
    this.uid = u.uid; this.email = u.email || ''; this.name = this.cleanName(u.displayName || (u.email || '').split('@')[0]);
    const ref = this.userRef();
    const snap = await ref.get();
    let data;
    if (!snap.exists) {
      data = { name: this.name, email: this.email, progress: { maxCleared: 0, stars: {}, fails: {}, blessing: {} }, wrong: {},
        totals: { games: 0, correct: 0, wrong: 0, timeSec: 0 }, createdAt: this.ts(), updatedAt: this.ts() };
      await ref.set(data);
    } else {
      data = snap.data();
      if (data.name !== this.name) await ref.update({ name: this.name, updatedAt: this.ts() }).catch(() => { });
    }
    const [adm, lb] = await Promise.all([
      this.db.collection('admins').doc(this.email).get().catch(() => null),
      this.lbRef().get().catch(() => null)
    ]);
    this.isAdmin = !!(adm && adm.exists);
    this.best = lb && lb.exists ? (lb.data().score || 0) : 0;
    return { name: this.name, email: this.email, progress: data.progress || {}, wrong: data.wrong || {} };
  },

  // прогресс пен қате сұрақтарды 1,5 сек кешіктіріп бір рет жазу (сұраныс санын азайту)
  save(fields) {
    if (!this.uid) return;
    this._pending = Object.assign(this._pending || {}, fields);
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.flush(), 1500);
  },
  flush() {
    clearTimeout(this._timer);
    if (!this.uid || !this._pending) return Promise.resolve();
    const f = Object.assign(this._pending, { updatedAt: this.ts() }); this._pending = null;
    return this.userRef().update(f).catch(e => { console.warn('Прогресс сақталмады:', e); APP.toast('Прогресс серверге сақталмады'); });
  },

  // бір ойынның нәтижесі: runs + users.totals + leaderboard бір batch-та (ереже соны талап етеді)
  async saveRun(r, test) {
    if (!this.uid) return;
    clearTimeout(this._timer); this._pending = null;
    const p = APP.progress;
    const b = this.db.batch();
    const run = { uid: this.uid, name: this.name, email: this.email, hero: String(r.hero).slice(0, 40), stage: r.stage, result: r.result,
      score: r.score, kills: r.kills, level: r.level, correct: r.correct, wrong: r.wrong, timeSec: r.timeSec, helpUsed: r.helpUsed,
      test: !!test, date: this.ts() };
    b.set(this.db.collection('runs').doc(), run);
    b.update(this.userRef(), {
      name: this.name, progress: p, wrong: APP.wrong, lastRun: this.ts(), updatedAt: this.ts(),
      'totals.games': this.inc(1), 'totals.correct': this.inc(r.correct), 'totals.wrong': this.inc(r.wrong), 'totals.timeSec': this.inc(r.timeSec)
    });
    const newBest = Math.max(this.best, r.score);
    if (!test) b.set(this.lbRef(), { name: this.name, score: newBest, level: p.maxCleared, updatedAt: this.ts() });
    try { await b.commit(); if (!test) this.best = newBest; }
    catch (e) {
      console.warn('Нәтиже сақталмады:', e);
      APP.toast(e && e.code === 'permission-denied' ? 'Нәтиже сақталмады: тым жиі жіберілді немесе ереже бұзылды' : 'Нәтиже серверге сақталмады');
      this.save({ progress: p, wrong: APP.wrong });     // прогресс бәрібір сақталсын
    }
  },

  async leaderboard() {
    const q = await this.db.collection('leaderboard').orderBy('score', 'desc').limit(50).get();
    return q.docs.map(d => Object.assign({ uid: d.id }, d.data()));
  },

  async myRuns() {
    const q = await this.db.collection('runs').where('uid', '==', this.uid).limit(300).get();
    return q.docs.map(d => { const x = d.data(); x.date = x.date && x.date.toDate ? x.date.toDate().toISOString() : new Date().toISOString(); return x; })
      .sort((a, b) => a.date < b.date ? 1 : -1);
  },

  async clearLeaderboard() {
    const q = await this.db.collection('leaderboard').get();
    const b = this.db.batch(); q.docs.forEach(d => b.delete(d.ref)); await b.commit();
    this.best = 0;
  }
};

window.CLOUD = CLOUD;
