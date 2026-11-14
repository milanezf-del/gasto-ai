const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.8;

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Não foi possível carregar a imagem selecionada."));
    };
    img.src = objectUrl;
  });
}

export async function compressImageForUpload(file: File): Promise<File> {
  const img = await loadImageFromFile(file);
  const srcWidth = img.naturalWidth || img.width;
  const srcHeight = img.naturalHeight || img.height;

  if (!srcWidth || !srcHeight) {
    return file;
  }

  const longest = Math.max(srcWidth, srcHeight);
  const scale = longest > MAX_DIMENSION ? MAX_DIMENSION / longest : 1;
  const targetWidth = Math.max(1, Math.round(srcWidth * scale));
  const targetHeight = Math.max(1, Math.round(srcHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
  );

  if (!blob) return file;

  const baseName = file.name.replace(/\.[^/.]+$/, "") || "comprovante";
  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}
