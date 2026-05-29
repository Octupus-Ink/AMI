import type { MarketContextPayload } from "@/lib/schemas/ami";
import { collectBrightDataEvidence } from "@/lib/data-providers/brightdata/client";

export async function collectWithWebUnlocker(context: MarketContextPayload) {
  return collectBrightDataEvidence(context, {
    webScraperEndpoint: undefined,
    serpEndpoint: undefined
  });
}
