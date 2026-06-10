const MAX_WIDTH = 1920;
const JPEG_QUALITY = 0.82;
const MAX_DATA_URL_CHARS = 1_200_000;

/** 首页 Hero 背景：等比缩放到最大宽度，输出 JPEG data URL */
export function resizeImageFileForHeroBackground(file: File): Promise<string> {
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
          const scale = w > MAX_WIDTH ? MAX_WIDTH / w : 1;
          const cw = Math.round(w * scale);
          const ch = Math.round(h * scale);
          const canvas = document.createElement('canvas');
          canvas.width = cw;
          canvas.height = ch;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('浏览器不支持 Canvas'));
            return;
          }
          ctx.drawImage(img, 0, 0, cw, ch);
          const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
          if (dataUrl.length > MAX_DATA_URL_CHARS) {
            reject(new Error('图片编码后过大，请换用较小原图'));
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
