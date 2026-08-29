# ТЗ: оточення, база, бек

Документ для того, хто робитиме бек і базу. Це **опис системи й правил**, а не
покрокова інструкція: як саме реалізувати ендпоінт — на розсуд виконавця, але
правила з розділу «Інваріанти» порушувати не можна, інакше дані поїдуть.

Перед читанням варто прогорнути `README.md` (як влаштований фронт і дані) і
`pipeline/README.md` (як збираються бандли). Тут вони не переказуються — тільки
те, що змінюється.

Поруч лежить скіл `.claude/skills/smakoteka-backend/`. Він цей документ не
дублює: показує, що читати під конкретну задачу, і тримає під рукою правила,
які легко порушити мовчки. Команда `/smakoteka-backend` — режим орієнтації для
нової людини. Переносячи роботу в репозиторій беку, копіювати треба обидва:
`BACKEND.md` і теку скіла.

---

## 1. Що вже є

Працює карта закладів харчування в чотирьох містах (Київ, Львів, Харків,
Дніпро). Vue 3 + Vite + Leaflet, деплой статикою.

**Бекенда немає взагалі.** Дані — чотири JSON-файли в `public/places/`, по
одному на місто, плюс манифест `index.json`. Файли збираються локально на
машині власника з трьох джерел:

| Джерело | Що дає | Де лежить |
|---|---|---|
| OpenStreetMap (`.osm.pbf` з Geofabrik) | самі заклади, координати, адреси, кухня, години | локально, ~1 ГБ |
| Overture Maps (через DuckDB) | телефони, соцмережі, оцінка достовірності | локально |
| Google Places (`searchNearby`) | `place_id` і статус роботи | локально, квота 5000/міс |

Поверх джерел лежить **накладка** — те, що людина зробила руками: приховані
заклади, виправлені координати, схвалені фото. Зараз це JSON-файли в
`pipeline/curated/`, які існують **в одному екземплярі на одному диску**.

Головні числа: 7592 заклади в чотирьох містах, з них підтверджених 3206.
Найбільший бандл — Київ, 1.2 МБ (≈250 КБ у gzip).

### Що болить і чому взагалі потрібен бек

1. **Немає користувачів.** Позначки «був тут» / «хочу сходити» й оцінка
   нікуди не зберігаються — це звичайні `ref` у компоненті, які вмирають при
   перемиканні картки.
2. **Немає зворотного звʼязку.** Людина бачить, що заклад закрився, і не може
   про це сказати.
3. **Накладка не має копії.** Втрата `pipeline/curated/` = смерть усіх наших
   id, а разом із ними всіх посилань і позначок людей.
4. **Правка чекає місяць.** Сьогодні будь-яка зміна доїжджає на карту тільки
   з наступним повним прогоном пайплайна.

---

## 2. Головна ідея: три контури

Це найважливіший розділ. Якщо в реалізації десь незрозуміло, що робити,
відповідь шукається тут.

```
    ДЖЕРЕЛА                НАКЛАДКА                ЛЮДИ
    OSM, Overture,         приховані,              акаунти, позначки
    Google                 правки полів,           «був/хочу», оцінки
                           додані заклади
    ↓                      ↓                       ↓
    перезбираються         пишуться з сайту,       пишуться з сайту,
    щомісяця з нуля,       НІКОЛИ не               пайплайн їх
    руками не правити      перезбираються          не бачить взагалі
    ↓                      ↓
    власник — пайплайн     власник — сайт
```

**Контури не перетинаються в записі.** Кожна колонка в базі має рівно одного
власника, і другий у неї не пише ніколи. Звідси випливає все інше:

- місячний прогін не може затерти те, що люди наробили за місяць;
- людина не може зіпсувати дані, які приїдуть із OSM наступного разу;
- відкотити можна кожен контур окремо.

### Де тут пайплайн

Пайплайн **лишається локальним** — на машині власника, з гігабайтом сирих
даних, які в базу не поїдуть ніколи. Змінюється рівно одне: накладку він тепер
не читає з диска, а **качає з бази перед прогоном** і **заливає результат
назад після**.

```
   1. PULL      база → pipeline/curated/*.json       (накладка)
   2. ПРОГІН    .osm.pbf + Overture + Google + накладка → заклади
   3. PUSH      заклади → база                        (UPSERT по uid)
   4. БАНДЛИ    база → JSON-файли для карти
```

Ключове, і саме воно знімає більшість питань: **накладка з бази матеріалізується
в ті самі файли `curated/`, які `fetch-places.js` уже вміє читати.** Логіку
пайплайна переписувати не треба — змінюється лише те, звідки взялися файли.

---

## 3. Оточення

### 3.1. Два репозиторії на GitLab

| Репозиторій | Що всередині | Куди деплоїться |
|---|---|---|
| `smakoteka-web` | Vue-застосунок (те, що зараз, мінус `public/places/`) | GitLab Pages |
| `smakoteka-api` | PHP-бек, міграції, docker-compose | сервер (див. 3.2) |

Пайплайн (`pipeline/`) **у жоден із цих репозиторіїв не входить** — він і далі
живе тільки локально, поза git. Так само й сирі дані.

`public/places/` з фронтового репозиторію **зникає**: бандли тепер породжує бек,
і тримати їх у git означало б мати дві правди.

### 3.2. Де це хоститься — чесно

GitLab дає репозиторії, CI і Pages. **Pages віддає лише статику** — PHP там не
виконується, MySQL там немає. Тобто GitLab закриває фронт і не закриває бек.

Справді безкоштовного хостингу з PHP + MySQL і пристойним аптаймом майже не
лишилось. Реальні варіанти, з цінами й пастками:

| Варіант | Ціна | Пастка |
|---|---|---|
| **Oracle Cloud Always Free** (ARM VM, 4 vCPU / 24 ГБ) | 0 | Потрібна картка для верифікації. ARM-потужності в популярних регіонах бувають недоступні тижнями. Але це повноцінна машина назавжди — docker-compose з nginx + php-fpm + MySQL стає на неї без компромісів. |
| Безкоштовний shared-хостинг (InfinityFree тощо) | 0 | Ні SSH, ні composer, ні cron нормального; ліміти на кількість запитів; можуть вимкнути без пояснень. Для продакшну не годиться. |
| Render / Fly.io (Docker з PHP) | 0–3 $/міс | Холодний старт після простою — перший запит чекає до хвилини. MySQL там немає, довелось би брати окремо. |
| Aiven / TiDB Serverless (тільки MySQL) | 0 | Закриває базу, але не рантайм. Комбінується з попереднім рядком. |
| Найдешевший VPS (Hetzner CX22 і подібні) | ≈4 €/міс | Просто працює. Але це вже гроші й адміністрування. |

