# AMI Icons

Copy these files into the Next.js `public/` directory.

Recommended minimum files:

- `favicon.ico`
- `favicon.svg`
- `apple-touch-icon.png`
- `icon-192x192.png`
- `icon-512x512.png`
- `site.webmanifest`

Optional files:

- Smaller PNG sizes for browser/device compatibility.
- Transparent variants for custom UI/logo usage.

For App Router metadata, reference them from `app/layout.tsx` if needed:

```ts
export const metadata = {
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};
```
