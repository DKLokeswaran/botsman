export function formatUpdateProgress(received: number, total: number | null | undefined): string {
  const toMb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);
  if (total != null && total > 0) {
    const percent = Math.min(100, Math.floor((received / total) * 100));
    return `Downloading ${percent}% (${toMb(received)} / ${toMb(total)} MB)`;
  }
  return `Downloading ${toMb(received)} MB`;
}

export function beginUpdateDownload(inFlight: boolean): boolean {
  return !inFlight;
}
