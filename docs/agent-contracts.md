# Agent Contracts

All agent outputs are validated with Zod in `lib/schemas/agents.ts`.

## Competitor Intelligence Agent

Input:

- Marketplace project
- Tracked competitors
- Product list
- Bright Data SERP or scraper wrapper output

Output:

```json
{
  "agent": "competitor",
  "status": "completed",
  "findings": [
    {
      "competitorName": "string",
      "productName": "string",
      "price": 0,
      "stockStatus": "in_stock",
      "discountDetected": true,
      "discountPercentage": 0,
      "deliveryEstimate": "string",
      "riskLevel": "low",
      "insight": "string"
    }
  ],
  "summary": "string",
  "confidence": 0.82
}
```

## Inventory Optimization Agent

Input:

- Marketplace project products
- Current stock
- Target stock
- Monthly sales
- Price and cost

Output:

```json
{
  "agent": "inventory",
  "status": "completed",
  "findings": [
    {
      "productName": "string",
      "currentStock": 0,
      "salesVelocity": "normal",
      "inventoryRisk": "healthy",
      "profitMarginEstimate": 0,
      "recommendedAction": "string",
      "riskLevel": "low"
    }
  ],
  "summary": "string",
  "confidence": 0.88
}
```

## Trend Intelligence Agent

Input:

- Marketplace project
- Product names
- Bright Data SERP wrapper output
- Demo trend signals

Output:

```json
{
  "agent": "trend",
  "status": "completed",
  "findings": [
    {
      "productName": "string",
      "trendScore": 0,
      "marketStatus": "stable",
      "seasonality": "medium",
      "demandSignal": "moderate",
      "recommendation": "string"
    }
  ],
  "summary": "string",
  "confidence": 0.8
}
```

## Coordinator Agent

Input:

- Competitor agent output
- Inventory agent output
- Trend agent output

Output:

```json
{
  "status": "completed",
  "marketplaceHealthScore": 73,
  "executiveSummary": "string",
  "recommendations": [
    {
      "priority": "high",
      "title": "string",
      "description": "string",
      "sourceAgents": ["competitor", "inventory", "trend"],
      "businessImpact": "string",
      "suggestedAction": "string"
    }
  ],
  "nextBestActions": ["string"],
  "risks": ["string"]
}
```

## Current Coordinator Rules

- Competitor prices drop plus high inventory plus declining trend: recommend a controlled discount campaign.
- Competitor out of stock plus low internal inventory plus growing trend: recommend restock and avoid discounting.
- Growing trend plus healthy margin: recommend increased promotion.
- Stagnant stock plus weak demand: recommend liquidation or bundle promotion.
