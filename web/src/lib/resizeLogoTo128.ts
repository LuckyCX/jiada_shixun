const SIZE = 128;
const MAX_DATA_URL_CHARS = 600_000;

/**
 * 将用户选择的图片居中裁剪为 1:1，并缩放为 128×128，输出 PNG data URL。
 */
export function resizeImageFileTo128Png(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('请选择图片文件'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.onload = () => {
      const url = reader.result as string;
      const img = new Image();
      img.onload = () => {
        try {
          const w = img.naturalWidth;
          const h = img.naturalHeight;
          if (!w || !h) {
            reject(new Error('无法解析图片尺寸'));
            return;
          }
          const side = Math.min(w, h);
          const sx = (w - side) / 2;
          const sy = (h - side) / 2;
          const canvas = document.createElement('canvas');
          canvas.width = SIZE;
          canvas.height = SIZE;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('浏览器不支持 Canvas'));
            return;
          }
          ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);
          const dataUrl = canvas.toDataURL('image/png');
          if (dataUrl.length > MAX_DATA_URL_CHARS) {
            reject(new Error('图片编码后过大，请换用较小原图或降低分辨率'));
            return;
          }
          resolve(dataUrl);
        } catch (e) {
          reject(e instanceof Error ? e : new Error('处理图片失败'));
        }
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = url;
    };
    reader.readAsDataURL(file);
  });
}