**Рекомендація:** починати з Oracle Always Free. Якщо машину не дадуть — брати
VPS за 4 €, бо решта безкоштовних варіантів коштує часу більше, ніж ці гроші.

Прохання «тільки безкоштовне» врахована: платні варіанти тут названі з цінами
саме для того, щоб рішення ухвалювалось із цифрами, а не наосліп.

### 3.3. Хто віддає бандли

Бандли — статичні JSON, найбільший 1.2 МБ (≈250 КБ у gzip). Кожен відвідувач
качає один бандл свого міста один раз на версію.

Віддає їх **nginx поруч із беком**, не PHP: це звичайні файли на диску,
пропускати їх через рантайм немає причин.

```
GET /places/index.json                        (без кешу, маленький)
GET /places/places-kyiv.json?v=50605326       (Cache-Control: public, max-age=31536000, immutable)
```

`?v=` — хеш вмісту, як зараз. Оскільки він змінюється разом із вмістом, файл
можна кешувати назавжди, і людина ніколи не побачить учорашній бандл.

Фронт живе на іншому домені (GitLab Pages), тому потрібен **CORS**:
`Access-Control-Allow-Origin` зі списку дозволених доменів, не `*`.

### 3.4. Локальне оточення розробника

`docker-compose.yml` у репозиторії беку:

- `php` — 8.3-fpm
- `nginx` — 1.27
- `mysql` — 8.0, том для даних
- `adminer` — подивитись базу очима

Один `make up` має піднімати все, `make migrate` — накотити схему, `make seed` —
залити демо-дані. Розробник не повинен нічого встановлювати руками.

Фронт локально: `npm run dev`, у `vite.config.js` додається proxy `/api` на
`http://localhost:8080`, щоб не воювати з CORS у розробці.

### 3.5. Конфіг і секрети

Ні в тому, ні в тому репозиторії секретів немає. У кожному лежить `.env.example`
з порожніми значеннями, справжній `.env` — тільки на сервері й на машинах
розробників.

Бек:

```
APP_ENV=production
APP_URL=https://api.smakoteka…
WEB_ORIGIN=https://…            дозволений домен фронту для CORS
DB_HOST= DB_NAME= DB_USER= DB_PASS=
JWT_SECRET=
PIPELINE_TOKEN=                 окремий довгий токен для скриптів пайплайна
GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET=
MAIL_DSN=                       підтвердження пошти й скидання пароля
BUNDLE_DIR=/var/www/places      куди бек пише бандли, звідки їх читає nginx
```

Фронт (`.env` збирається у Vite):

```
VITE_API_URL=https://api.smakoteka…
VITE_PLACES_URL=https://api.smakoteka…/places
```

---

## 4. База: контур закладів

MySQL 8.0, `utf8mb4_unicode_ci`. Власник усіх таблиць цього розділу — **пайплайн**.
Сайт їх читає, а пише тільки в чітко названих випадках.

### 4.1. `places` — заклади

Поточний зліпок того, що знають джерела. Один рядок на наш `uid`.

```sql
CREATE TABLE places (
  uid           VARCHAR(20)  NOT NULL,             -- kv_f27208dd, наш вічний id
  city          VARCHAR(16)  NOT NULL,             -- kyiv | lviv | kharkiv | dnipro
  origin        ENUM('osm','user') NOT NULL DEFAULT 'osm',
  osm_id        VARCHAR(24)  NULL,                 -- osm:n256492514, НЕСТАБІЛЬНИЙ
  name          VARCHAR(200) NOT NULL,
  kind          ENUM('cafe','restaurant','bar','pub','fast_food') NOT NULL,
  lat           DECIMAL(9,7) NOT NULL,
  lng           DECIMAL(10,7) NOT NULL,
  address       VARCHAR(255) NULL,
  address_from  ENUM('building','near') NULL,      -- звідки зшита адреса; NULL = власний тег
  cuisine       JSON         NULL,                 -- ["seafood","italian"]
  hours         VARCHAR(255) NULL,                 -- рядок opening_hours як є
  wheelchair    ENUM('yes','limited','no') NULL,
  outdoor       TINYINT(1)   NULL,
  delivery      TINYINT(1)   NULL,
  vegetarian    ENUM('yes','only') NULL,
  vegan         ENUM('yes','only') NULL,
  floor_level   TINYINT      NULL,                 -- як в OSM: 0 — рівень землі, не зберігаємо
  edited_year   SMALLINT     NULL,                 -- рік останньої правки в OSM
  confidence    DECIMAL(3,2) NULL,                 -- оцінка Overture
  checked       TINYINT(1)   NULL,                 -- заклад бачила Overture
  confirmed     TINYINT(1)   NOT NULL DEFAULT 0,   -- пускаємо на карту
  confirmed_by  ENUM('google','moderator') NULL,
  last_run_id   BIGINT UNSIGNED NULL,
  created_at    DATETIME     NOT NULL,
  updated_at    DATETIME     NOT NULL,
  PRIMARY KEY (uid),
  UNIQUE KEY uq_osm (osm_id),
  KEY ix_city_confirmed (city, confirmed),
  KEY ix_box (city, lat, lng)
) ENGINE=InnoDB;
```

Чому саме так:

- **`uid` — первинний ключ, `osm_id` — просто колонка.** Osm id живе рівно доти,
  доки маппер не видалить ноду й не створить її заново. Вішати на нього звʼязки
  не можна.
- **`origin`** відділяє заклад із OSM від доданого людиною. Прогін не має права
  чіпати рядки з `origin = 'user'` — інакше вони зникатимуть щомісяця.
- **`confirmed_by`** зберігає різницю між «Google підтвердив» і «модератор
  підтвердив вручну». Правило «на карті = підтверджене» лишається, але тепер у
  нього два джерела.
- **Фізичного видалення рядків немає.** Ніколи. Заклад, якого немає, — це запис
  у `place_removals`, а не `DELETE`.

### 4.2. `place_uids` — кладовище id

Мапа `osm_id → uid`. Записи звідси **не видаляються ніколи**: заклад зник із
джерела — рядок лишається зі старим `last_seen`, і наступного прогону є з чим
зіставляти.

