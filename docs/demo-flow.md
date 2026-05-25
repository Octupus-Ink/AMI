# Demo Flow

Use this sequence for judges:

1. Open the app at `/`.
2. Click `Launch Demo Analysis`.
3. Review the marketplace dashboard for Northstar Outdoor Gear.
4. Confirm the demo mode badge if credentials are missing.
5. Click `Run Marketplace Analysis`.
6. Watch the agent timeline move through:
   - Competitor Intelligence Agent
   - Inventory Optimization Agent
   - Trend Intelligence Agent
   - Coordinator Agent
7. Land on the analysis detail page.
8. Review the marketplace health score and coordinator recommendations.
9. Open the raw structured JSON panel to inspect agent contracts.
10. Return to the dashboard and review recent runs.

## Expected Demo Story

The demo data intentionally creates cross-agent tension:

- A competitor discounts the daypack while internal inventory is high and demand is declining.
- A competitor is out of stock on the bottle while internal stock is low and demand is growing.
- Packing cubes have stagnant inventory and moderate demand.

The coordinator should produce recommendations that show the value of agent collaboration rather than isolated single-agent findings.

## Fallback Behavior

The flow works without external credentials:

- Missing Bright Data credentials produce `source: "demo-fallback"` in wrapper results.
- Missing MongoDB stores the run in process memory and caches it in browser local storage.
- Missing OpenAI does not block the rule-based MVP.
