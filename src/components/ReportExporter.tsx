import React, { useState } from 'react';
import { AUDIT_PILLARS, AUDIT_FINDINGS, ARCHITECTURE_STRENGTHS } from '../audit/auditData';
import { Download, Copy, Check, FileText, Printer, FileSpreadsheet } from 'lucide-react';

export const ReportExporter: React.FC = () => {
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  const generateMarkdownReport = (): string => {
    let md = `# ПОЛНЫЙ ЭКСПЕРТНЫЙ АУДИТ КОДА: HLS & fMP4 MULTIPLEXER (ISO/IEC 14496-12 & RFC 8216)\n\n`;
    md += `**Дата проведения аудита:** ${new Date().toISOString().split('T')[0]}\n`;
    md += `**Объект аудита:** Pure JavaScript HLS Master/Media Parser, Fragment Downloader, Seekable fMP4 Multiplexer\n`;
    md += `**Статус:** Выявлено 2 критических дефекта, 2 проблемы высокого приоритета, 3 среднего и 3 низкого/оптимизационного уровня.\n\n`;

    md += `---\n\n## 1. СВОДНАЯ ОЦЕНКА ПО НАПРАВЛЕНИЯМ (SCORECARDS)\n\n`;
    md += `| Направление аудита | Оценка | Грейд | Статус |\n`;
    md += `|---|---|---|---|\n`;
    AUDIT_PILLARS.forEach((p) => {
      md += `| ${p.pillarRu} | ${p.score}% | ${p.grade} | ${p.statusRu} |\n`;
    });
    md += `\n`;

    md += `## 2. СИЛЬНЫЕ СТОРОНЫ АРХИТЕКТУРЫ\n\n`;
    ARCHITECTURE_STRENGTHS.forEach((s, idx) => {
      md += `${idx + 1}. **${s.title}**: ${s.description}\n`;
    });
    md += `\n`;

    md += `## 3. ПОЛНЫЙ РЕЕСТР ВЫЯВЛЕННЫХ ДЕФЕКТОВ И УЯЗВИМОСТЕЙ\n\n`;
    AUDIT_FINDINGS.forEach((f) => {
      md += `### [${f.id}] ${f.titleRu} (${f.severity})\n\n`;
      md += `- **Категория:** ${f.categoryLabelRu}\n`;
      md += `- **Локализация в коде:** ${f.lines}\n`;
      md += `- **Влияние на систему (Impact):** ${f.impactRu}\n`;
      md += `- **Первопричина (Root Cause):** ${f.rootCauseRu}\n`;
      md += `- **Сценарий воспроизведения:** ${f.exploitRu}\n`;
      md += `- **Рекомендация инженера:** ${f.recommendationRu}\n\n`;
      md += `#### Фрагмент исправления:\n\`\`\`typescript\n${f.codeFixed}\n\`\`\`\n\n`;
      md += `---\n\n`;
    });

    md += `## 4. ИТОГОВЫЕ РЕКОМЕНДАЦИИ ПО ВНЕДРЕНИЮ В PRODUCTION\n\n`;
    md += `1. **Упорядочивание дорожек по времени (Time-Sorted Interleaving):** Заменить попарное чередование фрагментов на сквозную сортировку по \`startDtsSeconds\`.\n`;
    md += `2. **Защита от OOM при стриминге:** Перевести запись на потоковые интерфейсы (ReadableStream / FileSystem API) для сохранения файлов любого объема без перегрузки RAM.\n`;
    md += `3. **Сетевая надежность:** Внедрить \`AbortController\` для мгновенной отмены и \`retry backoff\` на случай микроразрывов связи.\n`;
    md += `4. **Строгий TypeScript:** Использовать типизированные структуры боксов ISO-BMFF и парсера RFC 8216.\n`;

    return md;
  };

  const handleCopyMarkdown = () => {
    const md = generateMarkdownReport();
    navigator.clipboard.writeText(md);
    setCopiedFormat('md');
    setTimeout(() => setCopiedFormat(null), 2000);
  };

  const handleDownloadMarkdown = () => {
    const md = generateMarkdownReport();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hls-fmp4-audit-report.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = () => {
    const json = JSON.stringify(
      {
        auditDate: new Date().toISOString(),
        scorecards: AUDIT_PILLARS,
        findings: AUDIT_FINDINGS,
        strengths: ARCHITECTURE_STRENGTHS
      },
      null,
      2
    );
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hls-fmp4-audit-report.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Export Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div>
          <h1 className="text-xl font-bold text-slate-100">
            Экспорт полного аудиторского отчета
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Сформирован структурированный отчет в форматах Markdown, JSON и версии для печати/PDF.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCopyMarkdown}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-medium transition-colors"
          >
            {copiedFormat === 'md' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copiedFormat === 'md' ? 'Скопировано!' : 'Копировать MD'}</span>
          </button>

          <button
            onClick={handleDownloadMarkdown}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Скачать Markdown</span>
          </button>

          <button
            onClick={handleDownloadJson}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-medium transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-sky-400" />
            <span>JSON</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-medium transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-slate-400" />
            <span>Печать / PDF</span>
          </button>
        </div>
      </div>

      {/* Printable Report Document Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 space-y-8 text-slate-300 print:bg-white print:text-black print:p-0 print:border-none">
        <div className="border-b border-slate-800 pb-6">
          <div className="text-xs font-mono text-sky-400 mb-1">AUDIT VERIFICATION REPORT</div>
          <h2 className="text-2xl font-bold text-slate-100 print:text-black">
            Экспертное заключение по коду HLS & fMP4 Multiplexer
          </h2>
          <div className="text-xs text-slate-400 mt-2 flex flex-wrap gap-4 font-mono">
            <span>Стандарты: ISO/IEC 14496-12:2020 • RFC 8216</span>
            <span>Язык: JavaScript (ES2022) / TypeScript</span>
            <span>Найдено замечаний: {AUDIT_FINDINGS.length}</span>
          </div>
        </div>

        {/* Pillars Table */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono print:text-black">
            1. Результаты оценки по ключевым направлениям
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 font-mono text-[11px]">
                  <th className="pb-2">Направление аудита</th>
                  <th className="pb-2">Оценка</th>
                  <th className="pb-2">Грейд</th>
                  <th className="pb-2">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {AUDIT_PILLARS.map((p, i) => (
                  <tr key={i} className="hover:bg-slate-800/30">
                    <td className="py-2 text-slate-200">{p.pillarRu}</td>
                    <td className="py-2 text-sky-300 font-bold">{p.score}%</td>
                    <td className="py-2">{p.grade}</td>
                    <td className="py-2 text-slate-400">{p.statusRu}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Findings List */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono print:text-black">
            2. Детализация выявленных проблем
          </h3>
          <div className="space-y-4">
            {AUDIT_FINDINGS.map((f) => (
              <div key={f.id} className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-rose-400">
                    [{f.id}] {f.titleRu}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">{f.lines}</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{f.summaryRu}</p>
                <div className="text-[11px] text-slate-400">
                  <strong className="text-slate-300">Рекомендация:</strong> {f.recommendationRu}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
