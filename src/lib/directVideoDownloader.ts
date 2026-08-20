/**
 * Universal Direct Video & Web Stream Downloader
 * Downloads direct MP4, WebM, TS, MOV, MKV files or raw streams from the internet with CORS fallbacks and progress reporting.
 */

export interface DownloadMediaProgress {
  stage: 'init' | 'manifest' | 'init_segment' | 'downloading' | 'muxing' | 'complete';
  percent?: number;
  loadedBytes?: number;
  totalBytes?: number;
  speedBps?: number;
  message: string;
}

export interface DirectDownloadResult {
  uint8Array: Uint8Array;
  filename: string;
  mime: string;
  size: number;
}

export async function downloadDirectVideo(
  url: string,
  options: {
    customFilename?: string;
    signal?: AbortSignal;
    onProgress?: (progress: DownloadMediaProgress) => void;
  } = {}
): Promise<DirectDownloadResult> {
  const { customFilename, signal, onProgress } = options;

  onProgress?.({
    stage: 'init',
    message: `Подключение к источнику: ${url}...`
  });

  const fetchCandidates = [
    url,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://proxy.cors.sh/${url}`,
    `https://thingproxy.freeboard.io/fetch/${url}`
  ];

  let response: Response | null = null;
  let activeUrl = url;
  let lastError: any = null;

  for (let i = 0; i < fetchCandidates.length; i++) {
    if (signal?.aborted) throw new DOMException('Download aborted by user', 'AbortError');
    const target = fetchCandidates[i];
    try {
      if (i > 0) {
        onProgress?.({
          stage: 'init',
          message: `Прямой запрос заблокирован политикой CORS. Подключение через резервный CORS-шлюз #${i}...`
        });
      }
      const res = await fetch(target, { signal });
      if (res.ok) {
        response = res;
        activeUrl = target;
        break;
      }
    } catch (e: any) {
      if (e.name === 'AbortError' || signal?.aborted) throw e;
      lastError = e;
    }
  }

  if (!response || !response.ok) {
    let errorDetail = lastError?.message || 'CORS / Ошибка сети';
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      throw new Error(
        `YouTube защищает свои потоки шифрованием и политикой CORS. Прямое скачивание бинарного MP4 из YouTube в браузере невозможно — видео открыто во встроенном плеере YouTube.`
      );
    }
    throw new Error(
      `Не удалось загрузить видео по адресу ${url} (${errorDetail}). Сервер недоступен или блокирует кросс-доменные запросы.`
    );
  }

  const contentType = response.headers.get('content-type') || 'video/mp4';
  const contentLengthHeader = response.headers.get('content-length');
  const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

  // Extract filename from URL or header
  let filename = customFilename;
  if (!filename) {
    try {
      const parsedUrl = new URL(url);
      const pathname = parsedUrl.pathname;
      const baseName = pathname.substring(pathname.lastIndexOf('/') + 1);
      if (baseName && baseName.includes('.')) {
        filename = decodeURIComponent(baseName);
      }
    } catch {}
  }
  if (!filename) {
    filename = contentType.includes('webm') ? 'downloaded_video.webm' : 'downloaded_video.mp4';
  }

  if (!response.body) {
    const ab = await response.arrayBuffer();
    const result = new Uint8Array(ab);
    onProgress?.({
      stage: 'complete',
      percent: 100,
      loadedBytes: result.length,
      totalBytes: result.length,
      message: `✓ Файл "${filename}" (${(result.length / 1024 / 1024).toFixed(2)} МБ) успешно загружен!`
    });
    return {
      uint8Array: result,
      filename,
      mime: contentType,
      size: result.length
    };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loadedBytes = 0;
  const startTime = Date.now();

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

      const elapsedSec = (Date.now() - startTime) / 1000;
      const speedBps = elapsedSec > 0 ? loadedBytes / elapsedSec : 0;
      const speedMb = (speedBps / 1024 / 1024).toFixed(2);
      const loadedMb = (loadedBytes / 1024 / 1024).toFixed(2);

      let pct: number | undefined;
      let totalMb = '';
      if (totalBytes > 0) {
        pct = Math.min(99, Math.round((loadedBytes / totalBytes) * 100));
        totalMb = ` / ${(totalBytes / 1024 / 1024).toFixed(2)} МБ (${pct}%)`;
      }

      onProgress?.({
        stage: 'downloading',
        percent: pct,
        loadedBytes,
        totalBytes: totalBytes > 0 ? totalBytes : undefined,
        speedBps,
        message: `Загрузка данных из сети: ${loadedMb} МБ${totalMb} • ${speedMb} МБ/с`
      });
    }
  }

  // Concatenate chunks
  const finalBuffer = new Uint8Array(loadedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    finalBuffer.set(chunk, offset);
    offset += chunk.length;
  }

  onProgress?.({
    stage: 'complete',
    percent: 100,
    loadedBytes,
    totalBytes: loadedBytes,
    message: `✓ Загрузка завершена! Видео "${filename}" (${(loadedBytes / 1024 / 1024).toFixed(2)} МБ) готово к воспроизведению и сохранению.`
  });

  return {
    uint8Array: finalBuffer,
    filename,
    mime: contentType,
    size: loadedBytes
  };
}
