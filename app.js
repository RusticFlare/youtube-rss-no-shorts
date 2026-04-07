const CORS_PROXY = "https://corsproxy.io/?url=";

const urlInput = document.getElementById("urlInput");
const goBtn    = document.getElementById("goBtn");
const result   = document.getElementById("result");
const feedUrl  = document.getElementById("feedUrl");
const copyBtn  = document.getElementById("copyBtn");
const errorBox = document.getElementById("error");

goBtn.addEventListener("click", run);
urlInput.addEventListener("keydown", e => { if (e.key === "Enter") run(); });

copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(feedUrl.value).then(() => {
    copyBtn.classList.add("copied");
    copyBtn.querySelector("span").textContent = "Copied!";
    setTimeout(() => {
      copyBtn.classList.remove("copied");
      copyBtn.querySelector("span").textContent = "Copy";
    }, 2000);
  });
});

async function run() {
  const raw = urlInput.value.trim();
  if (!raw) return;

  setError(null);
  result.classList.add("hidden");
  goBtn.disabled = true;
  goBtn.textContent = "Fetching…";

  try {
    const channelUrl = normaliseUrl(raw);
    const html = await fetchPage(channelUrl);
    const rssHref = extractRssHref(html);
    if (!rssHref) throw new Error("Could not find an RSS <link> tag on that page. Make sure the URL points to a YouTube channel.");
    const noShortsUrl = toNoShortsUrl(rssHref);
    feedUrl.value = noShortsUrl;
    result.classList.remove("hidden");
  } catch (err) {
    setError(err.message);
  } finally {
    goBtn.disabled = false;
    goBtn.textContent = "Go";
  }
}

/** Accept bare channel names / handles and ensure scheme is present */
function normaliseUrl(input) {
  if (!/^https?:\/\//i.test(input)) {
    input = "https://www.youtube.com/" + input.replace(/^\/+/, "");
  }
  return input;
}

async function fetchPage(url) {
  const proxyUrl = CORS_PROXY + encodeURIComponent(url);
  const res = await fetch(proxyUrl);
  if (!res.ok) throw new Error(`Failed to fetch the page (HTTP ${res.status}). Check the URL and try again.`);
  return res.text();
}

/**
 * Find:  <link rel="alternate" type="application/rss+xml" ... href="...">
 * The attributes can appear in any order, so we grab the whole <link> tag
 * and then pull the href out of it.
 */
function extractRssHref(html) {
  // Match any <link> tag that contains both the rss+xml type and a feeds/videos href
  const linkTagRe = /<link[^>]+type=["']application\/rss\+xml["'][^>]*>/gi;
  const hrefRe    = /href=["']([^"']+feeds\/videos\.xml[^"']*)["']/i;

  let match;
  while ((match = linkTagRe.exec(html)) !== null) {
    const tag = match[0];
    const hrefMatch = hrefRe.exec(tag);
    if (hrefMatch) return hrefMatch[1];
  }
  return null;
}

/**
 * https://www.youtube.com/feeds/videos.xml?channel_id=UCxxxxxxxx
 *   →  https://www.youtube.com/feeds/videos.xml?playlist_id=UULFxxxxxxxx
 *
 * The UC prefix (2 chars) is replaced with UULF (4 chars).
 */
function toNoShortsUrl(href) {
  const url = new URL(href);
  const channelId = url.searchParams.get("channel_id");
  if (!channelId) throw new Error("RSS URL did not contain a channel_id parameter.");
  if (!channelId.startsWith("UC")) throw new Error(`Unexpected channel ID format: "${channelId}"`);

  const playlistId = "UULF" + channelId.slice(2); // drop "UC", prepend "UULF"
  url.searchParams.delete("channel_id");
  url.searchParams.set("playlist_id", playlistId);
  return url.toString();
}

function setError(msg) {
  if (msg) {
    errorBox.textContent = msg;
    errorBox.classList.remove("hidden");
  } else {
    errorBox.classList.add("hidden");
    errorBox.textContent = "";
  }
}
