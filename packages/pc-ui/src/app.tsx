import type { Platform } from "./platform.ts";
import { ServerCheckScreen } from "./screens/server-check.tsx";

// The root of the Windows app and the web dashboard.
export function App({ platform }: { platform: Platform }) {
  return <ServerCheckScreen platform={platform} />;
}
