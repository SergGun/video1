import React, { useState } from 'react';
import { AUDIT_FINDINGS, AuditFinding } from '../audit/auditData';
import { ShieldAlert, AlertTriangle, Info, Copy, Check, Filter, Search, Terminal, ArrowRight } from 'lucide-react';

interface FindingsExplorerProps {
  selectedFindingId: string | null;
  onSelectFinding: (id: string) => void;
}

export const FindingsExplorer: React.FC<FindingsExplorerProps> = ({
  selectedFindingId,
  onSelectFinding
}) => {
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredFindings = AUDIT_FINDINGS.filter((f) => {
    const matchesSeverity = severityFilter === 'ALL' || f.severity === severityFilter;
    const matchesSearch =
      searchQuery === '' ||
      f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.titleRu.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.summaryRu.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSeverity && matchesSearch;
  });

  const activeFinding = AUDIT_FINDINGS.find((f) => f.id === selectedFindingId) || filteredFindings[0] || AUDIT_FINDINGS[0];

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-rose-950 border border-rose-800 text-rose-300';
      case 'HIGH':
        return 'bg-amber-950 border border-amber-800 text-amber-300';
      case 'MEDIUM':
        return 'bg-yellow-950 border border-yellow-800 text-yellow-300';
      default:
        return 'bg-slate-800 border border-slate-700 text-slate-300';
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
            Каталог уязвимостей, дефектов и рекомендаций
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Детальный технический разбор {AUDIT_FINDINGS.length} проблем с исходным кодом, первопричинами и готовыми патчами.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по багам..."
              className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-md text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-sky-500 w-44 sm:w-56"
            />
          </div>

          <div className="flex items-center space-x-1 bg-slate-900 border border-slate-800 p-1 rounded-md">
            {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-2 py-1 text-xs rounded font-mono transition-colors whitespace-nowrap ${
                  severityFilter === sev
                    ? 'bg-slate-800 text-sky-400 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main 2-Column Explorer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Finding List (4 cols) */}
        <div className="lg:col-span-4 space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
          {filteredFindings.map((f) => {
            const isSelected = activeFinding.id === f.id;
            return (
              <div
                key={f.id}
                onClick={() => onSelectFinding(f.id)}
                className={`p-3.5 rounded-lg border transition-all cursor-pointer text-left ${
                  isSelected
                    ? 'bg-slate-800/90 border-sky-600 shadow-sm'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[11px] px-1.5 py-0.5 rounded font-mono font-bold ${getSeverityBadge(f.severity)}`}>
                    {f.id} • {f.severity}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">{f.lines}</span>
                </div>
                <div className="text-xs font-semibold text-slate-200 line-clamp-1">
                  {f.titleRu}
                </div>
                <div className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                  {f.summaryRu}
                </div>
              </div>
            );
          })}

          {filteredFindings.length === 0 && (
            <div className="p-6 text-center text-xs text-slate-500 bg-slate-900 border border-slate-800 rounded-lg">
              По вашему запросу ничего не найдено.
            </div>
          )}
        </div>

        {/* Right Column: Detailed Breakdown & Diff (8 cols) */}
        {activeFinding && (
          <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
            {/* Header info */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center space-x-2">
                  <span className={`text-xs px-2.5 py-0.5 rounded font-mono font-bold ${getSeverityBadge(activeFinding.severity)}`}>
                    {activeFinding.id} • {activeFinding.severity}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700">
                    {activeFinding.categoryLabelRu}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {activeFinding.lines}
                  </span>
                </div>

                <button
                  onClick={() => handleCopyCode(activeFinding.codeFixed, activeFinding.id)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium border border-slate-700 transition-colors"
                >
                  {copiedId === activeFinding.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Патч скопирован!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Скопировать фикс</span>
                    </>
                  )}
                </button>
              </div>

              <h2 className="text-lg sm:text-xl font-bold text-slate-100 mt-2">
                {activeFinding.titleRu}
              </h2>
              <div className="text-xs text-slate-400 font-mono mt-0.5">
                {activeFinding.title}
              </div>
            </div>

            {/* Structured analysis cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3.5 bg-slate-950/80 rounded-lg border border-slate-800/80 space-y-1">
                <div className="text-[11px] font-semibold text-rose-400 flex items-center space-x-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Влияние на систему (Impact)</span>
                </div>
                <div className="text-xs text-slate-300 leading-relaxed">
                  {activeFinding.impactRu}
                </div>
              </div>

              <div className="p-3.5 bg-slate-950/80 rounded-lg border border-slate-800/80 space-y-1">
                <div className="text-[11px] font-semibold text-amber-400 flex items-center space-x-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Первопричина (Root Cause)</span>
                </div>
                <div className="text-xs text-slate-300 leading-relaxed">
                  {activeFinding.rootCauseRu}
                </div>
              </div>
            </div>

            {/* Detailed Description & Scenario */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                Полное описание дефекта
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-lg border border-slate-800">
                {activeFinding.summaryRu}
              </p>
            </div>

            <div className="p-3.5 bg-sky-950/30 border border-sky-900/60 rounded-lg space-y-1">
              <div className="text-[11px] font-semibold text-sky-400 font-mono flex items-center space-x-1.5">
                <Terminal className="w-3.5 h-3.5" />
                <span>Сценарий воспроизведения / Триггер</span>
              </div>
              <div className="text-xs text-slate-300 leading-relaxed">
                {activeFinding.exploitRu}
              </div>
            </div>

            {/* Code Diff Side-by-Side */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                Сравнение исходного и исправленного кода
              </h3>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Original Code */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-rose-950/40 border border-rose-900/60 rounded-t-md text-xs text-rose-300 font-mono">
                    <span>Оригинал (С дефектом)</span>
                    <span className="text-[10px] text-rose-400 font-bold">BUG</span>
                  </div>
                  <pre className="p-3 bg-slate-950 border border-slate-800 rounded-b-md text-[11px] font-mono text-slate-300 overflow-x-auto leading-tight max-h-72">
                    <code>{activeFinding.codeOriginal}</code>
                  </pre>
                </div>

                {/* Fixed Code */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-emerald-950/40 border border-emerald-900/60 rounded-t-md text-xs text-emerald-300 font-mono">
                    <span>Исправленная версия (Hardened)</span>
                    <span className="text-[10px] text-emerald-400 font-bold">FIXED</span>
                  </div>
                  <pre className="p-3 bg-slate-950 border border-slate-800 rounded-b-md text-[11px] font-mono text-emerald-200 overflow-x-auto leading-tight max-h-72">
                    <code>{activeFinding.codeFixed}</code>
                  </pre>
                </div>
              </div>
            </div>

            {/* Recommendation footer */}
            <div className="pt-4 border-t border-slate-800 flex items-start space-x-2">
              <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-300 leading-relaxed">
                <span className="font-semibold text-slate-100">Рекомендация инженера: </span>
                {activeFinding.recommendationRu}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
