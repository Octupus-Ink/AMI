1. Bright Data products used
2. Validated endpoints/scrapers
3. Failed/optional sources
4. Environment variables
5. How AMI uses the data
6. Demo fallback behavior
7. MVP decision


AMIS/
├─ data/
│  └─ brightdata/
│     ├─ README.md
│     ├─ raw/
│     │  ├─ amazon/
│     │  ├─ ebay/
│     │  ├─ aliexpress/
│     │  └─ tiktok/
│     └─ normalized/
│
├─ docs/
│  └─ bright-data-integration-summary.md
│
├─ tools/
│  └─ organize-brightdata-json.ps1
│
└─ .env.example