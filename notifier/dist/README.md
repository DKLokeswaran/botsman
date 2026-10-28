# Download server

The apps look for updates at `http://100.113.35.96:8711/latest.json`. That host is the same tailnet address as Hermes, on port 8711. Each app has a field next to the Hermes server address if the base URL changes.

`latest.json` is not produced by the notifier process. After CI uploads the installer and the APK, copy those two files into the directory this server exposes and write the manifest beside them:

```bash
python3 scripts/make_latest_json.py \
  --build "$GITHUB_RUN_NUMBER" \
  --sha "$(git rev-parse --short=7 HEAD)" \
  --windows path/to/*-setup.exe \
  --android path/to/app-debug.apk \
  --output /var/www/hermes-dist/latest.json
```

`--build` becomes both `build` and the Android `versionCode`. The script fills `sha256` and `size` from the files. Each `url` is `http://100.113.35.96:8711/` plus the file name, so the exe and the apk have to sit next to `latest.json`.

The Windows installer version is `0.1.<run number>`, which is higher than the previous build, so NSIS upgrades in place. The APK is signed with the committed debug keystore `apps/android/app/hermes-debug.keystore` (alias `androiddebugkey`, store and key password `android`), and its `versionCode` is the same run number. A local build that is not in GitHub Actions shows `0.1.0 (build dev, dev)` and version code 1.

No new notifier environment variables. Restarting the notifier does not publish `latest.json`.
