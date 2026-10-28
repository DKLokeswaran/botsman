let enabled = false;

export async function isEnabled(): Promise<boolean> {
  return enabled;
}

export async function enable(): Promise<void> {
  enabled = true;
}

export async function disable(): Promise<void> {
  enabled = false;
}
