import React, { useState, useEffect, useMemo } from 'react';
import { IsoBoxNode, parseBoxes } from '../lib/hlsHardened';
import {
  generateSyntheticInitSegment,
  generateSyntheticMediaSegment
} from '../lib/sampleGenerators';
import { Layers, FileUp, Sparkles, ChevronRight, ChevronDown, Binary, Clock, FileText, Info, Play } from 'lucide-react';

interface BoxInspectorProps {
  onPlayInPlayer?: (buffer: Uint8Array, name: string) => void;
  initialBuffer?: Uint8Array | null;
  initialBufferName?: string;
}

export const BoxInspector: React.FC<BoxInspectorProps> = ({
  onPlayInPlayer,
  initialBuffer,
  initialBufferName
}) => {
  const [currentBuffer, setCurrentBuffer] = useState<Uint8Array | null>(null);
  const [bufferName, setBufferName] = useState<string>('Synthetic fMP4 Init + Media');
  const [selectedBox, setSelectedBox] = useState<IsoBoxNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [hexPage, setHexPage] = useState<number>(0);

  // Generate default combined fMP4 buffer or use initialBuffer
  useEffect(() => {
    if (initialBuffer && initialBuffer.length > 0) {
      setCurrentBuffer(initialBuffer);
      setBufferName(initialBufferName || 'Медиа буфер');
      setSelectedBox(null);
      setHexPage(0);
    } else {
      loadCombinedSample();
    }
  }, [initialBuffer, initialBufferName]);

  const loadCombinedSample = () => {
    const init = generateSyntheticInitSegment({ trackId: 1, handlerType: 'vide' });
    const seg1 = generateSyntheticMediaSegment({ trackId: 1, sequenceNumber: 1, baseDecodeTime: 0, sampleCount: 8 });
    const seg2 = generateSyntheticMediaSegment({ trackId: 1, sequenceNumber: 2, baseDecodeTime: 24000, sampleCount: 8 });

    const combined = new Uint8Array(init.length + seg1.length + seg2.length);
    combined.set(init, 0);
    combined.set(seg1, init.length);
    combined.set(seg2, init.length + seg1.length);

    setCurrentBuffer(combined);
    setBufferName('fMP4 Комплексный поток (Init + Segments 1..2)');
    setSelectedBox(null);
    setHexPage(0);
  };

  const loadInitSample = (type: 'vide' | 'soun') => {
    const init = generateSyntheticInitSegment({ trackId: type === 'vide' ? 1 : 2, handlerType: type });
    setCurrentBuffer(init);
    setBufferName(`Инициализационный сегмент (${type === 'vide' ? 'Видео avc1' : 'Аудио mp4a'})`);
    setSelectedBox(null);
    setHexPage(0);
  };

  const loadMediaSegmentSample = () => {
    const seg = generateSyntheticMediaSegment({ trackId: 1, sequenceNumber: 1, baseDecodeTime: 0, sampleCount: 12 });
    setCurrentBuffer(seg);
    setBufferName('Медиа-сегмент fMP4 (moof + mdat с ключевыми кадрами)');
    setSelectedBox(null);
    setHexPage(0);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result instanceof ArrayBuffer) {
        const buf = new Uint8Array(event.target.result);
        setCurrentBuffer(buf);
        setBufferName(file.name);
        setSelectedBox(null);
        setHexPage(0);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const parsedTree = useMemo(() => {
    if (!currentBuffer || currentBuffer.length === 0) return [];
    try {
      return parseBoxes(currentBuffer, 0, 0, currentBuffer.length, true);
    } catch (e: any) {
      console.error('Box parse error:', e);
      return [];
    }
  }, [currentBuffer]);

  const toggleExpand = (path: string) => {
    setExpandedNodes((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  // Hex dump rendering for selected box or entire buffer
  const HEX_BYTES_PER_ROW = 16;
  const HEX_ROWS_PER_PAGE = 32;
  const HEX_PAGE_SIZE = HEX_BYTES_PER_ROW * HEX_ROWS_PER_PAGE;

  const hexTargetData = useMemo(() => {
    if (selectedBox) {
      return {
        data: selectedBox.data,
        startOffset: selectedBox.absOffset,
        totalLen: selectedBox.size
      };
    }
    if (currentBuffer) {
      return {
        data: currentBuffer,
        startOffset: 0,
        totalLen: currentBuffer.length
      };
    }
    return null;
  }, [selectedBox, currentBuffer]);

  const hexPageData = useMemo(() => {
    if (!hexTargetData) return [];
    const offsetStart = hexPage * HEX_PAGE_SIZE;
    const offsetEnd = Math.min(offsetStart + HEX_PAGE_SIZE, hexTargetData.data.length);
    const slice = hexTargetData.data.subarray(offsetStart, offsetEnd);

    const rows: { offset: number; hex: string[]; ascii: string }[] = [];
    for (let i = 0; i < slice.length; i += HEX_BYTES_PER_ROW) {
      const rowSlice = slice.subarray(i, Math.min(i + HEX_BYTES_PER_ROW, slice.length));
      const hex: string[] = [];
      let ascii = '';
      for (let b = 0; b < rowSlice.length; b++) {
        const val = rowSlice[b];
        hex.push(val.toString(16).padStart(2, '0').toUpperCase());
        ascii += val >= 32 && val <= 126 ? String.fromCharCode(val) : '·';
      }
      rows.push({
        offset: hexTargetData.startOffset + offsetStart + i,
        hex,
        ascii
      });
    }
    return rows;
  }, [hexTargetData, hexPage]);

  const totalHexPages = hexTargetData ? Math.ceil(hexTargetData.data.length / HEX_PAGE_SIZE) : 1;

  // Recursive tree renderer
  const renderBoxNode = (node: IsoBoxNode, path: string, depth = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes[path] ?? (depth < 2);
    const isSelected = selectedBox?.absOffset === node.absOffset && selectedBox?.type === node.type;

    return (
      <div key={path} className="select-none">
        <div
          onClick={() => setSelectedBox(node)}
          className={`flex items-center justify-between py-1.5 px-2 rounded-md text-xs cursor-pointer transition-colors ${
            isSelected
              ? 'bg-sky-950 border border-sky-700 text-sky-200'
              : 'hover:bg-slate-800/80 text-slate-300'
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          <div className="flex items-center space-x-2">
            {hasChildren ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(path);
                }}
                className="p-0.5 hover:bg-slate-700 rounded text-slate-400"
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <div className="w-3.5 h-3.5 flex items-center justify-center text-slate-600">•</div>
            )}
            <span className="font-mono font-bold text-sky-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
              {node.type}
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              {node.size.toLocaleString()} Б
            </span>
          </div>

          <div className="text-[10px] text-slate-500 font-mono">
            Смещение: {node.absOffset}
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="border-l border-slate-800/80 ml-4 my-0.5">
            {node.children!.map((child, idx) =>
              renderBoxNode(child, `${path}/${child.type}[${idx}]`, depth + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Header & Preset controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div>
          <div className="flex items-center space-x-2 text-sky-400 text-xs font-mono mb-1">
            <Layers className="w-4 h-4" />
            <span>ISO/IEC 14496-12 Structure Analyzer</span>
          </div>
          <h1 className="text-xl font-bold text-slate-100">
            Инспектор структуры боксов ISO-BMFF (fMP4)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Текущий буфер:{' '}
            <span className="font-mono text-slate-200 font-semibold">{bufferName}</span>{' '}
            ({currentBuffer ? `${currentBuffer.length.toLocaleString()} байт` : '0 байт'})
          </p>
        </div>

        {/* Action presets */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadCombinedSample}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-medium transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>Комплексный fMP4</span>
          </button>

          <button
            onClick={() => loadInitSample('vide')}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded text-xs font-medium transition-colors"
          >
            Video Init (avc1)
          </button>

          <button
            onClick={loadMediaSegmentSample}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded text-xs font-medium transition-colors"
          >
            moof + mdat
          </button>

          {currentBuffer && onPlayInPlayer && (
            <button
              onClick={() => onPlayInPlayer(currentBuffer, bufferName)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold transition-colors shadow-xs"
              title="Открыть этот медиа-буфер в плеере"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Воспроизвести в плеере</span>
            </button>
          )}

          <label className="flex items-center space-x-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-medium cursor-pointer transition-colors">
            <FileUp className="w-3.5 h-3.5" />
            <span>Загрузить MP4/M4S</span>
            <input
              type="file"
              accept=".mp4,.m4s,.ts,.mov"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Main Grid: Tree (4 cols), Details & Hex (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Box Tree Viewer */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs text-slate-400 font-mono">
            <span>Иерархия боксов</span>
            <span>{parsedTree.length} корневых боксов</span>
          </div>

          <div className="max-h-[580px] overflow-y-auto space-y-1 pr-1">
            {parsedTree.map((box, idx) => renderBoxNode(box, `${box.type}[${idx}]`))}

            {parsedTree.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-500">
                Нет данных для отображения. Загрузите файл или выберите пресет.
              </div>
            )}
          </div>
        </div>

        {/* Selected Box Details & Hex Viewer */}
        <div className="lg:col-span-7 space-y-6">
          {/* Metadata Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded bg-slate-950 border border-slate-800 flex items-center justify-center font-mono font-bold text-sky-400 text-sm">
                  {selectedBox ? selectedBox.type : 'fMP4'}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    {selectedBox ? `Бокс ${selectedBox.type}` : 'Сводка по контейнеру'}
                  </h3>
                  <div className="text-xs text-slate-400 font-mono">
                    {selectedBox
                      ? `Абсолютное смещение: ${selectedBox.absOffset} • Размер: ${selectedBox.size} Б`
                      : 'Выберите любой бокс в дереве слева для детального анализа'}
                  </div>
                </div>
              </div>

              {selectedBox && (
                <button
                  onClick={() => setSelectedBox(null)}
                  className="text-xs text-slate-400 hover:text-slate-200 font-mono"
                >
                  Сбросить выбор
                </button>
              )}
            </div>

            {selectedBox ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
                  <div className="text-slate-500 font-mono text-[10px]">Тип (FourCC)</div>
                  <div className="font-mono font-bold text-sky-400 text-sm">{selectedBox.type}</div>
                </div>
                <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
                  <div className="text-slate-500 font-mono text-[10px]">Размер бокса</div>
                  <div className="font-mono font-bold text-slate-200">{selectedBox.size} байт</div>
                </div>
                <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
                  <div className="text-slate-500 font-mono text-[10px]">Размер заголовка</div>
                  <div className="font-mono font-bold text-slate-200">{selectedBox.headerSize} байт</div>
                </div>
                <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
                  <div className="text-slate-500 font-mono text-[10px]">Размер полезной нагрузки</div>
                  <div className="font-mono font-bold text-slate-200">{selectedBox.size - selectedBox.headerSize} байт</div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-950 rounded border border-slate-800 text-xs text-slate-400 space-y-2">
                <div className="flex items-center space-x-2 text-sky-400 font-medium">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>Стандарт ISO/IEC 14496-12 (ISO Base Media File Format)</span>
                </div>
                <p className="leading-relaxed">
                  Фрагментированный MP4 состоит из начального блока инициализации (<code className="text-sky-300 font-mono">ftyp</code>, <code className="text-sky-300 font-mono">moov</code>)
                  и серии автономных сегментов воспроизведения (<code className="text-sky-300 font-mono">moof</code> + <code className="text-sky-300 font-mono">mdat</code>). В конце файла располагается
                  индекс произвольного доступа (<code className="text-sky-300 font-mono">mfra</code> / <code className="text-sky-300 font-mono">tfra</code> / <code className="text-sky-300 font-mono">mfro</code>) для мгновенной перемотки.
                </p>
              </div>
            )}
          </div>

          {/* Hex Dump Viewer */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-2 text-xs font-mono text-slate-300">
                <Binary className="w-4 h-4 text-emerald-400" />
                <span>Hex Dump Viewer</span>
                <span className="text-slate-500">
                  ({hexTargetData?.totalLen.toLocaleString()} байт)
                </span>
              </div>

              {totalHexPages > 1 && (
                <div className="flex items-center space-x-2 text-xs font-mono">
                  <button
                    disabled={hexPage === 0}
                    onClick={() => setHexPage((p) => Math.max(0, p - 1))}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded text-slate-300"
                  >
                    Назад
                  </button>
                  <span className="text-slate-400">
                    {hexPage + 1} / {totalHexPages}
                  </span>
                  <button
                    disabled={hexPage >= totalHexPages - 1}
                    onClick={() => setHexPage((p) => Math.min(totalHexPages - 1, p + 1))}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded text-slate-300"
                  >
                    Вперед
                  </button>
                </div>
              )}
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] leading-relaxed overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-slate-600 text-left border-b border-slate-800/80">
                    <th className="pb-1 w-24">Смещение</th>
                    <th className="pb-1">Байты (HEX)</th>
                    <th className="pb-1 w-40">ASCII</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60">
                  {hexPageData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/50">
                      <td className="text-slate-500 py-0.5">{row.offset.toString(16).padStart(8, '0').toUpperCase()}</td>
                      <td className="text-sky-300 py-0.5 tracking-wider">{row.hex.join(' ')}</td>
                      <td className="text-slate-400 py-0.5 font-mono">{row.ascii}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {hexPageData.length === 0 && (
                <div className="text-center py-6 text-slate-500">Нет данных для Hex отображения</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
