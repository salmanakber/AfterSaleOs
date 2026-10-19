/** Client-safe helpers for rendering and downloading QR images. */

export function qrImageUrl(data: string, size = 320) {
  const s = Math.max(120, Math.min(size, 1024));
  return `https://api.qrserver.com/v1/create-qr-code/?size=${s}x${s}&margin=12&ecc=M&data=${encodeURIComponent(data)}`;
}

export async function downloadQrPng(data: string, filename: string, size = 720) {
  const res = await fetch(qrImageUrl(data, size));
  if (!res.ok) throw new Error("Could not generate QR image");
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

export function printQrSheet(opts: {
  title: string;
  subtitle?: string;
  url: string;
  imageUrl: string;
}) {
  const w = window.open("", "_blank", "noopener,noreferrer,width=560,height=720");
  if (!w) return;
  const safeTitle = opts.title.replace(/</g, "&lt;");
  const safeSub = (opts.subtitle ?? "").replace(/</g, "&lt;");
  const safeUrl = opts.url.replace(/</g, "&lt;");
  w.document.write(`<!doctype html><html><head><title>${safeTitle}</title>
<style>
  @page { margin: 18mm; }
  body { font-family: Georgia, "Times New Roman", serif; color: #111; text-align: center; padding: 24px; }
  h1 { font-size: 22px; margin: 0 0 6px; letter-spacing: -0.02em; }
  p { margin: 0 0 18px; color: #444; font-size: 13px; }
  img { width: 280px; height: 280px; border: 1px solid #e5e5e5; border-radius: 12px; padding: 12px; background: #fff; }
  .url { margin-top: 16px; font-family: ui-monospace, monospace; font-size: 11px; word-break: break-all; color: #666; }
  .hint { margin-top: 20px; font-size: 12px; color: #888; }
</style></head><body>
  <h1>${safeTitle}</h1>
  ${safeSub ? `<p>${safeSub}</p>` : ""}
  <img src="${opts.imageUrl}" alt="QR code" />
  <div class="url">${safeUrl}</div>
  <p class="hint">Scan to activate warranty or open support</p>
  <script>window.onload=()=>{window.print();}</script>
</body></html>`);
  w.document.close();
}
