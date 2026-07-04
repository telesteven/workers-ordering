import QRCode from "qrcode";

// Workers has no canvas/DOM, so we render as SVG (pure string output, no native deps)
// instead of PNG (which requires the 'canvas' package).
export async function renderQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    margin: 1,
    width: 320,
  });
}
