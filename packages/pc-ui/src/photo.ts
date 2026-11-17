import { PHOTO_SIZE } from "@botsman/client-core";

// Shrinks a picked image to a square JPEG data URL, cropped from its centre, small enough for an avatar.
export async function shrinkPhoto(file: File): Promise<string> {
  const image = await createImageBitmap(file);
  const side = Math.min(image.width, image.height);
  const canvas = document.createElement("canvas");
  canvas.width = PHOTO_SIZE;
  canvas.height = PHOTO_SIZE;
  canvas.getContext("2d")!.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
  return canvas.toDataURL("image/jpeg", 0.85);
}
