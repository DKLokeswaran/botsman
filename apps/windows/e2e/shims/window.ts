export function getCurrentWindow() {
  return {
    async isVisible(): Promise<boolean> {
      return true;
    },
    async isMinimized(): Promise<boolean> {
      return false;
    },
    async show(): Promise<void> {
      return undefined;
    },
    async unminimize(): Promise<void> {
      return undefined;
    },
    async setFocus(): Promise<void> {
      return undefined;
    },
    async onFocusChanged(_handler: (event: { payload: boolean }) => void): Promise<() => void> {
      return () => undefined;
    },
  };
}
