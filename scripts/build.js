/**
 * ============================================================================
 * ACCESSYOURDISTRICT - DEVOPS BUILD & MINIFICATION SCRIPT
 * Congressional App Challenge - Civic Inclusion Platform
 * ============================================================================
 *
 * ARCHITECTURE & DEVOPS EXPLANATION:
 * ----------------------------------
 * 1. Zero-Dependency Build Automation:
 *    - Uses native Node.js (`fs`, `path`) to minify CSS, JavaScript, and HTML
 *      without requiring bulky external node_modules or bundlers.
 *
 * 2. Instant Load Performance Optimization:
 *    - Strips comments, collapses whitespace, and condenses CSS/JS syntax to
 *      reduce network payload sizes by ~30–45%, ensuring instant loading on
 *      mobile devices and subfolder GitHub Pages environments.
 *
 * 3. Dist / Production Pipeline:
 *    - Outputs optimized files both in-place (`css/styles.min.css`) and into
 *      a clean `/dist` folder ready for automated GitHub Actions CI/CD deployment.
 *    - Automatically copies PWA manifest (`manifest.json`) and Service Worker
 *      (`service-worker.js`) to `/dist`.
 * ============================================================================
 */

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT_DIR, "dist");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function minifyCSS(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s*([{}|:;,>+=~])\s*/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/;}/g, "}")
    .trim();
}

function minifyJS(js) {
  return js
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("//")) return "";
      return trimmed;
    })
    .filter((line) => line.length > 0)
    .join("\n")
    .replace(/ {2,}/g, " ")
    .trim();
}

function minifyHTML(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/>\s+</g, "><")
    .trim();
}

function copyDir(src, dest) {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function runBuild() {
  console.log("============================================================================");
  console.log("🚀 [AccessYourDistrict DevOps] Starting production minification & build...");
  console.log("============================================================================\n");

  const stats = [];

  ensureDir(DIST_DIR);
  ensureDir(path.join(DIST_DIR, "css"));
  ensureDir(path.join(DIST_DIR, "js"));
  ensureDir(path.join(DIST_DIR, "assets"));

  // 1. Process CSS
  const cssSrcPath = path.join(ROOT_DIR, "css", "styles.css");
  if (fs.existsSync(cssSrcPath)) {
    const rawCSS = fs.readFileSync(cssSrcPath, "utf8");
    const minCSS = minifyCSS(rawCSS);

    fs.writeFileSync(path.join(ROOT_DIR, "css", "styles.min.css"), minCSS, "utf8");
    fs.writeFileSync(path.join(DIST_DIR, "css", "styles.css"), minCSS, "utf8");
    fs.writeFileSync(path.join(DIST_DIR, "css", "styles.min.css"), minCSS, "utf8");

    const origSize = Buffer.byteLength(rawCSS, "utf8");
    const minSize = Buffer.byteLength(minCSS, "utf8");
    const saved = ((1 - minSize / origSize) * 100).toFixed(1);

    stats.push({
      file: "css/styles.css",
      origKB: (origSize / 1024).toFixed(2) + " KB",
      minKB: (minSize / 1024).toFixed(2) + " KB",
      savings: `${saved}%`
    });
  }

  // 2. Process JS modules in `js/`
  const jsDir = path.join(ROOT_DIR, "js");
  if (fs.existsSync(jsDir)) {
    const jsFiles = fs.readdirSync(jsDir).filter((file) => file.endsWith(".js") && !file.endsWith(".min.js"));

    for (const file of jsFiles) {
      const srcPath = path.join(jsDir, file);
      const rawJS = fs.readFileSync(srcPath, "utf8");
      const minJS = minifyJS(rawJS);

      const baseName = file.replace(/\.js$/, "");
      const minFilename = `${baseName}.min.js`;

      fs.writeFileSync(path.join(jsDir, minFilename), minJS, "utf8");
      fs.writeFileSync(path.join(DIST_DIR, "js", file), minJS, "utf8");
      fs.writeFileSync(path.join(DIST_DIR, "js", minFilename), minJS, "utf8");

      const origSize = Buffer.byteLength(rawJS, "utf8");
      const minSize = Buffer.byteLength(minJS, "utf8");
      const saved = ((1 - minSize / origSize) * 100).toFixed(1);

      stats.push({
        file: `js/${file}`,
        origKB: (origSize / 1024).toFixed(2) + " KB",
        minKB: (minSize / 1024).toFixed(2) + " KB",
        savings: `${saved}%`
      });
    }
  }

  // 3. Process assets/ directory
  const assetsDir = path.join(ROOT_DIR, "assets");
  if (fs.existsSync(assetsDir)) {
    copyDir(assetsDir, path.join(DIST_DIR, "assets"));
    console.log("✅ [Assets] Copied all icons and preview graphics to /dist/assets.");
  }

  // 4. Process PWA Manifest & Service Worker
  const pwaFiles = ["manifest.json", "service-worker.js"];
  for (const pwaFile of pwaFiles) {
    const srcPath = path.join(ROOT_DIR, pwaFile);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, path.join(DIST_DIR, pwaFile));
      console.log(`✅ [PWA] Copied '${pwaFile}' to /dist.`);
    }
  }

  // 5. Process index.html
  const htmlSrcPath = path.join(ROOT_DIR, "index.html");
  if (fs.existsSync(htmlSrcPath)) {
    const rawHTML = fs.readFileSync(htmlSrcPath, "utf8");
    const minHTML = minifyHTML(rawHTML);
    fs.writeFileSync(path.join(DIST_DIR, "index.html"), minHTML, "utf8");

    const origSize = Buffer.byteLength(rawHTML, "utf8");
    const minSize = Buffer.byteLength(minHTML, "utf8");
    const saved = ((1 - minSize / origSize) * 100).toFixed(1);

    stats.push({
      file: "index.html",
      origKB: (origSize / 1024).toFixed(2) + " KB",
      minKB: (minSize / 1024).toFixed(2) + " KB",
      savings: `${saved}%`
    });
  }

  // 6. Copy Markdown & project documentation to dist
  const docs = ["README.md", "CS_LOGIC_EXPLANATION.md", "SECURITY.md"];
  for (const doc of docs) {
    const docPath = path.join(ROOT_DIR, doc);
    if (fs.existsSync(docPath)) {
      fs.copyFileSync(docPath, path.join(DIST_DIR, doc));
    }
  }

  // 7. Output DevOps Summary Table
  console.log("\n📊 [DevOps Minification & Compression Summary]");
  console.table(stats);

  console.log("✅ [Success] Production build completed! Optimized files are in `/dist` and `.min` files in root.");
  console.log("============================================================================\n");
}

runBuild();
