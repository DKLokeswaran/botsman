let visible = true;
let foregrounds = 0;

export function setWindowHidden(hidden: boolean): void {
  visible = !hidden;
}

export function foregroundCount(): number {
  return foregrounds;
}

export function getCurrentWindow() {
  return {
    async isVisible(): Promise<boolean> {
      return visible;
    },
    async isMinimized(): Promise<boolean> {
      return false;
    },
    async show(): Promise<void> {
      visible = true;
      foregrounds += 1;
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
