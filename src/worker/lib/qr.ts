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

// Renders a QR code with a "Table N" header and a timestamp label stacked above it
// (table number, then timestamp, then the QR code itself).
export async function renderTableQrSvg(
  url: string,
  tableNumber: number,
  timestampLabel: string
): Promise<string> {
  const qrSvg = await QRCode.toString(url, { type: "svg", margin: 1, width: 320 });
  const match = qrSvg.match(/<svg[^>]*viewBox="([^"]+)"[^>]*>([\s\S]*)<\/svg>/);
  const viewBox = match?.[1] ?? "0 0 320 320";
  const innerContent = match?.[2] ?? "";

  const width = 320;
  const headerHeight = 64;
  const totalHeight = width + headerHeight;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}">
  <rect width="${width}" height="${totalHeight}" fill="#ffffff"/>
  <text x="${width / 2}" y="26" text-anchor="middle" font-family="sans-serif" font-size="22" font-weight="bold" fill="#000000">Table ${tableNumber}</text>
  <text x="${width / 2}" y="48" text-anchor="middle" font-family="monospace" font-size="14" fill="#444444">${timestampLabel}</text>
  <svg x="0" y="${headerHeight}" width="${width}" height="${width}" viewBox="${viewBox}">${innerContent}</svg>
</svg>`;
}
