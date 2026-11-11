import { AudioAnalysis, MidiNote, ParsedMidi, VisualizerSettings, TimingInfo, ModelRegion, ModelDrawContext, SynthRegion } from '../types';
import { hexToRgb, hexToRgbaStr } from './palettes';
import { formatNoteName, detectChord } from './chords';
import { getModelRenderer } from '../models/registry';
import { getSynthRenderer } from '../hardware/registry';
import { drawStudioTapeMachine } from '../hardware/tape-machine';
import { roundRect } from '../shared/canvas-utils';

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.canvas.width = 1080;
    this.canvas.height = 1920;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Could not get 2D context');
    this.ctx = context;
  }

  public render(
    currentTime: number,
    midi: ParsedMidi,
    analysis: AudioAnalysis,
    settings: VisualizerSettings,
    introInfo?: TimingInfo | { isIntro: boolean; introBar: number; totalIntroBars: number }
  ) {
    const { ctx, canvas } = this;
    const width = canvas.width;   // 1080
    const height = canvas.height; // 1920

    const hasIntro = (introInfo && 'hasIntro' in introInfo)
      ? !!introInfo.hasIntro
      : (introInfo?.isIntro ?? false);
    const isIntro = introInfo?.isIntro ?? false;
    const bpm = settings.bpm || midi.bpm || 80;
    const secondsPerBar = (60 / bpm) * 4;
    const introDuration = (introInfo && 'introDuration' in introInfo && typeof introInfo.introDuration === 'number')
      ? introInfo.introDuration
      : (hasIntro ? (introInfo?.totalIntroBars || 1) * secondsPerBar : 0);
    const mainLoopDuration = (introInfo && 'mainLoopDuration' in introInfo && typeof introInfo.mainLoopDuration === 'number')
      ? introInfo.mainLoopDuration
      : (midi.duration || 16);

    let loopTime: number;
    if (hasIntro) {
      if (isIntro) {
        loopTime = currentTime;
      } else {
        const timeInMain = Math.max(0, currentTime - introDuration);
        const mainProgress = timeInMain % mainLoopDuration;
        loopTime = introDuration + mainProgress;
      }
    } else {
      const loopDuration = midi.duration || 16;
      loopTime = currentTime % loopDuration;
    }

    const duration = hasIntro ? (introDuration + mainLoopDuration) : (midi.duration || 16);

    // Active MIDI notes at current playback second
    const activeNotes = (midi.notes || []).filter(
      n => loopTime >= n.time && loopTime < n.time + n.duration
    );

    // Instagram Reels / TikTok Safe-Zone Scaling
    let xOffset = 0;
    let yOffset = 0;
    let scaleFactor = 1.0;
    if (settings.fitReelsSafeZone) {
      scaleFactor = 0.90;
      xOffset = (width * (1 - scaleFactor)) / 2;
      yOffset = 35;
    }

    ctx.save();
    if (settings.fitReelsSafeZone) {
      ctx.translate(xOffset, yOffset);
      ctx.scale(scaleFactor, scaleFactor);
    }

    // 1. Studio Background with audio-reactive radial illumination
    this.drawBackground(width, height, analysis, settings);

    // 2. Central Layout Region Calculation
    const contentStartX = 60;
    const contentWidth = width - 120; // 960px
    const centerX = width / 2;        // 540px

    // 3. Top Header: Track Title, Rounded Metadata Pill, and Bar Counter
    this.drawHeader(centerX, loopTime, duration, midi, settings, currentTime);

    // 4. Hardware Console (Dispatched via Hardware Registry with exact pixel-calibrated coordinates)
    const synthY = 195;
    const synthH = 570;
    const currentMode = settings.centerVisualizerMode || 'take-care';
    const isGoldSynth = currentMode === 'take-care';
    const isWaveform = settings.waveformMode ?? (!midi || midi.notes.length === 0);

    const synthRegion: SynthRegion = {
      x: contentStartX,
      y: synthY,
      width: contentWidth,
      height: synthH,
    };

    if (isWaveform) {
      // In Waveform Mode: Globally dispatch the Master Tape Machine Mark II (Zero piano keys!)
      drawStudioTapeMachine(
        ctx,
        synthRegion.x,
        synthRegion.y,
        synthRegion.width,
        synthRegion.height,
        isGoldSynth ? 'gold' : 'crimson'
      );
    } else {
      const renderSynth = getSynthRenderer(settings.synthModel);
      renderSynth(ctx, {
        region: synthRegion,
        currentTime,
        midi,
        activeNotes,
        analysis,
        settings,
        colorTheme: isGoldSynth ? 'gold' : 'crimson',
      });
    }

    // 5. Active Visual Model Card (Bottom Half: y = 795 to 1465, h = 670px)
    const modelY = 795;
    const modelH = 670;

    const modelRegion: ModelRegion = {
      x: contentStartX,
      y: modelY,
      width: contentWidth,
      height: modelH,
      centerX,
      centerY: modelY + modelH / 2,
      radius: Math.min(contentWidth / 2 - 20, modelH / 2 - 20),
    };

    // 6. Dispatch to the Active Visual Model (Take Care, TZ Lado Mau, Linear, Circular, etc.)
    const modelDrawContext: ModelDrawContext = {
      ctx,
      region: modelRegion,
      currentTime,
      loopTime,
      duration,
      midi,
      activeNotes,
      analysis,
      settings,
      introInfo: (introInfo && 'hasIntro' in introInfo) ? (introInfo as TimingInfo) : undefined,
      isWaveformMode: settings.waveformMode ?? (!midi || midi.notes.length === 0),
    };

    const renderModel = getModelRenderer(currentMode);
    renderModel(ctx, modelDrawContext);

    // 7. Bottom Section: Large Glowing Active Notes, Bar Dashes, and Watermark
    this.drawBottomSection(centerX, 1680, currentTime, loopTime, duration, midi, activeNotes, settings);

    ctx.restore();

    // 8. Reels Safe-Zone Guides
    if (settings.showSafeZoneGuides) {
      this.drawSafeZoneGuides(width, height);
    }
  }

  private drawBackground(
    width: number,
    height: number,
    analysis: AudioAnalysis,
    settings: VisualizerSettings
  ) {
    const { ctx } = this;
    ctx.save();
    const bg = settings.bgColor || '#141018';
    const rgb = hexToRgb(bg);

    const stageGrad = ctx.createLinearGradient(0, 0, 0, height);
    stageGrad.addColorStop(0, '#1c1008');
    stageGrad.addColorStop(0.35, '#100804');
    stageGrad.addColorStop(0.7, '#070302');
    stageGrad.addColorStop(1, '#020101');
    ctx.fillStyle = stageGrad;
    ctx.fillRect(0, 0, width, height);

    // Ambient reactive backlight glow
    if (settings.backgroundGlow !== false) {
      const glowColor = settings.glowColor || settings.notesColor || '#f59e0b';
      const reactiveBass = analysis.bass * (settings.audioSensitivity || 1.2);
      const centerAlpha = Math.min(0.45, 0.20 + reactiveBass * 0.30);

      const centerGrad = ctx.createRadialGradient(width / 2, 900, 60, width / 2, 900, 950);
      centerGrad.addColorStop(0, hexToRgbaStr(glowColor, centerAlpha));
      centerGrad.addColorStop(0.5, hexToRgbaStr(settings.accentColor || glowColor, centerAlpha * 0.4));
      centerGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = centerGrad;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.restore();
  }

  private drawHeader(
    centerX: number,
    loopTime: number,
    duration: number,
    midi: ParsedMidi,
    settings: VisualizerSettings,
    currentTime: number
  ) {
    const { ctx } = this;
    ctx.save();

    // 1. Track Title (e.g. "FEELS THE SAME")
    const titleY = 76;
    ctx.font = '900 44px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';

    if (settings.glowIntensity > 0) {
      ctx.shadowColor = hexToRgbaStr(settings.notesColor || '#f59e0b', 0.5 * settings.glowIntensity);
      ctx.shadowBlur = 14 * settings.glowIntensity;
    }
    const titleStr = (settings.title || 'FEELS THE SAME').toUpperCase();
    ctx.fillText(titleStr, centerX, titleY);
    ctx.shadowBlur = 0;

    // 2. Rounded Dark Pill: "120 BPM • E MIN • PRODBYSERROT"
    const bpm = settings.bpm || midi.bpm || 80;
    const keyStr = (settings.key || midi.key || 'CMIN').toUpperCase();
    const handle = (settings.producerHandle || 'PRODBYSERROT').trim().toUpperCase();

    const pillY = 126;
    ctx.font = '800 17px "JetBrains Mono", monospace';

    const segmentBpm = `${bpm} BPM`;
    const segmentDot = ' • ';
    const segmentKey = keyStr;
    const segmentHandle = handle;

    const wBpm = ctx.measureText(segmentBpm).width;
    const wDot = ctx.measureText(segmentDot).width;
    const wKey = ctx.measureText(segmentKey).width;
    const wHandle = ctx.measureText(segmentHandle).width;

    const contentW = wBpm + wDot + wKey + wDot + wHandle;
    const pillPaddingX = 26;
    const pillW = contentW + pillPaddingX * 2;
    const pillH = 34;
    const pillX = centerX - pillW / 2;

    // Dark pill container with gold border
    ctx.fillStyle = '#0b0c12';
    roundRect(ctx, pillX, pillY - pillH / 2, pillW, pillH, 17, true, false);
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.45)';
    ctx.lineWidth = 1.2;
    roundRect(ctx, pillX, pillY - pillH / 2, pillW, pillH, 17, false, true);

    // Draw metadata text inside pill
    let curX = pillX + pillPaddingX;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#ffffff';
    ctx.fillText(segmentBpm, curX, pillY);
    curX += wBpm;

    ctx.fillStyle = '#fde047';
    ctx.fillText(segmentDot, curX, pillY);
    curX += wDot;

    ctx.fillStyle = '#fde047';
    ctx.fillText(segmentKey, curX, pillY);
    curX += wKey;

    ctx.fillStyle = '#fde047';
    ctx.fillText(segmentDot, curX, pillY);
    curX += wDot;

    ctx.fillStyle = settings.notesColor || '#f59e0b';
    ctx.fillText(segmentHandle, curX, pillY);

    // 3. Measure / Bar Counter below pill: "BAR 01 / 10"
    const secondsPerBar = (60 / bpm) * 4;
    const totalBars = Math.max(1, Math.round(duration / secondsPerBar)) || 10;
    const currentBar = Math.floor(loopTime / secondsPerBar) + 1;
    const barText = `BAR ${String(currentBar).padStart(2, '0')} / ${String(totalBars).padStart(2, '0')}`;

    const barY = 166;
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.letterSpacing = '1.2px';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#b4975a';
    ctx.fillText(barText, centerX, barY);
    ctx.letterSpacing = '0px';

    ctx.restore();
  }

  private drawBottomSection(
    centerX: number,
    notesY: number,
    currentTime: number,
    loopTime: number,
    duration: number,
    midi: ParsedMidi,
    activeNotes: MidiNote[],
    settings: VisualizerSettings
  ) {
    const { ctx } = this;
    ctx.save();

    const isWaveform = !!settings.waveformMode;
    const showNotesRow = settings.showChord !== false;

    if (showNotesRow) {
      if (isWaveform) {
        // In Waveform Mode: Audio spectrum readout instead of piano MIDI notes
        ctx.font = '800 22px "JetBrains Mono", monospace';
        ctx.letterSpacing = '2.5px';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = settings.glowColor || '#f59e0b';
        ctx.shadowBlur = 10;
        ctx.fillText('AUDIO WAVEFORM  •  MASTER STEREO', centerX, notesY);
        ctx.shadowBlur = 0;
        ctx.letterSpacing = '0px';
      } else {
        // In Piano / MIDI Mode: Prominent Row of Active Piano Notes and optional Chord Symbol
        const noteNames = activeNotes.map(n => formatNoteName(n.midi, settings.accidental, settings.middleC));

        if (noteNames.length > 0) {
          ctx.font = '900 34px "Inter", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // Detect chord symbol if enabled (e.g. Cm7)
          let chordPrefix = '';
          if (settings.showChordSymbol) {
            const detected = detectChord(activeNotes, settings.accidental, settings.middleC);
            if (detected?.symbol) {
              chordPrefix = `${detected.symbol}  •  `;
            }
          }

          const fullText = chordPrefix + noteNames.join('  •  ');
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = '#fde047';
          ctx.shadowBlur = 14;
          ctx.fillText(fullText, centerX, notesY);
          ctx.shadowBlur = 0;
        } else {
          ctx.font = '800 24px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#64748b';
          ctx.fillText('—', centerX, notesY);
        }
      }
    }

    // 2. Bar Progress Dashes (e.g. 10 dashes, active dash illuminated in gold)
    const showDashes = settings.showProgressDashes !== false;
    const dashesY = notesY + 54;
    const bpm = settings.bpm || midi.bpm || 80;
    const secondsPerBar = (60 / bpm) * 4;
    const totalBars = Math.max(1, Math.round(duration / secondsPerBar)) || 10;
    const currentBarIdx = Math.floor(loopTime / secondsPerBar) % totalBars;

    if (showDashes) {
      const dashW = 18;
      const dashH = 3;
      const dashGap = 10;
      const totalDashesW = totalBars * dashW + (totalBars - 1) * dashGap;
      const startDashX = centerX - totalDashesW / 2;

      for (let b = 0; b < totalBars; b++) {
        const dx = startDashX + b * (dashW + dashGap);
        const isCur = b === currentBarIdx;

        if (isCur) {
          ctx.fillStyle = '#fde047';
          ctx.shadowColor = '#f59e0b';
          ctx.shadowBlur = 8;
          roundRect(ctx, dx, dashesY - dashH / 2, dashW, dashH, 1.5, true, false);
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
          roundRect(ctx, dx, dashesY - dashH / 2, dashW, dashH, 1.5, true, false);
        }
      }
    }

    // 3. Studio Watermark: "samplescreen visualizer • 1080x1920 @ 60 fps"
    const wmY = showDashes ? dashesY + 44 : notesY + 44;
    ctx.font = '700 11.5px "JetBrains Mono", monospace';
    ctx.letterSpacing = '1.2px';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#786851';
    ctx.fillText((settings.watermark || 'samplescreen visualizer • 1080x1920 @ 60 fps').toLowerCase(), centerX, wmY);
    ctx.letterSpacing = '0px';

    ctx.restore();
  }

  private drawSafeZoneGuides(width: number, height: number) {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 6]);

    ctx.strokeRect(40, 200, width - 80, height - 420);
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.fillStyle = '#ef4444';
    ctx.textAlign = 'left';
    ctx.fillText('INSTAGRAM REELS / TIKTOK SAFE ZONE', 50, 225);
    ctx.restore();
  }
}
