# 🚀 WP Local-to-Static

> **Zero-cost, blazing-fast, and database-free WordPress hosting on Vercel.**

**WP Local-to-Static** is an open-source static site generator and publishing workflow that converts a local WordPress development instance into a production-grade, highly-responsive static website hosted entirely for free on Vercel. 

By separating your editorial environment (local WordPress) from your public environment (static files on Vercel's global CDN), you can save **$150–$300+ per year** in premium WordPress hosting costs while gaining infinite scalability and absolute protection against security vulnerabilities.

---

## 💎 Features

* **⚡ Blazing Fast Performance:** Serves flat, static HTML and assets via Vercel's global edge network.
* **🔒 Bulletproof Security:** Zero active database or PHP runtime in production, making SQL injections, XSS attacks, and brute-force attacks impossible.
* **📱 Deep Responsive Assets Crawling:** Scrapes, resolves, and downloads all image sizes referenced in `srcset` and `data-srcset` attributes, guaranteeing images load dynamically and beautifully on desktop, tablets, and mobile devices.
* **🛡️ Zero Local Network Leakage:** Automatically walks through generated files and sweeps escaping breadcrumbs, JSON config blobs, and sharing query parameters to scrub all local network references (resolving Private Network Access browser warnings).
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