```sql
CREATE TABLE place_uids (
  osm_id     VARCHAR(24) NOT NULL,
  uid        VARCHAR(20) NOT NULL,
  city       VARCHAR(16) NOT NULL,
  name       VARCHAR(200) NULL,      -- підпис для людини, яка читатиме очима
  lat        DECIMAL(9,7)  NULL,
  lng        DECIMAL(10,7) NULL,
  first_seen DATE NOT NULL,
  last_seen  DATE NOT NULL,
  PRIMARY KEY (osm_id),
  KEY ix_uid (uid)
) ENGINE=InnoDB;
```

Це переїзд `curated/place-uids.json` (1.6 МБ, ≈9 тисяч рядків). Найцінніший
файл проєкту — після переїзду він нарешті має копію.

### 4.3. `place_uid_aliases` — злиття дублів

`place_uids` розвʼязує «osm id змінився». Не розвʼязує іншого: два різні `uid`
виявились одним закладом (людина додала місце, а через півроку воно приїхало з
OSM під своїм id).

Зливати можна тільки псевдонімом, не видаленням: на старому `uid` висять
позначки людей і роздані посилання.

```sql
CREATE TABLE place_uid_aliases (
  old_uid    VARCHAR(20) NOT NULL,
  uid        VARCHAR(20) NOT NULL,   -- на що вести
  merged_by  BIGINT UNSIGNED NULL,   -- хто злив
  merged_at  DATETIME NOT NULL,
  PRIMARY KEY (old_uid),
  KEY ix_uid (uid)
) ENGINE=InnoDB;
```

Будь-який запит за `uid` (картка, позначка, посилання `?place=`) спершу
проходить через цю таблицю. Ланцюжки не допускаються: зливаючи `B → C`, коли вже
є `A → B`, треба переписати й `A → C`.

### 4.4. `place_contacts` — контакти з джерелом

Контакти витягнуті з `places` в окрему таблицю **навмисно**. Причина в ліцензії:
Overture (CDLA-Permissive 2.0) вимагає зазначати джерело, і якщо колись доведеться
прибрати саме її дані, без цієї колонки вирізати їх буде нічим. Це пастка,
зафіксована в `pipeline/FUTURE.md`, і переїзд на базу — саме той момент, коли її
треба закрити.

```sql
CREATE TABLE place_contacts (
  uid     VARCHAR(20) NOT NULL,
  channel ENUM('phone','website','instagram','facebook','telegram','x','tiktok','youtube') NOT NULL,
  value   VARCHAR(500) NOT NULL,     -- завжди повне посилання, навіть якщо в джерелі був нік
  source  ENUM('osm','overture','user') NOT NULL,
  PRIMARY KEY (uid, channel)
) ENGINE=InnoDB;
```

Пріоритет при конфлікті: `user` > `osm` > `overture`. OSM сильніший за Overture,
бо тег вписаний саме цьому обʼєкту, а Overture чіпляється нечітким збігом за
100 м і схожістю назви, тобто помилитись може принципово.

### 4.5. `place_media` — фото й лого

```sql
CREATE TABLE place_media (
  uid         VARCHAR(20) NOT NULL,
  kind        ENUM('photo','logo') NOT NULL,
  url         VARCHAR(500) NOT NULL,
  source      ENUM('site','facebook','user') NOT NULL,
  approved_at DATETIME NULL,          -- NULL = чекає на перегляд
  approved_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (uid, kind)
) ENGINE=InnoDB;
```

У бандл їде тільки те, у чого стоїть `approved_at`. Фото з сайтів переглядаються
очима — автоматично туди приїжджає що завгодно, від банерів до стокових картинок.

### 4.6. `google_links` — звʼязка з Google

```sql
CREATE TABLE google_links (
  osm_id     VARCHAR(24) NOT NULL,
  gid        VARCHAR(64) NULL,        -- place_id; NULL = питали і не знайшли
  status     ENUM('OPERATIONAL','CLOSED_TEMPORARILY','CLOSED_PERMANENTLY') NULL,
  distance_m SMALLINT NULL,
  source     ENUM('auto','manual') NOT NULL DEFAULT 'auto',
  missed     SMALLINT NOT NULL DEFAULT 0,
  checked_at DATE NOT NULL,
  PRIMARY KEY (osm_id),
  KEY ix_checked (checked_at)
) ENGINE=InnoDB;
```

**Ця таблиця не виходить за межі беку ніколи.** Жоден публічний ендпоінт її не
віддає, `gid` не потрапляє у відповіді API. Умови Google Maps Platform дозволяють
зберігати `place_id` безстроково, але не роздавати його третім особам.

Таблиця тут не для роздачі, а щоб мати копію: `curated/place-ids.json` напрацьовано
запитами до Google, квота витрачена, і безкоштовно він більше не відновлюється.

Дата на промахах (`gid IS NULL`) не менш важлива за дату на влучаннях: без неї
2088 ненайдених закладів зʼїдали б повну місячну квоту щоразу.

### 4.7. `closed_suspects` — «OSM каже, що закладу немає»

Список на перегляд очима: поруч із нашим закладом стоїть обʼєкт із тегом
`disused:amenity` чи `was:amenity`. Автоматично не видаляємо — на місці зниклого
часто працює наступник із схожою назвою.

```sql
CREATE TABLE closed_suspects (
  uid      VARCHAR(20) NOT NULL,
  ghost    VARCHAR(200) NULL,        -- назва зниклого обʼєкта
  tag      VARCHAR(64)  NULL,        -- disused:amenity=pub
  metres   SMALLINT NULL,
  score    DECIMAL(3,2) NULL,        -- схожість назв
  verdict  ENUM('closed','keep') NULL,
  seen_at  DATE NOT NULL,
  PRIMARY KEY (uid)
) ENGINE=InnoDB;
```

Вердикт ставить людина, і він переживає прогони: `keep` більше не питаємо,
`closed` щоразу викидає заклад із бандла.

---

## 5. База: накладка

Власник — **сайт**. Пайплайн ці таблиці **тільки читає** й не пише в них ніколи,
крім рядків із `source` у `('google','osm')` в `place_removals`.

Це прямий переїзд `curated/dropped.json` і `curated/edits.json` у базу.

### 5.1. `place_removals` — заклад прибрано

```sql
CREATE TABLE place_removals (
  uid        VARCHAR(20) NOT NULL,
  source     ENUM('manual','google','osm') NOT NULL,
  why        VARCHAR(255) NULL,
  by_user_id BIGINT UNSIGNED NULL,   -- хто прибрав; NULL для пайплайна
  at         DATETIME NOT NULL,
  revoked_at DATETIME NULL,          -- знято; рядок лишається як історія
  revoked_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (uid),
  KEY ix_source (source, revoked_at)
) ENGINE=InnoDB;
```

