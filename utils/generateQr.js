import QRCode from "qrcode";
export async function generateQRCode(link) {
  return QRCode.toDataURL(link);
}
