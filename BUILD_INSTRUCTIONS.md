# Build Instructions for ReadAssist Pro

## Prerequisites

1. **Node.js** (v18 or higher)
2. **npm** or **yarn**
3. **Expo CLI**: `npm install -g expo-cli` or `npm install -g eas-cli`
4. **Android Studio** (for Android builds)
5. **Java JDK** (for Android builds)

## Step 1: Install Dependencies

```bash
cd "C:\Users\HP\Desktop\ReadAssist Pro"
npm install
```

## Step 2: Configure Firebase

1. Create a Firebase project at https://console.firebase.google.com
2. Enable Authentication (Email/Password)
3. Create a Firestore database
4. Enable Storage
5. Copy your Firebase config and create a `.env` file:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id
```

## Step 3: Run the App (Development)

### Option A: Using Expo Go (Quick Testing)

```bash
npm start
```

Then:
- Press `a` for Android emulator
- Press `i` for iOS simulator
- Scan QR code with Expo Go app on your phone

### Option B: Development Build

```bash
# For Android
npm run android

# For iOS (Mac only)
npm run ios
```

## Step 4: Build APK for Android

### Method 1: Using EAS Build (Recommended)

1. Install EAS CLI:
```bash
npm install -g eas-cli
```

2. Login to Expo:
```bash
eas login
```

3. Configure build:
```bash
eas build:configure
```

4. Build APK:
```bash
eas build --platform android --profile preview
```

This will create a downloadable APK file.

### Method 2: Using Expo Build (Legacy)

```bash
expo build:android -t apk
```

### Method 3: Local Build with Android Studio

1. Generate Android project:
```bash
npx expo prebuild --platform android
```

2. Open `android` folder in Android Studio

3. Build > Generate Signed Bundle / APK

4. Select APK, create keystore, and build

## Step 5: Build AAB for Play Store

For Play Store submission, build an AAB (Android App Bundle):

```bash
eas build --platform android --profile production
```

Or with legacy Expo:
```bash
expo build:android -t app-bundle
```

## Troubleshooting

### Common Issues

1. **Metro bundler errors**: Clear cache
   ```bash
   npm start -- --clear
   ```

2. **Android build fails**: Check Java version
   ```bash
   java -version  # Should be JDK 11 or higher
   ```

3. **Firebase errors**: Verify `.env` file and Firebase project setup

4. **Permission errors**: Check `app.json` permissions

5. **Document scanning not working**: 
   - Ensure storage permissions are granted
   - Check Android manifest permissions
   - Test on physical device (emulator may have limited file access)

### Android Permissions

Make sure these are in `app.json`:
- READ_EXTERNAL_STORAGE
- WRITE_EXTERNAL_STORAGE
- READ_MEDIA_IMAGES
- READ_MEDIA_VIDEO

## Testing the App

1. **Document Upload**: 
   - Tap "Upload Document" button
   - Select a PDF, EPUB, or DOCX file
   - Document should appear in library

2. **Auto-Scan**:
   - App automatically scans on launch
   - Tap "Scan" button for manual scan
   - Found documents are auto-added to library

3. **Open Document**:
   - Tap any document in library
   - Should open in Reader screen

## Production Checklist

Before building for production:

- [ ] Update app version in `app.json`
- [ ] Configure Firebase production project
- [ ] Set up app signing (keystore)
- [ ] Test on physical devices
- [ ] Verify all permissions work
- [ ] Test document scanning on real device
- [ ] Test document upload/download
- [ ] Verify eye tracking (if hardware available)
- [ ] Test offline functionality
- [ ] Review and update privacy policy

## Build Commands Summary

```bash
# Development
npm start                    # Start Metro bundler
npm run android              # Run on Android
npm run ios                  # Run on iOS

# Building
eas build --platform android --profile preview    # APK
eas build --platform android --profile production # AAB for Play Store
eas build --platform ios --profile production     # iOS build

# Legacy Expo Build
expo build:android -t apk           # APK
expo build:android -t app-bundle    # AAB
```

## Notes

- First build may take 10-20 minutes
- EAS Build requires Expo account (free tier available)
- APK files can be installed directly on Android devices
- AAB files are required for Google Play Store submission
- Test APK thoroughly before submitting to Play Store


















