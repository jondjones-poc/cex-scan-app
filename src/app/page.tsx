import { readSettings } from "@/lib/settings";
import { checkProducts } from "@/lib/cex";
import StatusTable from "@/components/StatusTable";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const settings = await readSettings();
  const results = await checkProducts(settings.productIds, settings);

  return (
    <main>
      <StatusTable results={results} />
    </main>
  );
}