Хто що може, і це найважливіша таблиця в документі:

| `source` | Хто ставить | Хто може зняти | Чи чіпає пайплайн |
|---|---|---|---|
| `manual` | людина через сайт | **тільки людина** | ні, ніколи |
| `google` | пайплайн, за `CLOSED_PERMANENTLY` | пайплайн, коли Google скаже `OPERATIONAL` | так, повністю |
| `osm` | пайплайн, за вердиктом `closed` у `closed_suspects` | пайплайн | так, повністю |

Ручний надгробок сильніший за будь-яке джерело: людина подивилась і сказала,
що закладу немає. Скасувати його може тільки людина — інакше найближчий прогін
мовчки поверне те, що щойно прибрали.

`CLOSED_TEMPORARILY` надгробком **не є**: ремонт чи сезон не скасовують того,
що заклад існує.

Ключ — `uid`, а не `osm_id`, і це принципово: перестворена нода приходить з
іншим osm id, і без цього прибране воскресало б само.

### 5.2. `place_edits` — виправлені поля

```sql
CREATE TABLE place_edits (
  uid        VARCHAR(20) NOT NULL,
  field      ENUM('lat','lng','address','name','hours') NOT NULL,
  value      VARCHAR(255) NOT NULL,
  by_user_id BIGINT UNSIGNED NULL,
  at         DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  PRIMARY KEY (uid, field)
) ENGINE=InnoDB;
```

Рядок на кожне виправлене поле. **Правка вічна** — вона не «застосовується й
видаляється», а лежить і накладається на кожному прогоні. Інакше наступний
прогін притягне з OSM ту саму криву координату.

Список полів у `field` **закритий навмисно**. Сьогодні пайплайн дозволяє
перекривати `lat`, `lng`, `address` (константа `EDITABLE` у `fetch-places.js`).
`name` і `hours` додані сюди на виріст — відкривати їх треба свідомо й по
одному, бо мовчазне перекриття, скажімо, кухні потім шукалося б по всьому
пайплайну.

Виправлена адреса гасить `address_from`: поле відповідає на питання «звідки це
взялось», а відповідь змінилась.

**Окремо про координати.** Брати їх треба з OSM, а не з Google: зберігати
дозволено лише `place_id`, і скопійована з Google пара чисел — це вже його
контент. Подивитись у Google, **де** заклад насправді, і взяти координату того
будинку з OSM — чисто. Це має бути написано прямо у формі правки, інакше через
пів року ніхто не згадає.

### 5.3. Додані заклади

**Окремої таблиці немає, і це свідомо.** Доданий заклад — це звичайний рядок у
`places` з `origin = 'user'` і `osm_id IS NULL`.

Причина: доданий заклад нічим не відрізняється від решти в читанні. Він так само
має `uid`, так само потрапляє в бандл, так само на ньому висять позначки людей.
Окрема таблиця означала б `UNION` у кожному запиті й дві гілки в збірці бандла —
рівно там, де помилка коштує найдорожче.

Захист від пайплайна — це `origin`, а не окрема таблиця: прогін відбирає рядки
`WHERE origin = 'osm'` і фізично не бачить доданих.

---

## 6. База: люди

### 6.1. `users`

```sql
CREATE TABLE users (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email          VARCHAR(255) NOT NULL,
  email_verified_at DATETIME NULL,
  password_hash  VARCHAR(255) NULL,        -- NULL, якщо вхід тільки через Google
  name           VARCHAR(100) NULL,
  role           ENUM('user','moderator','admin') NOT NULL DEFAULT 'user',
  created_at     DATETIME NOT NULL,
  last_seen_at   DATETIME NULL,
  blocked_at     DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_email (email)
) ENGINE=InnoDB;
```

Пароль — `password_hash()` з `PASSWORD_DEFAULT` (bcrypt/argon2), ніяких sha1 і
власних солей.

`role` — те, на чому тримається модерація: правка адміна застосовується одразу,
правка звичайної людини лягає в чергу.

### 6.2. `user_identities` — вхід через Google

Email + пароль і Google живуть на **одному** акаунті, звʼязані по пошті. Людина,
яка зареєструвалась паролем, а потім натиснула «увійти через Google», має
потрапити в той самий акаунт, а не завести другий.

```sql
CREATE TABLE user_identities (
  user_id     BIGINT UNSIGNED NOT NULL,
  provider    ENUM('google') NOT NULL,
  provider_id VARCHAR(128) NOT NULL,
  email       VARCHAR(255) NULL,
  created_at  DATETIME NOT NULL,
  PRIMARY KEY (provider, provider_id),
  KEY ix_user (user_id)
) ENGINE=InnoDB;
```

Пастка, яку треба закрити явно: звʼязувати по email можна **лише якщо пошта
підтверджена** — і в нас, і в Google (`email_verified` у профілі). Інакше
достатньо зареєструватись на чужу адресу, дочекатись входу власника через
Google і отримати його акаунт.

### 6.3. `user_sessions` — refresh-токени

```sql
CREATE TABLE user_sessions (
  id          CHAR(36) NOT NULL,
  user_id     BIGINT UNSIGNED NOT NULL,
  token_hash  CHAR(64) NOT NULL,       -- sha256 від refresh-токена, не сам токен
  user_agent  VARCHAR(255) NULL,
  created_at  DATETIME NOT NULL,
  expires_at  DATETIME NOT NULL,
  revoked_at  DATETIME NULL,
  PRIMARY KEY (id),
  KEY ix_user (user_id, revoked_at)
) ENGINE=InnoDB;
```

Access-токен — короткий JWT (15 хв), у памʼяті фронту. Refresh — довгий (30 днів),
у `HttpOnly; Secure; SameSite=Lax` куці. Фронт і бек на різних доменах, тому куку
треба ставити на домен беку й ходити з `credentials: 'include'`; це ще одна
причина тримати список дозволених origin, а не `*`.

### 6.4. `user_places` — позначки

Те, заради чого все й затівалось.

```sql
CREATE TABLE user_places (
  user_id    BIGINT UNSIGNED NOT NULL,
  uid        VARCHAR(20) NOT NULL,
  mark       ENUM('visited','planned') NOT NULL,
  rating     ENUM('meh','ok','top') NULL,   -- тільки для visited
  visited_on DATE NULL,
  note       VARCHAR(1000) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (user_id, uid),
  KEY ix_uid (uid)
) ENGINE=InnoDB;
```

