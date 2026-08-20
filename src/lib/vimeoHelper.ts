/**
 * Vimeo Video Resolver & Downloader Utility
 * Resolves Vimeo video IDs and URLs into direct playable/downloadable MP4 streams and HLS manifests.
 */

export interface VimeoProgressiveFile {
  id: string;
  quality: string;
  width: number;
  height: number;
  fps: number;
  mime: string;
  url: string;
  bitrate?: number;
}

export interface VimeoVideoMetadata {
  id: string;
  title: string;
  duration: number; // in seconds
  thumbnailUrl: string;
  authorName: string;
  authorUrl: string;
  hlsMasterUrl?: string;
  progressiveFiles: VimeoProgressiveFile[];
  bestMp4Url?: string;
}

export function extractVimeoId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  // Direct numeric ID
  if (/^\d+$/.test(trimmed)) return trimmed;
  // Standard Vimeo URL patterns
  const match = trimmed.match(/(?:vimeo\.com\/(?:video\/|channels\/[\w-]+\/|groups\/[\w-]+\/videos\/|album\/\d+\/video\/)?|player\.vimeo\.com\/video\/)(\d+)/);
  return match ? match[1] : null;
}

export async function fetchVimeoConfig(
  videoId: string,
  signal?: AbortSignal,
  onStatus?: (msg: string) => void
): Promise<VimeoVideoMetadata> {
  const configUrl = `https://player.vimeo.com/video/${videoId}/config`;
  const playerUrl = `https://player.vimeo.com/video/${videoId}`;
  onStatus?.(`Получение конфигурации Vimeo для видео ID: ${videoId}...`);

  const fetchUrls = [
    configUrl,
    `https://corsproxy.io/?${encodeURIComponent(configUrl)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(configUrl)}`,
    `https://proxy.cors.sh/${configUrl}`,
    `https://thingproxy.freeboard.io/fetch/${configUrl}`
  ];

  let configJson: any = null;
  let lastErr: any = null;

  for (const url of fetchUrls) {
    if (signal?.aborted) throw new DOMException('Aborted by user', 'AbortError');
    try {
      const resp = await fetch(url, { signal });
      if (resp.ok) {
        const text = await resp.text();
        try {
          configJson = JSON.parse(text);
          if (configJson && (configJson.video || configJson.request)) {
            break;
          }
        } catch {
          // Check if it's HTML containing config JSON
          const match = text.match(/(?:window\.playerConfig|var config)\s*=\s*({.+?});/s);
          if (match && match[1]) {
            try {
              configJson = JSON.parse(match[1]);
              if (configJson && (configJson.video || configJson.request)) break;
            } catch {}
          }
        }
      }
    } catch (e: any) {
      if (e.name === 'AbortError' || signal?.aborted) throw e;
      lastErr = e;
    }
  }

  // If still not found, try fetching the player page directly via proxies
  if (!configJson) {
    const pageProxies = [
      `https://corsproxy.io/?${encodeURIComponent(playerUrl)}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(playerUrl)}`
    ];
    for (const pUrl of pageProxies) {
      if (signal?.aborted) break;
      try {
        const pResp = await fetch(pUrl, { signal });
        if (pResp.ok) {
          const html = await pResp.text();
          const match = html.match(/(?:window\.playerConfig|var config)\s*=\s*({.+?});/);
          if (match && match[1]) {
            configJson = JSON.parse(match[1]);
            if (configJson) break;
          }
        }
      } catch {}
    }
  }

  // Fallback: oEmbed metadata if config is restricted
  let oembedData: any = null;
  try {
    const oembedUrl = `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${videoId}`;
    const oembedResp = await fetch(`https://corsproxy.io/?${encodeURIComponent(oembedUrl)}`, { signal });
    if (oembedResp.ok) {
      oembedData = await oembedResp.json();
    }
  } catch {}

  const title = configJson?.video?.title || oembedData?.title || `Vimeo Video #${videoId}`;
  const duration = configJson?.video?.duration || oembedData?.duration || 0;
  const thumbnailUrl = configJson?.video?.thumbs?.base || oembedData?.thumbnail_url || '';
  const authorName = configJson?.video?.owner?.name || oembedData?.author_name || 'Vimeo Creator';
  const authorUrl = configJson?.video?.owner?.url || oembedData?.author_url || `https://vimeo.com/${videoId}`;

  const progressiveList: VimeoProgressiveFile[] = [];

  if (configJson?.request?.files?.progressive && Array.isArray(configJson.request.files.progressive)) {
    for (const f of configJson.request.files.progressive) {
      if (f && f.url) {
        progressiveList.push({
          id: String(f.id || f.quality || 'mp4'),
          quality: String(f.quality || `${f.height}p` || 'HD'),
          width: Number(f.width || 0),
          height: Number(f.height || 0),
          fps: Number(f.fps || 30),
          mime: f.mime || 'video/mp4',
          url: f.url,
          bitrate: f.bitrate
        });
      }
    }
  }

  // Sort descending by height / quality
  progressiveList.sort((a, b) => (b.height || 0) - (a.height || 0));

  // Find HLS master URL if present
  let hlsMasterUrl: string | undefined;
  const hlsFiles = configJson?.request?.files?.hls;
  if (hlsFiles) {
    if (hlsFiles.cdns) {
      const defaultCdn = hlsFiles.default_cdn || Object.keys(hlsFiles.cdns)[0];
      if (defaultCdn && hlsFiles.cdns[defaultCdn]?.url) {
        hlsMasterUrl = hlsFiles.cdns[defaultCdn].url;
      }
    }
    if (!hlsMasterUrl && hlsFiles.url) {
      hlsMasterUrl = hlsFiles.url;
    }
  }

  const bestMp4Url = progressiveList.length > 0 ? progressiveList[0].url : undefined;

  return {
    id: videoId,
    title,
    duration,
    thumbnailUrl,
    authorName,
    authorUrl,
    hlsMasterUrl,
    progressiveFiles: progressiveList,
    bestMp4Url
  };
}

