# ایندکس پروژه دوز (Dooz) — نقشهٔ سریع کد

> این فایل برای پاسخ‌دهی سریع ساخته شده. اگر سؤالی دربارهٔ پروژه پرسیده شد، اول اینجا دنبال فایل/بخش مربوطه بگرد، بعد همان فایل را بخوان.
> آخرین به‌روزرسانی ایندکس: 2026-11-27

---

## 1. خلاصهٔ پروژه

بازی فکری **دوز** با سه گونه:

| گونه | توضیح | موتور |
| --- | --- | --- |
| `THREE` | دوز ۳ تایی؛ دو قانون `CLASSIC` و `INFINITE` | `dooz-engine.ts` |
| `NINE` | دوز ۹ تایی (Nine Men's Morris) | `morris-engine.ts` |
| `TWELVE` | دوز ۱۲ تایی (Twelve Men's Morris) — قفل خرید | `morris-engine.ts` + `twelve-billing.ts` |

حالت‌های بازی (`GameMode`): `AI` (ربات)، `LOCAL_2P` (دونفره یک دستگاه)، `ONLINE` (سرور WebSocket)، `LAN` (وای‌فای بدون اینترنت در اندروید).

خروجی‌ها:
- **وب**: Angular + SSR (Express)
- **اندروید**: Capacitor (کد Angular مشترک + پلاگین‌های Java)

---

## 2. پشتهٔ فناوری

- Angular **21** (standalone components، signals، OnPush)
- TypeScript **5.9**
- Tailwind CSS **4** + CSS اختصاصی (`styles.css`, `visual-refresh.css`, `app.css`)
- Three.js (نمای ۳بعدی)، `motion`
- Express **5** + `ws` (WebSocket) + `@angular/ssr`
- Capacitor **8** (Android)، پلاگین‌های Preferences/Filesystem/Share/App
- تست: Vitest (Angular) + `node:test` (سرور آنلاین)

---

## 3. دستورهای اجرا / ساخت / تست

| کار | دستور |
| --- | --- |
| نصب | `npm install` |
| اجرا (وب + سرور آنلاین) | `npm start` → `http://localhost:3000` |
| اجرا با دسترسی شبکه | `npm run dev` |
| فقط سرور آنلاین | `npm run serve:online` |
| بیلد وب | `npm run build` |
| بیلد موبایل (بدون SDK) | `npm run build:mobile` |
| آماده‌سازی اندروید | `npm run android:sync` |
| باز کردن اندروید | `npm run android:open` |
| تست Angular | `npm test -- --watch=false` |
| تست سرور آنلاین | `npm run test:online` |
| لینت | `npm run lint` |

جزئیات کامل در `README.md`.

---

## 4. فایل‌های تنظیمات (ریشه)

| فایل | نقش |
| --- | --- |
| `package.json` | اسکریپت‌ها و وابستگی‌ها |
| `angular.json` | کانفیگ build/serve/test/lint؛ کانفیگ `mobile` برای Capacitor |
| `tsconfig.json` / `tsconfig.app.json` / `tsconfig.spec.json` | TS اپ |
| `tsconfig.online.json` | کامپایل سرور آنلاین به `out-tsc/online-server` |
| `proxy.conf.cjs` | پروکسی `/api/ws`, `/api/health`, `/runtime-config.json` به سرور محلی |
| `appsettings.example.json` | نمونهٔ تنظیمات؛ کپی به `appsettings.json` |
| `appsettings.json` | تنظیمات واقعی (در Git نیست) |
| `src/project-settings.cjs` | خواندن/اعتبارسنجی تنظیمات + env override |
| `capacitor.config.ts` | `appId: ir.dooz.game`، `webDir: dist/mobile/browser` |
| `eslint.config.js` | ESLint |
| `.postcssrc.json` | Tailwind/PostCSS |

### تنظیمات مهم (`appsettings.json`)
- `online.serverUrl` / `online.mobileServerUrl` / `online.publicWebUrl`
- `server.port` / `server.dataDirectory` (پیش‌فرض `.data`)
- `development.webPort` (3000) / `development.onlinePort` (4201)
- `android.billing.productId` (پیش‌فرض `dooz_twelve_unlock`) + کلیدهای عمومی `myket`/`bazaar`

Override های محیطی: `PORT`, `DOOZ_DATA_DIR`, `DOOZ_ONLINE_PORT`, `DOOZ_ONLINE_URL`, `DOOZ_PUBLIC_WEB_URL`.

---

## 5. نقشهٔ پوشه‌ها

```
src/
  main.ts                     bootstrap مرورگر
  main.server.ts              bootstrap سرور (SSR)
  server.ts                   Express + SSR + upgrade به WebSocket
  server-rooms.ts             مدیر اتاق‌های آنلاین (WebSocketServer)
  server-rivalries.ts         ذخیره‌سازی تاریخچه/هویت مهمان روی دیسک
  server-zip.ts               خروجی ZIP سورس (allowlist)
  dev-online-server.ts        سرور آنلاین مخصوص dev
  project-settings.cjs        خواندن تنظیمات
  index.html, styles.css
  app/
    app.ts                    ★ کامپوننت ریشه و ارکستراسیون کل بازی (۱۷۲۳ خط)
    app.html                  قالب اصلی UI
    app.css, visual-refresh.css
    app.config.ts             providers (RuntimeConfig, DeviceStorage, I18n, Router)
    app.config.server.ts      کانفیگ SSR
    app.routes.ts             خالی (SPA تک‌صفحه‌ای)
    app.routes.server.ts
    i18n.ts                   سرویس زبان + pipe `t`
    messages.ts               ترجمه‌های en/ar (کلید = متن فارسی)
    runtime-config.ts         خواندن runtime-config.json و ساخت آدرس‌ها
    ui/                       اجزای عمومی UI
    game/                     ★ کل منطق و اجزای بازی
scripts/
  start-dev.mjs               اجرای هم‌زمان سرور آنلاین + ng serve
  build-mobile.mjs            build موبایل + نوشتن runtime-config.json
  online-server.test.mjs      تست سرور اتاق‌ها
android/                      پروژهٔ Capacitor/Android
public/                       assetهای وب (avatar، environment، آیکون، لایسنس)
docs/                         مستندات (همین فایل + visual-quality-plan.md)
.data/                        دادهٔ سرور (rivalries.json) — در Git نیست
```

---

## 6. هستهٔ منطق بازی (`src/app/game/`)

### دوز ۳ تایی
| فایل | مسئولیت | نمادهای کلیدی |
| --- | --- | --- |
| `dooz-engine.ts` | قواعد ۳×۳، برد کلاسیک/بی‌نهایت، AI | `WINNING_LINES`, `createEmptyBoard`, `checkWinner`, `applyMove`, `chooseAiMove`, `getAvailableCells`, `toPersianDigits` |
| `dooz.types.ts` | تایپ‌ها و ثابت‌های UI بازی | `GameVariant`, `GameMode`, `BoardRule`, `Difficulty`, `ENVIRONMENT_THEMES`, `PIECE_STYLES`, `QUICK_EMOTES`, `WinResult`, `MoveSnapshot`, `RoundRecord`, `ScoreBoard` |

### دوز ۹/۱۲ تایی (Morris)
| فایل | مسئولیت | نمادهای کلیدی |
| --- | --- | --- |
| `morris-engine.ts` | گراف، آسیاب‌ها، فاز PLACE/MOVE/REMOVE، پرواز، AI | `MORRIS_NODES`, `getMorrisEdges`, `getMorrisMills`, `createInitialMorrisState`, `applyMorrisPlace/Move/Remove`, `canPlayerFly`, `chooseMorrisAiDecision`, `evaluateMorrisBoard` |
| `morris.types.ts` | تایپ state/snapshot | `MorrisVariant`, `MorrisState`, `MorrisSnapshot`, `MorrisTurnAction` |

### ربات‌ها و مربی
| فایل | مسئولیت |
| --- | --- |
| `bot-personalities.ts` | `BOTS` (باران، سیمین، رستم، آذر، زال، سیمرغ)، `personalityMove`, `personalityMorris`؛ عمق جست‌وجو per-bot |
| `learning-engine.ts` | حل دقیق دوز کلاسیک (`classicValue`, `bestClassicMoves`)، `canForceWin`, `dailyPuzzle`, `tehranDay`, `reviewThree` |
| `coach-review.ts` | `reviewMorris`, `MorrisLesson`، کامپوننت `CoachReview` (تمرین مجدد) |

**باز شدن ربات‌ها با سکه**: باران ۰، سیمین ۱، رستم ۲، آذر ۵، زال ۹، سیمرغ ۱۵ (`BOTS[].requiredCoins`).

---

## 7. اجزای UI بازی

| فایل | selector | نقش |
| --- | --- | --- |
| `dooz-board.ts` | `app-dooz-board` | برد ۲بعدی ۳×۳ + خط برد |
| `morris-board.ts` | `app-morris-board` | برد ۲بعدی ۹/۱۲ تایی (گراف، انتخاب، هایلایت) |
| `dooz-3d-stage.ts` | `app-dooz-3d-stage` | صحنهٔ ۳بعدی Three.js؛ `CameraPreset` |
| `piece-tray.ts` | `app-piece-tray` | سینی مهره‌های باقی‌مانده |
| `dooz-piece-svg.ts` | `app-dooz-piece-svg` | رندر SVG مهره‌ها بر اساس `PieceStyle` |
| `color-palette-picker.ts` | `app-color-palette-picker` | انتخاب رنگ مهره/برد |
| `dooz-history-panel.ts` | `app-dooz-history-panel` | بازپخش حرکت‌به‌حرکت |
| `player-avatar.ts` | `app-player-avatar` | نمایش آواتار |
| `player-dashboard.ts` | `app-player-dashboard` | داشبورد بازیکن |
| `profile-panel.ts` | `app-profile-panel` | پروفایل/آمار/نشان‌ها |
| `journey-panel.ts` | `app-bot-roster` / `app-journey-panel` | انتخاب حریف و مسیر پیشرفت |
| `rivalry-panel.ts` | `app-rivalry-panel` | سابقهٔ رقابت آنلاین |
| `daily-challenge.ts` | `app-daily-challenge` | معمای روز |
| `ui/choice-sheet.ts` | `app-choice-sheet` | انتخاب از گزینه‌ها (زبان، تم و…) |
| `ui/dooz-icon.ts` | `app-dooz-icon` | آیکون‌های SVG (`DoozIconName`) |

---

## 8. وضعیت، ذخیره‌سازی و پروفایل

| فایل | نقش |
| --- | --- |
| `device-storage.ts` | لایهٔ ذخیره: `localStorage` در وب، `Capacitor Preferences` در اندروید؛ صف نوشتن، تشخیص خطای load/write |
| `player-stats.ts` | آمار/سکه/تم/محیط/سبک مهره/رنگ سفارشی؛ signal-based |
| `player-score.ts` | `PlayerRecord`, `emptyRecord`, `restoreRecord`, `COINS_PER_ROUND` |
| `player-profile.ts` | نام و آواتار بازیکن |
| `player-journey.ts` | پیشرفت، نشان‌ها (`BADGES`)، زنجیرهٔ معما، بردها per-bot |
| `avatar.ts` | آواتار کارتونی/گراواتار |
| `sound-fx.ts` | صداها؛ سه سبک `wood`/`soft`/`santur` + mute |
| `color-palette.ts` | ابزار رنگ (hex، luminance، shades) |
| `share-card.ts` | ساخت کارت PNG معمای روز و اشتراک‌گذاری |

### کلیدهای ذخیره‌سازی (DeviceStorage allowlist)
```
dooz_language_v1            dooz_player_stats_v1        dooz_profile_v1
dooz_board_theme_v1         dooz_color_mode_v1          dooz_environment_theme_v1
dooz_piece_style_v1         dooz_view_mode_v1           dooz_custom_x_color_v1
dooz_custom_o_color_v1      dooz_custom_board_color_v1  dooz_journey_v1
dooz_online_session_v1      dooz_sound_muted            dooz_sound_style_v1
```

---

## 9. آنلاین و شبکه

| فایل | نقش |
| --- | --- |
| `online.types.ts` | قرارداد پیام‌های WS و `RoomSnapshotDto` |
| `online-client.ts` | کلاینت WebSocket + اتصال LAN؛ signals وضعیت/اتاق/نقش/ایموت |
| `room-coordinator.ts` | ★ منطق معتبر و مشترک اتاق (سرور و میزبان LAN): ساخت/پیوستن، اعتبارسنجی حرکت، مساوی، rematch، رقابت سری |
| `lan-session.ts` | سشن وای‌فای اندروید؛ `parseLanInvite` (`IP:PORT/CODE`)، `LanPlugin` |
| `src/server-rooms.ts` | `OnlineRoomManager`؛ WebSocketServer روی `/api/ws`، اتصال به `RoomCoordinator` |
| `src/server-rivalries.ts` | `RivalryStore`؛ ذخیرهٔ اتمیک `rivalries.json`، هش توکن مهمان |
| `src/server.ts` | Express: `/runtime-config.json`, `/api/health`, `/api/download-project`، static، SSR، upgrade WS |
| `src/dev-online-server.ts` | سرور مستقل dev (پورت `development.onlinePort`) |
| `runtime-config.ts` | `serverOrigin`, `onlineSocketUrl`, `inviteLink`, `challengeLink` |

**معماری اعتماد**: فقط سرور (یا میزبان LAN) حرکت را معتبر می‌کند؛ کلاینت فقط نمایش می‌دهد. اتاق‌ها در حافظه‌اند؛ فقط تاریخچهٔ رقابت روی دیسک می‌ماند.

---

## 10. اندروید (`android/`)

| فایل | نقش |
| --- | --- |
| `app/src/main/java/ir/dooz/game/MainActivity.java` | ثبت `LanTransportPlugin` و `DoozBillingPlugin` |
| `.../LanTransportPlugin.java` | سوکت TCP محلی، heartbeat، host/join/send/drop/stop |
| `.../LanFrames.java` | فریم‌بندی length-prefixed UTF-8 (حداکثر ۱۲۸KB) |
| `.../LanAddresses.java` | تشخیص IP خصوصی، اولویت Wi-Fi، تطبیق subnet |
| `app/src/store/java/.../DoozBillingPlugin.java` | خرید مایکت/بازار + تأیید امضای RSA |
| `app/src/standalone/java/.../DoozBillingPlugin.java` | نسخهٔ بدون فروشگاه (همیشه unowned) |
| `app/build.gradle` | flavors: `standalone`, `myket`, `bazaar`؛ خواندن billing از `appsettings.json` |
| `app/src/main/AndroidManifest.xml` | مجوزها/پیکربندی |
| `capacitor.config.ts` (ریشه) | شناسه و webDir |

ساخت فروشگاهی:
```powershell
cd android
.\gradlew.bat :app:assembleMyketRelease :app:assembleBazaarRelease
.\gradlew.bat :app:assembleStandaloneDebug
```

---

## 11. بین‌المللی‌سازی

- زبان پیش‌فرض: **فارسی**. کلیدهای ترجمه، خودِ متن فارسی هستند.
- `src/app/messages.ts`: دیکشنری `{فارسی: [English, العربية]}`.
- استفاده در قالب: `{{ 'متن' | t }}` یا `{{ 'متن {0}' | t: [value] }}`.
- `I18n.digits()` اعداد را به ارقام زبان جاری تبدیل می‌کند.
- جهت: `fa/ar` → RTL، `en` → LTR (روی `<html>` اعمال می‌شود).

---

## 12. تست‌ها

| فایل | موضوع |
| --- | --- |
| `src/app/app.spec.ts` | رفتار کلی اپ/زبان |
| `src/app/runtime-config.spec.ts` | اعتبارسنجی آدرس‌ها |
| `src/app/game/avatar.spec.ts` | آواتار |
| `src/app/game/device-storage.spec.ts` | ذخیره‌سازی و مهاجرت |
| `src/app/game/lan-session.spec.ts` | ورودی دعوت LAN |
| `src/app/game/learning-engine.spec.ts` | معما/حل کلاسیک |
| `src/app/game/online-client.spec.ts` | کلاینت آنلاین |
| `src/app/game/player-journey.spec.ts` | پیشرفت/نشان |
| `src/app/game/player-score.spec.ts` | رکورد/سکه |
| `src/app/game/twelve-billing.spec.ts` | خرید ۱۲ تایی |
| `scripts/online-server.test.mjs` | ساخت اتاق/حرکت/همگام‌سازی سرور |

---

## 13. جدول «سؤال → فایل»

| اگر پرسیده شد… | برو به |
| --- | --- |
| منطق برد/حرکت دوز ۳ تایی | `src/app/game/dooz-engine.ts` |
| منطق آسیاب/حرکت ۹ و ۱۲ تایی | `src/app/game/morris-engine.ts` |
| هوش مصنوعی / سختی ربات‌ها | `dooz-engine.ts` (`chooseAiMove`), `morris-engine.ts` (`chooseMorrisAiDecision`), `bot-personalities.ts` |
| لیست ربات‌ها و سکهٔ لازم | `bot-personalities.ts` (`BOTS`) |
| صفحهٔ اصلی و جریان بازی | `src/app/app.ts` + `src/app/app.html` |
| ظاهر برد / تم / مهره | `dooz-board.ts`, `morris-board.ts`, `dooz-piece-svg.ts`, `dooz-3d-stage.ts`, `player-stats.ts`, `color-palette.ts` |
| ذخیرهٔ آمار/سکه/تنظیمات | `device-storage.ts`, `player-stats.ts`, `player-score.ts` |
| پروفایل، آواتار، نشان‌ها | `player-profile.ts`, `avatar.ts`, `player-journey.ts` |
| معمای روز | `daily-challenge.ts`, `learning-engine.ts` (`dailyPuzzle`, `tehranDay`), `share-card.ts` |
| مربی / تحلیل باخت | `coach-review.ts`, `learning-engine.ts` (`reviewThree`), `morris-engine.ts` |
| بازی آنلاین (کلاینت) | `online-client.ts`, `online.types.ts`, `runtime-config.ts` |
| بازی آنلاین (سرور) | `src/server.ts`, `src/server-rooms.ts`, `src/server-rivalries.ts`, `room-coordinator.ts` |
| بازی وای‌فای بدون اینترنت | `lan-session.ts` + فایل‌های Java در `android/app/src/main/java/ir/dooz/game/` |
| خرید دوز ۱۲ تایی | `twelve-billing.ts` + `DoozBillingPlugin.java` + `app/build.gradle` |
| تنظیم آدرس سرور / پورت | `appsettings.json`, `src/project-settings.cjs`, `proxy.conf.cjs` |
| ترجمه/زبان/راست‌چین | `i18n.ts`, `messages.ts` |
| ساخت/اجرا/تست | `package.json`, `scripts/`, `README.md` |
| دانلود ZIP سورس | `src/server-zip.ts` |

---

## 14. نکات معماری مهم (برای جلوگیری از اشتباه)

1. **`app.ts` قلب برنامه است**: state بازی، انتخاب حالت، اتصال به همهٔ سرویس‌ها و کامپوننت‌های صفحه در همین فایل‌اند. تغییرات UI/جریان بازی اغلب اینجا + `app.html` است.
2. **`RoomCoordinator` مشترک است**: هم سرور Node و هم میزبان LAN از همین کلاس برای اعتبارسنجی استفاده می‌کنند. تغییر قواعد آنلاین باید هر دو مسیر را پوشش دهد و با تست سرور بررسی شود.
3. **`app.routes.ts` خالی است**: ناوبری با `signal`های وضعیت (`gameState`, `homeTab`) انجام می‌شود، نه Router.
4. **کلید ترجمه = متن فارسی**: برای متن جدید، کلید فارسی را در قالب بگذار و (اختیاری) ترجمهٔ en/ar را در `messages.ts` اضافه کن.
5. **ذخیره‌سازی فقط از allowlist `DeviceStorage`**: کلید جدید را به لیست مجاز اضافه کن، وگرنه نوشتن نادیده گرفته می‌شود.
6. **`appsettings.json` در Git نیست**: برای تنظیم محلی از `appsettings.example.json` کپی بگیر.
7. **سرور آنلاین باید بعد از تغییر ری‌استارت شود**؛ برای اندروید `npm run android:sync` لازم است.
8. **دوز ۱۲ تایی پولی است**: `TwelveBilling.canPlay` فقط وقتی true است که پلاگین native موجود و خرید تأییدشده باشد؛ در نسخهٔ standalone همیشه قفل است.
9. **فایل‌های build سنگین**: `android/app/build`, `dist`, `node_modules`, `out-tsc`, `.angular` را در جست‌وجوهای کد نادیده بگیر.
10. **معمای روز بر اساس ساعت تهران** است (`tehranDay`) و موقعیت با تاریخ hash می‌شود؛ آرشیوها زنجیرهٔ روزانه را پر نمی‌کنند.

---

## 15. تاریخچهٔ اخیر Git (زمینه)

```
a8a5de3 fix(lan): make Wi-Fi multiplayer work without internet
1511174 add config
a15e788 feat(billing): add Myket and Bazaar purchases for 12-piece Dooz
eb66b9d feat(game): expand the bot roster and improve opponent selection
83086b3 feat(game): replace Elo ratings with coin-based progression
```

---

## 16. نگهداری این ایندکس

هنگام افزودن فایل/قابلیت جدید:
1. ردیف مربوطه را در جدول‌های بالا اضافه/به‌روز کن.
2. اگر کلید ذخیره‌سازی یا پیام WS جدید اضافه شد، بخش مربوطه را به‌روز کن.
3. تاریخ «آخرین به‌روزرسانی» بالای فایل را تغییر بده.
