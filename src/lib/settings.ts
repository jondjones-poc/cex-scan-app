import { promises as fs } from "fs";
import path from "path";

export type StoreGroup = {
  name: string;
  values: string[];
};

export type AppSettings = {
  productIds?: string[]; // Legacy support
  essentialProducts?: string[];
  oneDayProducts?: string[];
  baseUrl?: string;
  userAgent?: string;
  webhookUrlEnv?: string;
  stores?: StoreGroup[];
  retroCategoryIds?: string[];
  discBasedGameCategoryIds?: string[];
  searchUrl?: string;
  categoryMap?: { [key: string]: string };
};

const DEFAULTS: Required<Omit<AppSettings, "productIds" | "essentialProducts" | "oneDayProducts">> = {
  baseUrl: "https://uk.webuy.com",
  userAgent: "Mozilla/5.0 (compatible; CeX-Monitor/0.1; +https://example.local)",
  webhookUrlEnv: "NOTIFY_WEBHOOK_URL",
  stores: [],
  retroCategoryIds: ["1037"],
  discBasedGameCategoryIds: ["1178", "403", "1192", "782", "808", "1064", "795"],
  searchUrl: "https://uk.webuy.com/search",
  categoryMap: {}
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
  
  // Handle legacy productIds for backward compatibility
  if (!Array.isArray(merged.productIds)) {
    merged.productIds = [];
  }
  
  // Handle new product structure
  if (!Array.isArray(merged.essentialProducts)) {
    merged.essentialProducts = [];
  }
  if (!Array.isArray(merged.oneDayProducts)) {
    merged.oneDayProducts = [];
  }
  
  if (!Array.isArray(merged.stores)) {
    merged.stores = [];
  }
  if (!Array.isArray(merged.retroCategoryIds)) {
    merged.retroCategoryIds = ["1037"];
  }
  if (!Array.isArray(merged.discBasedGameCategoryIds)) {
    merged.discBasedGameCategoryIds = ["1178", "403", "1192", "782", "808", "1064", "795"];
  }
  if (!merged.categoryMap) {
    merged.categoryMap = {};
  }
  return merged;
}
