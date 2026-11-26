# Botsman

Botsman is a self-hosted personal assistant. A TypeScript server built on Pi Durable runs the bots. A Windows app (Tauri and React), a web dashboard on the same screens, and an Android app (Expo and React Native) are the clients.

## Instructions

Make every change, whether a new feature, a bug fix, or anything else, with care that the Windows and Android apps stay in parity.

- Put code in the package that owns it:
  - `protocol`: what the server and the apps must agree on, such as messages, limits, and patterns. Read a limit from here and never write its value again.
  - `client-core`: every decision, calculation, server call, and text that depends on state. Each screen or form gets one hook, with its decisions in plain functions that have tests.
  - `tokens`: colours, sizes, and shapes both apps draw.
  - Screens (`pc-ui` and `apps/android`): layout, styling, navigation, fixed wording, and platform calls. If the other app would need the same line of logic, it belongs in `client-core`.
- Before writing logic, search `client-core` and the other app for it. Use what exists, or move the other app's copy to `client-core` and use it in both.
- Move the whole piece of logic, not a one-line helper that leaves the rest repeated in each screen.
- When a step must differ by platform, such as picking a photo, write only that step in each app and pass it to the shared hook. The hook keeps the rest of the logic.
- Export only what another package uses.
- A UI change is finished only when it is on both apps.
- Only one internal server module may import Pi Durable. Pin Pi to an exact version.
- Run `pnpm lint` before finishing a change. It checks the import rules between packages and the code rules for screens.
- Record every decision or applied default in the affected docs, in the same change.
