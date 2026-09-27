# Equb Admin – React + Capacitor (Android APK)

Real Android app for managing Ethiopian Equbs (ዕቁብ).

## Features (corrected logic)

- Payments recorded **per cycle** (Cycle 1, 2, 4…)
- Ethiopian (Habesha) calendar with start & finish dates
- Each Equb is a **completely separate ledger** (no data mixing)
- Lottery + manual winner selection
- SMS reminders
- Offline storage

## Requirements

- Node.js 18+
- Android Studio (for building APK)
- Java JDK 17

## Setup & Build APK

```bash
# 1. Install dependencies
npm install

# 2. Add Android platform
npx cap add android

# 3. Build web assets
npm run build

# 4. Sync to Android
npx cap sync android

# 5. Open in Android Studio
npx cap open android
```

Inside Android Studio:
1. Wait for Gradle sync
2. Build → Build Bundle(s) / APK(s) → Build APK(s)
3. APK will be in `android/app/build/outputs/apk/debug/`

## Development (browser)

```bash
npm run dev
```

## Project structure

```
equb-capacitor/
├── src/
│   ├── App.jsx              ← Main app (all screens + logic)
│   ├── main.jsx
│   ├── index.css
│   └── utils/
│       ├── ethiopian.js     ← Habesha calendar helpers
│       └── storage.js       ← Local storage
├── capacitor.config.json
├── package.json
└── vite.config.js
```

## Notes

- Data is stored locally on the device (localStorage / Capacitor Preferences)
- Each Equb is fully isolated
- No backend required
