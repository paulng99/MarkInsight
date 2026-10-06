import assert from "node:assert/strict";
import test from "node:test";
import { readResolvedImage } from "./pdf-image-lookup.ts";

function store(images: Record<string, { width: number; height: number; kind: number; data: Uint8Array } | null>) {
  return {
    has(id: string) {
      return Object.prototype.hasOwnProperty.call(images, id) && images[id] != null;
    },
    get(id: string) {
      if (!this.has(id)) {
        throw new Error(`waited for unresolved image ${id}`);
      }
      return images[id];
    },
  };
}

test("skips a group placeholder instead of waiting for it", () => {
  const page = store({});
  const common = store({
    img_p19_1: { width: 3507, height: 4960, kind: 2, data: new Uint8Array([1, 2, 3]) },
  });
  assert.equal(readResolvedImage([page, common], "g_d0_img_p19_1"), null);
  assert.equal(readResolvedImage([page, common], "img_p19_1")?.width, 3507);
});

test("reads an image that is only in the common store", () => {
  const page = store({});
  const common = store({
    g_d0_img_p19_1: { width: 800, height: 1200, kind: 2, data: new Uint8Array([9]) },
  });
  assert.equal(readResolvedImage([page, common], "g_d0_img_p19_1")?.height, 1200);
});
