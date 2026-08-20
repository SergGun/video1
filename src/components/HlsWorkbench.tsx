import React, { useState, useMemo } from 'react';
import { parseMasterPlaylist, parseMediaPlaylist, MasterPlaylistParsed, MediaPlaylistParsed } from '../lib/hlsHardened';
import { SAMPLE_HLS_MASTER, SAMPLE_HLS_MEDIA_FMP4, SAMPLE_HLS_MEDIA_TS } from '../lib/sampleGenerators';
import { Terminal, Play, ShieldAlert, CheckCircle2, AlertTriangle, Radio, Film, Music, Clock, Copy, Check } from 'lucide-react';

export const HlsWorkbench: React.FC = () => {
  const [manifestText, setManifestText] = useState<string>(SAMPLE_HLS_MASTER);
  const [baseUrl, setBaseUrl] = useState<string>('https://cdn.example.com/hls/master.m3u8');
  const [copied, setCopied] = useState<boolean>(false);

  const masterResult = useMemo<MasterPlaylistParsed>(() => {
    try {
      return parseMasterPlaylist(manifestText, baseUrl);
    } catch {
      return { isMaster: false, isEncrypted: false, encryptionMethod: null, variants: [], audioTracks: [] };
    }
  }, [manifestText, baseUrl]);

  const mediaResult = useMemo<MediaPlaylistParsed>(() => {
    try {
      return parseMediaPlaylist(manifestText, baseUrl);
    } catch {
      return {
        isEncrypted: false,
        encryptionMethod: null,
        hasDiscontinuity: false,
        initUrl: null,
        initByteRange: null,
        targetDuration: 0,
        totalDuration: 0,
        segments: [],
        isFmp4: false,
        isTs: false
      };
    }
  }, [manifestText, baseUrl]);

  const isMaster = masterResult.isMaster;

  const handleCopy = () => {
    navigator.clipboard.writeText(manifestText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div>
          <div className="flex items-center space-x-2 text-sky-400 text-xs font-mono mb-1">
            <Radio className="w-4 h-4" />
            <span>RFC 8216 HLS Manifest Validator & Inspector</span>
          </div>
          <h1 className="text-xl font-bold text-slate-100">
            Парсер и верификатор плейлистов HLS
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Проверка Master и Media плейлистов, валидация тегов EXT-X-MAP, EXT-X-BYTERANGE, раздельных аудиодорожек и кодеков.
          </p>
        </div>

        {/* Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setManifestText(SAMPLE_HLS_MASTER);
              setBaseUrl('https://cdn.example.com/hls/master.m3u8');
            }}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-medium transition-colors"
          >
            Master Playlist (VOD)
          </button>

          <button
            onClick={() => {
              setManifestText(SAMPLE_HLS_MEDIA_FMP4);
              setBaseUrl('https://cdn.example.com/hls/1080p/prog_index.m3u8');
            }}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-medium transition-colors"
          >
            fMP4 Media Playlist
          </button>

          <button
            onClick={() => {
              setManifestText(SAMPLE_HLS_MEDIA_TS);
              setBaseUrl('https://cdn.example.com/hls/ts/prog_index.m3u8');
            }}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-medium transition-colors"
          >
            TS Media Playlist
          </button>
        </div>
      </div>

      {/* Main 2-column workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left column: Manifest Editor (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
              Текст манифеста M3U8
            </h3>
            <button
              onClick={handleCopy}
              className="flex items-center space-x-1 text-xs text-slate-400 hover:text-slate-200 font-mono"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Скопировано' : 'Копировать'}</span>
            </button>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 font-mono block mb-1">
              Базовый URL (Base URL для резолва относительных путей)
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:outline-hidden focus:border-sky-500"
            />
          </div>

          <textarea
            value={manifestText}
            onChange={(e) => setManifestText(e.target.value)}
            rows={18}
            className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 leading-relaxed focus:outline-hidden focus:border-sky-500 resize-y"
            placeholder="#EXTM3U..."
          />
        </div>

        {/* Right column: Parsed Diagnostics & Inspector (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Status summary banner */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <span className="text-xs px-2.5 py-0.5 rounded font-mono font-bold bg-sky-950 border border-sky-800 text-sky-300">
                  {isMaster ? 'MASTER PLAYLIST' : 'MEDIA PLAYLIST'}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {isMaster ? `${masterResult.variants.length} вариантов видео` : `${mediaResult.segments.length} сегментов`}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                {(isMaster ? masterResult.isEncrypted : mediaResult.isEncrypted) ? (
                  <span className="text-xs px-2 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300 font-mono">
                    DRM / Encrypted
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 font-mono">
                    Clear (Unencrypted)
                  </span>
                )}
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-950 rounded border border-slate-800">
                <div className="text-slate-500 font-mono text-[10px]">Формат контейнера</div>
                <div className="font-mono font-bold text-slate-200 mt-0.5">
                  {isMaster ? 'Adaptive HLS' : mediaResult.isFmp4 ? 'fMP4 (ISO-BMFF)' : 'MPEG-2 TS'}
                </div>
              </div>
              <div className="p-3 bg-slate-950 rounded border border-slate-800">
                <div className="text-slate-500 font-mono text-[10px]">Длительность</div>
                <div className="font-mono font-bold text-slate-200 mt-0.5">
                  {isMaster ? '—' : `${mediaResult.totalDuration.toFixed(2)} сек`}
                </div>
              </div>
              <div className="p-3 bg-slate-950 rounded border border-slate-800">
                <div className="text-slate-500 font-mono text-[10px]">Target Duration</div>
                <div className="font-mono font-bold text-slate-200 mt-0.5">
                  {isMaster ? '—' : `${mediaResult.targetDuration} сек`}
                </div>
              </div>
              <div className="p-3 bg-slate-950 rounded border border-slate-800">
                <div className="text-slate-500 font-mono text-[10px]">Discontinuity</div>
                <div className="font-mono font-bold text-slate-200 mt-0.5">
                  {mediaResult.hasDiscontinuity ? 'Обнаружены' : 'Нет'}
                </div>
              </div>
            </div>
          </div>

          {/* Master Playlist Variant Matrix */}
          {isMaster && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center space-x-2 text-slate-200">
                <Film className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-bold">Таблица вариантов потока (Video Variants)</h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 font-mono text-[11px]">
                      <th className="pb-2">Качество</th>
                      <th className="pb-2">Разрешение</th>
                      <th className="pb-2">Битрейт</th>
                      <th className="pb-2">Кодеки</th>
                      <th className="pb-2">Аудио</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {masterResult.variants.map((v, i) => (
                      <tr key={i} className="hover:bg-slate-800/40">
                        <td className="py-2 text-sky-300 font-semibold">{v.qualityLabel}</td>
                        <td className="py-2 text-slate-300">{v.resolution || 'Auto'}</td>
                        <td className="py-2 text-slate-300">{(v.bandwidth / 1000000).toFixed(2)} Мбит/с</td>
                        <td className="py-2 text-slate-400">{v.codecs || '—'}</td>
                        <td className="py-2 text-slate-400">{v.audioGroupId || 'Встроенное'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Audio Renditions */}
              {masterResult.audioTracks.length > 0 && (
                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <div className="flex items-center space-x-2 text-slate-200">
                    <Music className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider font-mono">
                      Аудиодорожки (Audio Renditions)
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {masterResult.audioTracks.map((a, i) => (
                      <div key={i} className="p-2.5 bg-slate-950 rounded border border-slate-800 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-200">{a.name} ({a.language || 'und'})</span>
                          {a.isDefault && <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-800">По умолчанию</span>}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-1 truncate">
                          URI: {a.uri || 'Мультиплексировано в видео'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Media Playlist Segments List */}
          {!isMaster && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-slate-200">
                  <Clock className="w-4 h-4 text-sky-400" />
                  <h3 className="text-sm font-bold">Сегменты медиа-плейлиста</h3>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {mediaResult.segments.length} сегментов
                </span>
              </div>

              {mediaResult.initUrl && (
                <div className="p-3 bg-sky-950/40 border border-sky-900/60 rounded-lg text-xs font-mono space-y-1">
                  <div className="text-sky-400 font-bold">EXT-X-MAP Инициализационный заголовок:</div>
                  <div className="text-slate-300 truncate">URL: {mediaResult.initUrl}</div>
                  {mediaResult.initByteRange && (
                    <div className="text-slate-400 text-[11px]">
                      Диапазон: {mediaResult.initByteRange.length} байт @ смещение {mediaResult.initByteRange.offset}
                    </div>
                  )}
                </div>
              )}

              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                {mediaResult.segments.map((seg, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-slate-950 rounded border border-slate-800/80 flex items-center justify-between text-xs font-mono"
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span className="text-slate-500 w-6 text-right">#{idx + 1}</span>
                      <span className="text-slate-300 truncate">{seg.url}</span>
                    </div>

                    <div className="flex items-center space-x-3 shrink-0 text-[11px]">
                      {seg.byteRange && (
                        <span className="text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/60">
                          {seg.byteRange.length} Б @ {seg.byteRange.offset}
                        </span>
                      )}
                      <span className="text-sky-400">{seg.duration.toFixed(2)}s</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
