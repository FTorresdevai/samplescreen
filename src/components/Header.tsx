import React from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { secondaryBtnCls } from './ui';

interface HeaderProps {
  onLoadDemo: () => void;
  onOpenExport: () => void;
  isExporting: boolean;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  exportBlockReason?: string | null; // e.g. MIDI-only mode without a MIDI file
  viewSwitch?: React.ReactNode;      // MIDI / Audio switch, only for modes with input 'both'
}

export const Header: React.FC<HeaderProps> = ({ onLoadDemo, onOpenExport, isExporting, isSidebarOpen, onToggleSidebar, exportBlockReason, viewSwitch }) => (
  <header className="h-12 shrink-0 bg-surface-1 border-b border-line px-3 sm:px-4 flex items-center justify-between gap-2 z-30 select-none">
    {/* Wordmark links back to the landing page */}
    <a href="./" className="font-serif text-xl sm:text-2xl leading-none text-text rounded-sm shrink-0" title="Back to the home page">
      SampleScreen
    </a>

    <div className="flex items-center gap-1.5 sm:gap-2 whitespace-nowrap">
      {viewSwitch && <div className="w-24 sm:w-32">{viewSwitch}</div>}
      <button type="button" onClick={onLoadDemo} className={secondaryBtnCls} title="Load the 16-bar demo loop">
        <span className="sm:hidden">Demo</span><span className="hidden sm:inline">Load demo</span>
      </button>
      <button
        type="button"
        onClick={onOpenExport}
        disabled={isExporting || !!exportBlockReason}
        className={`${secondaryBtnCls} hidden sm:inline-flex`} /* phones: Export video sits in the controls panel */
        title={exportBlockReason ?? undefined}
      >
        Export
      </button>
      <button
        type="button"
        onClick={onToggleSidebar}
        className={`${secondaryBtnCls} !px-1.5`}
        title={isSidebarOpen ? 'Hide controls' : 'Show controls'}
        aria-label={isSidebarOpen ? 'Hide controls' : 'Show controls'}
        aria-pressed={isSidebarOpen}
      >
        {isSidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
      </button>
    </div>
  </header>
);
