import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { put } from "@vercel/blob";
import { apiSuccess, apiError, apiUnauthorized, apiServerError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const orgId = (session?.user as { organisationId?: string })?.organisationId;
    if (!orgId) return apiUnauthorized();

    const formData = await req.formData();
    const file = formData.get("image") as File | null;
    if (!file) return apiError("No image provided");

    // Limit file size to 10MB
    if (file.size > 10 * 1024 * 1024) return apiError("Image too large (max 10MB)");

    const ext = file.name.split(".").pop() ?? "jpg";
    const filename = `receipts/${orgId}/${Date.now()}.${ext}`;

    const blob = await put(filename, file, {
      access: "public",
      contentType: file.type || "image/jpeg",
    });

    logger.info("Receipt uploaded", { url: blob.url });
    return apiSuccess({ url: blob.url });
  } catch (err) {
    logger.error("upload-receipt error", err);
    // If Blob not configured, return a helpful error
    if (String(err).includes("BLOB_READ_WRITE_TOKEN")) {
      return apiError("Receipt storage not configured. Contact your administrator.");
    }
    return apiServerError();
  }
}