Одна позначка на заклад: `visited` і `planned` взаємно виключні (так само як
зараз у `MenuPlace.vue`). Перемикання з `visited` на `planned` скидає `rating`.

`uid` тут — **не** зовнішній ключ на `places`. Причина: людина може мати позначку
на закладі, який пайплайн тимчасово не привіз (не той bbox, зникнув із OSM,
приховали). Позначка мусить це пережити й ожити, коли заклад повернеться. Замість
FK — перевірка існування в застосунку й прохід через `place_uid_aliases`.

### 6.5. Позначки до реєстрації

Людина клацає «хочу сходити», не маючи акаунта. Варіанти «змусити зареєструватись»
немає — це вбиває першу взаємодію.

Правило: **до входу позначки лежать у `localStorage`**, при вході переносяться в
базу одним запитом і з локального сховища прибираються. Конфлікт (позначка є і
там, і там) розвʼязується на користь свіжішої за `updated_at`.

---

## 7. База: черга й модерація

Рішення: **правки адміна застосовуються одразу, правки решти лягають у чергу.**
Це закриває ризик із `pipeline/FUTURE.md`: кнопка «цього закладу немає» доступна
всім, і один зловмисник вичищає карту за вечір.

Тут важливо не сплутати дві різні речі:

- **`proposals`** — журнал: «хтось о 14:00 запропонував таку адресу». Багато
  рядків на один заклад, у кожного вердикт.
- **накладка** (`place_edits`, `place_removals`) — поточний стан: «адреса цього
  закладу така». Один рядок на поле.

Схвалення пропозиції = запис у накладку. Пропозиція після цього нікуди не
дівається, вона стає історією.

```sql
CREATE TABLE proposals (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  kind        ENUM('remove','edit','add') NOT NULL,
  uid         VARCHAR(20) NULL,          -- NULL для kind='add'
  city        VARCHAR(16) NOT NULL,
  payload     JSON NOT NULL,             -- {field: value} або повний запис нового закладу
  comment     VARCHAR(500) NULL,         -- що написала людина
  by_user_id  BIGINT UNSIGNED NOT NULL,
  status      ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  decided_by  BIGINT UNSIGNED NULL,
  decided_at  DATETIME NULL,
  decision_note VARCHAR(500) NULL,
  created_at  DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_queue (status, created_at),
  KEY ix_place (uid)
) ENGINE=InnoDB;
```

Захист від засмічення, мінімум:

- одна активна пропозиція одного типу на заклад від однієї людини;
- не більше 20 пропозицій на добу від акаунта;
- пропозиції не приймаються від акаунта з непідтвердженою поштою;
- `blocked_at` в `users` зупиняє все одразу.

### `merge_candidates` — схожі на дубль

Коли доданий людиною заклад через місяці приїжджає з OSM, виходить два рядки про
одне місце. Ловиться це тим самим зіставленням, яким пайплайн звʼязується з
Google: 60 м і схожість назв 0.6 (`pipeline/scripts/lib/match.js`).

**Автоматично не зливати.** Тільки в список, рішення за людиною.

```sql
CREATE TABLE merge_candidates (
  id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  uid_a     VARCHAR(20) NOT NULL,
  uid_b     VARCHAR(20) NOT NULL,
  metres    SMALLINT NOT NULL,
  score     DECIMAL(3,2) NOT NULL,
  verdict   ENUM('merge','different') NULL,
  found_at  DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pair (uid_a, uid_b)
) ENGINE=InnoDB;
```

Вердикт `different` переживає прогони — інакше та сама пара спливатиме щомісяця.
Вердикт `merge` створює рядок у `place_uid_aliases`.

---

## 8. База: службові таблиці

### `pipeline_runs` — журнал прогонів

```sql
CREATE TABLE pipeline_runs (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  kind          ENUM('places','resolve','overture') NOT NULL,
  cities        JSON NOT NULL,           -- ["kyiv","lviv"]
  overlay_at    DATETIME NOT NULL,       -- на яку версію накладки спирався прогін
  started_at    DATETIME NOT NULL,
  finished_at   DATETIME NULL,
  rows_upserted INT NULL,
  status        ENUM('running','done','failed') NOT NULL DEFAULT 'running',
  log           TEXT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;
```

`overlay_at` — не декорація. Він фіксує, яку накладку прогін бачив, і дозволяє
потім відповісти на питання «чому правка від 3 числа не доїхала»: тому що прогін
почався 2-го.

### `bundles` — стан статики

```sql
CREATE TABLE bundles (
  city       VARCHAR(16) NOT NULL,
  version    CHAR(8) NOT NULL,          -- перші 8 hex від sha256 вмісту
  count      INT NOT NULL,
  confirmed  INT NOT NULL,
  bbox       JSON NOT NULL,
  built_at   DATETIME NOT NULL,
  dirty      TINYINT(1) NOT NULL DEFAULT 0,   -- є зміни, треба перезбирати
  PRIMARY KEY (city)
) ENGINE=InnoDB;
```

`dirty` ставиться будь-якою зміною, що впливає на бандл: схвалена пропозиція,
надгробок, правка, заливка з пайплайна.

---

## 9. Механізм оновлення: як усе працює разом

### 9.1. Місячний прогін, покроково

**Крок 1. PULL — забрати накладку.** Новий скрипт `npm run pull:overlay`:

```
GET /api/pipeline/overlay
Authorization: Bearer <PIPELINE_TOKEN>
```

Відповідь:

```json
{
  "generatedAt": "2026-09-01T10:00:00Z",
  "counts": { "removals": 143, "edits": 27, "additions": 5, "aliases": 2, "suspects": 61 },
  "removals":  { "kv_f27208dd": { "source": "manual", "why": "…", "at": "2026-08-30" } },
  "edits":     { "dnpr_a0d7326b": { "lat": 48.462, "lng": 35.053, "address": "…" } },
  "additions": [ { "uid": "kv_9a1b2c3d", "name": "…", "kind": "cafe", "lat": …, "lng": … } ],
  "aliases":   { "kv_old11111": "kv_new22222" },
  "suspects":  { "kv_707400bd": "closed" },
  "googleLinks": { "osm:n10003860121": { "gid": "ChIJ…", "status": "OPERATIONAL", "checkedAt": "2026-08-28" } }
}
```

Скрипт розкладає це у ті самі файли, які пайплайн уже читає: `curated/dropped.json`,
`curated/edits.json`, `curated/closed-suspects.json`, `curated/place-ids.json`.

