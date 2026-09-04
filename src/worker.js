// Worker for elxak-dev.
//
// Static assets (dist/, i.e. index.html, socials.html, ...) are served
// directly by Cloudflare with no Worker invocation, EXCEPT paths matching
// /api/* (see wrangler.jsonc's assets.run_worker_first), which land here.
//
// Routes:
//   GET /api/youtube    — latest uploads from the YouTube channel, via the
//                          YouTube Data API v3 (env.YOUTUBE_API_KEY secret +
//                          env.YOUTUBE_CHANNEL_HANDLE var).
//   GET /api/instagram  — latest media from the Instagram account, via the
//                          Instagram API with Instagram Login
//                          (graph.instagram.com), using the long-lived
//                          access token stored in SOCIALS_KV under
//                          "ig_access_token" (seeded by hand once, see
//                          CLAUDE.md — refreshed automatically by the
//                          scheduled() cron below).
//
// Both responses are cached at the edge for CACHE_TTL_SECONDS so a burst of
// visitors doesn't burn API quota or hammer the Instagram token.

const CACHE_TTL_SECONDS = 30 * 60; // 30 min

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/youtube") return await withCache(request, ctx, () => fetchYouTube(env));
      if (url.pathname === "/api/instagram") return await withCache(request, ctx, () => fetchInstagram(env));
    } catch (err) {
      return json({ error: String(err && err.message || err) }, 502);
    }
    // Anything else under /api/* (or a stale route) — 404, don't fall
    // through to assets since run_worker_first already claimed this path.
    return json({ error: "not found" }, 404);
  },

  // Keeps the Instagram long-lived token alive indefinitely. Tokens are
  // valid 60 days and refreshable any time after the first 24h, so a daily
  // run (see wrangler.jsonc triggers.crons) leaves a wide safety margin.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(refreshInstagramToken(env));
  },
};

async function withCache(request, ctx, handler) {
  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).toString(), { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const response = await handler();
  response.headers.set("Cache-Control", `public, max-age=${CACHE_TTL_SECONDS}`);
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

async function fetchYouTube(env) {
  if (!env.YOUTUBE_API_KEY) return json({ error: "YouTube not configured" }, 503);

  const handle = (env.YOUTUBE_CHANNEL_HANDLE || "").replace(/^@?/, "@");
  const chRes = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&forHandle=${encodeURIComponent(handle)}&key=${env.YOUTUBE_API_KEY}`
  );
  const chData = await chRes.json();
  const uploadsId = chData.items && chData.items[0] && chData.items[0].contentDetails.relatedPlaylists.uploads;
  if (!uploadsId) return json({ error: "YouTube channel not found" }, 502);

  const plRes = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=12&playlistId=${uploadsId}&key=${env.YOUTUBE_API_KEY}`
  );
  const plData = await plRes.json();
  if (!plData.items) return json({ error: "YouTube fetch failed" }, 502);

  const videos = plData.items
    .filter((it) => it.snippet && it.snippet.resourceId && it.snippet.resourceId.videoId)
    .map((it) => ({
      id: it.snippet.resourceId.videoId,
      title: it.snippet.title,
      thumbnail:
        (it.snippet.thumbnails &&
          (it.snippet.thumbnails.medium || it.snippet.thumbnails.default || {}).url) ||
        "",
      publishedAt: it.snippet.publishedAt,
    }));

  return json({ videos });
}

async function fetchInstagram(env) {
  const token = await env.SOCIALS_KV.get("ig_access_token");
  if (!token) return json({ error: "Instagram not configured" }, 503);

  const fields = "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp";
  const igRes = await fetch(
    `https://graph.instagram.com/me/media?fields=${fields}&limit=12&access_token=${token}`
  );
  const igData = await igRes.json();
  if (igData.error) return json({ error: igData.error.message || "Instagram fetch failed" }, 502);

  const posts = (igData.data || []).map((p) => ({
    id: p.id,
    caption: p.caption || "",
    isVideo: p.media_type === "VIDEO",
    isReel: p.media_product_type === "REELS",
    thumbnail: p.media_type === "VIDEO" ? p.thumbnail_url || p.media_url : p.media_url,
    permalink: p.permalink,
    timestamp: p.timestamp,
  }));

  return json({ posts });
}

async function refreshInstagramToken(env) {
  const token = await env.SOCIALS_KV.get("ig_access_token");
  if (!token) return; // nothing seeded yet — see CLAUDE.md setup steps
  const res = await fetch(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`
  );
  const data = await res.json();
  if (data.access_token) {
    await env.SOCIALS_KV.put("ig_access_token", data.access_token);
  }
  // If this fails, the old token just keeps working until it actually
  // expires — next day's run tries again. Nothing to roll back.
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
