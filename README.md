# 🚀 WP Local-to-Static

> **Zero-cost, blazing-fast, and database-free WordPress hosting on Vercel.**

**WP Local-to-Static** is an open-source static site generator and publishing workflow that converts a local WordPress development instance into a production-grade, highly-responsive static website hosted entirely for free on Vercel. 

By separating your editorial environment (local WordPress) from your public environment (static files on Vercel's global CDN), you can save **$150–$300+ per year** in premium WordPress hosting costs while gaining infinite scalability and absolute protection against security vulnerabilities.

---

## 💎 Features

* **⚡ Blazing Fast Performance:** Serves flat, static HTML and assets via Vercel's global edge network.
* **🔒 Bulletproof Security:** Zero active database or PHP runtime in production, making SQL injections, XSS attacks, and brute-force attacks impossible. The included `vercel.json` also ships hardened HTTP headers (`X-Frame-Options`, `nosniff`, a strict `Referrer-Policy`, and a locked-down `Permissions-Policy`) out of the box.
* **🪶 Zero Dependencies:** The entire crawler is built on Node.js's native `fetch` (v18+). `npm install` pulls down nothing — no bloat, no supply-chain surface.
* **🗺️ Sitemap-Seeded + Recursive Crawl:** Seeds itself from your WordPress sitemaps (posts, pages, categories, and multilingual variants like `/ar/`), then recursively discovers and queues every internal link — so it finds every page, not just the ones you remember. System routes (`/wp-admin/`, `/wp-json/`, feeds, author archives) are filtered out automatically.
* **📱 Deep Responsive Assets Crawling:** Scrapes, resolves, and downloads all image sizes referenced in `srcset` and `data-srcset` attributes, then **un-lazyloads** them (promoting `data-src`/`data-srcset`/`data-sizes` into real attributes) so images render instantly without JavaScript — beautiful on desktop, tablet, and mobile.
* **🎨 CSS Asset Following:** Parses `url(...)` references inside your stylesheets to pull down the fonts and background images that most scrapers silently drop.
* **🛡️ Zero Local Network Leakage:** Rewrites your local domain to your production domain in **three encodings** — plain URLs, escaped slashes inside JSON (`https:\/\/...`), and URL-encoded share links (`https%3A%2F%2F...`) — across HTML, CSS, JS, JSON, and XML sitemaps (resolving Private Network Access browser warnings).
* **🌍 Production-Ready Details:** Query-string pagination (`?query-3-page=2`) is rewritten to clean static paths (`/page/2/`), Unicode/Arabic URLs are decoded for correct on-disk filenames, and sitemaps are rewritten to your live domain so SEO keeps working.
* **💸 Free Web Analytics Integration:** Integrated toggle to inject lightweight Vercel Web Analytics.
* **🔄 1-Click Publishing:** Deploy updates, new articles, or translations dynamically to Git and Vercel in a single command.

---

## 📐 How it Works

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR LOCAL MACHINE                        │
│                                                             │
│  ┌──────────────┐    ┌─────────────────┐    ┌───────────┐  │
│  │  Local WP    │    │ Static Crawler  │    │  /public  │  │
│  │  (Localhost) │───▶│  (Dynamic CLI)  │───▶│  (Static  │  │
│  │  Write Posts │    │ npm run crawl   │    │  Assets)  │  │
│  └──────────────┘    └─────────────────┘    └─────┬─────┘  │
│                                                   │        │
└───────────────────────────────────────────────────┼────────┘
                                                    │
                                                git push
                                                    │
                                                    ▼
                                        ┌───────────────────┐
                                        │   GitHub Repo     │
                                        │  (Template Repo)  │
                                        └─────────┬─────────┘
                                                  │
                                            auto-detected
                                                  │
                                                  ▼
                                        ┌───────────────────┐
                                        │   Vercel Edge     │
                                        │  (Hobby Free)     │
                                        │  MyWebsite.com    │
                                        └───────────────────┘
```

---

## 🚀 Quick Start Guide

### Prerequisites
* [Node.js](https://nodejs.org) (v18 or higher recommended)
* Git installed and configured with your GitHub account
* [Local WP](https://localwp.com) installed (to run WordPress locally for free)

### Step 1 — Clone and Initialize
1. Duplicate or clone this repository to your local computer.
2. Open your terminal in the cloned directory and run:
   ```bash
   npm install
   ```

### Step 2 — Run the Setup Wizard
Initialize your environments by running the interactive configuration CLI:
```bash
npm run setup
```
The wizard will ask for:
* **Local WordPress URL:** (e.g. `http://mywordpress.local`)
* **Production Domain:** (e.g. `https://www.mywebsite.com`)
* **Output Path:** The target output folder (Default: `./public`)
* **Vercel Analytics:** Enable or disable web traffic analytics integration.

This will generate a secure `wp-static-config.json` containing your custom configuration.

### Step 3 — Write in WordPress
1. Open your **Local** WP application and start your website instance.
2. Go to your local admin dashboard (e.g., `http://mywordpress.local/wp-admin`) and write your articles or customize your theme.
3. Use your favorite page builders (Elementor, Gutenberg, Divi) and media libraries.

### Step 4 — Crawl & Publish
When you are ready to make your website live:
```bash
npm run publish
```

This single command will:
1. Initialize the static crawler to extract all HTML, CSS, JS, fonts, and responsive `srcset` images.
2. Clean all references to `localhost` or `.local` domains.
3. Automatically stage all generated files, create a timed release commit, and push it to GitHub to trigger Vercel's automated deployment.

### Step 5 (Optional) — Preview Locally Before Pushing
Want to inspect the generated static site before it goes live? Serve the output folder locally:
```bash
npm run dev
```
This spins up a local static server for the `public` folder so you can verify everything renders correctly before publishing.

---

## 📟 Command Reference

| Command | What it does |
| --- | --- |
| `npm run setup` | Interactive wizard that generates `wp-static-config.json`. |
| `npm run crawl` | Crawls your local WordPress site into the static output folder (no Git). |
| `npm run dev` | Serves the generated `public` folder locally for previewing. |
| `npm run publish` | Crawls, then commits and pushes to GitHub to trigger a Vercel deploy. |

> [!TIP]
> You can also run a **targeted single-page crawl** by passing a URL: `node scripts/crawler.js http://mywordpress.local/some-page/`. Useful for quickly re-exporting one page without re-crawling the whole site.

---

## ☁️ Deploying to Vercel (Automatic GitHub Pull)

To configure Vercel to automatically detect pushes to your GitHub repository and deploy your static site, follow these instructions:

### 1. Create a Vercel Project
1. Log into your [Vercel Dashboard](https://vercel.com) (create a free account if you haven't).
2. Click **Add New...** and select **Project**.
3. Under **Import Git Repository**, find your cloned `wp-local-to-static` repository and click **Import**.

### 2. Configure Build & Development Settings
On the project import screen, configure the following settings:
* **Framework Preset:** Select **Other** (since it's a standard static website).
* **Root Directory:** Keep as `./` (or directory root).
* **Build Command:** Toggle **OFF** / Leave empty (our static files are crawled locally and pushed directly).
* **Output Directory:** Change this to **`public`** (or whatever folder you entered in your config output path). *This is extremely important as it tells Vercel where to find your compiled static pages.*

### 3. Deploy
1. Click **Deploy**. Vercel will pull and host your folder immediately!
2. You will get a free production subdomain (e.g., `your-site.vercel.app`).
3. You can go to the project **Settings → Domains** to connect your custom domain (e.g., `www.mywebsite.com`) for free.

Whenever you run `npm run publish` locally, your files are pushed to GitHub, Vercel pulls the changes immediately, and your live site updates in under 60 seconds!

---

## 🔧 Recommended WordPress Plugin Settings

For the absolute best results, configure these minor options in your local WordPress environment:

> [!TIP]
> ### Permalinks Structure
> Go to **Settings → Permalinks** in your WP Admin and select **Post name** (e.g., `/%postname%/`). This ensures your static page links remain clean and elegant without trailing `.html` extensions.

> [!WARNING]
> ### Deactivate Static Generators
> Ensure that active plugins like *Simply Static* are **Deactivated**. Traditional static plugins generate severe edge conflicts and deadlocks on local development. The custom crawl pipeline handles 100% of the extraction securely from the host computer.

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.
