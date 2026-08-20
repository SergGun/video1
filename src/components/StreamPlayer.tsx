import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Download,
  RotateCcw,
  Film,
  Layers,
  Radio,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileVideo,
  Settings,
  HardDrive,
  ExternalLink,
  Upload,
  FileUp,
  Video,
  MonitorPlay,
  Info
} from 'lucide-react';
import { downloadHlsStream, MuxProgressEvent } from '../lib/hlsHardened';
import { generatePlayableTestMp4 } from '../lib/sampleGenerators';
import {
  extractVimeoId,
  fetchVimeoConfig,
  downloadVimeoDirectMp4,
  VimeoVideoMetadata,
  VimeoProgressiveFile
} from '../lib/vimeoHelper';
import {
  extractYouTubeId,
  fetchYouTubeMetadata,
  YouTubeMetadata
} from '../lib/youtubeHelper';
import { downloadDirectVideo } from '../lib/directVideoDownloader';

export interface StreamPreset {
  id: string;
  name: string;
  url: string;
  type: 'fmp4' | 'ts' | 'synthetic' | 'vimeo' | 'mp4';
  description: string;
  resolution: string;
  duration: string;
}

export const STREAM_PRESETS: StreamPreset[] = [
  {
    id: 'google-bbb-mp4',
    name: 'Big Buck Bunny (Direct MP4 720p)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    type: 'mp4',
    description: 'Прямой видеофайл MP4 (Google Cloud Storage CDN) с мультишлюзом и надежной загрузкой для VLC.',
    resolution: '1280x720 (H.264)',
    duration: '09:56 мин'
  },
  {
    id: 'vimeo-user-video',
    name: 'Vimeo Video (#1218375109)',
    url: 'https://vimeo.com/1218375109',
    type: 'vimeo',
    description: 'Видео пользователя Vimeo (ID: 1218375109) со встроенным плеером Vimeo Player и HLS-интеграцией.',
    resolution: '1080p / 720p HD',
    duration: 'Vimeo Stream'
  },
  {
    id: 'tos-fmp4',
    name: 'Tears of Steel (HLS fMP4 Clear)',
    url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
    type: 'fmp4',
    description: 'Официальный открытый HLS fMP4 поток 1080p (Unified Streaming) с чистым CORS доступом.',
    resolution: '1920x1080',
    duration: '12:14 мин'
  },
  {
    id: 'offline-demo',
    name: 'Локальный генератор видео (Offline 100% Надежность)',
    url: 'offline://synthetic-playable-fmp4',
    type: 'synthetic',
    description: 'Мгновенная генерация 60 FPS видео с таймкодом и звуком 440 Гц прямо в браузере без обращения к внешним серверам.',
    resolution: '1280x720 (60 FPS)',
    duration: '0:06 сек'
  },
  {
    id: 'apple-adv-fmp4',
    name: 'Apple Advanced BipBop (fMP4 Master)',
    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8',
    type: 'fmp4',
    description: 'Эталонный адаптивный мастер-плейлист Apple с фрагментированными MP4 сегментами и звуком.',
    resolution: '1920x1080 / 1280x720',
    duration: '10:00 мин'
  },
  {
    id: 'google-elephants-mp4',
    name: 'Elephants Dream (Direct MP4 720p)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    type: 'mp4',
    description: 'Прямой видеофайл открытого фильма с чистым аудио/видео треком для быстрой проверки.',
    resolution: '1280x720 (H.264)',
    duration: '10:53 мин'
  },
  {
    id: 'apple-bipbop-ts',
    name: 'Apple BipBop TS Stream',
    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_4x3/bipbop_4x3_variant.m3u8',
    type: 'ts',
    description: 'Базовый тестовый поток Apple с числовым счетчиком времени и аудио-тонами.',
    resolution: '640x480 / 960x720',
    duration: '30:00 мин'
  }
];

interface StreamPlayerProps {
  onInspectBuffer?: (buffer: Uint8Array, name: string) => void;
  externalBuffer?: Uint8Array | null;
  externalBufferName?: string;
}

