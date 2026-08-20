/**
 * YouTube Helper and Direct Video Stream Resolver
 * Handles YouTube video IDs, oEmbed meta, and embeds
 */

export interface YouTubeMetadata {
  id: string;
  title: string;
  authorName: string;
  authorUrl: string;
  thumbnailUrl: string;
  embedUrl: string;
}

export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  // 11 chars standard YouTube video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Common YouTube URL formats
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
  ];

  for (const p of patterns) {
    const match = trimmed.match(p);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

export async function fetchYouTubeMetadata(
  videoId: string,
  signal?: AbortSignal
): Promise<YouTubeMetadata> {
  const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
  const proxies = [
    `https://corsproxy.io/?${encodeURIComponent(oembedUrl)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(oembedUrl)}`,
    oembedUrl
  ];

  let data: any = null;
  for (const u of proxies) {
    if (signal?.aborted) throw new DOMException('Aborted by user', 'AbortError');
    try {
      const resp = await fetch(u, { signal });
      if (resp.ok) {
        data = await resp.json();
        break;
      }
    } catch {}
  }

  return {
    id: videoId,
    title: data?.title || `YouTube Video #${videoId}`,
    authorName: data?.author_name || 'YouTube Creator',
    authorUrl: data?.author_url || `https://www.youtube.com/watch?v=${videoId}`,
    thumbnailUrl: data?.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&enablejsapi=1`
  };
}
