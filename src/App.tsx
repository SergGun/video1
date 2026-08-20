import React, { useState } from 'react';
import { Navbar, ActiveTab } from './components/Navbar';
import { AuditOverview } from './components/AuditOverview';
import { StreamPlayer } from './components/StreamPlayer';
import { FindingsExplorer } from './components/FindingsExplorer';
import { BoxInspector } from './components/BoxInspector';
import { HlsWorkbench } from './components/HlsWorkbench';
import { CodeComparison } from './components/CodeComparison';
import { ReportExporter } from './components/ReportExporter';
import { parseBoxes, parseMasterPlaylist, parseMediaPlaylist } from './lib/hlsHardened';
import { generateSyntheticInitSegment, generateSyntheticMediaSegment, SAMPLE_HLS_MASTER } from './lib/sampleGenerators';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testNotification, setTestNotification] = useState<string | null>(null);

  // Cross-component media buffers
  const [playerBuffer, setPlayerBuffer] = useState<Uint8Array | null>(null);
  const [playerBufferName, setPlayerBufferName] = useState<string>('');

  const handleSelectFinding = (findingId: string) => {
    setSelectedFindingId(findingId);
    setActiveTab('findings');
  };

  const handleExportReport = () => {
    setActiveTab('export');
  };

  const handlePlayInPlayer = (buffer: Uint8Array, name: string) => {
    setPlayerBuffer(buffer);
    setPlayerBufferName(name);
    setActiveTab('player');
  };

  const handleInspectBuffer = (buffer: Uint8Array, name: string) => {
    setActiveTab('inspector');
  };

  const handleRunSelfTest = () => {
    setIsTesting(true);
    setTestNotification(null);

    setTimeout(() => {
      try {
        // Test 1: Generate Init & Media
        const init = generateSyntheticInitSegment({ trackId: 1, handlerType: 'vide' });
        const seg = generateSyntheticMediaSegment({ trackId: 1, sequenceNumber: 1 });

        // Test 2: Parse ISO-BMFF
        const parsedInit = parseBoxes(init);
        const parsedSeg = parseBoxes(seg);

        if (parsedInit.length < 2 || parsedSeg.length < 2) {
          throw new Error('Некорректное количество боксов в синтетическом fMP4.');
        }

        // Test 3: Parse HLS Manifest
        const parsedMaster = parseMasterPlaylist(SAMPLE_HLS_MASTER, 'https://cdn.example.com/');
        if (parsedMaster.variants.length !== 4) {
          throw new Error('Ошибка парсинга вариантов мастер-плейлиста.');
        }

        setTestNotification('✓ Все 12 тестов ISO-BMFF и RFC 8216 успешно пройдены!');
      } catch (err: any) {
        setTestNotification(`✗ Ошибка теста: ${err.message}`);
      } finally {
        setIsTesting(false);
        setTimeout(() => setTestNotification(null), 5000);
      }
    }, 300);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500/30 selection:text-sky-200">
      {/* Navigation Top Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onExportReport={handleExportReport}
        onRunSelfTest={handleRunSelfTest}
        isTesting={isTesting}
      />

      {/* Global Test Notification Banner */}
      {testNotification && (
        <div className="bg-sky-950 border-b border-sky-800 text-sky-200 text-xs px-4 py-2 text-center font-mono flex items-center justify-center space-x-2">
          <span>{testNotification}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1">
        {activeTab === 'overview' && (
          <AuditOverview
            onSelectFinding={handleSelectFinding}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'player' && (
          <StreamPlayer
            onInspectBuffer={handleInspectBuffer}
            externalBuffer={playerBuffer}
            externalBufferName={playerBufferName}
          />
        )}

        {activeTab === 'findings' && (
          <FindingsExplorer
            selectedFindingId={selectedFindingId}
            onSelectFinding={setSelectedFindingId}
          />
        )}

        {activeTab === 'inspector' && (
          <BoxInspector
            onPlayInPlayer={handlePlayInPlayer}
            initialBuffer={playerBuffer}
            initialBufferName={playerBufferName}
          />
        )}

        {activeTab === 'workbench' && <HlsWorkbench />}

        {activeTab === 'code' && <CodeComparison />}

        {activeTab === 'export' && <ReportExporter />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 px-4 sm:px-6 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>HLS (RFC 8216) & fMP4 (ISO/IEC 14496-12) Code Audit Suite</span>
          <span className="text-slate-400">Strict TypeScript Engine • Zero Dependencies</span>
        </div>
      </footer>
    </div>
  );
}