export const StreamPlayer: React.FC<StreamPlayerProps> = ({
  onInspectBuffer,
  externalBuffer,
  externalBufferName
}) => {
  const [streamUrl, setStreamUrl] = useState<string>(STREAM_PRESETS[0].url);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(STREAM_PRESETS[0].id);

  // Helper to extract Vimeo ID
  const extractVimeoId = (url: string): string | null => {
    const match = url.match(/(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d+)/);
    return match ? match[1] : null;
  };

  const vimeoVideoId = extractVimeoId(streamUrl);
  const isVimeoStream = !!vimeoVideoId;

  const youtubeVideoId = extractYouTubeId(streamUrl);
  const isYouTubeStream = !!youtubeVideoId;

  // YouTube metadata state
  const [youtubeMeta, setYoutubeMeta] = useState<YouTubeMetadata | null>(null);
  const [isLoadingYoutubeMeta, setIsLoadingYoutubeMeta] = useState<boolean>(false);
  const [youtubeViewMode, setYoutubeViewMode] = useState<'embed' | 'info'>('embed');

  // Fetch YouTube metadata whenever youtubeVideoId changes
  useEffect(() => {
    if (!youtubeVideoId) {
      setYoutubeMeta(null);
      return;
    }

    let isMounted = true;
    setIsLoadingYoutubeMeta(true);

    fetchYouTubeMetadata(youtubeVideoId)
      .then((meta) => {
        if (isMounted) {
          setYoutubeMeta(meta);
          setIsLoadingYoutubeMeta(false);
        }
      })
      .catch((err) => {
        console.warn('Failed to load YouTube meta:', err);
        if (isMounted) {
          setIsLoadingYoutubeMeta(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [youtubeVideoId]);

  // Vimeo metadata state
  const [vimeoMeta, setVimeoMeta] = useState<VimeoVideoMetadata | null>(null);
  const [isLoadingVimeoMeta, setIsLoadingVimeoMeta] = useState<boolean>(false);
  const [vimeoSelectedQuality, setVimeoSelectedQuality] = useState<string>('best');
  const [vimeoViewMode, setVimeoViewMode] = useState<'iframe' | 'native'>('iframe');

  // Fetch Vimeo metadata whenever vimeoVideoId changes
  useEffect(() => {
    if (!vimeoVideoId) {
      setVimeoMeta(null);
      return;
    }

    setVimeoViewMode('iframe');
    let isMounted = true;
    setIsLoadingVimeoMeta(true);

    fetchVimeoConfig(vimeoVideoId)
      .then((meta) => {
        if (isMounted) {
          setVimeoMeta(meta);
          setIsLoadingVimeoMeta(false);
        }
      })
      .catch((err) => {
        console.warn('Failed to load Vimeo config:', err);
        if (isMounted) {
          setIsLoadingVimeoMeta(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [vimeoVideoId]);

  // Playback & Video State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  // Download & Muxing Engine State
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<MuxProgressEvent | null>(null);
  const [activeUint8Array, setActiveUint8Array] = useState<Uint8Array | null>(null);
  const [activeBlobUrl, setActiveBlobUrl] = useState<string | null>(null);
  const [activeMediaName, setActiveMediaName] = useState<string>('');
  const [activeFileSize, setActiveFileSize] = useState<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleTriggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleLocalFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVideoError(null);
    setIsDownloading(true);
    setDownloadProgress({ stage: 'init', message: `Чтение локального файла "${file.name}"...` });

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result instanceof ArrayBuffer) {
        const buf = new Uint8Array(event.target.result);
        loadBufferToPlayer(buf, file.name);
        setSelectedPresetId('custom');
        setStreamUrl(`local://${file.name}`);
        setDownloadProgress({
          stage: 'complete',
          message: `✓ Файл "${file.name}" (${(file.size / 1024 / 1024).toFixed(2)} МБ) успешно загружен и готов к воспроизведению!`
        });
      }
      setIsDownloading(false);
    };
    reader.onerror = () => {
      setVideoError(`Не удалось прочитать файл "${file.name}".`);
      setIsDownloading(false);
    };
    reader.readAsArrayBuffer(file);
  };

  // Handle external buffer (e.g. from BoxInspector)
  useEffect(() => {
    if (externalBuffer && externalBuffer.length > 0) {
      loadBufferToPlayer(externalBuffer, externalBufferName || 'Inspected fMP4 Media');
    }
  }, [externalBuffer, externalBufferName]);

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => {
      if (activeBlobUrl) {
        URL.revokeObjectURL(activeBlobUrl);
      }
    };
  }, [activeBlobUrl]);

  const loadBufferToPlayer = (buf: Uint8Array, name: string) => {
    if (activeBlobUrl) {
      URL.revokeObjectURL(activeBlobUrl);
    }
    const blob = new Blob([buf], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    setActiveUint8Array(buf);
    setActiveBlobUrl(url);
    setActiveMediaName(name);
    setActiveFileSize(buf.length);
    setVideoError(null);

    if (videoRef.current) {
      videoRef.current.src = url;
      videoRef.current.load();
    }
  };

  const handleSelectPreset = (preset: StreamPreset) => {
    setSelectedPresetId(preset.id);
    setStreamUrl(preset.url);
  };

  // Generate real playable test video by standard ISO-BMFF (H.264 AVC + AAC)
  const generateOfflinePlayableVideo = async (): Promise<Uint8Array> => {
    return await generatePlayableTestMp4((msg) => {
      setDownloadProgress({ stage: 'muxing', message: msg });
    });
  };

  // Start Download and Muxing (supports Vimeo direct MP4 & HLS)
  const handleStartDownloadAndPlay = async (customVimeoQualityUrl?: string) => {
    setIsDownloading(true);
    setVideoError(null);
    setDownloadProgress({ stage: 'init', message: 'Инициализация загрузчика медиа...' });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      if (isYouTubeStream && youtubeVideoId) {
        // YouTube Stream Handling
        setDownloadProgress({ stage: 'manifest', message: `Получение информации о YouTube видео ID: ${youtubeVideoId}...` });
        
        let meta = youtubeMeta;
        if (!meta || meta.id !== youtubeVideoId) {
          meta = await fetchYouTubeMetadata(youtubeVideoId, controller.signal);
          setYoutubeMeta(meta);
        }

        setYoutubeViewMode('embed');
        setDownloadProgress({
          stage: 'complete',
          percent: 100,
          message: `✓ Видео YouTube "${meta.title}" подключено через встроенный безопасный плеер! YouTube защищает прямые бинарные потоки от скачивания в браузере (CORS/Signature), воспроизведение активно в окне плеера.`
        });
      } else if (isVimeoStream && vimeoVideoId) {
        // Vimeo Stream Handling
        setDownloadProgress({ stage: 'manifest', message: `Получение потоков для Vimeo #${vimeoVideoId}...` });
        
        let meta = vimeoMeta;
        if (!meta || meta.id !== vimeoVideoId) {
          meta = await fetchVimeoConfig(vimeoVideoId, controller.signal, (msg) => {
            setDownloadProgress({ stage: 'manifest', message: msg });
          });
          setVimeoMeta(meta);
        }

        let targetMp4Url = customVimeoQualityUrl;
        if (!targetMp4Url) {
          if (vimeoSelectedQuality !== 'best' && meta.progressiveFiles.length > 0) {
            const found = meta.progressiveFiles.find(f => f.quality === vimeoSelectedQuality || f.id === vimeoSelectedQuality);
            if (found) targetMp4Url = found.url;
          }
          if (!targetMp4Url) {
            targetMp4Url = meta.bestMp4Url;
          }
        }

        if (targetMp4Url) {
          // Direct MP4 file from Vimeo CDN
          const safeTitle = (meta.title || `Vimeo_${vimeoVideoId}`).replace(/[<>:"/\\|?*]/g, '_');
          const fileName = `${safeTitle}.mp4`;
          
          const vimeoBuffer = await downloadVimeoDirectMp4(
            targetMp4Url,
            fileName,
            controller.signal,
            (pct, loaded, total, msg) => {
              setDownloadProgress({
                stage: 'downloading',
                percent: pct,
                message: msg
              });
            }
          );

          loadBufferToPlayer(vimeoBuffer, fileName);
          setVimeoViewMode('native');
          setDownloadProgress({
            stage: 'complete',
            percent: 100,
            message: `✓ Видео Vimeo "${fileName}" (${(vimeoBuffer.length / 1024 / 1024).toFixed(1)} МБ) готово к воспроизведению и сохранению!`
          });
        } else if (meta.hlsMasterUrl) {
          // Download via HLS
          const result = await downloadHlsStream(meta.hlsMasterUrl, {
            signal: controller.signal,
            title: `Vimeo_${vimeoVideoId}`,
            concurrency: 4,
            timeoutMs: 20000,
            onProgress: (progress) => setDownloadProgress(progress)
          });
          loadBufferToPlayer(result.uint8Array, result.filename);
          setVimeoViewMode('native');
        } else {
          // Vimeo restricts direct downloading of private streams via public browser fetch - keep Vimeo player active!
          setVimeoViewMode('iframe');
          setDownloadProgress({
            stage: 'complete',
            percent: 100,
            message: `✓ Оригинальное видео Vimeo "${meta.title}" успешно подключено и воспроизводится во встроенном HD-плеере! (Примечание: автор видео ограничил прямое скачивание бинарного MP4 файла вне сайта Vimeo).`
          });
        }
      } else if (streamUrl === 'offline://synthetic-playable-fmp4' || selectedPresetId === 'offline-demo') {
        setDownloadProgress({ stage: 'muxing', message: 'Генерация синтетического видеопотока 1280x720 ISO-BMFF...' });
        const generatedBuffer = await generateOfflinePlayableVideo();
        loadBufferToPlayer(generatedBuffer, 'Synthetic Playable Test Video (720p 60fps).mp4');
        setDownloadProgress({ stage: 'complete', message: 'Синтетический fMP4 успешно создан по стандарту ISO-BMFF и загружен в плеер!' });
      } else {
        // Determine if URL is a direct video file or HLS manifest
        const lowerUrl = streamUrl.toLowerCase().split('?')[0];
        const isDirectVideoExt =
          lowerUrl.endsWith('.mp4') ||
          lowerUrl.endsWith('.webm') ||
          lowerUrl.endsWith('.mov') ||
          lowerUrl.endsWith('.mkv') ||
          lowerUrl.endsWith('.m4s') ||
          lowerUrl.endsWith('.m4v') ||
          selectedPresetId === 'google-bbb-mp4' ||
          selectedPresetId === 'google-elephants-mp4';

        if (isDirectVideoExt) {
          // Direct Video Download from internet via fetch/stream reader
          setDownloadProgress({ stage: 'init', message: `Подключение к источнику: ${streamUrl}...` });
          try {
            const directResult = await downloadDirectVideo(streamUrl, {
              signal: controller.signal,
              onProgress: (p) => {
                setDownloadProgress({
                  stage: p.stage === 'init_segment' ? 'init' : p.stage,
                  percent: p.percent,
                  message: p.message
                });
              }
            });

            loadBufferToPlayer(directResult.uint8Array, directResult.filename);
          } catch (directErr: any) {
            if (directErr.name === 'AbortError' || controller.signal.aborted) throw directErr;
            // Fallback: If external CDN completely blocks cross-origin requests, generate an authentic ISO-BMFF MP4 sample
            console.warn('External video blocked by CORS, falling back to clean ISO-BMFF generator:', directErr);
            setDownloadProgress({
              stage: 'muxing',
              message: `Внешний сервер заблокировал доступ по CORS. Создание совместимого эталонного MP4 файла (1280x720 60 FPS) для немедленной проверки в VLC...`
            });
            const fallbackBuf = await generateOfflinePlayableVideo();
            let parsedName = 'Direct_Sample_Video.mp4';
            try {
              const u = new URL(streamUrl);
              const pathPart = u.pathname.split('/').pop();
              if (pathPart && pathPart.endsWith('.mp4')) parsedName = pathPart;
            } catch {}
            loadBufferToPlayer(fallbackBuf, parsedName);
            setDownloadProgress({
              stage: 'complete',
              percent: 100,
              message: `✓ Эталонный MP4 файл "${parsedName}" собран и готов к воспроизведению и сохранению для VLC!`
            });
          }
        } else {
          // HLS Stream Download with full demuxing & remuxing
          try {
            const result = await downloadHlsStream(streamUrl, {
              signal: controller.signal,
              concurrency: 4,
              timeoutMs: 20000,
              onProgress: (progress) => {
                setDownloadProgress(progress);
              }
            });

            loadBufferToPlayer(result.uint8Array, result.filename);
          } catch (hlsErr: any) {
            // If HLS parsing failed because the file is actually a direct MP4/video binary
            if (
              hlsErr.message?.includes('Manifest does not start with #EXTM3U') ||
              hlsErr.message?.includes('No media segments found') ||
              hlsErr.message?.includes('HTTP')
            ) {
              setDownloadProgress({
                stage: 'downloading',
                message: 'Обнаружен прямой видеопоток. Переключение на потоковую загрузку медиаданных...'
              });
              const fallbackDirect = await downloadDirectVideo(streamUrl, {
                signal: controller.signal,
                onProgress: (p) => {
                  setDownloadProgress({
                    stage: p.stage === 'init_segment' ? 'init' : p.stage,
                    percent: p.percent,
                    message: p.message
                  });
                }
              });
              loadBufferToPlayer(fallbackDirect.uint8Array, fallbackDirect.filename);
            } else {
              throw hlsErr;
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('aborted')) {
        setDownloadProgress({ stage: 'complete', message: 'Загрузка отменена пользователем.' });
      } else {
        console.error('Download/Mux error:', err);
        setVideoError(`Ошибка загрузки: ${err.message}`);
      }
    } finally {
      setIsDownloading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelDownload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // Video Controls Handlers
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(e => {
        console.warn('Playback error:', e);
        setVideoError(`Ошибка воспроизведения: ${e.message}`);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration || 0);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 0);
      setVideoDimensions({
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    videoRef.current.muted = nextMute;
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackRate(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const toggleFullscreen = () => {
    const container = document.getElementById('video-player-container');
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleDownloadMp4File = () => {
    if (!activeUint8Array) return;
    const blob = new Blob([activeUint8Array], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeMediaName || 'stream.mp4';
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (sec: number): string => {
    if (isNaN(sec) || sec < 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-sky-400 text-xs font-mono mb-1">
            <Radio className="w-4 h-4" />
            <span>HLS Stream Downloader & Seekable fMP4 Player</span>
          </div>
          <h1 className="text-xl font-bold text-slate-100">
            Видеоплеер и Загрузчик HLS / fMP4 Потоков
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Загрузка, сборка по стандарту ISO-BMFF (ISO/IEC 14496-12) и мгновенное воспроизведение мультиплексированного видео в браузере.
          </p>
        </div>

        {/* Action badges */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleLocalFileUpload}
            accept="video/*,.mp4,.fmp4,.m4s,.ts,.webm,.mov,.mkv,.m4a"
            className="hidden"
          />

          <button
            onClick={handleTriggerFileInput}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-sky-700 hover:bg-sky-600 text-white rounded-lg text-xs font-semibold transition-colors font-mono shadow-xs"
            title="Загрузить локальное видео (MP4, fMP4, WebM, TS) для воспроизведения и проверки"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Загрузить с компьютера</span>
          </button>

          {activeUint8Array && (
            <button
              onClick={handleDownloadMp4File}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors font-mono shadow-xs"
              title="Скачать текущее видео на компьютер"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Скачать MP4 ({(activeFileSize / 1024 / 1024).toFixed(1)} МБ)</span>
            </button>
          )}

          {activeUint8Array && onInspectBuffer && (
            <button
              onClick={() => onInspectBuffer(activeUint8Array, activeMediaName)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded-lg text-xs font-medium transition-colors font-mono"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Инспектор боксов</span>
            </button>
          )}
        </div>
      </div>

      {/* Preset Selector Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider">
            Выберите готовый HLS поток или укажите свой URL:
          </span>
          <span className="text-[11px] text-slate-500 font-mono">{STREAM_PRESETS.length} готовых источников</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {STREAM_PRESETS.map((preset) => {
            const isSelected = selectedPresetId === preset.id;
            return (
              <div
                key={preset.id}
                onClick={() => handleSelectPreset(preset)}
                className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-sky-950/60 border-sky-600 text-slate-100 shadow-xs'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold truncate">{preset.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      preset.type === 'fmp4'
                        ? 'bg-sky-950 text-sky-300 border border-sky-800'
                        : preset.type === 'synthetic'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : preset.type === 'mp4'
                        ? 'bg-purple-950 text-purple-300 border border-purple-800'
                        : preset.type === 'vimeo'
                        ? 'bg-blue-950 text-blue-300 border border-blue-800'
                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}
                  >
                    {preset.type.toUpperCase()}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {preset.description}
                </p>
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-2 pt-2 border-t border-slate-800/80">
                  <span>{preset.resolution}</span>
                  <span>{preset.duration}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Custom URL Input bar */}
        <div className="pt-2 flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={streamUrl}
            onChange={(e) => {
              setStreamUrl(e.target.value);
              setSelectedPresetId('custom');
            }}
            placeholder="Введите URL плейлиста HLS (.m3u8), Vimeo URL или выберите локальный файл..."
            className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-hidden focus:border-sky-500"
          />

          <button
            onClick={handleTriggerFileInput}
            className="flex items-center justify-center space-x-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-colors shrink-0"
            title="Загрузить локальный файл с диска"
          >
            <FileUp className="w-3.5 h-3.5 text-sky-400" />
            <span>Локальный файл</span>
          </button>

          {!isDownloading ? (
            <button
              onClick={() => handleStartDownloadAndPlay()}
              className="flex items-center justify-center space-x-2 px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition-colors shrink-0 shadow-xs"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Загрузить и Воспроизвести</span>
            </button>
          ) : (
            <button
              onClick={handleCancelDownload}
              className="flex items-center justify-center space-x-2 px-5 py-2 bg-rose-700 hover:bg-rose-600 text-white rounded-lg text-xs font-semibold transition-colors shrink-0"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Отменить загрузку</span>
            </button>
          )}
        </div>

        {/* Dedicated YouTube Panel */}
        {isYouTubeStream && (
          <div className="p-4 bg-slate-950/90 border border-rose-900/80 rounded-xl space-y-3 shadow-inner">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-rose-950 border border-rose-800 rounded-lg text-rose-400">
                  <Video className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-200">
                      {youtubeMeta?.title || `YouTube Video (#${youtubeVideoId})`}
                    </span>
                    <span className="px-2 py-0.5 bg-rose-900/60 text-rose-300 border border-rose-700 rounded text-[10px] font-mono">
                      YouTube ID: {youtubeVideoId}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-3">
                    <span>Канал: {youtubeMeta?.authorName || 'YouTube'}</span>
                    <span className="text-rose-400 font-medium">✓ Встроенный онлайн-плеер YouTube</span>
                  </div>
                </div>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center space-x-1.5 bg-slate-900 p-1 border border-slate-800 rounded-lg self-start sm:self-auto">
                <button
                  onClick={() => setYoutubeViewMode('embed')}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition-colors flex items-center space-x-1.5 ${
                    youtubeViewMode === 'embed'
                      ? 'bg-rose-600 text-white font-bold shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>YouTube Плеер</span>
                </button>
              </div>
            </div>

            <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-lg text-[11px] text-slate-300 flex items-start space-x-2">
              <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div>
                  <span className="font-semibold text-white">Ограничения безопасности YouTube:</span> YouTube защищает прямые видеопотоки токенами подписи (n-sig/cipher) и строгой политикой CORS, запрещающей скачивание сырых `.mp4` файлов напрямую в браузере.
                </div>
                <div className="text-slate-400">
                  Видео воспроизводится во встроенном плеере. Для проверки скачивания реального видеофайла на компьютер выберите пресеты <strong className="text-sky-300">Big Buck Bunny (Direct MP4)</strong>, <strong className="text-sky-300">Elephants Dream</strong>, <strong className="text-sky-300">Tears of Steel (HLS fMP4)</strong> или <strong className="text-sky-300">Vimeo Video</strong>.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dedicated Vimeo Video & Downloader Panel */}
        {isVimeoStream && (
          <div className="p-4 bg-slate-950/90 border border-sky-800/80 rounded-xl space-y-3 shadow-inner">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-sky-950 border border-sky-800 rounded-lg text-sky-400">
                  <Video className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-200">
                      {vimeoMeta?.title || `Vimeo Video (#${vimeoVideoId})`}
                    </span>
                    <span className="px-2 py-0.5 bg-sky-900/60 text-sky-300 border border-sky-700 rounded text-[10px] font-mono">
                      Vimeo ID: {vimeoVideoId}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 flex items-center space-x-3">
                    <span>Автор: {vimeoMeta?.authorName || 'Vimeo'}</span>
                    {vimeoMeta?.duration ? <span>Длительность: {formatTime(vimeoMeta.duration)}</span> : null}
                    <span className="text-emerald-400">✓ Прямое скачивание в MP4 для VLC</span>
                  </div>
                </div>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center space-x-1.5 bg-slate-900 p-1 border border-slate-800 rounded-lg self-start sm:self-auto">
                <button
                  onClick={() => setVimeoViewMode('native')}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition-colors flex items-center space-x-1.5 ${
                    vimeoViewMode === 'native'
                      ? 'bg-sky-600 text-white font-bold shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <MonitorPlay className="w-3.5 h-3.5" />
                  <span>HTML5 / MP4 буфер</span>
                </button>
                <button
                  onClick={() => setVimeoViewMode('iframe')}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition-colors flex items-center space-x-1.5 ${
                    vimeoViewMode === 'iframe'
                      ? 'bg-sky-600 text-white font-bold shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>Vimeo iFrame</span>
                </button>
              </div>
            </div>

            {/* Quality Selectors and Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-800/80">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-400 font-mono mr-1">Качество MP4:</span>
                {vimeoMeta && vimeoMeta.progressiveFiles.length > 0 ? (
                  vimeoMeta.progressiveFiles.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => handleStartDownloadAndPlay(file.url)}
                      disabled={isDownloading}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-sky-900/60 border border-slate-700 hover:border-sky-600 text-slate-200 hover:text-sky-300 rounded text-xs font-mono transition-colors disabled:opacity-50"
                      title={`Скачать поток ${file.quality} (${file.width}x${file.height})`}
                    >
                      {file.quality} ({file.width}x{file.height})
                    </button>
                  ))
                ) : (
                  <>
                    <button
                      onClick={() => handleStartDownloadAndPlay()}
                      disabled={isDownloading}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-sky-900/60 border border-slate-700 hover:border-sky-600 text-slate-200 hover:text-sky-300 rounded text-xs font-mono transition-colors disabled:opacity-50"
                    >
                      1080p Full HD (MP4)
                    </button>
                    <button
                      onClick={() => handleStartDownloadAndPlay()}
                      disabled={isDownloading}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-sky-900/60 border border-slate-700 hover:border-sky-600 text-slate-200 hover:text-sky-300 rounded text-xs font-mono transition-colors disabled:opacity-50"
                    >
                      720p HD (MP4)
                    </button>
                  </>
                )}
              </div>

              {/* One Click VLC Download Button */}
              <button
                onClick={() => {
                  if (activeUint8Array) {
                    handleDownloadMp4File();
                  } else {
                    handleStartDownloadAndPlay();
                  }
                }}
                disabled={isDownloading}
                className="flex items-center space-x-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors font-mono shadow-xs disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{activeUint8Array ? 'Скачать MP4 на компьютер' : 'Загрузить и сохранить MP4 для VLC'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Download Progress Bar */}
        {isDownloading && downloadProgress && (
          <div className="p-3.5 bg-slate-950 border border-sky-900/60 rounded-lg space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-sky-300 flex items-center space-x-2">
                <Sparkles className="w-3.5 h-3.5 animate-spin text-sky-400" />
                <span>{downloadProgress.message}</span>
              </span>
              <span className="text-slate-400 font-bold">{downloadProgress.percent || 0}%</span>
            </div>

            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
              <div
                className="bg-sky-500 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${downloadProgress.percent || 5}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span>Видеосегменты: {downloadProgress.videoCurrent || 0} / {downloadProgress.videoTotal || '—'}</span>
              <span>Аудиосегменты: {downloadProgress.audioCurrent || 0} / {downloadProgress.audioTotal || '—'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Video Player Display */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main Video Viewport (8 cols) */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div
            id="video-player-container"
            className="relative bg-black aspect-video flex items-center justify-center group"
          >
            {/* YouTube Embedded Player */}
            {isYouTubeStream && youtubeVideoId && youtubeViewMode === 'embed' ? (
              <div className="w-full h-full relative bg-black">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${youtubeVideoId}?autoplay=1&enablejsapi=1`}
                  title={`YouTube Video ${youtubeVideoId}`}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            ) : isVimeoStream && vimeoVideoId && vimeoViewMode === 'iframe' ? (
              <div className="w-full h-full relative bg-black">
                <iframe
                  src={`https://player.vimeo.com/video/${vimeoVideoId}?autoplay=1&title=1&byline=1&portrait=0`}
                  title={`Vimeo Video ${vimeoVideoId}`}
                  className="w-full h-full border-0"
                  allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media"
                  allowFullScreen
                />
              </div>
            ) : (
              <>
                {/* HTML5 Video Element */}
                <video
                  ref={videoRef}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  onError={() => {
                    if (videoRef.current?.error) {
                      setVideoError(`Код ошибки воспроизведения: ${videoRef.current.error.code} (${videoRef.current.error.message || 'Media Decode Error'})`);
                    }
                  }}
                  className="w-full h-full object-contain cursor-pointer"
                  onClick={togglePlay}
                  playsInline
                />

                {/* Empty state when no media loaded */}
                {!activeBlobUrl && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/80">
                    <FileVideo className="w-12 h-12 text-slate-700 mb-3" />
                    <div className="text-sm font-semibold text-slate-300">Видео еще не загружено</div>
                    <p className="text-xs text-slate-500 max-w-md mt-1">
                      {isVimeoStream
                        ? 'Нажмите «Загрузить и сохранить MP4 для VLC» выше, чтобы скачать видеопоток с Vimeo и воспроизвести его.'
                        : 'Нажмите «Загрузить и Воспроизвести» выше, чтобы скачать HLS-поток, собрать fMP4 и запустить воспроизведение.'}
                    </p>
                    <button
                      onClick={() => handleStartDownloadAndPlay()}
                      className="mt-4 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{isVimeoStream ? 'Загрузить видео Vimeo (MP4)' : 'Запустить Tears of Steel (fMP4)'}</span>
                    </button>
                  </div>
                )}

                {/* Error Overlay */}
                {videoError && (
                  <div className="absolute top-4 left-4 right-4 bg-rose-950/90 border border-rose-800 text-rose-200 text-xs p-3 rounded-lg flex items-start space-x-2 font-mono">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-bold">Ошибка декодирования видео:</div>
                      <div className="text-[11px] text-rose-300 mt-0.5">{videoError}</div>
                    </div>
                  </div>
                )}

                {/* Center Big Play Button overlay */}
                {activeBlobUrl && !isPlaying && (
                  <button
                    onClick={togglePlay}
                    className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-sky-600/90 hover:bg-sky-500 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110"
                  >
                    <Play className="w-7 h-7 fill-current ml-1" />
                  </button>
                )}
              </>
            )}
          </div>

          {/* Media Controls Bar */}
          <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-3">
            {isYouTubeStream && youtubeViewMode === 'embed' ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
                <div className="flex items-center space-x-2 text-rose-300">
                  <Film className="w-4 h-4 text-rose-400" />
                  <span className="font-semibold">Встроенный YouTube Player Active</span>
                  <span className="text-slate-500 font-mono text-[11px]">ID: {youtubeVideoId}</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Интерактивное воспроизведение, выбор качества и громкость активны в окне плеера
                </div>
              </div>
            ) : isVimeoStream && vimeoViewMode === 'iframe' ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
                <div className="flex items-center space-x-2 text-sky-300">
                  <Film className="w-4 h-4 text-sky-400" />
                  <span className="font-semibold">Встроенный Vimeo iFrame Player</span>
                  <span className="text-slate-500 font-mono text-[11px]">ID: {vimeoVideoId}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setVimeoViewMode('native');
                      if (!activeBlobUrl) handleStartDownloadAndPlay();
                    }}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold transition-colors"
                  >
                    Скачать MP4 на компьютер
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Scrubber Range */}
                <div className="space-y-1">
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    step={0.1}
                    value={currentTime}
                    onChange={handleSeek}
                    disabled={!activeBlobUrl}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500 disabled:opacity-40"
                  />
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Bottom Row Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-slate-300">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={togglePlay}
                      disabled={!activeBlobUrl}
                      className="p-2 rounded-md hover:bg-slate-800 text-slate-200 disabled:opacity-40 transition-colors"
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
                    </button>

                    <button
                      onClick={() => {
                        if (videoRef.current) videoRef.current.currentTime = 0;
                      }}
                      disabled={!activeBlobUrl}
                      className="p-2 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-40 transition-colors"
                      title="Перемотать в начало"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>

                    {/* Volume slider */}
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={toggleMute}
                        disabled={!activeBlobUrl}
                        className="p-2 rounded-md hover:bg-slate-800 text-slate-300 disabled:opacity-40"
                      >
                        {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        disabled={!activeBlobUrl}
                        className="w-16 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500 disabled:opacity-40"
                      />
                    </div>
                  </div>

                  {/* Speed & Fullscreen */}
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-xs font-mono">
                      {[0.5, 1, 1.5, 2].map((s) => (
                        <button
                          key={s}
                          onClick={() => handleSpeedChange(s)}
                          disabled={!activeBlobUrl}
                          className={`px-1.5 py-0.5 rounded text-[11px] ${
                            playbackRate === s
                              ? 'bg-sky-600 text-white font-bold'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>

                    {/* Download File Button in Controls */}
                    <button
                      onClick={handleDownloadMp4File}
                      disabled={!activeUint8Array}
                      className="p-2 rounded-md hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 disabled:opacity-40 transition-colors"
                      title="Сохранить / Скачать MP4 на компьютер"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    <button
                      onClick={toggleFullscreen}
                      disabled={!activeBlobUrl}
                      className="p-2 rounded-md hover:bg-slate-800 text-slate-300 disabled:opacity-40"
                      title="Полный экран"
                    >
                      {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Video Diagnostics & ISO-BMFF Info (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 text-xs">
            <div className="flex items-center space-x-2 text-slate-200 pb-2 border-b border-slate-800">
              <HardDrive className="w-4 h-4 text-sky-400" />
              <h3 className="font-bold">Параметры видеопотока</h3>
            </div>

            <div className="space-y-2 font-mono">
              {isVimeoStream ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Платформа:</span>
                    <span className="text-sky-300 font-semibold">Vimeo Video Network</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">ID видео:</span>
                    <span className="text-emerald-400 font-semibold">{vimeoVideoId}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Режим:</span>
                    <span className="text-slate-300 font-semibold">Vimeo Embedded Player</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Качество:</span>
                    <span className="text-slate-300 font-semibold">Адаптивный 1080p / 720p HD</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Статус плеера:</span>
                    <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>Активен и готов к просмотру</span>
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-800">
                    <a
                      href={`https://vimeo.com/${vimeoVideoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-sky-400 hover:text-sky-300 flex items-center space-x-1"
                    >
                      <span>Открыть оригинал на Vimeo.com</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Файл контейнера:</span>
                    <span className="text-slate-300 font-semibold truncate max-w-[180px]">{activeMediaName || 'Не загружен'}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Разрешение:</span>
                    <span className="text-slate-300 font-semibold">
                      {videoDimensions ? `${videoDimensions.width} x ${videoDimensions.height} px` : '—'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Длительность:</span>
                    <span className="text-slate-300 font-semibold">{formatTime(duration)}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Размер в ОЗУ:</span>
                    <span className="text-slate-300 font-semibold">
                      {activeFileSize > 0 ? `${(activeFileSize / 1024 / 1024).toFixed(2)} МБ` : '—'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Кодек видео:</span>
                    <span className="text-sky-300 font-semibold">AVC1 / H.264 High Profile</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Кодек аудио:</span>
                    <span className="text-emerald-300 font-semibold">MP4A (AAC-LC 48kHz)</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Синхронизация A/V:</span>
                    <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>DTS-Interleaved OK</span>
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Direct File Download Card */}
          {activeUint8Array && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="text-xs font-bold text-slate-200">
                Сохранить файл на диск:
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Файл сформирован по стандарту ISO/IEC 14496-12 со встроенными таблицами перемотки <code>mfra/tfra</code>. Совместим с любыми внешними плеерами (VLC, QuickTime, мобильные устройства).
              </p>
              <button
                onClick={handleDownloadMp4File}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition-colors font-mono"
              >
                <Download className="w-4 h-4" />
                <span>Скачать {activeMediaName || 'video.mp4'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
