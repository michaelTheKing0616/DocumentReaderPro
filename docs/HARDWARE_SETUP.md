# Hardware Eye-Tracking Setup

ReadAssist Pro supports multiple gaze sources via `HardwareGazeAdapter`. **Web + Electron + Desktop** are prioritized.

## Web (default)

1. Run `npm run web` or `npm run electron:dev`
2. Enable **Eye Tracking** in Settings
3. Grant camera permission when prompted
4. Complete calibration on the Calibration screen

Uses **WebGazer** (MIT) at ~30fps through `WebGazerSource`.

## Pupil Labs (Neon / Invisible)

- Discovery: mDNS `_pupil-remote._tcp.local.`
- Status: HTTP port `8080`
- Gaze stream: ZeroMQ SUB port `50020`, topic `gaze`
- Configure in Settings → Hardware → Pupil Labs

**Note:** Native ZeroMQ requires a platform bridge on mobile. Use Electron/desktop for full Pupil integration.

## Tobii Pro / Stream Engine

- Electron preload exposes `window.readAssistTobiiBridge`
- Desktop app connects to Tobii Stream Engine locally
- See `electron/preload.js` for bridge API

## Other supported adapters (network/USB scaffolds)

| Device | Service | Platform |
|--------|---------|----------|
| Gazepoint GP3 | `GazepointService` | USB / desktop |
| SMI iView | `SMIService` | Desktop SDK |
| EyeLink | `EyeLinkService` | Desktop + pylink bridge |
| GazeSense | `GazeSenseService` | WebSocket |
| Beam | `BeamService` | Webcam |

## Production mock gating

Random gaze streams are **disabled in production** unless `EXPO_PUBLIC_ENABLE_MOCK_DATA=true`.

In development (`__DEV__`), mock streams help test I-DT/I-VT pipelines without hardware.

## Calibration

- **Explicit:** 5–9 point grid (`CalibrationUtils.buildGrid`)
- **Smooth pursuit:** linear regression on moving target
- **Implicit:** background calibration during reading

Re-calibrate when accuracy drops below 70% or after device change.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| No gaze on mobile | Use web/Electron; hardware SDKs are desktop-first |
| WebGazer permission denied | Allow camera in browser settings |
| Pupil not found | Same Wi-Fi; check mDNS; use desktop bridge |
| High latency | Reduce prediction horizon in `NeuralGazePredictor` |
