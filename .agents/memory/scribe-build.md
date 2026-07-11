---
name: Scribe build notes
description: When a full EAS build is required vs OTA-safe, and which native configs are already set.
---

## Full EAS rebuild required when:
- A new native module is added (expo-print, expo-sharing, react-native-reanimated, etc.)
- `jsEngine` is changed in app.json (Hermes was added — already done)
- `versionCode` in app.json must be incremented with each build submission

## Already configured (do NOT add again):
- `"jsEngine": "hermes"` in `app.json` → `expo.android`
- `react-native-reanimated/plugin` in `babel.config.js` plugins array

## OTA-safe (no rebuild needed):
- Pure JS/TS changes (new screens, context logic, UI tweaks)
- AsyncStorage key changes
- Theme/font/spacing changes

## Native deps added in prior sessions (require EAS build):
- `expo-print`
- `expo-sharing`

## EAS rebuild prompt for user:
```
eas build --platform android --profile preview
```
Or for production: `eas build --platform android --profile production`

**Why:** Hermes JS engine and new native modules (expo-print, expo-sharing, react-native-reanimated) cannot be delivered over-the-air. A fresh native binary is required.
