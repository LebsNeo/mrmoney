import { NextRequest } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, apiServerError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugify(base);
  let existing = await prisma.organisation.findUnique({ where: { slug } });
  if (!existing) return slug;
  // Append random suffix
  slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  existing = await prisma.organisation.findUnique({ where: { slug } });
  return existing ? `${slug}-${Date.now()}` : slug;
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, organisationName } = await req.json();

    if (!name?.trim() || !email?.trim() || !password || !organisationName?.trim()) {
      return apiError("All fields are required");
    }
    if (password.length < 8) {
      return apiError("Password must be at least 8 characters");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return apiError("Invalid email address");
    }

    // Check duplicate email
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return apiError("An account with this email already exists");

    const passwordHash = await hash(password, 12);
    const slug = await uniqueSlug(organisationName);

    // Create org + user atomically
    const user = await prisma.$transaction(async (tx) => {
      const org = await tx.organisation.create({
        data: {
          name: organisationName.trim(),
          slug,
          plan: "FREE",
          currency: "ZAR",
        },
      });

      return tx.user.create({
        data: {
          organisationId: org.id,
          name: name.trim(),
          email: email.toLowerCase().trim(),
          passwordHash,
          role: "OWNER",
        },
      });
    });

    logger.info("New user registered", { email: user.email });
    return apiSuccess({ email: user.email });
  } catch (err) {
    logger.error("Registration error", err);
    return apiServerError();
  }
}
