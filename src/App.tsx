import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Dropzone } from './components/Dropzone';
import { CanvasPreview } from './components/CanvasPreview';
import { PlaybackControls } from './components/PlaybackControls';
import { CustomizationSidebar } from './components/CustomizationSidebar';
import { ExportModal } from './components/ExportModal';
import { CanvasRenderer } from './engine/renderer';
import { audioManager } from './engine/audio';
import { parseMidiFile, createDemoMidi, createDemoIntroMidi, getTimelineTiming, sliceMidiData } from './engine/midi';
import { VideoExporter, ExportProgress } from './engine/exporter';
import { ParsedMidi, VisualizerSettings } from './types';
import { validateAudioFile, validateMidiFile, sanitizeText } from './core/validator';
import { parseSampleFileName } from './core/sample-parser';
import { MODEL_REGISTRY } from './models/registry';

export const App: React.FC = () => {
  // References
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const exporterRef = useRef<VideoExporter>(new VideoExporter());
  const originalMidiDataRef = useRef<ParsedMidi | null>(null);

  // URL params initialization for deep-linking and visual testing
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const rawModel = urlParams?.get('model');
  const initialModel = (rawModel && rawModel in MODEL_REGISTRY) ? rawModel : 'take-care';
  const initialWaveform = urlParams?.get('waveform') === 'true';

  // Settings State with complete feature set matching reference video
  const [settings, setSettings] = useState<VisualizerSettings>({
    title: initialModel === 'tz-lado-mau' ? 'LADO MAU' : 'FEELS THE SAME',
    bpm: initialModel === 'tz-lado-mau' ? 140 : 120,
    key: initialModel === 'tz-lado-mau' ? 'D MIN' : 'E MIN',
    producerHandle: 'PRODBYSERROT',
    watermark: 'samplescreen visualizer • 1080x1920 @ 60 fps',

    notesColor: '#f59e0b',
    circleColor: '#2b231c',
    bgColor: '#161310',
    accentColor: '#fde047',
    glowColor: '#f59e0b',
    backgroundGlow: true,
    waveformMode: initialWaveform,

    showObiStrip: true,
    showSynthConsole: true,
    showCenterOrb: true,
    showChord: true,
    showChordBelowPiano: false,
    chordDisplayLocation: 'bottom',
    showChordSymbol: false,
    showMidiNotesInRoll: true,
    isLightStudioMode: false,
    showSafeZoneGuides: false,
    showPreviewHud: false,
    fitReelsSafeZone: false,

    centerVisualizerMode: initialModel,
    loopBars: 10,
    motionMode: 'rotating-wheel',
    drawNotesOnRings: true,
    noteNameTags: true,
    showProgressDashes: true,
    audioVisualizerMode: 'piano-roll',

    accidental: 'sharp',
    middleC: 3,

    // Intro Sequence Feature (1 - 8 Bars)
    enableIntro: false,
    introBars: 4,

    audioSensitivity: 1.2,
    glowIntensity: 1.3,

    exportLoops: 1,
  });

  // Data & Playback State
  const [midiData, setMidiData] = useState<ParsedMidi>(() => createDemoMidi(16));
  const [introMidiData, setIntroMidiData] = useState<ParsedMidi | null>(() => createDemoIntroMidi(4, 80));
  const [introMidiFileName, setIntroMidiFileName] = useState<string | null>('demo_intro_pads.mid');
  const [audioFileName, setAudioFileName] = useState<string | null>('demo_synth_chords.wav');
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [detectedAudioInfo, setDetectedAudioInfo] = useState<string | null>(null);
  const [midiFileName, setMidiFileName] = useState<string | null>('demo_progression.mid');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Open by default!

  // Explicit source state tracking ('demo' | 'file')
  const [audioSource, setAudioSource] = useState<'demo' | 'file'>('demo');
  const [midiSource, setMidiSource] = useState<'demo' | 'file'>('demo');
  const [introMidiSource, setIntroMidiSource] = useState<'demo' | 'file'>('demo');

  // Export State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportDownloadUrl, setExportDownloadUrl] = useState<string | null>(null);
  const [exportExtension, setExportExtension] = useState<'mp4' | 'webm'>('mp4');
  const [exportError, setExportError] = useState<string | null>(null);

  // Initialize Demo Loop on mount with 16 bars
  useEffect(() => {
    const demo = createDemoMidi(16);
    setMidiData(demo);
    originalMidiDataRef.current = demo;
    const demoIntro = createDemoIntroMidi(settings.introBars, settings.bpm);
    setIntroMidiData(demoIntro);
    const buf = audioManager.generateCombinedAudioBuffer(
      settings.enableIntro ? demoIntro : null,
      demo,
      settings.enableIntro,
      settings.introBars
    );
    if (buf) {
      setAudioDuration(buf.duration);
    }
  }, []);

  // Debounced audio regeneration for demo synthesizer (prevents UI freeze on rapid BPM input typing)
  useEffect(() => {
    if (audioSource !== 'demo') return;
    if (settings.isAudioTrimmed) return; // Do not overwrite active trimmed audio buffer with full progression
    const timer = setTimeout(() => {
      audioManager.generateCombinedAudioBuffer(
        settings.enableIntro ? introMidiData : null,
        midiData,
        settings.enableIntro,
        settings.introBars
      );
    }, 150);
    return () => clearTimeout(timer);
  }, [audioSource, settings.enableIntro, settings.introBars, settings.bpm, settings.loopBars, settings.isAudioTrimmed, midiData, introMidiData]);

  const handleUpdateSettings = (updates: Partial<VisualizerSettings>) => {
    // Sanitize string inputs against XSS and excessive length
    const sanitizedUpdates = { ...updates };
    if (sanitizedUpdates.title !== undefined) {
      sanitizedUpdates.title = sanitizeText(sanitizedUpdates.title, 64);
    }
    if (sanitizedUpdates.producerHandle !== undefined) {
      sanitizedUpdates.producerHandle = sanitizeText(sanitizedUpdates.producerHandle, 48);
    }
    if (sanitizedUpdates.watermark !== undefined) {
      sanitizedUpdates.watermark = sanitizeText(sanitizedUpdates.watermark, 96);
    }

    // Pure state updater
    setSettings((prev) => ({ ...prev, ...sanitizedUpdates }));

    // Side-effects handled outside the functional updater
    if (sanitizedUpdates.loopBars && sanitizedUpdates.loopBars !== settings.loopBars && midiSource === 'demo') {
      const currentMidi = createDemoMidi(sanitizedUpdates.loopBars);
      setMidiData(currentMidi);
    }

    if ((sanitizedUpdates.introBars !== undefined || sanitizedUpdates.bpm !== undefined) && introMidiSource === 'demo') {
      const targetBars = sanitizedUpdates.introBars ?? settings.introBars;
      const targetBpm = sanitizedUpdates.bpm ?? settings.bpm;
      const currentIntro = createDemoIntroMidi(targetBars, targetBpm);
      setIntroMidiData(currentIntro);
    }
  };

  const handleLoadDemo = () => {
    audioManager.clearCustomAudio();
    const demo = createDemoMidi();
    setMidiData(demo);
    originalMidiDataRef.current = demo;
    const demoIntro = createDemoIntroMidi(settings.introBars, 80);
    setIntroMidiData(demoIntro);
    setAudioSource('demo');
    setMidiSource('demo');
    setIntroMidiSource('demo');
    setAudioFileName('demo_synth_chords.wav');
    setMidiFileName('demo_progression.mid');
    setIntroMidiFileName('demo_intro_pads.mid');
    setDetectedAudioInfo(null);
    setSettings((prev) => ({
      ...prev,
      title: 'FEELS THE SAME',
      bpm: 80,
      key: 'CMIN',
      producerHandle: 'PRODBYSERROT',
      isAudioTrimmed: false,
      audioTrimStartBar: 1,
      audioTrimBars: 8,
      loopBars: 8,
    }));
    const buf = audioManager.generateCombinedAudioBuffer(
      settings.enableIntro ? demoIntro : null,
      demo,
      settings.enableIntro,
      settings.introBars
    );
    if (buf) {
      setAudioDuration(buf.duration);
    }
  };

  const handleLoadDemoIntro = () => {
    const demoIntro = createDemoIntroMidi(settings.introBars, settings.bpm);
    setIntroMidiData(demoIntro);
    setIntroMidiSource('demo');
    setIntroMidiFileName('demo_intro_pads.mid');
    if (settings.enableIntro && audioSource === 'demo') {
      audioManager.generateCombinedAudioBuffer(demoIntro, midiData, true, settings.introBars);
    }
  };

  const handleAudioSelected = async (file: File) => {
    const validation = validateAudioFile(file);
    if (!validation.valid) {
      alert(`Audio Rejected: ${validation.error}`);
      return;
    }

    try {
      const decoded = await audioManager.loadAudioFile(file);
      setAudioSource('file');
      setAudioFileName(file.name);
      setAudioDuration(decoded.duration);

      // Auto-detect Title, BPM, Key, and Producer from sample filename
      const parsed = parseSampleFileName(file.name);
      setDetectedAudioInfo(parsed.detectedSummary || null);

      const effectiveBpm = parsed.bpm ?? settings.bpm ?? 80;
      const secondsPerBar = (60 / effectiveBpm) * 4;
      const totalBars = Math.max(1, Math.round(decoded.duration / secondsPerBar));
      const defaultBars = Math.min(16, totalBars);

      // If producer has not loaded a custom MIDI yet, switch to Waveform Mode
      const isCustomMidi = midiSource === 'file';
      let activeMidi = midiData;
      let activeIntro = introMidiData;

      if (!isCustomMidi) {
        activeMidi = {
          notes: [],
          totalBars: defaultBars,
          bpm: effectiveBpm,
          key: parsed.key || settings.key,
          duration: decoded.duration,
        };
        activeIntro = null;
        setMidiData(activeMidi);
        originalMidiDataRef.current = activeMidi;
        setMidiFileName(null);
        setIntroMidiData(null);
        setIntroMidiFileName(null);
      } else {
        if (!originalMidiDataRef.current) {
          originalMidiDataRef.current = activeMidi;
        }
      }

      setSettings((prev) => ({
        ...prev,
        title: parsed.title ? sanitizeText(parsed.title, 64) : prev.title,
        bpm: parsed.bpm ?? prev.bpm,
        key: parsed.key ? sanitizeText(parsed.key, 16) : prev.key,
        producerHandle: parsed.producer ? sanitizeText(parsed.producer, 48) : prev.producerHandle,
        audioTrimStartBar: 1,
        audioTrimBars: defaultBars,
        loopBars: defaultBars,
        isAudioTrimmed: false,
        waveformMode: !isCustomMidi ? true : prev.waveformMode,
      }));

      const timing = getTimelineTiming(activeMidi, activeIntro, {
        ...settings,
        bpm: effectiveBpm,
        loopBars: defaultBars,
      });
      audioManager.setLoopEndTime(timing.totalDuration);
    } catch (err) {
      console.error('Failed to decode audio file:', err);
      alert(err instanceof Error ? err.message : 'Unable to decode audio file. Please ensure it is a valid WAV or MP3 file.');
    }
  };

  const handleTrimAudio = (startBar: number, numBars: number) => {
    // Preserve untrimmed original MIDI before applying trim
    if (!originalMidiDataRef.current) {
      originalMidiDataRef.current = midiData;
    }
    const baseMidi = originalMidiDataRef.current;

    const result = audioManager.trimToBars(startBar, numBars, settings.bpm);
    if (result) {
      setAudioDuration(result.durationSec);
      setSettings((prev) => ({
        ...prev,
        audioTrimStartBar: startBar,
        audioTrimBars: result.totalBars,
        loopBars: result.totalBars,
        isAudioTrimmed: true,
      }));
      audioManager.setLoopEndTime(result.durationSec);

      // Crucial Bug Fix: slice loaded MIDI notes and synchronize with trimmed audio
      const slicedMidi = sliceMidiData(baseMidi, result.startSec, result.durationSec, result.totalBars);
      setMidiData(slicedMidi);
    }
  };

  const handleResetAudioTrim = () => {
    const originalDur = audioManager.resetTrim();
    setAudioDuration(originalDur);
    const bpm = settings.bpm || 80;
    const secondsPerBar = (60 / bpm) * 4;
    const recoveredBars = Math.max(1, Math.round(originalDur / secondsPerBar));
    const defaultBars = Math.min(16, recoveredBars);

    // Restore original untrimmed MIDI notes
    if (originalMidiDataRef.current) {
      setMidiData(originalMidiDataRef.current);
    }

    const restoredBars = originalMidiDataRef.current?.totalBars || defaultBars;

    setSettings((prev) => ({
      ...prev,
      audioTrimStartBar: 1,
      audioTrimBars: defaultBars,
      loopBars: restoredBars,
      isAudioTrimmed: false,
    }));
    audioManager.setLoopEndTime(originalDur);
  };

  const handleMidiSelected = async (file: File) => {
    const validation = validateMidiFile(file);
    if (!validation.valid) {
      alert(`MIDI Rejected: ${validation.error}`);
      return;
    }

    try {
      const parsed = await parseMidiFile(file);
      setMidiData(parsed);
      originalMidiDataRef.current = parsed;
      setMidiSource('file');
      setMidiFileName(file.name);
      setSettings((prev) => ({
        ...prev,
        bpm: parsed.bpm,
        key: parsed.key || prev.key,
        loopBars: parsed.totalBars,
        isAudioTrimmed: false,
        waveformMode: false, // Activating MIDI file defaults to piano / sequencer mode
      }));
      if (audioSource === 'demo') {
        audioManager.generateCombinedAudioBuffer(
          settings.enableIntro ? introMidiData : null,
          parsed,
          settings.enableIntro,
          settings.introBars
        );
      }
    } catch (err) {
      console.error('Failed to parse MIDI file:', err);
      alert('Unable to process MIDI file. Please ensure it is a valid .mid file.');
    }
  };

  const handleIntroMidiSelected = async (file: File) => {
    const validation = validateMidiFile(file);
    if (!validation.valid) {
      alert(`Intro MIDI Rejected: ${validation.error}`);
      return;
    }

    try {
      const parsed = await parseMidiFile(file);
      setIntroMidiData(parsed);
      setIntroMidiSource('file');
      setIntroMidiFileName(file.name);
      if (settings.enableIntro && audioSource === 'demo') {
        audioManager.generateCombinedAudioBuffer(parsed, midiData, true, settings.introBars);
      }
    } catch (err) {
      console.error('Failed to parse Intro MIDI file:', err);
      alert('Could not parse intro MIDI file.');
    }
  };

  // Safe object URL cleanup to prevent high RAM accumulation
  const revokeExportUrl = () => {
    if (exportDownloadUrl) {
      URL.revokeObjectURL(exportDownloadUrl);
      setExportDownloadUrl(null);
    }
  };

  useEffect(() => {
    return () => {
      if (exportDownloadUrl) {
        URL.revokeObjectURL(exportDownloadUrl);
      }
    };
  }, [exportDownloadUrl]);

  const handleStartExport = async () => {
    if (!canvasRef.current || !rendererRef.current) {
      console.warn('Canvas or Renderer not ready for export');
      return;
    }

    // Revoke any previous export blob before starting new export
    revokeExportUrl();

    // Pause audio playback during export
    audioManager.pause();

    const timing = getTimelineTiming(midiData, introMidiData, settings);
    const exportLoops = settings.exportLoops || 1;
    const totalDuration = timing.introDuration + timing.mainLoopDuration * exportLoops;

    setIsExportModalOpen(true);
    setIsExporting(true);
    setExportError(null);
    setExportProgress({
      currentFrame: 0,
      totalFrames: Math.floor(totalDuration * 60),
      percent: 0,
      fps: 0,
      etaSeconds: 0,
      status: 'Initializing WebCodecs 60 FPS Export Pipeline...',
    });

    try {
      const blob = await exporterRef.current.exportVideo(
        canvasRef.current,
        rendererRef.current,
        audioManager,
        midiData,
        settings,
        (progress) => setExportProgress(progress),
        introMidiData
      );

      setExportExtension(blob.type.includes('webm') ? 'webm' : 'mp4');
      const url = URL.createObjectURL(blob);
      setExportDownloadUrl(url);
      setIsExporting(false);
    } catch (err: unknown) {
      console.error('Export error:', err);
      setIsExporting(false);
      setExportError((err as Error)?.message || 'Export failed. Please try again.');
    }
  };

  const handleCloseExport = () => {
    setIsExportModalOpen(false);
    revokeExportUrl();
  };

  const handleCancelExport = () => {
    exporterRef.current.cancel();
    setIsExporting(false);
    setIsExportModalOpen(false);
    revokeExportUrl();
  };

  const exportFileName = `SampleScreen_${settings.title.replace(/\s+/g, '_')}_1080x1920_60FPS.${exportExtension}`;

  // Total playback duration calculation for the timeline scrubber and audio sync
  const timelineTiming = getTimelineTiming(midiData, introMidiData, settings);
  const trimmedDuration = audioManager.getDuration() || (settings.audioTrimBars ? settings.audioTrimBars * ((60 / settings.bpm) * 4) : timelineTiming.mainLoopDuration);
  const totalPlaybackDuration = settings.isAudioTrimmed ? trimmedDuration : timelineTiming.totalDuration;

  useEffect(() => {
    if (totalPlaybackDuration > 0) {
      audioManager.setLoopEndTime(totalPlaybackDuration);
    }
  }, [totalPlaybackDuration, settings.isAudioTrimmed]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#060709]">
      
      {/* 1. Header Bar */}
      <Header
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onLoadDemo={handleLoadDemo}
        onOpenExport={handleStartExport}
        isExporting={isExporting}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      {/* Main Studio Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Left / Center Area */}
        <div className="flex-1 flex flex-col min-w-0">
          
          {/* Top Dropzone */}
          <div className="p-2.5 bg-[#07080a] border-b border-white/[0.06]">
            <Dropzone
              onAudioSelected={handleAudioSelected}
              onMidiSelected={handleMidiSelected}
              audioFileName={audioFileName}
              midiFileName={midiFileName}
              midiData={midiData}
              detectedAudioInfo={detectedAudioInfo}
            />
          </div>

          {/* Canvas 9:16 Video Preview Viewport with Direct In-Place Text Editor */}
          <CanvasPreview
            rendererRef={rendererRef}
            canvasRef={canvasRef}
            audioManager={audioManager}
            midiData={midiData}
            introMidiData={introMidiData}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            isExporting={isExporting}
          />

          {/* Bottom Playback Controls */}
          <PlaybackControls
            audioManager={audioManager}
            duration={totalPlaybackDuration}
            bpm={settings.bpm}
            enableIntro={settings.enableIntro}
            introBars={settings.introBars}
          />

        </div>

        {/* Right Customization Sidebar */}
        <CustomizationSidebar
          settings={settings}
          onUpdate={handleUpdateSettings}
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          onExport={handleStartExport}
          introMidiData={introMidiData}
          introMidiFileName={introMidiFileName}
          onIntroMidiSelected={handleIntroMidiSelected}
          onLoadDemoIntro={handleLoadDemoIntro}
          midiData={midiData}
          audioDuration={audioDuration || audioManager.getDuration()}
          rawAudioDuration={audioManager.getRawDuration() || audioDuration}
          onTrimAudio={handleTrimAudio}
          onResetAudioTrim={handleResetAudioTrim}
        />

      </div>

      {/* Export Overlay Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        isExporting={isExporting}
        progress={exportProgress}
        downloadUrl={exportDownloadUrl}
        fileName={exportFileName}
        error={exportError}
        onClose={handleCloseExport}
        onCancel={handleCancelExport}
      />

    </div>
  );
};
