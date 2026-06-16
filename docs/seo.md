# SearchTrust SEO Foundations

## Sitemap

The App Router sitemap is implemented in `src/app/sitemap.ts`.

Production URL:

```text
https://trysearchtrust.com/sitemap.xml
```

Included indexable routes:

- `/`
- `/framework`
- `/sample-report`
- `/use-cases`
- `/pricing`
- `/terms`
- `/privacy`
- `/refund-policy`

## Robots Rules

Robots rules are implemented in `src/app/robots.ts`.

Production URL:

```text
https://trysearchtrust.com/robots.txt
```

Rules:

- `Allow: /` for public marketing and legal pages.
- `Disallow: /api/` for API routes.
- `Disallow: /checkout/` for internal checkout/callback paths.
- `Disallow: /reports/` for generated user reports and private report workspace pages.
- `Disallow: /sign-in/` for authentication pages.
- `Disallow: /test-report/` for internal testing.

The robots file also points crawlers to `https://trysearchtrust.com/sitemap.xml`.

## Index And Noindex

Indexable public pages:

- Home
- Framework
- Sample report
- Use cases
- Pricing
- Terms of Service
- Privacy Policy
- Refund Policy

Noindex pages:

- `/reports`
- `/sign-in`
- `/test-report`
- API routes and webhook routes through robots disallow rules

Generated reports and private payment/report flows should stay noindex unless a future public sharing feature explicitly creates public report URLs with their own metadata and access rules.

## Metadata Conventions

Shared SEO helpers live in `src/lib/seo.ts`.

Each public page should define:

- Unique `title`
- Unique `description`
- Canonical URL
- Open Graph title, description, URL, type, and image
- Twitter summary large image card

Use `createPageMetadata(pageSeo.somePage)` for normal public pages. Use `createPageMetadata({ ..., noindex: true })` for private or internal pages.

Homepage JSON-LD includes:

- `Organization`
- `SoftwareApplication`
- `FAQPage`

FAQPage JSON-LD should only be added when the page visibly renders matching FAQ content.

## Google Search Console Verification

1. Deploy the site with the SEO routes enabled.
2. Open Google Search Console and add the domain property for `trysearchtrust.com`.
3. Verify ownership with DNS verification or the hosting provider's recommended method.
4. Submit the sitemap:

```text
https://trysearchtrust.com/sitemap.xml
```

5. Use URL Inspection for the main public routes:

- `https://trysearchtrust.com/`
- `https://trysearchtrust.com/framework`
- `https://trysearchtrust.com/sample-report`
- `https://trysearchtrust.com/use-cases`
- `https://trysearchtrust.com/pricing`

6. Confirm private URLs such as `/reports` show noindex or are blocked as expected.
7. Validate structured data with Google's Rich Results Test or Schema Markup Validator.
