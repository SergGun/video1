import React from 'react';
import { ShieldCheck, Layers, FileCode, CheckCircle2, Download, Terminal, Film } from 'lucide-react';

export type ActiveTab = 'overview' | 'player' | 'findings' | 'inspector' | 'workbench' | 'code' | 'export';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onExportReport: () => void;
  onRunSelfTest: () => void;
  isTesting: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onExportReport,
  onRunSelfTest,
  isTesting
}) => {
  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Аудит', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'player', label: 'Видеоплеер', icon: <Film className="w-4 h-4 text-sky-400" /> },
    { id: 'findings', label: 'Уязвимости и Баги', icon: <FileCode className="w-4 h-4" /> },
    { id: 'inspector', label: 'ISO-BMFF Инспектор', icon: <Layers className="w-4 h-4" /> },
    { id: 'workbench', label: 'HLS Плейлисты', icon: <Terminal className="w-4 h-4" /> },
    { id: 'code', label: 'Код и Сравнение', icon: <FileCode className="w-4 h-4" /> }
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-900 border-b border-slate-800 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        {/* Zone 1: Brand title */}
        <div className="flex items-center space-x-3 shrink-0">
          <div className="w-8 h-8 rounded bg-sky-600 flex items-center justify-center font-mono font-bold text-white text-sm tracking-wider">
            fMP4
          </div>
          <span className="font-semibold text-base text-slate-100 tracking-tight whitespace-nowrap">
            HLS & fMP4 Audit Suite
          </span>
        </div>

        {/* Zone 2: Navigation links (single line, 1-2 word labels) */}
        <nav className="hidden md:flex items-center space-x-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-slate-800 text-sky-400 font-semibold shadow-xs border border-slate-700'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary actions */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={onRunSelfTest}
            disabled={isTesting}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
            title="Запустить верификацию и бинарные тесты"
          >
            <CheckCircle2 className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-sky-400' : 'text-emerald-400'}`} />
            <span>{isTesting ? 'Проверка...' : 'Тест ISO-BMFF'}</span>
          </button>

          <button
            onClick={onExportReport}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Экспорт отчета</span>
          </button>
        </div>
      </div>

      {/* Mobile nav row */}
      <div className="md:hidden flex items-center overflow-x-auto px-4 py-2 bg-slate-950 border-t border-slate-800 space-x-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`px-2.5 py-1 rounded text-xs whitespace-nowrap shrink-0 ${
              activeTab === item.id
                ? 'bg-sky-600 text-white font-medium'
                : 'text-slate-400 hover:text-slate-200 bg-slate-900'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </header>
  );
};
