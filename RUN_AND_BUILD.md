continue # Run and Build ReadAssist Pro - Complete Guide

## 🚀 Quick Start

### Step 1: Install Dependencies

```powershell
cd "C:\Users\HP\Desktop\ReadAssist Pro"
npm install --legacy-peer-deps
```

**Note**: Using `--legacy-peer-deps` to resolve React version conflicts.

### Step 2: Configure Firebase

1. Create a `.env` file in the root directory:
```env
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id
```

2. Or update `src/services/firebase/FirebaseService.ts` directly with your Firebase config.

### Step 3: Run the App

#### Option A: Development Mode (Expo Go)

```powershell
npm start
```

Then:
- Press `a` for Android emulator
- Press `i` for iOS simulator (Mac only)
- Scan QR code with Expo Go app on your phone

#### Option B: Development Build

```powershell
# Android
npm run android

# iOS (Mac only)
npm run ios
```

## 📱 Build APK for Android

### Method 1: Using EAS Build (Recommended - Cloud Build)

1. **Install EAS CLI**:
```powershell
npm install -g eas-cli
```

2. **Login to Expo**:
```powershell
eas login
```

3. **Configure project**:
```powershell
eas build:configure
```

4. **Build APK**:
```powershell
eas build --platform android --profile preview
```

This will:
- Build in the cloud
- Generate a downloadable APK
- Take 10-20 minutes

5. **Download APK**:
After build completes, download from the provided URL.

### Method 2: Local Build (Requires Android Studio)

1. **Generate Android project**:
```powershell
npx expo prebuild --platform android
```

2. **Open in Android Studio**:
   - Open the `android` folder in Android Studio
   - Wait for Gradle sync

3. **Build APK**:
   - Build > Build Bundle(s) / APK(s) > Build APK(s)
   - APK will be in `android/app/build/outputs/apk/debug/app-debug.apk`

4. **For Release APK**:
   - Build > Generate Signed Bundle / APK
   - Create keystore (first time)
   - Select APK
   - Build

### Method 3: Using Expo Build (Legacy)

```powershell
expo build:android -t apk
```

**Note**: This method is deprecated but may still work.

## 🔧 Troubleshooting

### Issue: npm install fails

**Solution**: Use `--legacy-peer-deps`:
```powershell
npm install --legacy-peer-deps
```

### Issue: Expo version mismatch

**Solution**: Check Expo version:
```powershell
npx expo --version
```

Should be 50.x.x. If not:
```powershell
npm install expo@~50.0.0
```

### Issue: Camera not working

**Solution**: 
1. Check permissions in `app.json`
2. Test on physical device (emulator may have limited camera)
3. Ensure `expo-camera` is properly installed

### Issue: Document scanning not finding files

**Solution**:
1. Grant storage permissions
2. Test on physical device
3. Check Android manifest permissions

### Issue: Build fails with Gradle errors

**Solution**:
1. Update Android Studio
2. Update Gradle wrapper
3. Clean build: `cd android && ./gradlew clean`

## 📋 Pre-Build Checklist

- [ ] Dependencies installed (`npm install --legacy-peer-deps`)
- [ ] Firebase configured (`.env` file or direct config)
- [ ] App runs in development (`npm start`)
- [ ] Camera permissions granted
- [ ] Storage permissions granted
- [ ] Tested on physical device (recommended)

## 🎯 Build Commands Summary

```powershell
# Development
npm start                    # Start Metro bundler
npm run android              # Run on Android
npm run ios                  # Run on iOS

# Building APK
eas build --platform android --profile preview    # Cloud build (recommended)
npx expo prebuild --platform android              # Local build setup
```

## 📦 APK Installation

After building:

1. **Transfer APK to device** (via USB, email, or cloud)
2. **Enable "Install from Unknown Sources"** in Android settings
3. **Install APK** by tapping the file
4. **Grant permissions** when app launches

## 🔐 For Play Store (AAB Build)

For Google Play Store submission, build AAB instead:

```powershell
eas build --platform android --profile production
```

This creates an Android App Bundle (.aab) required for Play Store.

## ⚡ Quick Test Script

Create `test-build.ps1`:

```powershell
# Test Build Script
Write-Host "Installing dependencies..."
npm install --legacy-peer-deps

Write-Host "Starting Expo..."
npm start
```

Run with:
```powershell
.\test-build.ps1
```

## 📝 Notes

- **First build takes longer** (10-20 minutes)
- **EAS Build requires Expo account** (free tier available)
- **Physical device testing recommended** for camera/scanning features
- **APK size**: ~50-100MB (includes all dependencies)
- **Production builds** require signing keystore

## 🎉 Success Indicators

✅ App launches without errors
✅ Camera opens and captures images
✅ Documents can be scanned
✅ Library shows documents
✅ TrueScan processes documents
✅ Exported files are saved

Your app is ready to build and deploy! 🚀
















