# Click Jyotish blog workflow

## Add an article

1. Create a new Markdown file in `src/data/blog/` using a clear English filename, for example `diwali-2026-puja-guide.md`.
2. Copy this frontmatter at the top:

```md
---
title: "Article title"
description: "One clear 1-2 sentence summary for Google and readers."
pubDate: 2026-10-11
category: "Festivals"
tags: ["Diwali", "Puja"]
draft: true
featured: false
---
```

3. Write the article below the frontmatter with clear headings (`##`).
4. Keep `draft: true` while it is being reviewed. Change it to `draft: false` only after Deepak Ji verifies every festival date, panchang time, transit claim and suggested remedy.
5. Commit and push to `main`. Cloudflare will publish the article automatically and the `/blog` page will list it.

## Monthly editorial rhythm

- Week 1: Upcoming festival, vrat or puja guide.
- Week 2: One major transit or monthly Jyotish reflection, checked against a reliable panchang/ephemeris.
- Week 3: Practical Vastu or Palmistry topic.
- Week 4: A consultation-preparation or high-intent question such as career, marriage or Kundali Milan.

## Automation policy

AI can prepare a draft, title, meta description, internal links and social-post copy. It must not publish automatically. Deepak Ji should approve time-sensitive dates, muhurat, remedies and all client-facing spiritual claims before `draft` is changed to `false`.

## Weekly draft automation

`.github/workflows/weekly-blog-draft.yml` runs every Monday at **9:00 AM IST**. It uses current-topic signals only for article ideas, then opens a GitHub review request containing one Markdown post with `draft: true`.

A draft is not live. Verify all factual and time-sensitive details, change `draft: true` to `draft: false`, then merge the request. Cloudflare publishes the approved article automatically.

### One-time setup

1. GitHub → `baburawtest/click-jyotish` → **Settings** → **Secrets and variables** → **Actions**.
2. Select **New repository secret**.
3. Name: `OPENAI_API_KEY`.
4. Paste your OpenAI API key and save. Never add it to a website file or Git commit.
5. Repository **Actions** tab → **Create weekly Click Jyotish blog draft** → **Run workflow** to create the first draft immediately. You may optionally type a topic.