/**
 * Downloads a direct progressive MP4 file or HLS from Vimeo into a Uint8Array with progress reporting
 */
export async function downloadVimeoDirectMp4(
  videoUrl: string,
  fileName: string,
  signal?: AbortSignal,
  onProgress?: (percent: number, loadedBytes: number, totalBytes: number, message: string) => void
): Promise<Uint8Array> {
  const fetchUrls = [
    videoUrl,
    `https://corsproxy.io/?${encodeURIComponent(videoUrl)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(videoUrl)}`,
    `https://proxy.cors.sh/${videoUrl}`,
    `https://thingproxy.freeboard.io/fetch/${videoUrl}`
  ];

  let response: Response | null = null;
  let lastErr: any = null;

  for (const url of fetchUrls) {
    if (signal?.aborted) throw new DOMException('Download aborted by user', 'AbortError');
    try {
      const r = await fetch(url, { signal });
      if (r.ok) {
        response = r;
        break;
      }
    } catch (e: any) {
      if (e.name === 'AbortError' || signal?.aborted) throw e;
      lastErr = e;
    }
  }

  if (!response || !response.ok) {
    throw new Error(`Не удалось загрузить видеофайл Vimeo (${lastErr?.message || 'CORS / Network Error'}).`);
  }

  const contentLengthHeader = response.headers.get('content-length');
  const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

  if (!response.body) {
    const ab = await response.arrayBuffer();
    const result = new Uint8Array(ab);
    onProgress?.(100, result.length, result.length, 'Загрузка завершена!');
    return result;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loadedBytes = 0;

  while (true) {
    if (signal?.aborted) {
      reader.cancel();
      throw new DOMException('Download aborted by user', 'AbortError');
    }

    const { done, value } = await reader.read();
    if (done) break;

    if (value) {
      chunks.push(value);
      loadedBytes += value.length;
      const pct = totalBytes > 0 ? Math.min(99, Math.round((loadedBytes / totalBytes) * 100)) : 50;
      const mbLoaded = (loadedBytes / 1024 / 1024).toFixed(1);
      const mbTotal = totalBytes > 0 ? (totalBytes / 1024 / 1024).toFixed(1) + ' МБ' : 'размер уточняется...';
      onProgress?.(pct, loadedBytes, totalBytes, `Загрузка MP4 потока с Vimeo: ${mbLoaded} / ${mbTotal} (${pct}%)`);
    }
  }

  // Concat chunks
  const finalBuffer = new Uint8Array(loadedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    finalBuffer.set(chunk, offset);
    offset += chunk.length;
  }

  onProgress?.(100, loadedBytes, loadedBytes, `✓ Видеофайл "${fileName}" (${(loadedBytes / 1024 / 1024).toFixed(1)} МБ) успешно загружен и готов!`);
  return finalBuffer;
}
