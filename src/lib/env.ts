/**
 * MrMoney — Environment Validation
 * Phase 9: All required env vars validated at startup via zod.
 */
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NEXTAUTH_SECRET: z
    .string()
    .min(32, "NEXTAUTH_SECRET must be at least 32 characters"),
  NEXTAUTH_URL: z.string().url("NEXTAUTH_URL must be a valid URL"),
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url("NEXT_PUBLIC_APP_URL must be a valid URL"),
});

function parseEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `❌ Invalid environment variables:\n${issues}\n\nCheck your .env file and ensure all required variables are set.`
    );
  }
  return result.data;
}

// Parsed and validated env — throws at module load if invalid
export const env = parseEnv();

export type Env = z.infer<typeof envSchema>;
