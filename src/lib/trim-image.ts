// Recorta los márgenes en blanco/transparentes de una imagen (p. ej. un logo
// exportado con mucho padding), devolviendo un data URL solo con el contenido visible.
export function trimImageWhitespace(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(src);
        ctx.drawImage(img, 0, 0);

        const { width, height } = canvas;
        const { data } = ctx.getImageData(0, 0, width, height);
        const isBackground = (i: number) => {
          const a = data[i + 3];
          if (a < 10) return true;
          return data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245;
        };

        let top = 0, bottom = height - 1, left = 0, right = width - 1;
        let found = false;

        outerTop: for (; top < height; top++) {
          for (let x = 0; x < width; x++) {
            if (!isBackground((top * width + x) * 4)) { found = true; break outerTop; }
          }
        }
        if (!found) return resolve(src); // imagen vacía o toda uniforme -> no tocar

        outerBottom: for (; bottom >= top; bottom--) {
          for (let x = 0; x < width; x++) {
            if (!isBackground((bottom * width + x) * 4)) break outerBottom;
          }
        }
        outerLeft: for (; left < width; left++) {
          for (let y = top; y <= bottom; y++) {
            if (!isBackground((y * width + left) * 4)) break outerLeft;
          }
        }
        outerRight: for (; right >= left; right--) {
          for (let y = top; y <= bottom; y++) {
            if (!isBackground((y * width + right) * 4)) break outerRight;
          }
        }

        const margin = 4;
        const cropX = Math.max(0, left - margin);
        const cropY = Math.max(0, top - margin);
        const cropW = Math.min(width, right - left + 1 + margin * 2);
        const cropH = Math.min(height, bottom - top + 1 + margin * 2);

        const out = document.createElement("canvas");
        out.width = cropW;
        out.height = cropH;
        const outCtx = out.getContext("2d");
        if (!outCtx) return resolve(src);
        outCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        resolve(out.toDataURL("image/png"));
      } catch {
        resolve(src); // CORS u otro error -> usar la imagen original sin recortar
      }
    };
    img.onerror = () => reject(new Error("No se pudo cargar la imagen"));
    img.src = src;
  });
}