**Прогін без свіжого pull заборонений.** `fetch-places.js` перевіряє, що файли
накладки молодші за добу, і **падає**, якщо ні. Це не перестраховка: прогін зі
старою накладкою мовчки поверне на карту все, що люди прибрали за місяць, і
дізнаємось ми про це не одразу.

**Крок 2. Прогін.** `npm run fetch:places` — усе як зараз, без змін у логіці.
`.osm.pbf` + Overture + `place-ids.json` + накладка → заклади.

**Крок 3. PUSH — залити результат.** Новий скрипт `npm run push:places`:

```
POST /api/pipeline/runs            → { runId: 42 }
POST /api/pipeline/places          → чанками по 500 записів, UPSERT
POST /api/pipeline/uids            → нові й успадковані uid
POST /api/pipeline/google-links    → оновлені статуси
POST /api/pipeline/runs/42/finish  → { rowsUpserted: 7592 }
```

**Крок 4. Бандли.** `finish` ставить `bundles.dirty = 1` для порушених міст, і
бек перезбирає їх.

### 9.2. Правила заливки

Це те, де найлегше все зламати:

1. **Тільки `UPSERT` по `uid`. Ніякого `TRUNCATE`, ніякого `DELETE`.**
   Перезбірка торкається лише колонок із джерел і ніколи — тих, які заповнила
   людина. Звідси й береться те, що місячний прогін не затирає щоденних правок.
2. **`WHERE origin = 'osm'`** у кожному записі. Рядки, додані людиною, прогін
   не бачить.
3. **Заклад, якого прогін не привіз, не видаляється.** Він міг випасти з bbox,
   маппер міг зняти тег, джерело могло глюкнути. Ставиться `last_run_id` тим, хто
   приїхав; хто не приїхав кілька прогонів поспіль — потрапляє в список на
   перегляд, а не під `DELETE`.
4. **Уся заливка — в одній транзакції на чанк**, з `run_id` у логу.

### 9.3. Між прогонами

Правка людини не має чекати місяць. FUTURE.md формулює це різко й правильно:
натиснув «цього закладу немає» — він зник за секунду, інакше людина вирішить, що
кнопка не працює.

Тому накладка діє **при читанні**, а не з наступного прогону:

```
дія на сайті → запис у накладку → bundles.dirty = 1 → перезбірка → нова ?v=
```

Перезбірка — не на кожен клік, а за дебаунсом: cron раз на 5 хвилин бере міста
з `dirty = 1` і перебудовує. Місячний прогін просто **запікає** те саме
остаточно.

Це відповідь на відкрите питання «момент інвалідації бандла» з `pipeline/FUTURE.md`.
Пункт треба буде звідти прибрати, коли це запрацює.

### 9.4. Що НЕ їде в базу ніколи

| Файл | Розмір | Чому лишається локально |
|---|---|---|
| `ukraine-latest.osm.pbf` | ~1 ГБ | сировина, качається з Geofabrik заново |
| `filtered.osm.pbf`, `*.geojsonseq` | сотні МБ | проміжне, відтворюється за 40 секунд |
| `google-raw.jsonl` | росте з кожним прогоном | сирі відповіді Google; потрібні, щоб переграти матчинг офлайн, але це не дані застосунку |

Усе інше з `curated/` у базу переїжджає — і це, крім усього, нарешті дає йому
копію.

---

## 10. Три сценарії наскрізь

### 10.1. Видалення: «цього закладу немає»

1. Людина в картці тисне кнопку. `POST /api/places/kv_f27208dd/removal`.
2. Бек дивиться `users.role`:
   - **admin/moderator** → одразу `INSERT place_removals (source='manual')`,
     `bundles.dirty = 1`. Заклад зникає з карти за хвилини.
   - **user** → `INSERT proposals (kind='remove', status='pending')`. На карті
     нічого не змінюється. Людині: «Дякуємо, перевіримо». Не «заклад видалено».
3. Модератор у черзі схвалює → бек пише `place_removals`, ставить
   `proposals.status='approved'`, `bundles.dirty = 1`.
4. **Наступний місячний прогін**: `pull:overlay` привозить надгробок у
   `curated/dropped.json`, `fetch-places.js` бачить `source: 'manual'` і викидає
   заклад із бандла — рівно та сама гілка коду, що працює сьогодні.
5. Заклад **не видаляється з `places`**. Рядок лишається, просто не потрапляє в
   бандл. Помилку можна відкотити, поставивши `revoked_at`.

Заклад, прибраний Google як `CLOSED_PERMANENTLY`, проходить те саме, але з
`source='google'` і без черги — і знімається сам, якщо Google скаже
`OPERATIONAL`.

### 10.2. Зміна: «адреса не та»

1. `POST /api/places/kv_f27208dd/edits` з тілом `{ "address": "Барикадна вулиця 6" }`.
2. Бек перевіряє, що поле є в дозволеному списку. Поле не з списку — `422`, а не
   мовчазне ігнорування.
3. Роль вирішує: одразу в `place_edits` чи в `proposals(kind='edit')`.
4. Схвалення → `INSERT … ON DUPLICATE KEY UPDATE` в `place_edits`, `dirty = 1`.
5. Збірка бандла накладає правку **останньою**, після джерел, Overture і фото —
   по ній у бандлі не має бути арбітра. Правка адреси гасить `address_from`.
6. Прогін наступного місяця бачить правку у `curated/edits.json` і накладає так
   само. **Пайплайн у цей файл не пише ніколи, тільки читає** — звідси й береться
   те, що перезбірка правок не затирає.

Виправлена координата — не косметика: наступний прогін резолвера питає Google
уже за нею, тож заклад дістає шанс знайтись колом і потрапити на карту.

### 10.3. Додавання: «тут є заклад, а у вас його немає»

1. `POST /api/places` з `{ name, kind, lat, lng, address?, contacts? }`.
2. **Бек шукає дублі** — 60 м і схожість назв 0.6 — серед:
   - `places` (заклад уже є, просто людина його не знайшла);
   - `place_removals` (це місце вже прибирали — і тоді треба сказати коли й чому,
     а не створювати дубль).
3. Знайшов кандидатів → повертає їх, людина або обирає існуючий, або наполягає.
4. Створюється рядок `places` з `origin='user'`, `osm_id = NULL`, новим `uid` за
   тим самим правилом (`префікс_міста` + 8 hex) і `confirmed = 0`.
5. Не адмін → плюс `proposals(kind='add')`. На карту заклад виходить тільки після
   схвалення: `confirmed = 1`, `confirmed_by = 'moderator'`.
