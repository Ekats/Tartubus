# Building Android APK for Tartu Bussid

This guide explains how to build the Android app from this React web app using Capacitor.

## Prerequisites

You need to have installed:
- **Node.js** (already have this ✅)
- **Android Studio** - Download from https://developer.android.com/studio
- **Java JDK 17** - Usually comes with Android Studio

## Quick Start

### 1. Build the web app and sync to Android

```bash
npm run android:build
```

This will:
- Build the React app (`npm run build`)
- Sync files to Android project (`npx cap sync android`)
- Open Android Studio

### 2. Build APK in Android Studio

Once Android Studio opens:
1. Wait for Gradle sync to finish (bottom status bar)
2. Click **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
3. Wait for build to complete
4. Find APK at: `android/app/build/outputs/apk/debug/app-debug.apk`

## Available NPM Scripts

```bash
# Build web app and open in Android Studio
npm run android:build

# Just sync changes to Android (faster when you only changed web code)
npm run android:sync

# Open Android Studio without building
npm run android:open

# Build APK from command line (requires Gradle setup)
npm run android:apk
```

## First Time Setup in Android Studio

### Install Android SDK

When you first open Android Studio:
1. Tools → SDK Manager
2. Install:
   - Android SDK Platform 34 (Android 14)
   - Android SDK Build-Tools 34
   - Android SDK Platform-Tools

### Create Keystore (for signing APKs)

For release builds, you'll need a keystore:

```bash
# Generate keystore (run once)
keytool -genkey -v -keystore my-release-key.keystore -alias tartu-bussid -keyalg RSA -keysize 2048 -validity 10000
```

Then update `capacitor.config.json`:
```json
{
  "android": {
    "buildOptions": {
      "keystorePath": "path/to/my-release-key.keystore",
      "keystoreAlias": "tartu-bussid"
    }
  }
}
```

## Testing on Device

### Via USB (ADB)

1. Enable Developer Options on your Android phone
2. Enable USB Debugging
3. Connect phone to computer
4. In Android Studio: Run → Run 'app'

### Via APK Sideload

1. Build APK (see above)
2. Copy `app-debug.apk` to your phone
3. Install APK (you may need to enable "Install from Unknown Sources")

## App Permissions

The app requests these permissions (configured in `android/app/src/main/AndroidManifest.xml`):

- `ACCESS_FINE_LOCATION` - for GPS location
- `ACCESS_COARSE_LOCATION` - for approximate location
- `INTERNET` - for fetching bus data

## Troubleshooting

### "Gradle sync failed"

- Open Android Studio → File → Invalidate Caches → Restart

### "SDK not found"

- Install Android SDK via Tools → SDK Manager

### "Java version mismatch"

- Capacitor requires JDK 17
- Check: File → Project Structure → SDK Location

### "Build failed - missing dependencies"

```bash
cd android
./gradlew clean
cd ..
npm run android:sync
```

## Publishing to Google Play

**Note:** You mentioned Google won't verify your ID yet. When ready:

1. Create Google Play Console account
2. Create release keystore (see above)
3. Build signed release APK:
   - Build → Generate Signed Bundle / APK
   - Choose APK
   - Select your keystore
   - Build variant: release
4. Upload to Google Play Console

## Distributing Without Google Play

You can distribute APKs directly:

### Option 1: GitHub Releases
- Upload `app-release.apk` to GitHub Releases
- Users download and sideload

### Option 2: F-Droid
- Submit to F-Droid (FOSS app store)
- No Google account needed
- https://f-droid.org/docs/Inclusion_How-To/

### Option 3: Self-host
- Host APK on your website
- Users download directly

## Updating the App

When you make changes to the web app:

```bash
npm run build
npm run android:sync
```

Then rebuild APK in Android Studio.

---

**Built with Capacitor** - https://capacitorjs.com/
