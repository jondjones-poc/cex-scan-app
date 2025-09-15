import { promises as fs } from "fs";
import path from "path";

export type AppSettings = {
  productIds: string[];
  baseUrl?: string;
  userAgent?: string;
  webhookUrlEnv?: string;
  stores?: string[];
  categoryIds?: string[];
  searchUrl?: string;
};

const DEFAULTS: Required<Omit<AppSettings, "productIds">> = {
  baseUrl: "https://uk.webuy.com",
  userAgent: "Mozilla/5.0 (compatible; CeX-Monitor/0.1; +https://example.local)",
  webhookUrlEnv: "NOTIFY_WEBHOOK_URL",
  stores: [],
  categoryIds: ["1037"],
  searchUrl: "https://uk.webuy.com/search"
};

export async function readSettings(): Promise<AppSettings & typeof DEFAULTS> {
  const root = process.cwd();
  const settingsPath = path.join(root, "settings.json");
  const storesPath = path.join(root, "stores.json");
  
  let data: Partial<AppSettings> = {};
  let storesData: any = {};
  
  try {
    const raw = await fs.readFile(settingsPath, "utf8");
    data = JSON.parse(raw);
  } catch (error) {
    data = {};
  }

  try {
    const storesRaw = await fs.readFile(storesPath, "utf8");
    storesData = JSON.parse(storesRaw);
  } catch (error) {
    storesData = {};
  }

  const merged = { ...DEFAULTS, ...data, ...storesData } as AppSettings & typeof DEFAULTS;
  if (!Array.isArray(merged.productIds)) {
    merged.productIds = [];
  }
  if (!Array.isArray(merged.stores)) {
    merged.stores = [];
  }
  if (!Array.isArray(merged.categoryIds)) {
    merged.categoryIds = ["1037"];
  }
  return merged;
}
