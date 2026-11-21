# Botsman

Botsman is a self-hosted personal assistant. A TypeScript server built on Pi Durable runs the bots. A Windows app (Tauri and React), a web dashboard on the same screens, and an Android app (Expo and React Native) are the clients. The architecture is in `docs/decisions/overview.md`.

## Instructions

Make every change, whether a new feature, a bug fix, or anything else, with care that the Windows and Android apps stay in parity.

- Put logic in the shared `protocol` and `client-core` packages. Screens hold no logic of their own.
- A UI change is finished only when it is on both apps.
- Only one internal server module may import Pi Durable. Pin Pi to an exact version.
- Run `pnpm lint:imports` before finishing a change. It checks the [import rules](docs/decisions/stack.md#import-rules) between packages.
- Record every decision or applied default in the affected docs, in the same change.
