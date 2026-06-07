#!/usr/bin/env node
/**
 * Reads Instagram post URLs from voice-mosaic tiles in quienes-somos.html,
 * downloads og:image thumbnails, and updates each tile's <img src>.
 *
 * Usage: node scripts/fetch-instagram-thumbnails.mjs
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.join(__dirname, "..");
const HTML_FILE = path.join(SITE_ROOT, "quienes-somos.html");
const VOICE_DIR = path.join(SITE_ROOT, "assets", "images", "voice");
const MANIFEST_FILE = path.join(SITE_ROOT, "scripts", "voice-posts.json");

const TILE_RE =
  /(<a class="voice-mosaic__tile" href=")([^"]+)("[^>]*>\s*<img src=")([^"]+)(" alt="" width="120" height="120" loading="lazy" \/>)/g;

const USER_AGENT = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

function extractShortcode(url) {
  const match = url.match(/instagram\.com\/(?:p|reels|reel)\/([^/?#]+)/i);
  return match ? match[1] : null;
}

function normalizePostUrl(url) {
  const shortcode = extractShortcode(url);
  if (!shortcode) return url;
  const isReel = /instagram\.com\/reels?\//i.test(url);
  return isReel
    ? `https://www.instagram.com/reel/${shortcode}/`
    : `https://www.instagram.com/p/${shortcode}/`;
}

function extractOgImage(html) {
  const patterns = [
    /property="og:image"\s+content="([^"]+)"/,
    /content="([^"]+)"\s+property="og:image"/,
    /"og:image"\s*:\s*"([^"]+)"/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1].replace(/&amp;/g, "&");
  }

  return null;
}

async function fetchOgImage(postUrl) {
  const res = await fetch(normalizePostUrl(postUrl), {
    headers: { "User-Agent": USER_AGENT },
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const html = await res.text();
  const imageUrl = extractOgImage(html);
  if (!imageUrl) {
    throw new Error("og:image not found");
  }

  return imageUrl;
}

async function downloadImage(imageUrl, destPath) {
  const res = await fetch(imageUrl, {
    headers: { "User-Agent": USER_AGENT },
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`Image download HTTP ${res.status}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(destPath, buffer);
}

async function main() {
  const html = await fs.readFile(HTML_FILE, "utf8");
  await fs.mkdir(VOICE_DIR, { recursive: true });

  const tiles = [];
  let match;
  TILE_RE.lastIndex = 0;
  while ((match = TILE_RE.exec(html)) !== null) {
    tiles.push({
      href: match[2],
      currentSrc: match[4],
      fullMatch: match[0],
      prefix: match[1],
      suffix: match[3],
      closing: match[5],
    });
  }

  if (!tiles.length) {
    console.error("No voice-mosaic tiles found in quienes-somos.html");
    process.exit(1);
  }

  console.log(`Found ${tiles.length} mosaic tile(s).`);

  const manifest = [];
  let updatedHtml = html;
  const cache = new Map();

  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    const shortcode = extractShortcode(tile.href);

    if (!shortcode) {
      console.warn(`[${i + 1}] Skipping non-Instagram URL: ${tile.href}`);
      continue;
    }

    let status = "cached";

    try {
      if (!cache.has(shortcode)) {
        console.log(`[${i + 1}/${tiles.length}] Fetching ${shortcode}…`);
        const ogImage = await fetchOgImage(tile.href);
        const localRel = `assets/images/voice/${shortcode}.jpg`;
        const localAbs = path.join(SITE_ROOT, localRel);
        await downloadImage(ogImage, localAbs);
        cache.set(shortcode, { localRel, ogImage });
        status = "downloaded";
      } else {
        console.log(`[${i + 1}/${tiles.length}] Reusing ${shortcode}`);
      }

      const { localRel: imagePath, ogImage } = cache.get(shortcode);
      const newTile =
        tile.prefix + tile.href + tile.suffix + imagePath + tile.closing;

      updatedHtml = updatedHtml.replace(tile.fullMatch, newTile);

      manifest.push({
        index: i + 1,
        shortcode,
        href: tile.href,
        image: imagePath,
        ogImage,
        status,
      });
    } catch (err) {
      console.warn(`[${i + 1}] Failed for ${shortcode}: ${err.message}`);
      manifest.push({
        index: i + 1,
        shortcode,
        href: tile.href,
        image: tile.currentSrc,
        error: err.message,
        status: "failed",
      });
    }

    await new Promise((r) => setTimeout(r, 400));
  }

  await fs.writeFile(HTML_FILE, updatedHtml, "utf8");
  await fs.writeFile(
    MANIFEST_FILE,
    JSON.stringify({ updatedAt: new Date().toISOString(), posts: manifest }, null, 2) + "\n",
    "utf8",
  );

  const ok = manifest.filter((p) => p.status !== "failed").length;
  console.log(`Done. ${ok}/${tiles.length} thumbnails ready.`);
  console.log(`Manifest: scripts/voice-posts.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
