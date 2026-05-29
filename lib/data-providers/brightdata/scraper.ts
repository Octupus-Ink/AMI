import type { MarketContextPayload } from "@/lib/schemas/ami";
import { collectBrightDataEvidence } from "@/lib/data-providers/brightdata/client";

export async function collectWithStructuredScraper(context: MarketContextPayload) {
  return collectBrightDataEvidence(context, {
    webUnlockerEndpoint: undefined,
    serpEndpoint: undefined
  });
}
