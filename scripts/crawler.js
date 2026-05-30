const fs = require('fs');
const path = require('path');

const configPath = path.join(path.dirname(__dirname), 'wp-static-config.json');

if (!fs.existsSync(configPath)) {
  console.error('\n❌ [ERROR] Configuration file not found!');
  console.error('Please run the setup wizard first to configure your domains:\n');
  console.error('  npm run setup\n');
  process.exit(1);
}

let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (err) {
  console.error('❌ [ERROR] Failed to parse wp-static-config.json:', err.message);
  process.exit(1);
}

const BASE_URL = config.localUrl; // e.g. http://mywordpress.local
const DOMAIN = BASE_URL.replace(/^https?:\/\//i, '').split(':')[0]; // e.g. mywordpress.local

const PROD_URL = config.productionUrl; // e.g. https://www.mywebsite.com
const PROD_DOMAIN = PROD_URL.replace(/^https?:\/\//i, '').split(':')[0]; // e.g. www.mywebsite.com

const OUTPUT_DIR = path.isAbsolute(config.outputPath) 
  ? config.outputPath 
  : path.join(path.dirname(__dirname), config.outputPath);

// Keep track of visited pages and assets to avoid duplicates
const crawledPages = new Set();
const downloadedAssets = new Set();

// Helper to create directory recursively if it doesn't exist
function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Download a single file (binary or text)
async function downloadFile(url, destPath) {
  try {
    ensureDirSync(path.dirname(destPath));
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[WARN] Failed to download: ${url} (Status: ${response.status})`);
      return false;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(destPath, buffer);
    return true;
  } catch (err) {
    console.error(`[ERROR] Failed downloading asset ${url}:`, err.message);
    return false;
  }
}

// Resolve relative URLs (e.g. "../fonts/font.woff" relative to "wp-content/css/style.css")
function resolveRelativeUrl(fromPath, toPath) {
  if (toPath.startsWith('http://') || toPath.startsWith('https://') || toPath.startsWith('//') || toPath.startsWith('data:')) {
    return toPath;
  }
  
  // If it's already a root-relative path (starts with /), return it directly
  if (toPath.startsWith('/')) {
    return toPath.split('?')[0].split('#')[0];
  }
  
  // Clean up queries or hashes
  const cleanToPath = toPath.split('?')[0].split('#')[0];
  if (!cleanToPath) return null;

  const resolved = path.posix.join(path.posix.dirname(fromPath), cleanToPath);
  return resolved.startsWith('/') ? resolved : '/' + resolved;
}

// Process and download assets linked in a CSS file
async function processCssAssets(cssUrl, cssContent, relativeCssPath) {
  // Regex to match url(...) references
  const urlRegex = /url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/g;
  let match;
  const fontAndImageAssets = [];

  while ((match = urlRegex.exec(cssContent)) !== null) {
    const assetPath = match[1].trim();
    if (!assetPath || assetPath.startsWith('data:') || assetPath.startsWith('http') || assetPath.startsWith('//')) {
      continue;
    }

    const resolvedRelativePath = resolveRelativeUrl(relativeCssPath, assetPath);
    if (resolvedRelativePath && !downloadedAssets.has(resolvedRelativePath)) {
      fontAndImageAssets.push(resolvedRelativePath);
      downloadedAssets.add(resolvedRelativePath);
    }
  }

  if (fontAndImageAssets.length > 0) {
    console.log(`  Found ${fontAndImageAssets.length} assets inside CSS: ${relativeCssPath}`);
  }

  for (const assetPath of fontAndImageAssets) {
    const fullAssetUrl = `${BASE_URL}${assetPath}`;
    const destPath = path.join(OUTPUT_DIR, assetPath.split('?')[0].split('#')[0]);
    console.log(`    Downloading CSS asset: ${assetPath}`);
    await downloadFile(fullAssetUrl, destPath);
  }
}

// Scrape assets from HTML (scripts, links, images, fonts)
async function scrapeAssetsFromHtml(html, pagePath) {
  const srcRegex = /src=["']([^"']+)["']/g;
  const hrefRegex = /href=["']([^"']+)["']/g;
  const dataSrcRegex = /data-src=["']([^"']+)["']/g;
  const srcsetRegex = /srcset=["']([^"']+)["']/g;
  const dataSrcsetRegex = /data-srcset=["']([^"']+)["']/g;
  
  const rawAssets = [];
  let match;

  while ((match = srcRegex.exec(html)) !== null) {
    rawAssets.push(match[1]);
  }
  while ((match = hrefRegex.exec(html)) !== null) {
    rawAssets.push(match[1]);
  }
  while ((match = dataSrcRegex.exec(html)) !== null) {
    rawAssets.push(match[1]);
  }

  // Parse srcset and data-srcset attributes (split by comma and extract URLs)
  const parseSrcsetVal = (srcsetVal) => {
    const parts = srcsetVal.split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed) {
        const url = trimmed.split(/\s+/)[0];
        if (url) {
          rawAssets.push(url);
        }
      }
    }
  };

  while ((match = srcsetRegex.exec(html)) !== null) {
    parseSrcsetVal(match[1]);
  }
  while ((match = dataSrcsetRegex.exec(html)) !== null) {
    parseSrcsetVal(match[1]);
  }

  // Filter for local assets belonging to our local domain
  const localAssets = [];
  for (let assetUrl of rawAssets) {
    if (assetUrl.startsWith('//')) {
      assetUrl = 'https:' + assetUrl;
    }
    
    let isLocal = false;
    let localPath = '';

    const localUrlRegex = new RegExp(`^https?://${DOMAIN}`, 'i');
    if (localUrlRegex.test(assetUrl)) {
      isLocal = true;
      localPath = assetUrl.replace(localUrlRegex, '');
    } else if (assetUrl.startsWith('/') && !assetUrl.startsWith('//')) {
      isLocal = true;
      localPath = assetUrl;
    } else if (assetUrl.startsWith('wp-content/') || assetUrl.startsWith('wp-includes/')) {
      isLocal = true;
      localPath = '/' + assetUrl;
    }

    if (isLocal) {
      const cleanPath = localPath.split('?')[0].split('#')[0];
      if (cleanPath && cleanPath.includes('.') && !cleanPath.endsWith('/') && !cleanPath.endsWith('.php')) {
        localAssets.push({ original: assetUrl, cleanPath });
      }
    }
  }

  // Download unique assets
  for (const asset of localAssets) {
    if (!downloadedAssets.has(asset.cleanPath)) {
      downloadedAssets.add(asset.cleanPath);
      const fullUrl = asset.original.startsWith('http') ? asset.original : `${BASE_URL}${asset.original}`;
      const destPath = path.join(OUTPUT_DIR, asset.cleanPath);
      
      console.log(`  Downloading asset: ${asset.cleanPath}`);
      const success = await downloadFile(fullUrl, destPath);

      // If it's a CSS file, parse it for further assets (fonts, bg images)
      if (success && asset.cleanPath.endsWith('.css')) {
        try {
          const cssContent = fs.readFileSync(destPath, 'utf8');
          await processCssAssets(fullUrl, cssContent, asset.cleanPath);
        } catch (err) {
          console.error(`  Error parsing CSS ${asset.cleanPath}:`, err.message);
        }
      }
    }
  }
}

// Clean and rewrite internal links inside HTML to be root-relative
function rewriteHtmlLinks(html, pagePath) {
  let rewritten = html;

  // 1. Rewrite absolute page urls to relative
  const localUrlRegex = new RegExp(`https?://${DOMAIN}(\\/[^"\\'\\s>]*)`, 'g');
  rewritten = rewritten.replace(localUrlRegex, '$1');

  // 2. Rewrite pagination query parameters to static paths
  rewritten = rewritten.replace(/\/ar\/latest\/[?&][^"'\s>]*query-\d+-page=(\d+)[^"'\s>]*/g, '/ar/latest/page/$1/');
  rewritten = rewritten.replace(/\/latest\/[?&][^"'\s>]*query-\d+-page=(\d+)[^"'\s>]*/g, '/latest/page/$1/');
  
  const targetLatestPath = pagePath.startsWith('/ar/') ? '/ar/latest/' : '/latest/';
  rewritten = rewritten.replace(/(href=["'])\?[^"'\s>]*query-\d+-page=(\d+)[^"'\s>]*(["'])/g, `$1${targetLatestPath}page/$2/$3`);

  // Clean page/1/ links to point directly to the main index page
  rewritten = rewritten.replace(/\/ar\/latest\/page\/1\/?/g, '/ar/latest/');
  rewritten = rewritten.replace(/\/latest\/page\/1\/?/g, '/latest/');

  // 3. Clean up any remaining unescaped, escaped, or url-encoded references to the local domain
  // to ensure there are no local network leakage causing Private Network Access warnings on live site
  const escapeRegex = (string) => string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  
  // Unescaped references
  const unescapedRegex = new RegExp(`https?://${DOMAIN}`, 'g');
  rewritten = rewritten.replace(unescapedRegex, `https://${PROD_DOMAIN}`);
  
  // Escaped slashes (e.g. inside JSON strings)
  const escapedSlashRegex = new RegExp(`https?:\\\\/\\\\/${escapeRegex(DOMAIN)}`, 'g');
  rewritten = rewritten.replace(escapedSlashRegex, `https:\\/\\/${PROD_DOMAIN}`);
  
  // URL-encoded references (e.g. sharing button links)
  const encodedRegex = new RegExp(`https?(?:%3A|%3a)(?:%2F|%2f)(?:%2F|%2f)${escapeRegex(DOMAIN)}`, 'g');
  rewritten = rewritten.replace(encodedRegex, `https%3A%2F%2F${PROD_DOMAIN}`);

  return rewritten;
}

// Convert lazy-loaded images to native HTML image tags so they work immediately in static export
function unlazyloadHtml(html) {
  return html.replace(/<img\s+([^>]+)>/gi, (imgTag) => {
    let rewrittenTag = imgTag;
    
    // Check if data-src is present
    const dataSrcMatch = imgTag.match(/(?:\s)data-src=["']([^"']+)["']/i);
    if (dataSrcMatch) {
      const realSrc = dataSrcMatch[1];
      if (rewrittenTag.match(/(?:\s)src=["']/i)) {
        rewrittenTag = rewrittenTag.replace(/(?:\s)src=["']([^"']*)["']/i, ` src="${realSrc}"`);
      } else {
        rewrittenTag = rewrittenTag.replace(/<img/i, `<img src="${realSrc}"`);
      }
    }
    
    // Check if data-srcset is present
    const dataSrcsetMatch = imgTag.match(/(?:\s)data-srcset=["']([^"']+)["']/i);
    if (dataSrcsetMatch) {
      const realSrcset = dataSrcsetMatch[1];
      if (rewrittenTag.match(/(?:\s)srcset=["']/i)) {
        rewrittenTag = rewrittenTag.replace(/(?:\s)srcset=["']([^"']*)["']/i, ` srcset="${realSrcset}"`);
      } else {
        rewrittenTag = rewrittenTag.replace(/<img/i, `<img srcset="${realSrcset}"`);
      }
    }
    
    // Check if data-sizes is present
    const dataSizesMatch = imgTag.match(/(?:\s)data-sizes=["']([^"']+)["']/i);
    if (dataSizesMatch) {
      const realSizes = dataSizesMatch[1];
      if (rewrittenTag.match(/(?:\s)sizes=["']/i)) {
        rewrittenTag = rewrittenTag.replace(/(?:\s)sizes=["']([^"']*)["']/i, ` sizes="${realSizes}"`);
      } else {
        rewrittenTag = rewrittenTag.replace(/<img/i, `<img sizes="${realSizes}"`);
      }
    }

    return rewrittenTag;
  });
}

// Scrape a single HTML page
async function scrapePage(url, queueCallback) {
  const localUrlRegex = new RegExp(`^https?://${DOMAIN}`, 'i');
  let relativePath = url.replace(localUrlRegex, '');
  if (!relativePath.startsWith('/')) {
    relativePath = '/' + relativePath;
  }

  // Decode percent-encoded relative path to support proper Arabic/Unicode characters on disk
  try {
    relativePath = decodeURIComponent(relativePath);
  } catch (err) {
    console.warn(`[WARN] Failed to decode path ${relativePath}:`, err.message);
  }

  // Detect query-based pagination page number before query cleaning
  let pageNumber = null;
  const pageMatch = relativePath.match(/(?:[?&])query-\d+-page=(\d+)/);
  if (pageMatch) {
    pageNumber = pageMatch[1];
  }

  // Clean trailing slashes/hashes
  relativePath = relativePath.split('?')[0].split('#')[0];
  
  // If this is a paginated page, map the disk route to path-based pagination e.g., `/latest/page/X/`
  if (pageNumber) {
    if (!relativePath.endsWith('/')) {
      relativePath += '/';
    }
    relativePath = `${relativePath}page/${pageNumber}/`;
  }
  
  if (crawledPages.has(relativePath)) return;
  crawledPages.add(relativePath);

  console.log(`\n--------------------------------------------`);
  console.log(`[CRAWL] Fetching page: ${relativePath}`);
  console.log(`--------------------------------------------`);

  try {
    // Append cache-busting query parameter to bypass edge redirect caches
    const fetchUrl = url.includes('?') ? `${url}&nocache=true` : `${url}?nocache=true`;
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      console.error(`[ERROR] Failed to fetch page: ${url} (Status: ${response.status})`);
      return;
    }

    let html = await response.text();
    const rawHtml = html; // Save raw HTML before link rewriting!

    // 1. Download all assets referenced on this page (supports robust srcset extraction)
    await scrapeAssetsFromHtml(html, relativePath);

    // 2. Rewrite absolute links and pagination queries to static routes
    html = rewriteHtmlLinks(html, relativePath);

    // Un-lazyload all image tags to load them natively in the static export
    html = unlazyloadHtml(html);

    // 3. Inject Vercel Web Analytics integration if enabled in config
    if (config.vercelAnalytics) {
      const vercelAnalyticsScript = `
<script>
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
</script>
<script defer src="/_vercel/insights/script.js"></script>
`;
      if (html.includes('</body>')) {
        html = html.replace('</body>', `${vercelAnalyticsScript}\n</body>`);
      } else {
        html = html + `\n${vercelAnalyticsScript}`;
      }
    }

    // 4. Determine save path
    let destFile = '';
    if (relativePath === '/' || relativePath === '/index.html') {
      destFile = path.join(OUTPUT_DIR, 'index.html');
    } else {
      const dirPath = path.join(OUTPUT_DIR, relativePath);
      ensureDirSync(dirPath);
      destFile = path.join(dirPath, 'index.html');
    }

    fs.writeFileSync(destFile, html, 'utf8');
    console.log(`[SUCCESS] Saved page to: ${destFile}`);

    // 5. Extract and queue all internal page links dynamically
    if (queueCallback) {
      const linkRegex = new RegExp(`href=["'](https?://${DOMAIN}\\/[^"\\'\\s>]*|\\/[^"\\'\\s>]*|\\?[^"\\'\\s>]*)`, 'g');
      let match;
      while ((match = linkRegex.exec(rawHtml)) !== null) {
        let linkUrl = match[1];
        
        // Standardize to absolute URL
        if (linkUrl.startsWith('/')) {
          linkUrl = `${BASE_URL}${linkUrl}`;
        } else if (linkUrl.startsWith('?')) {
          const cleanBase = url.split('?')[0].replace(BASE_URL, '');
          linkUrl = `${BASE_URL}${cleanBase}${linkUrl}`;
        }
        
        // Extract query-based pagination details to keep them from being cleaned
        let pageQuery = '';
        const linkPageMatch = linkUrl.match(/(?:[?&])(query-\d+-page=\d+)/);
        if (linkPageMatch) {
          pageQuery = linkPageMatch[1];
        }

        // Clean query strings and hashes, but retain our pagination query if present
        let cleanUrl = linkUrl.split('?')[0].split('#')[0];
        if (pageQuery) {
          cleanUrl = `${cleanUrl}?${pageQuery}`;
        }
        
        // Check if it's a page and not a file asset
        const pathname = cleanUrl.split('?')[0].replace(BASE_URL, '');
        const lastSegment = pathname.split('/').pop() || '';
        const hasExtension = lastSegment.includes('.') && !lastSegment.endsWith('.html');
        
        // Exclude system pages, REST API, date archives, author profiles, and feeds
        const isDateArchive = pathname.match(/\/\d{4}\/\d{2}\/?$/);
        const isPage = !hasExtension && 
                       !isDateArchive &&
                       !cleanUrl.includes('/wp-admin/') && 
                       !cleanUrl.includes('/wp-login.php') && 
                       !cleanUrl.includes('/wp-json/') &&
                       !cleanUrl.includes('/xmlrpc.php') &&
                       !cleanUrl.includes('/feed/') &&
                       !cleanUrl.includes('/author/') &&
                       !cleanUrl.includes('/comments/');
                         
        if (isPage) {
          queueCallback(cleanUrl);
        }
      }
    }

  } catch (err) {
    console.error(`[ERROR] Failed to crawl page ${url}:`, err.message);
  }
}

// Clean and rewrite references in all generated text assets to remove local network domain leaks
function cleanOutputFolder(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      cleanOutputFolder(filePath);
    } else {
      const ext = path.extname(file).toLowerCase();
      const isTextFile = ['.html', '.xml', '.json', '.js', '.css', '.txt', ''].includes(ext) || file === 'embed';
      
      if (isTextFile) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          if (content.includes(DOMAIN)) {
            let cleaned = content;
            const escapeRegex = (string) => string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            
            // 1. Double-slash references
            const doubleSlashRegex = new RegExp(`(?:https?:)?//${escapeRegex(DOMAIN)}`, 'g');
            cleaned = cleaned.replace(doubleSlashRegex, `https://${PROD_DOMAIN}`);
            
            // 2. Escaped slashes
            const escapedSlashRegex = new RegExp(`(?:https?:)?\\\\/\\\\/${escapeRegex(DOMAIN)}`, 'g');
            cleaned = cleaned.replace(escapedSlashRegex, `https:\\/\\/${PROD_DOMAIN}`);
            
            // 3. URL-encoded
            const encodedRegex = new RegExp(`https?(?:%3A|%3a)(?:%2F|%2f)(?:%2F|%2f)${escapeRegex(DOMAIN)}`, 'g');
            cleaned = cleaned.replace(encodedRegex, `https%3A%2F%2F${PROD_DOMAIN}`);
            
            fs.writeFileSync(filePath, cleaned, 'utf8');
            console.log(`[CLEANUP] Cleaned local domain references in: ${path.relative(OUTPUT_DIR, filePath)}`);
          }
        } catch (err) {
          // Ignore binary/read errors
        }
      }
    }
  }
}

// Fetch sitemap URLs
async function fetchSitemapUrls() {
  const sitemaps = [
    'sitemap.xml', 'post-sitemap.xml', 'page-sitemap.xml', 'category-sitemap.xml',
    'ar/sitemap.xml', 'ar/post-sitemap.xml', 'ar/page-sitemap.xml', 'ar/category-sitemap.xml'
  ];
  const urls = new Set();
  
  // Always include the homepage explicitly
  urls.add(BASE_URL);

  for (const s of sitemaps) {
    const sitemapUrl = `${BASE_URL}/${s}`;
    console.log(`Fetching sitemap: ${sitemapUrl}`);
    try {
      const res = await fetch(sitemapUrl);
      if (!res.ok) continue;
      const xml = await res.text();
      const matches = xml.match(/<loc>(.*?)<\/loc>/g) || [];
      matches.forEach(m => {
        const u = m.slice(5, -6).trim();
        if (u.startsWith('http')) {
          urls.add(u);
        }
      });
    } catch (err) {
      console.error(`Failed to parse sitemap ${s}:`, err.message);
    }
  }

  return Array.from(urls);
}

// Main execution block
async function main() {
  console.log(`\n============================================`);
  console.log(`🚀 STARTING CRAWL OF: ${BASE_URL}`);
  console.log(`🌐 TARGET PRODUCTION: ${PROD_URL}`);
  console.log(`📁 OUTPUT DIRECTORY : ${OUTPUT_DIR}`);
  console.log(`============================================\n`);

  ensureDirSync(OUTPUT_DIR);

  // 1. Collect all sitemap URLs
  const urlsToScrape = await fetchSitemapUrls();
  console.log(`Collected ${urlsToScrape.length} target pages from sitemaps.`);

  const queuedUrls = new Set(urlsToScrape);

  const queueCallback = (newUrl) => {
    if (!queuedUrls.has(newUrl)) {
      queuedUrls.add(newUrl);
      urlsToScrape.push(newUrl);
      console.log(`[QUEUE] Queued new internal page: ${newUrl.replace(BASE_URL, '')}`);
    }
  };

  // 2. Crawl all pages sequentially
  for (let i = 0; i < urlsToScrape.length; i++) {
    const url = urlsToScrape[i];
    console.log(`\nProgress: Page ${i + 1} of ${urlsToScrape.length} (Queue: ${urlsToScrape.length})`);
    await scrapePage(url, queueCallback);
  }

  // 3. Save sitemaps as static XMLs rewritten to production domain
  console.log('\nDownloading sitemaps for SEO redirection...');
  const sitemapFiles = [
    'sitemap.xml', 'post-sitemap.xml', 'page-sitemap.xml', 'category-sitemap.xml',
    'ar/sitemap.xml', 'ar/post-sitemap.xml', 'ar/page-sitemap.xml', 'ar/category-sitemap.xml'
  ];
  for (const s of sitemapFiles) {
    const dest = path.join(OUTPUT_DIR, s);
    console.log(`  Downloading sitemap asset: ${s}`);
    const success = await downloadFile(`${BASE_URL}/${s}`, dest);
    if (success && fs.existsSync(dest)) {
      try {
        let content = fs.readFileSync(dest, 'utf8');
        const escapeRegex = (string) => string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const sitemapDomainRegex = new RegExp(`https?://${escapeRegex(DOMAIN)}`, 'g');
        content = content.replace(sitemapDomainRegex, PROD_URL);
        fs.writeFileSync(dest, content, 'utf8');
        console.log(`    Successfully rewrote sitemap to use production URL: ${s}`);
      } catch (err) {
        console.error(`    Error rewriting sitemap ${s}:`, err.message);
      }
    }
  }

  // 4. Run global clean post-processing to guarantee zero local domain leaks
  console.log('\nRunning global clean post-processing of output directory...');
  cleanOutputFolder(OUTPUT_DIR);

  console.log(`\n============================================`);
  console.log(`🎉 CRAWL COMPLETED SUCCESSFULLY!`);
  console.log(`Total Pages Crawled: ${crawledPages.size}`);
  console.log(`Total Assets Downloaded: ${downloadedAssets.size}`);
  console.log(`Saved output to directory: ${OUTPUT_DIR}`);
  console.log(`============================================\n`);
}

if (process.argv[2]) {
  const targetUrl = process.argv[2];
  console.log(`Targeted crawl for: ${targetUrl}`);
  scrapePage(targetUrl).then(() => {
    console.log(`\nTargeted crawl finished.`);
  }).catch(err => console.error(err));
} else {
  main().catch(err => {
    console.error("Fatal error during crawling run:", err);
    process.exit(1);
  });
}
