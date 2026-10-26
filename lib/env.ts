import { z } from "zod";
import type { RuntimeMode } from "@/types/domain";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SMTP2GO_SMTP_HOST: z.string().optional(),
  SMTP2GO_SMTP_PORT: z.coerce.number().optional(),
  SMTP2GO_SMTP_USER: z.string().optional(),
  SMTP2GO_SMTP_PASSWORD: z.string().optional(),
  SMTP2GO_FROM_EMAIL: z.string().email().optional(),
  SMTP2GO_FROM_NAME: z.string().optional(),
  SMTP2GO_WEBHOOK_AUTH: z.string().optional(),
  ATHENA_REGISTERED_OFFICE: z.string().optional(),
  ATHENA_COMPANY_REGISTRATION: z.string().optional(),
  ATHENA_ENQUIRIES_EMAIL: z.string().email().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional()
});

const rawEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SMTP2GO_SMTP_HOST: process.env.SMTP2GO_SMTP_HOST,
  SMTP2GO_SMTP_PORT: process.env.SMTP2GO_SMTP_PORT,
  SMTP2GO_SMTP_USER: process.env.SMTP2GO_SMTP_USER,
  SMTP2GO_SMTP_PASSWORD: process.env.SMTP2GO_SMTP_PASSWORD,
  SMTP2GO_FROM_EMAIL: process.env.SMTP2GO_FROM_EMAIL,
  SMTP2GO_FROM_NAME: process.env.SMTP2GO_FROM_NAME,
  SMTP2GO_WEBHOOK_AUTH: process.env.SMTP2GO_WEBHOOK_AUTH,
  ATHENA_REGISTERED_OFFICE: process.env.ATHENA_REGISTERED_OFFICE,
  ATHENA_COMPANY_REGISTRATION: process.env.ATHENA_COMPANY_REGISTRATION,
  ATHENA_ENQUIRIES_EMAIL: process.env.ATHENA_ENQUIRIES_EMAIL,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI
};

type ParsedEnv = Partial<z.infer<typeof envSchema>>;

// Validate each variable on its own. Previously one bad value (for example a typo in
// SMTP2GO_FROM_EMAIL) failed the whole object and silently dropped the site into demo
// mode. Now only the bad variable is ignored, and it is reported in the logs.
function parseEnv(): ParsedEnv {
  const result: Record<string, unknown> = {};
  const shape = envSchema.shape;

  for (const key of Object.keys(shape) as Array<keyof typeof shape>) {
    const value = rawEnv[key];

    if (value === undefined || value === "") {
      continue;
    }

    const parsedValue = shape[key].safeParse(value);

    if (parsedValue.success) {
      result[key] = parsedValue.data;
    } else if (typeof window === "undefined") {
      console.error(`[athena] Ignoring invalid environment variable ${key}: ${parsedValue.error.issues[0]?.message}`);
    }
  }

  return result as ParsedEnv;
}

const data = parseEnv();

export const env = {
  supabaseUrl: data.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: data.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: data.SUPABASE_SERVICE_ROLE_KEY ?? "",
  smtp2goHost: data.SMTP2GO_SMTP_HOST ?? "",
  smtp2goPort: data.SMTP2GO_SMTP_PORT ?? 587,
  smtp2goUser: data.SMTP2GO_SMTP_USER ?? "",
  smtp2goPassword: data.SMTP2GO_SMTP_PASSWORD ?? "",
  smtp2goFromEmail: data.SMTP2GO_FROM_EMAIL ?? "",
  smtp2goFromName: data.SMTP2GO_FROM_NAME ?? "Athena Pro",
  smtp2goWebhookAuth: data.SMTP2GO_WEBHOOK_AUTH ?? "",
  registeredOffice: data.ATHENA_REGISTERED_OFFICE ?? "",
  companyRegistration: data.ATHENA_COMPANY_REGISTRATION ?? "",
  enquiriesEmail: data.ATHENA_ENQUIRIES_EMAIL ?? "",
  googleClientId: data.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: data.GOOGLE_CLIENT_SECRET ?? "",
  googleRedirectUri: data.GOOGLE_REDIRECT_URI ?? "",
  hasSupabase:
    Boolean(data.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(data.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  hasSmtp2go:
    Boolean(data.SMTP2GO_SMTP_HOST) &&
    Boolean(data.SMTP2GO_SMTP_USER) &&
    Boolean(data.SMTP2GO_SMTP_PASSWORD) &&
    Boolean(data.SMTP2GO_FROM_EMAIL),
  hasGoogleOAuth:
    Boolean(data.GOOGLE_CLIENT_ID) &&
    Boolean(data.GOOGLE_CLIENT_SECRET) &&
    Boolean(data.GOOGLE_REDIRECT_URI)
};

export function getRuntimeMode(): RuntimeMode {
  return env.hasSupabase ? "live" : "demo";
}

// True when a production build is running without Supabase. Demo mode exists for
// local development and previews, so production code paths use this to refuse
// anything that would expose the sample admin workspace.
export function isProductionDemo() {
  return process.env.NODE_ENV === "production" && process.env.ATHENA_ALLOW_DEMO !== "true" && !env.hasSupabase;
}
