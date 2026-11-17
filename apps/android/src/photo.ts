import { PHOTO_SIZE } from "@botsman/client-core";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { launchImageLibraryAsync } from "expo-image-picker";

// Lets the owner pick and crop a square photo, then shrinks it to a small JPEG data URL. Undefined when cancelled.
export async function pickPhoto(): Promise<string | undefined> {
  const picked = await launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 });
  const uri = picked.canceled ? undefined : picked.assets[0]?.uri;
  if (uri === undefined) return undefined;
  const image = await ImageManipulator.manipulate(uri).resize({ width: PHOTO_SIZE, height: PHOTO_SIZE }).renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });
  return `data:image/jpeg;base64,${saved.base64}`;
}
