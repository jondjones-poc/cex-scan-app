import { NextResponse } from "next/server";
import { readSettings } from "@/lib/settings";
import { checkProducts } from "@/lib/cex";
import { notifyInStock } from "@/lib/notifier";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await readSettings();
    const results = await checkProducts(settings.productIds, settings);

    const inStock = results.filter(r => r.inStock === true);
    if (inStock.length > 0) {
      await notifyInStock(inStock, settings);
    }

    return NextResponse.json({ ok: true, count: results.length, inStockCount: inStock.length, results });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}