6. Прогін цей рядок **не бачить** (`origin = 'user'`).
7. Через місяці заклад приїжджає з OSM під своїм id → створюється другий рядок,
   `origin='osm'`. Прогін кладе пару в `merge_candidates` і **не зливає сам**.
   Людина вирішує; злиття = `place_uid_aliases`, і позначки зі старого uid
   переїжджають самі.

Це закриває розділ «Додавання місць» із `pipeline/FUTURE.md` — усі три вимоги
звідти (свій простір імен, поле `origin`, дедуплікація без автозлиття) тут є.

---

## 11. API

Префікс `/api`. JSON, `Content-Type: application/json`. Помилки — однаковим
конвертом:

```json
{ "error": { "code": "place_not_found", "message": "Такого закладу немає" } }
```

`message` призначений людині й може потрапити в інтерфейс, тому пишеться живою
мовою й без назв джерел даних — це загальне правило проєкту, див. `CLAUDE.md`.

### Публічне читання

| Метод | Шлях | Що робить |
|---|---|---|
| `GET` | `/places/index.json` | манифест: міста, bbox, `count`, `confirmed`, `version`. Статика через nginx |
| `GET` | `/places/places-{city}.json?v=` | бандл міста. Статика через nginx |
| `GET` | `/api/places/{uid}` | картка одного закладу. Проходить через `place_uid_aliases` і віддає `301`-подібну підказку `{ "movedTo": "…" }`, якщо uid злитий |

Бандл — не дубль бази, а її кеш. Карта читає **тільки бандли**: статика з
диска безкоштовна й швидка, а база потрібна для запису й серверної логіки.

`GET /api/places/{uid}` для роботи карти не обовʼязковий — усе потрібне вже є
в бандлі. Він потрібен для посилання `?place=` на заклад із міста, чий бандл ще
не завантажений, і щоб показати агрегати («12 людей були тут»).

### Авторизація

| Метод | Шлях |
|---|---|
| `POST` | `/api/auth/register` — email, пароль; відправляє лист із підтвердженням |
| `POST` | `/api/auth/verify` — токен із листа |
| `POST` | `/api/auth/login` — email, пароль → access + refresh |
| `POST` | `/api/auth/refresh` — оновити access за refresh-кукою |
| `POST` | `/api/auth/logout` — відкликати сесію |
| `POST` | `/api/auth/password/forgot` / `/reset` |
| `GET` | `/api/auth/google/start` → редирект на Google |
| `GET` | `/api/auth/google/callback` → створює або звʼязує акаунт, ставить куку |
| `GET` | `/api/me` — профіль і роль |

Обмеження частоти обовʼязкові на `login`, `register`, `password/forgot` — інакше
перебір пароля коштує нуль.

### Позначки

| Метод | Шлях |
|---|---|
| `GET` | `/api/me/places?mark=visited` — списки для вкладок «Колекція» і «Плани» |
| `PUT` | `/api/me/places/{uid}` — `{ mark, rating?, visitedOn?, note? }` |
| `DELETE` | `/api/me/places/{uid}` |
| `POST` | `/api/me/places/import` — перенести те, що лежало в `localStorage` до входу |
| `GET` | `/api/me/export` — усе моє одним JSON |

Експорт — не «колись потім». `pipeline/FUTURE.md` вимагає його **разом із першою
позначкою**: без нього дані людини живуть рівно до чищення браузера.

### Пропозиції

| Метод | Шлях |
|---|---|
| `POST` | `/api/places/{uid}/removal` — «цього закладу немає» |
| `POST` | `/api/places/{uid}/edits` — виправити поля |
| `POST` | `/api/places` — додати заклад |
| `GET` | `/api/me/proposals` — що я пропонував і що з цим сталось |

Відповідь має чесно казати, що саме сталось, і не брехати про миттєвий результат:

```json
{ "status": "pending", "message": "Дякуємо. Перевіримо й приберемо." }
{ "status": "applied", "message": "Прибрали." }
```

### Модерація (роль `moderator` або `admin`)

| Метод | Шлях |
|---|---|
| `GET` | `/api/moderation/proposals?status=pending` |
| `POST` | `/api/moderation/proposals/{id}/approve` |
| `POST` | `/api/moderation/proposals/{id}/reject` |
| `GET` | `/api/moderation/merge-candidates` |
| `POST` | `/api/moderation/merge` — `{ keep, drop }` → alias |
| `GET` | `/api/moderation/suspects` — «OSM каже, що закладу немає» |
| `POST` | `/api/moderation/suspects/{uid}` — вердикт `closed` / `keep` |

### Службове для пайплайна

Окремий префікс, окремий токен, **не сесії**:

```
Authorization: Bearer <PIPELINE_TOKEN>
```

| Метод | Шлях |
|---|---|
| `GET` | `/api/pipeline/overlay` — уся накладка одним файлом |
| `POST` | `/api/pipeline/runs` — відкрити прогін |
| `POST` | `/api/pipeline/places` — UPSERT закладів, чанками |
| `POST` | `/api/pipeline/uids` — нові й успадковані id |
| `POST` | `/api/pipeline/google-links` — статуси |
| `POST` | `/api/pipeline/runs/{id}/finish` — закрити, позначити бандли `dirty` |
| `POST` | `/api/pipeline/merge-candidates` — знайдені дублі |

Ці ендпоінти мусять бути доступні тільки з токеном і бажано ще й з обмеженням
за IP. Вони можуть переписати весь контур закладів.

---

## 12. Збірка бандла з бази

Замінює те, що сьогодні робить кінець `fetch-places.js`. Формат вихідного файлу
**не змінюється** — фронт має продовжити працювати без правок.

```sql
SELECT p.*
FROM places p
LEFT JOIN place_removals r ON r.uid = p.uid AND r.revoked_at IS NULL
WHERE p.city = :city
  AND r.uid IS NULL
```

Далі на кожен заклад:

1. підтягнути `place_contacts` (пріоритет `user` > `osm` > `overture`);
2. підтягнути `place_media` зі `approved_at IS NOT NULL`;
3. накласти `place_edits` **останніми**; правка адреси прибирає `address_from`;
4. викинути порожні поля — бандл розріджений навмисно, з 7592 закладів телефон
   мають 2488, інстаграм 801;
5. `JSON_ENCODE` **одним рядком, без відступів** — це те, що їде в браузер;
6. `version` = перші 8 hex від `sha256` вмісту;
7. записати у `BUNDLE_DIR`, оновити рядок у `bundles`, перебудувати `index.json`.

