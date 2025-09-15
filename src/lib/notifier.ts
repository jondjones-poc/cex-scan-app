import type { AppSettings } from "./settings";
import type { ProductCheckResult } from "./cex";

function resolveWebhookUrl(settings: AppSettings & { webhookUrlEnv: string }): string | undefined {
  const key = settings.webhookUrlEnv || "NOTIFY_WEBHOOK_URL";
  const value = process.env[key];
  return value && value.length > 0 ? value : undefined;
}

export async function notifyInStock(results: ProductCheckResult[], settings: AppSettings & { webhookUrlEnv: string }): Promise<void> {
  const url = resolveWebhookUrl(settings);
  if (!url) return;

  const textLines = results.map(r => `✅ ${r.productId} appears in stock: ${r.url}`);
  const payload = { text: textLines.join("\n") };

  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}
