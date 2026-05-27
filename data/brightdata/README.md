# Bright Data Raw Outputs

This folder contains raw Bright Data outputs used for AMI demo mode, validation, and evidence traceability.

## Purpose

AMI uses Bright Data to collect live marketplace data and transform it into structured business recommendations.

These files preserve the original scraper outputs before normalization.

## Core validated sources

- Amazon products search
- Amazon products collect by URL
- Bright Data Web Unlocker

## Optional or failed runtime sources

- AliExpress
- TikTok Shop
- TikTok Posts
- eBay

## Folder structure

- `raw/amazon/search`: Amazon product discovery results.
- `raw/amazon/product-detail`: Amazon product detail enrichment results.
- `raw/amazon/global-dataset`: Optional Amazon dataset samples.
- `raw/amazon/errors`: Failed Amazon test inputs.
- `raw/ebay/product-detail`: Optional competitor marketplace sample.
- `raw/aliexpress/errors`: AliExpress runtime validation errors.
- `raw/tiktok/errors`: TikTok and TikTok Shop runtime validation errors.
- `normalized`: Future AMI-ready data derived from raw outputs.

## MVP decision

The MVP uses Amazon Search and Amazon Product Detail as the core Bright Data runtime sources.

AliExpress, Alibaba, TikTok Shop, TikTok Posts, and eBay are documented as optional or future enrichment sources.

## Security

No API keys, tokens, MongoDB credentials, OpenAI keys, or Bright Data credentials should be stored in this folder.