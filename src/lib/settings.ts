import { promises as fs } from "fs";
import path from "path";

export type AppSettings = {
  productIds: string[];
  baseUrl?: string;
  userAgent?: string;
  webhookUrlEnv?: string;
};

const DEFAULTS: Required<Omit<AppSettings, "productIds">> = {
  baseUrl: "https://uk.webuy.com",
  userAgent: "Mozilla/5.0 (compatible; CeX-Monitor/0.1; +https://example.local)",
  webhookUrlEnv: "NOTIFY_WEBHOOK_URL"
};

export async function readSettings(): Promise<AppSettings & typeof DEFAULTS> {
  const root = process.cwd();
  const settingsPath = path.join(root, "settings.json");
  let data: Partial<AppSettings> = {};
  try {
    const raw = await fs.readFile(settingsPath, "utf8");
    data = JSON.parse(raw);
  } catch (error) {
    data = {};
  }

  const merged = { ...DEFAULTS, ...data } as AppSettings & typeof DEFAULTS;
  if (!Array.isArray(merged.productIds)) {
    merged.productIds = [];
  }
  return merged;
}