**Критерій приймання цього етапу:** бандл, зібраний із бази на поточних даних,
збігається з тим, що зараз лежить у `public/places/`, з точністю до порядку
ключів. Це перевірна умова, і поки вона не виконується, переїзд не зроблено.

Про `gid`: сьогодні він у бандлі є (2802 записи в Києві). Чи лишати його там —
питання до замовника, див. розділ 15. Збірка має вміти і те, і те, за прапорцем
у конфізі.

---

## 13. Що змінюється на фронті

Роботи менше, ніж здається — контракт джерела в `README.md` для цього й описаний.

1. **`src/lib/sources/cityBundles.js`** — база URL береться з `VITE_PLACES_URL`
   замість `import.meta.env.BASE_URL`. Усе інше без змін.
2. **`public/places/` зникає з репозиторію.**
3. **`?place=` переходить із `id` (osm) на `uid`.** Це вимога з `FUTURE.md`, і
   зробити її треба **до** першого опублікованого посилання, інакше роздані
   посилання доведеться ламати вдруге.
4. **Вхід і профіль.** `MenuProfile.vue` перестає бути заглушкою.
5. **Позначки їдуть в API.** До входу — `localStorage`, при вході — перенос.
6. **Дві нові кнопки в картці:** «цього закладу немає» і «виправити».
7. **Форма додавання закладу** з показом можливих дублів.

Тексти всіх нових екранів — за правилами `CLAUDE.md`: просто, на «ти», без назв
джерел даних, і без минулого часу, який видає рід.

---

## 14. Інваріанти

Правила, порушення яких ламає дані так, що це помічають не одразу. Кожне варте
тесту.

1. **Пайплайн ніколи не пише в накладку і в контур людей.** Виняток єдиний:
   рядки `place_removals` із `source` у `('google','osm')`.
2. **Заливка — тільки UPSERT по `uid`.** Ніякого `TRUNCATE`, ніякого масового
   `DELETE`.
3. **Прогін не чіпає рядки `origin = 'user'`.**
4. **Заклад не видаляється фізично ніколи.** Тільки надгробок, який можна зняти.
5. **`uid` видається раз і не змінюється.** Злиття — через `place_uid_aliases`,
   не через видалення.
6. **`gid` не виходить за межі беку.**
7. **Ручне сильніше за автоматичне.** Скасувати ручне рішення може тільки людина.
8. **Записи в `place_uids` не видаляються ніколи** — це кладовище, з якого
   відновлюються id.
9. **Кожна заливка має `run_id` і рядок у `pipeline_runs`.**
10. **Прогін зі старою накладкою не запускається** — скрипт падає.

---

## 15. Розвилки, які лишаються за замовником

Тут ТЗ свідомо не вирішує. Це не прогалини, а місця, де відповідь коштує грошей
або ризику.

**1. `gid` у публічних бандлах.** Умови Google Maps Platform дозволяють зберігати
`place_id`, але роздавати його третім особам статичним файлом під цей виняток не
підпадає. Ціна прибирання, порахована по підтверджених: до списку замість
конкретного закладу деградує 1% посилань у Києві й 6% у Дніпрі — це ті, у кого
назва повторюється й немає номера будинку. Рішення відкладене; збірка має вміти
обидва варіанти.

**2. Чи потрібен поріг довіри.** Зараз обрано «чужі правки — в чергу». Це
безпечно, але робить одну людину вузьким місцем. Альтернатива — N незалежних
скарг застосовуються самі. Вводити варто тоді, коли черга справді почне не
встигати, а не наперед.

**3. Розширення списку полів, які можна правити.** Сьогодні `lat`, `lng`,
`address`. Кожне нове поле — окреме рішення: чим більше можна перекрити, тим
менше сенсу в оновленні з OSM.

**4. Частота перезбірки бандлів.** Запропоновано 5 хвилин. Число не з розрахунку,
його треба буде підбити по навантаженню.

**5. Чи віддавати заклади через API, а не тільки бандлами.** Зараз ні. Це варто
переглянути, коли зʼявиться пошук по всій країні або дуже великі міста, де бандл
перестане влазити в розумний розмір.

---

## 16. Порядок робіт

Етапи впорядковані так, щоб кожен закінчувався чимось перевірним, а не «майже
готово».

**Етап 1. Оточення і схема.** Два репозиторії, docker-compose, міграції, CI.
Одноразовий скрипт `migrate:curated`, який заливає в базу те, що зараз лежить у
`pipeline/curated/` і в бандлах. Збірка бандлів із бази.
*Готово, коли:* бандл із бази збігається з поточним, а фронт із `VITE_PLACES_URL`
на бек працює як раніше.

**Етап 2. Пайплайн ↔ база.** `GET /api/pipeline/overlay`, ендпоінти заливки,
скрипти `pull:overlay` і `push:places`, падіння прогону на старій накладці.
*Готово, коли:* повний місячний цикл пройшов на живих даних і нічого не затер.

**Етап 3. Люди.** Реєстрація email + пароль, Google, сесії, `user_places`,
перенос із `localStorage`, експорт.
*Готово, коли:* позначка переживає вихід і вхід з іншого браузера.

**Етап 4. Пропозиції й модерація.** Кнопки «немає» і «виправити», черга,
перезбірка бандлів за `dirty`.
*Готово, коли:* правка адміна видно на карті за хвилини, а не за місяць.

**Етап 5. Додавання місць.** Форма, пошук дублів, `merge_candidates`, злиття
через alias.

Етапи 1 і 2 треба робити разом і не випускати окремо: база без циклу заливки —
це друга копія правди, яка почне розходитись із першою того ж дня.

---

## 17. Що оновити в документації, коли це запрацює

- `README.md` — розділ «Замінити джерело даних» описує саме цей переїзд;
  дописати, звідки тепер беруться бандли.
- `pipeline/README.md` — розділ «Коли зʼявиться бек» стає описом того, що є.
  Уточнення: там сказано, що `dropped.json` розділиться надвоє (ручні надгробки
  в базу, гуглові лишаються локально). Це ТЗ пропонує **одну** таблицю
  `place_removals` з колонкою `source`. Причина: у файлі вони й так лежать разом
  і розрізняються тим самим полем, різні власники задаються правами на запис, а
  не двома сховищами. Якщо це не влаштовує — розділити треба до першої міграції,
  не після.
- `pipeline/FUTURE.md` — закриваються пункти «Додавання місць», «Модерація
  користувацьких правок», «Кеш бандлів», «Момент інвалідації бандла» і частина
  «Ліцензії» (поле джерела для контактів зʼявляється в `place_contacts`).
