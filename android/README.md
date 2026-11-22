# Smart Silent Zone — Standalone Android APK Project (Inbuilt DND Access)

A self-contained native Kotlin Android application for **Smart Silent Zone**.
Once built and installed as an **APK**, it combines the full **Smart Silent Zone** interactive web dashboard (`WebView` with `@JavascriptInterface` native bridge), background **Android Geofencing API** monitoring, **Firebase Firestore** sync, and **inbuilt `NotificationManager` / `AudioManager` Do Not Disturb control** — **without downloading any third-party automation apps** (no Tasker, no MacroDroid, no external helper apps).

---

## Key Features

1. **Inbuilt Native DND Mode Access (Zero Third-Party Apps)**:
   - Uses official Android `NotificationManager.setInterruptionFilter(...)` and `AudioManager.ringerMode` directly inside this single APK.
   - Supports per-zone silence profiles: **Total Silence** (`INTERRUPTION_FILTER_NONE`), **Priority Only** (`INTERRUPTION_FILTER_PRIORITY`), and **Vibrate Only** (`RINGER_MODE_VIBRATE`), restoring `INTERRUPTION_FILTER_ALL` + `RINGER_MODE_NORMAL` automatically on exit.
   - `WebAppDndBridge.kt` exposes `window.AndroidNativeDnd` directly to the embedded dashboard so every geofence transition and manual toggle executes on device hardware natively.

2. **Standalone + Bi-Directional Sync**:
   - **Standalone Mode**: Zones created in the **App Map** tab sync directly into native `GeofenceManager` via `syncZonesFromWeb(...)` and persist offline in `SharedPreferences` across app restarts and device reboots.
   - **Paired Mode**: Optionally enter a 6-character Pairing Code in **Native DND** to sync in real time with desktop browsers via Firebase Firestore.

3. **Screen-Locked Background Geofencing**:
   - Hardware-efficient `GeofencingClient` + persistent `GeofenceForegroundService` + `BootReceiver` keeps monitoring active even with the screen locked or after a reboot.

---

## Publishing & Building the APK

### Option 1: GitHub Actions Cloud APK Build (No Local Android Studio Needed)
1. Push the `android/` directory to a GitHub repository.
2. Open the **Actions** tab and run **Build Smart Silent Zone APK** (`.github/workflows/build-apk.yml`).
3. Download the compiled `SmartSilentZone-APKs` artifact (`app-debug.apk` or `app-release.apk`) and install it on any Android 8.0+ phone.

### Option 2: Android Studio (Local Build & Signed Release APK)
1. Launch **Android Studio** (Hedgehog or newer) and open the `android/` folder.
2. Connect your Android phone with **USB Debugging** enabled and click **Run**, OR choose **Build > Generate Signed Bundle / APK > APK** to export a signed release APK for publishing.

### Option 3: Terminal / Gradle CLI
```bash
cd android
gradle assembleDebug        # Outputs app/build/outputs/apk/debug/app-debug.apk
gradle assembleRelease      # Outputs app/build/outputs/apk/release/app-release-unsigned.apk
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

4. **Inbuilt Emergency Contact Ring-Through (`EmergencyCallReceiver.kt`)**:
   - Reads your saved emergency numbers via `EmergencyContactsManager.kt` (`READ_PHONE_STATE` + `READ_CALL_LOG`).
   - When a saved emergency number or repeat caller (twice within 3 minutes) rings while DND or Vibrate mode is active, the APK temporarily restores normal ringer & volume so your mobile rings out loud, then automatically re-engages your Silent Zone DND mode when the call finishes.

---

## First-Time Permissions on Phone
1. **1-Tap Automatic Access**: Tap **Allow Location, DND & Emergency Access** (inside *App Map* banner or *Native DND* tab). Android prompts in sequence for Location (`Allow all the time`), Call Breakthrough, and Inbuilt DND Access, then starts `GeofenceForegroundService` automatically.
2. **Add Emergency Numbers**: Open **Settings → Emergency Contacts Ring-Through** (or the **Native DND** tab) to add phone numbers that should always ring out loud during DND.
