import React from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { secondaryBtnCls } from './ui';

interface HeaderProps {
  onLoadDemo: () => void;
  onOpenExport: () => void;
  isExporting: boolean;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onLoadDemo, onOpenExport, isExporting, isSidebarOpen, onToggleSidebar }) => (
  <header className="h-12 shrink-0 bg-surface-1 border-b border-line px-4 flex items-center justify-between z-30 select-none">
    {/* Wordmark links back to the landing page */}
    <a href="./" className="font-serif text-2xl leading-none text-text rounded-sm" title="Back to the home page">
      SampleScreen
    </a>

    <div className="flex items-center gap-2">
      <button type="button" onClick={onLoadDemo} className={secondaryBtnCls} title="Load the 16-bar demo loop">
        Load demo
      </button>
      <button type="button" onClick={onOpenExport} disabled={isExporting} className={secondaryBtnCls}>
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
