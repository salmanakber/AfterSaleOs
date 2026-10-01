import { createHash, randomBytes } from "crypto";
import fs from "fs/promises";
import path from "path";
import { prisma } from "../client";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "video/mp4",
]);

const MAX_BYTES = Number(process.env.MAX_UPLOAD_SIZE_MB ?? 25) * 1024 * 1024;

function uploadRoot() {
  return process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");
}

export async function saveClaimAttachment(params: {
  shopId: string;
  fileName: string;
  contentType: string;
  bytes: Buffer;
  claimId?: string;
}) {
  if (!ALLOWED_TYPES.has(params.contentType)) {
    throw Object.assign(new Error("File type not allowed"), { code: "FILE_TYPE" });
  }
  if (params.bytes.length > MAX_BYTES) {
    throw Object.assign(new Error("File too large"), { code: "FILE_TOO_LARGE" });
  }

  // Basic magic-byte sniff for images/pdf
  const scanStatus = sniffFile(params.bytes, params.contentType) ? "clean" : "quarantine";

  const key = `${params.shopId}/claims/${Date.now()}_${randomBytes(8).toString("hex")}_${sanitizeName(params.fileName)}`;
  const full = path.join(uploadRoot(), key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, params.bytes);

  return prisma.attachment.create({
    data: {
      shopId: params.shopId,
      claimId: params.claimId,
      storageKey: key,
      fileName: params.fileName,
      contentType: params.contentType,
      sizeBytes: params.bytes.length,
      scannedAt: new Date(),
      scanStatus,
    },
  });
}

export async function readAttachmentFile(storageKey: string) {
  const full = path.join(uploadRoot(), storageKey);
  return fs.readFile(full);
}

export function downloadToken(attachmentId: string, shopId: string) {
  const secret = process.env.TOKEN_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY || "dev";
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const payload = `${attachmentId}.${shopId}.${exp}`;
  const sig = createHash("sha256").update(`${payload}.${secret}`).digest("hex").slice(0, 32);
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function verifyDownloadToken(token: string): { attachmentId: string; shopId: string } | null {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const [attachmentId, shopId, expStr, sig] = raw.split(".");
    if (!attachmentId || !shopId || !expStr || !sig) return null;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
    const secret = process.env.TOKEN_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY || "dev";
    const payload = `${attachmentId}.${shopId}.${expStr}`;
    const expected = createHash("sha256").update(`${payload}.${secret}`).digest("hex").slice(0, 32);
    if (expected !== sig) return null;
    return { attachmentId, shopId };
  } catch {
    return null;
  }
}

function sanitizeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

function sniffFile(buf: Buffer, contentType: string) {
  if (buf.length < 4) return false;
  if (contentType === "application/pdf") return buf.slice(0, 4).toString() === "%PDF";
  if (contentType === "image/png") return buf[0] === 0x89 && buf[1] === 0x50;
  if (contentType === "image/jpeg") return buf[0] === 0xff && buf[1] === 0xd8;
  if (contentType === "image/gif") return buf.slice(0, 3).toString() === "GIF";
  if (contentType === "image/webp") return buf.slice(0, 4).toString() === "RIFF";
  if (contentType === "video/mp4") return true; // skip deep check
  return false;
}
