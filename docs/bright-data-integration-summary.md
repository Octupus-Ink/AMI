# Bright Data Integration Summary

## Purpose

This document summarizes how AMI uses Bright Data during the MVP.

AMI uses Bright Data to collect marketplace data, preserve raw outputs, normalize product signals, and generate explainable business recommendations.

## Bright Data products used

- Web Scraper API
- Web Unlocker API
- Native proxy fallback

## Core validated sources

### Amazon Products Search

Status: validated.

Use in AMI:

- Product discovery
- Competitor signal collection
- Demand signal extraction
- Pricing signal extraction

Raw file:

- `data/brightdata/raw/amazon/search/2026-05-27-amazon-products-search.raw.json`

### Amazon Product Detail

Status: validated.

Use in AMI:

- Product enrichment
- Product detail evidence
- Price, rating, availability, reviews, ranking, and feature extraction

Raw file:

- `data/brightdata/raw/amazon/product-detail/2026-05-27-amazon-product-detail-asus-rog-strix-g16.raw.json`

### Web Unlocker API

Status: validated.

Use in AMI:

- Public web access fallback
- Bright Data infrastructure evidence
- Future custom source access

## Optional or future sources

### eBay

Status: partial sample.

Use in AMI:

- Optional competitor marketplace source

### AliExpress

Status: runtime failed during validation.

Reason:

- The tested scraper expected individual product URLs.
- Search/category URLs produced timeout or empty/dead-page results.

Decision:

- Keep as optional/future supplier source.

### TikTok Shop and TikTok Posts

Status: runtime failed during validation.

Reason:

- Crawler errors and timeout during product/post collection.

Decision:

- Keep as optional/future trend source.

## MVP decision

AMI MVP uses Amazon Search, Amazon Product Detail, and Bright Data Web Unlocker as the core Bright Data integration.

Optional sources remain documented but should not block the MVP.

## Data flow

Bright Data scraping
→ raw storage
→ normalization
→ scoring
→ assistant outputs
→ AMI Coordinator
→ recommendation dashboard

## Demo fallback behavior

If live Bright Data calls fail, AMI can use the preserved raw JSON files as demo data.

## Security

No API keys, tokens, MongoDB credentials, OpenAI keys, or Bright Data credentials should be committed to the repository.
