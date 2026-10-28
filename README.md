# Hermes Bots

A client for a self-hosted Hermes Agent (v0.22.5). Phase 0 is a pair of test apps, plus a small notifier, that prove the risky platform pieces before the real app is built.

The Hermes process in this design listens on port 9119 and is reached over Tailscale. The test apps do not ship a login. You type the server URL, username, and password on the device.

## Layout

| Path | What it is |
| --- | --- |
| `apps/windows` | Tauri v2, React, TypeScript, Vite, Tailwind, shadcn-style controls. HTTP and WebSocket use Tauri's native plugins. The refresh token is stored with the `keyring` crate (Windows Credential Manager). |
| `apps/android` | Kotlin and Jetpack Compose. minSdk 26, compileSdk 37, targetSdk 35. The refresh token is in EncryptedSharedPreferences with a Keystore master key. UnifiedPush uses the official android-connector. |
| `contract` | The Hermes OpenRPC document pinned to v0.22.5, hand-written TypeScript and Kotlin clients, and a fake gateway for tests. |
| `tokens` | Zoetrik colors and fonts. `tokens/zoetrik.json` is the source. CSS and the Android font resources are generated or copied from it. |
| `notifier` | A Python standard-library process for the devbox. It watches Hermes and POSTs to ntfy or a UnifiedPush endpoint. |
| `docs` | The device checklist and what this phase actually verified. |
| `mockups` | Approved screens. Left as they are. |

## Checks

```bash
python3 contract/check_contract.py
python3 tokens/build_tokens.py --check
python3 notifier/test_notify.py
npm test --prefix contract/ts
cd apps/android && ./gradlew :hermes-client:test assembleDebug
cd apps/windows && npm run check
```

GitHub Actions builds an unsigned Windows NSIS installer (`hermes-bots-windows-setup`) and a debug APK (`hermes-bots-android-debug`). Signing is not set up. See `docs/phase0-test-plan.md`.
