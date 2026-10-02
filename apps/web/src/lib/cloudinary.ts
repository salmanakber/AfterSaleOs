import { createHash } from "crypto";

const CLOUD_NAME = () => process.env.CLOUDINARY_CLOUD_NAME ?? "";
const API_KEY = () => process.env.CLOUDINARY_API_KEY ?? "";
const API_SECRET = () => process.env.CLOUDINARY_API_SECRET ?? "";
const FOLDER = () => process.env.CLOUDINARY_UPLOAD_FOLDER ?? "aftersale";

export function isCloudinaryConfigured() {
  return Boolean(CLOUD_NAME() && API_KEY() && API_SECRET());
}

/** Signed upload to Cloudinary (image/logo). Returns secure_url. */
export async function uploadLogoToCloudinary(params: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  shopDomain: string;
}): Promise<{ url: string; publicId: string }> {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
    );
  }

  const cloud = CLOUD_NAME();
  const apiKey = API_KEY();
  const apiSecret = API_SECRET();
  const folder = `${FOLDER()}/${params.shopDomain.replace(/[^a-z0-9.-]/gi, "_")}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `logo_${timestamp}`;

  // Signature: sorted params excluding file + api_key, then append api_secret
  const toSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const signature = createHash("sha1").update(toSign).digest("hex");

  const blob = new Blob([new Uint8Array(params.buffer)], {
    type: params.mimeType || "application/octet-stream",
  });
  const form = new FormData();
  form.append("file", blob, params.fileName || "logo.png");
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("folder", folder);
  form.append("public_id", publicId);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
    method: "POST",
    body: form,
  });
  const json = (await res.json()) as {
    secure_url?: string;
    public_id?: string;
    error?: { message?: string };
  };
  if (!res.ok || !json.secure_url) {
    throw new Error(json.error?.message ?? "Cloudinary upload failed");
  }
  return { url: json.secure_url, publicId: json.public_id ?? publicId };
}
