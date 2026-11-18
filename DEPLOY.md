# Серверге шығару (Firebase) — қадамдық нұсқаулық

Нәтижесінде ойын `https://<жоба-id>.firebaseapp.com` сілтемесімен ашылады: Google арқылы кіру, нәтижелер серверде, бүкіл топқа ортақ рейтинг.

Бәрі тегін (Spark жоспары), банк картасы керек емес.

---

## 0. Алдын ала керек

- **Google аккаунт** — Firebase жобасы осы аккаунттың атына ашылады.
- **Node.js (LTS)** — https://nodejs.org сайтынан жүктеп, орнатыңыз.
- **GitHub аккаунт** — кодты жариялау үшін (10-қадам).

## 1. Firebase жобасын ашу

1. https://console.firebase.google.com → **Create a project**.
2. Атауы, мысалы: `hkz101-qorgan`. Google Analytics керек емес — өшіріп қойыңыз.
3. Жоба ашылғанда **Project ID**-ді жазып алыңыз (мысалы `hkz101-qorgan` немесе `hkz101-qorgan-1a2b3`).

## 2. Google арқылы кіруді қосу

1. Сол мәзір: **Build → Authentication → Get started**.
2. **Sign-in method → Google → Enable**, «Support email» ретінде өз поштаңызды таңдап, **Save**.
3. **Settings → Authorized domains** тізімінде `<жоба-id>.firebaseapp.com` және `<жоба-id>.web.app` бар екенін тексеріңіз (әдетте өзі қосылады).

## 3. Деректер қорын (Firestore) ашу

1. **Build → Firestore Database → Create database**.
2. Location: `europe-west1` (немесе ұсынылғанын қалдырыңыз). Кейін өзгерту мүмкін емес.
3. **Start in production mode** таңдаңыз. Ережелерді біз өзіміз жүктейміз (`firestore.rules`).

## 4. Веб-қосымшаны тіркеу

1. Жоба бетіндегі ⚙ → **Project settings → General → Your apps** → `</>` (Web) белгісі.
2. Аты: `qorgan-web`. **«Also set up Firebase Hosting» белгісін қойыңыз** → **Register app**.
3. Шыққан `firebaseConfig` кодын **көшірудің керегі жоқ** — ойын баптауларды Hosting-тен өзі алады (`/__/firebase/init.js`). Қалған қадамдарды «Next» арқылы өткізіп жіберіңіз.

## 5. Firebase CLI орнату (бір рет)

PowerShell немесе «Командная строка» ашып:

```
npm install -g firebase-tools
firebase login
```

Браузер ашылады — 1-қадамдағы Google аккаунтпен кіріңіз.

> PowerShell «running scripts is disabled» деп қате берсе:
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` командасын орындап, қайта көріңіз.

## 6. Жобаны таңдау

`game` папкасындағы `.firebaserc` файлын ашып, `FIREBASE_PROJECT_ID` орнына 1-қадамдағы Project ID-ді жазыңыз. Немесе терминалда:

```
cd "E:\_Uni stuff\History of kazahkstan\game"
firebase use --add
```

## 7. Серверге жүктеу

```
cd "E:\_Uni stuff\History of kazahkstan\game"
firebase deploy
```

Бұл команда бір уақытта:

- сайтты (Hosting) жүктейді;
- Firestore қауіпсіздік ережелерін (`firestore.rules`) орнатады.

Соңында `Hosting URL: https://<жоба-id>.web.app` шығады.

**Ағайға жіберетін сілтеме:** `https://<жоба-id>.firebaseapp.com` — Google кіру осы адресте ең сенімді жұмыс істейді (Safari мен телефонда да). `.web.app` адресі де ашылады.

## 8. Админ тағайындау

Админ панелі сайтта PIN-мен емес, серверде тексеріледі.

1. **Firestore Database → Data → Start collection**.
2. Collection ID: `admins`.
3. Document ID: админнің Gmail адресі, дәл Google аккаунттағыдай (мысалы `aty.zhoni@gmail.com`).
4. Бір өріс қосыңыз: `role` = `admin` → **Save**.
5. Сол аккаунтпен кіріп, логотипті 5 рет басыңыз — панель ашылады.

Тағы админ қосу үшін `admins` ішіне жаңа құжат қосыңыз. Админдер тізімін тек Console арқылы өзгертуге болады — сайттан өзгерту мүмкін емес.

## 9. Өзгерістерді жаңарту (фото, музыка, сұрақтар, код)

1. Файлды папкада ауыстырыңыз. Ең оңайы — **сол атпен** (мысалы `img/heroes/tomiris.jpg`, `audio/game.mp3`).
   Басқа атпен салсаңыз, `js/data.js` ішіндегі жолды да өзгертіңіз.
2. Қайта жүктеңіз:

```
firebase deploy --only hosting
```

3. Браузерде **Ctrl + F5** басыңыз. Сайт кэшсіз бапталған, сондықтан жаңа нұсқа бірден көрінеді.

