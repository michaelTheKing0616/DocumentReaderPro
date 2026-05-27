# ReadAssist Pro

A comprehensive, high-end document reader application with advanced eye-tracking, AI-driven comprehension metrics, and assistive technologies for users with reading challenges like dyslexia and ADHD.

## Features

### Core Document Reading
- Support for 15+ formats: PDF, EPUB, DOCX, TXT, RTF, and images (with OCR)
- Full-text search, bookmarks, annotations
- Customizable fonts (including OpenDyslexic), spacing, and themes
- Reflowable text with zoom/pan capabilities

### Eye Tracking & Analytics
- Webcam-based eye tracking (WebGazer.js)
- Hardware integration support (Pupil Labs, Tobii, EyeLink, SMI, Gazepoint, GazeSense)
- Advanced algorithms: I-DT (fixation detection), I-VT (saccade detection)
- Neural gaze prediction models
- Real-time engagement metrics and heatmaps
- Gaze360 dataset integration for 3D unconstrained gaze estimation

### Assistive Technologies
- **Text-to-Speech (TTS)**: Synchronized highlighting with adjustable speed (100-300 wpm)
- **AR Overlays**: Interactive definitions and visual aids
- **Brightness Modulation**: Auto-adjust based on eye sensitivity, ambient light, and time of day
- **Comprehension Tools**: AI-generated quizzes and summaries
- **Gamification**: Points, badges, levels, and challenges

### Personalization
- Evidence-based adaptations for dyslexia and ADHD
- AI-driven comprehension metrics
- Personalized UI/UX with fluid animations
- Voice commands and gesture controls

## Tech Stack

- **Framework**: React Native 0.74+ with Expo
- **Language**: TypeScript
- **State Management**: Redux Toolkit
- **Navigation**: React Navigation v6
- **Backend**: Firebase (Auth, Firestore, Storage)
- **Eye Tracking**: WebGazer.js, TensorFlow.js
- **ML/AI**: TensorFlow.js, Hugging Face APIs
- **UI**: Styled Components, React Native Reanimated, Lottie

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm/yarn
- Expo CLI: `npm install -g expo-cli`
- iOS Simulator (for Mac) or Android Studio (for Android development)
- Firebase project (for backend features)

### Installation

1. **Clone and install dependencies:**
   ```bash
   cd "C:\Users\HP\Desktop\ReadAssist Pro"
   npm install
   ```

2. **Configure Firebase:**
   - Create a Firebase project at https://console.firebase.google.com
   - Copy your Firebase config
   - Create a `.env` file in the root directory:
     ```
     EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key
     EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-auth-domain
     EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
     EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-storage-bucket
     EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
     EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id
     ```

3. **Run the app:**
   ```bash
   npm start
   ```
   Then press `i` for iOS simulator, `a` for Android emulator, or scan the QR code with Expo Go app.

### Hardware Setup (Optional)

#### Pupil Labs
- Install Pupil Capture software
- Connect via network API (ZeroMQ)
- The app will auto-discover devices via mDNS

#### Tobii Eye Trackers
- Install Tobii Pro SDK
- Connect hardware via USB or network
- Configure in app settings

#### Other Hardware
- EyeLink: Requires pylink Python bindings
- SMI: Requires iViewNG API
- Gazepoint: USB connection with SDK
- GazeSense: REST/WebSocket API

### Gaze360 Dataset (Optional)

For fine-tuning gaze models:
1. Download from [erkil1452/gaze360](https://github.com/erkil1452/gaze360) or Hugging Face
2. Place dataset in `data/gaze360/`
3. Enable fine-tuning in app settings

## Project Structure

```
src/
├── components/
│   ├── common/          # Reusable UI components
│   ├── document/        # Document viewer components
│   ├── assistive/       # Eye tracking, TTS, AR components
│   ├── analytics/       # Charts and heatmaps
│   └── ux/              # Onboarding, gestures, voice
├── screens/             # Main app screens
├── navigation/          # Navigation setup
├── services/
│   ├── eye/             # Eye tracking services
│   ├── hardware/        # Hardware integration services
│   ├── tts/             # Text-to-speech service
│   ├── ai/              # AI/ML services
│   ├── gamification/    # Gamification service
│   ├── firebase/        # Firebase service
│   ├── ar/              # AR overlay service
│   └── brightness/      # Brightness modulation service
├── hooks/               # Custom React hooks
├── redux/                # Redux store and slices
└── types/               # TypeScript type definitions
```

## Development

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

### Building for Production
```bash
# iOS
expo build:ios

# Android
expo build:android
```

## Key Features Implementation

### Eye Tracking
- Uses WebGazer.js for webcam-based tracking
- Implements I-DT and I-VT algorithms for fixation/saccade detection
- Supports multiple hardware SDKs via native modules
- Neural gaze prediction for proactive assistance

### Evidence-Based Adaptations
- **Dyslexia**: OpenDyslexic font, 1.5x line spacing, TTS at 150wpm, AR blue overlays
- **ADHD**: Self-monitoring prompts every 5min, phonemic drills, Pomodoro breaks
- **Comprehension**: AI-generated quizzes, summarization, progress tracking

### Gamification
- Points for pages read (10/pt) and quizzes completed
- Badges for milestones (Focus Master, Bookworm, Scholar, Streak Master)
- Daily streaks with reset on missed days
- Challenges and leaderboards (opt-in)

## License

This project uses various open-source libraries. Please refer to individual package licenses.

## Contributing

This is a comprehensive implementation. To extend:
1. Add new hardware integrations in `src/services/hardware/`
2. Implement additional neural models in `src/services/eye/`
3. Add new assistive features in `src/components/assistive/`
4. Extend gamification in `src/services/gamification/`

## Acknowledgments

- WebGazer.js for webcam-based eye tracking
- Gaze360 dataset for 3D gaze estimation
- Various open-source neural gaze models (MobileGaze, GaTector, Gazelle, etc.)
- Evidence-based research on reading interventions for dyslexia and ADHD

## Support

For issues and questions, please refer to the documentation or create an issue in the repository.

