import { addTrayListener } from "./bridge";

export async function listen(
  event: string,
  handler: (event: { payload: unknown }) => void,
): Promise<() => void> {
  return addTrayListener(event, handler);
}