> **Сұрақ қосқаннан кейін, жүктемес бұрын** `index.html`-ді компьютерде екі рет басып ашыңыз (демо режим).
> Сұрақтарда қате болса, экранның төменгі жағында ескерту шығады, ал F12 → Console-да қай жолда екені жазылады.
> Ең жиі қате — сұрақтың соңындағы **үтір (,)** ұмытылып кетуі.

Тек ережелерді өзгерткенде: `firebase deploy --only firestore:rules`.

## 10. GitHub-қа жариялау

**GitHub Desktop** арқылы (`game` папкасы әлі репозиторий емес, сондықтан алдымен репозиторий жасаймыз):

1. **File → Add local repository** → `E:\_Uni stuff\History of kazahkstan\game` таңдаңыз.
2. «This directory does not appear to be a Git repository» деп шығады — астындағы **create a repository** сілтемесін басыңыз.
   (Немесе **File → New repository**: Name = `game`, Local path = `E:\_Uni stuff\History of kazahkstan`.)
3. Терезеде: **Initialize with README** белгісін **алып тастаңыз** (README бар), Git ignore = **None** (`.gitignore` бар) → **Create repository**.
4. Сол жақта барлық файлдар шығады → төменде Summary: `Алғашқы нұсқа` → **Commit to main**.
5. **Publish repository** → атауы `qazaq-dalasy-qorgany`, «Keep this code private» белгісін алып тастаңыз (ағай көруі үшін) → **Publish**.
6. Кейін өзгеріс енгізгенде: Commit → **Push origin**.
7. `.gitignore` бар — Firebase кэші (`.firebase/`) мен логтары жүктелмейді.
8. Кодта құпия кілт **жоқ**: Firebase баптаулары GitHub-та емес, Hosting-те (`/__/firebase/init.js`).
9. Топтастарды Settings → Collaborators арқылы қосыңыз.

## 11. Қорғауда айтатын қауіпсіздік шаралары (CYB)

| Талап | Біздің ойында |
|---|---|
| Google OAuth, аутентификация | Firebase Authentication, Google провайдері |
| Session management | Firebase сессиясы (токен өздігінен жаңарады), «Шығу» батырмасы сессияны жабады |
| Backend | Firebase: Hosting + Authentication + Firestore |
| Деректерді қауіпсіз сақтау | `firestore.rules`: әр ойыншы тек өз профилін оқиды/жазады; рейтингте email жоқ, тек аты |
| Input validation | Клиентте (атты тексеру) + серверде (ережелер: өріс тізімі, түрі, ұзындығы, шегі) |
| XSS-тен қорғау | Барлық мәтін `textContent` арқылы шығады (`h()` функциясы) + Content-Security-Policy тақырыбы |
| API key-ді шығармау, GitHub-та құпия жоқ | Баптаулар кодта емес, Hosting-тен алынады; `.gitignore` |
| HTTPS | Firebase Hosting тек HTTPS, HSTS тақырыбы қосылған |
| Basic rate limiting | Бір ойыншы нәтижені 10 секундта бір реттен жиі жібере алмайды (ереже `lastRun`) |
| Leaderboard manipulation-нан қорғау | Ұпай шегі кезеңге байланысты (≤ 25 000 × кезең), ұпай тек өседі, деңгейді секіріп өтуге болмайды (+1), рейтинг тек жаңа ойын нәтижесімен бірге жазылады, админ ойындары рейтингке түспейді |
| Админ рөлі | Серверде, `admins` коллекциясы арқылы; браузерде PIN жоқ |

**Firebase `apiKey` туралы сұраса:** веб-қосымшада ол құпия емес — Firebase оны браузерге әдейі береді (кез келген сайт F12-де көрсетеді). Деректер кілтпен емес, сервердегі ережелермен қорғалады. Сондықтан біз оны GitHub-қа салмадық, ал қорғанысты `firestore.rules` арқылы жасадық.

## 12. Мәселе шықса

- **«Google арқылы кіру» орнына атты жазатын демо терезе шығады** → 4-қадамда Hosting белгісі қойылмаған немесе сайт `firebase deploy` арқылы емес ашылған.
- **«Бұл сайт Firebase-те рұқсат етілмеген»** → 2-қадамның 3-тармағы: доменді Authorized domains-қа қосыңыз.
- **«Нәтиже сақталмады…» хабары** → ойындарды 10 секундтан жиі аяқтасаңыз, бұл қалыпты (rate limit). Үнемі шықса, `firebase deploy --only firestore:rules` орындаңыз.
- **Кіру терезесі ашылмай қалады** → браузердің pop-up бұғаттауын осы сайтқа өшіріңіз.
- **Компьютерде файл ретінде ашу** (`index.html` екі рет басу) бұрынғыдай демо режимде жұмыс істейді — интернетсіз көрсетуге ыңғайлы.

## Тегін жоспар шектері

Hosting: 10 ГБ сақтау, күніне 360 МБ трафик. Firestore: күніне 50 000 оқу, 20 000 жазу. Топқа жеткілікті. Тек музыка файлдары кішкентай болсын (MP3, 2–4 МБ): әр жаңа ойыншы оларды бір рет жүктейді.
