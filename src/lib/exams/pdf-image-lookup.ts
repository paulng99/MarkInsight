export type ResolvedPdfImage = {
  width: number;
  height: number;
  kind: number;
  data: Uint8Array | Uint8ClampedArray;
};

type ImageStore = {
  has(id: string): boolean;
  get(id: string): ResolvedPdfImage | null;
};

/**
 * Read an image that is already decoded.
 * pdf.js `get(id, callback)` inserts a promise and waits forever when the id
 * is a group placeholder (`g_…`) that will never resolve.
 */
export function readResolvedImage(
  stores: ImageStore[],
  name: string,
): ResolvedPdfImage | null {
  const store = stores.find((item) => item.has(name));
  if (!store) return null;
  const img = store.get(name);
  if (!img?.width || !img.height || !img.data) return null;
  return img;
}
