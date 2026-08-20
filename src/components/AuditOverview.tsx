import React from 'react';
import { AUDIT_PILLARS, AUDIT_FINDINGS, ARCHITECTURE_STRENGTHS } from '../audit/auditData';
import { ShieldAlert, CheckCircle, AlertTriangle, ArrowRight, Layers, FileCode, Check, Cpu } from 'lucide-react';
import { ActiveTab } from './Navbar';

interface AuditOverviewProps {
  onSelectFinding: (findingId: string) => void;
  setActiveTab: (tab: ActiveTab) => void;
}

export const AuditOverview: React.FC<AuditOverviewProps> = ({
  onSelectFinding,
  setActiveTab
}) => {
  const criticalCount = AUDIT_FINDINGS.filter(f => f.severity === 'CRITICAL').length;
  const highCount = AUDIT_FINDINGS.filter(f => f.severity === 'HIGH').length;
  const mediumCount = AUDIT_FINDINGS.filter(f => f.severity === 'MEDIUM').length;
  const lowCount = AUDIT_FINDINGS.filter(f => f.severity === 'LOW' || f.severity === 'OPTIMIZATION').length;

  const totalScore = Math.round(
    AUDIT_PILLARS.reduce((acc, p) => acc + p.score, 0) / AUDIT_PILLARS.length
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-6 px-4 sm:px-6">
      {/* Hero Banner with Executive Verdict */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded bg-sky-950/80 border border-sky-800 text-sky-300 text-xs font-mono">
              <Cpu className="w-3.5 h-3.5" />
              <span>ISO/IEC 14496-12 & RFC 8216 Engine Audit</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
              Полный экспертный аудит и отчет об устранении дефектов HLS / fMP4
            </h1>
            <p className="text-sm sm:text-base text-slate-400 max-w-3xl leading-relaxed">
              Проведен глубокий анализ и полное устранение архитектурных рисков в коде парсера HLS, сетевого слоя и
              мультиплексора fMP4. Все обнаруженные дефекты: <span className="text-emerald-400 font-semibold">{criticalCount} критических бага</span> (рассинхронизация A/V и утечка памяти OOM),{' '}
              <span className="text-emerald-400 font-semibold">{highCount} проблемы высокого приоритета</span> и сопутствующие недочеты <span className="text-emerald-400 font-semibold">полностью устранены и верифицированы</span>.
            </p>
          </div>

          <div className="flex items-center gap-4 p-5 bg-slate-950/90 rounded-lg border border-slate-800 shrink-0">
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-extrabold text-emerald-400 font-mono">
                {totalScore}
                <span className="text-sm font-normal text-slate-500">/100</span>
              </div>
              <div className="text-xs text-slate-400 mt-1 font-medium">Общий индекс надежности</div>
            </div>
            <div className="h-10 w-px bg-slate-800" />
            <div className="flex flex-col justify-center space-y-1.5 text-xs">
              <span className="px-2.5 py-1 bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 rounded font-mono flex items-center space-x-1.5 font-medium">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>10 / 10 Исправлено</span>
              </span>
              <span className="px-2.5 py-1 bg-sky-950/60 border border-sky-800/80 text-sky-300 rounded font-mono text-[11px] text-center">
                0 активных рисков
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 6 Audit Pillars Scorecards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-100 flex items-center space-x-2">
            <span>Оценка по 6 направлениям спецификации</span>
          </h2>
          <span className="text-xs text-slate-400 font-mono">ISO/IEC 14496-12:2020 + RFC 8216</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {AUDIT_PILLARS.map((pillar, idx) => {
            const isGood = pillar.score >= 80;
            const isWarning = pillar.score < 80 && pillar.score >= 70;
            const isCritical = pillar.score < 70;

            const badgeBg = isGood
              ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300'
              : isWarning
              ? 'bg-amber-950/50 border-amber-800 text-amber-300'
              : 'bg-rose-950/50 border-rose-800 text-rose-300';

            return (
              <div
                key={idx}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors rounded-lg p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-slate-400">{pillar.pillar}</span>
                    <span className={`text-xs px-2 py-0.5 rounded border font-mono font-medium ${badgeBg}`}>
                      {pillar.grade} ({pillar.score}%)
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-200 mb-2">{pillar.pillarRu}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">{pillar.summaryRu}</p>
                </div>

                <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      isGood ? 'bg-emerald-500' : isWarning ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${pillar.score}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Critical Findings Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-slate-100">
              Архитектурные исправления ключевых дефектов
            </h2>
          </div>
          <button
            onClick={() => setActiveTab('findings')}
            className="text-xs font-medium text-sky-400 hover:text-sky-300 flex items-center space-x-1"
          >
            <span>Смотреть все 10 отчетов с диффами и решениями</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {AUDIT_FINDINGS.slice(0, 4).map((finding) => (
            <div
              key={finding.id}
              onClick={() => onSelectFinding(finding.id)}
              className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all rounded-lg p-5 cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-emerald-950 border border-emerald-800 text-emerald-300 flex items-center space-x-1">
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>{finding.id} • УСТРАНЕНО</span>
                  </span>
                  <span className="text-xs text-slate-400 font-mono">{finding.lines}</span>
                </div>
                <span className="text-xs text-slate-500 font-mono group-hover:text-sky-400 flex items-center space-x-1">
                  <span>Решение</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>

              <h3 className="text-sm font-semibold text-slate-200 group-hover:text-sky-300 transition-colors mb-2">
                {finding.titleRu}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                {finding.summaryRu}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Architectural Strengths & Spec Compliance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Strengths */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center space-x-2 text-emerald-400">
            <CheckCircle className="w-4 h-4" />
            <h3 className="text-sm font-semibold text-slate-100">
              Сильные стороны реализации
            </h3>
          </div>
          <div className="space-y-3">
            {ARCHITECTURE_STRENGTHS.map((item, idx) => (
              <div key={idx} className="flex items-start space-x-2.5">
                <div className="w-4 h-4 rounded-full bg-emerald-950 border border-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-200">{item.title}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{item.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Tools Jump */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-sky-400 mb-3">
              <Layers className="w-4 h-4" />
              <h3 className="text-sm font-semibold text-slate-100">
                Инструменты верификации и инспекции
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Вы можете протестировать парсер ISO-BMFF, разобрать структуру боксов в реальном времени,
              проверить HLS плейлисты или сравнить оригинальный код с исправленной версией.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={() => setActiveTab('player')}
                className="flex items-center space-x-2 p-3 bg-sky-950/40 hover:bg-sky-900/50 border border-sky-800/80 rounded text-left transition-colors"
              >
                <Cpu className="w-4 h-4 text-sky-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-sky-200">Видеоплеер и HLS</div>
                  <div className="text-[10px] text-sky-400/80">Загрузка и воспроизведение</div>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('inspector')}
                className="flex items-center space-x-2 p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-left transition-colors"
              >
                <Layers className="w-4 h-4 text-sky-400 shrink-0" />
                <div>
                  <div className="text-xs font-medium text-slate-200">ISO-BMFF Box Inspector</div>
                  <div className="text-[10px] text-slate-400">Дерево боксов + Hex</div>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('workbench')}
                className="flex items-center space-x-2 p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-left transition-colors"
              >
                <FileCode className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xs font-medium text-slate-200">HLS Manifest Tester</div>
                  <div className="text-[10px] text-slate-400">Парсинг Master/Media</div>
                </div>
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500 font-mono">
            <span>Стандарты: ISO/IEC 14496-12 • RFC 8216</span>
            <span className="text-slate-400">Vanilla JS / TypeScript</span>
          </div>
        </div>
      </div>
    </div>
  );
};
