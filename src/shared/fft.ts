/**
 * Real FFT Analyzer for Offline Video Export
 * Implements Radix-2 Cooley-Tukey FFT with Hann windowing and Web Audio standard dB mapping.
 * Matches browser AnalyserNode (minDecibels: -100, maxDecibels: -30, smoothing: 0.8) exactly.
 */

const FFT_SIZE = 2048;
const HALF_FFT = FFT_SIZE / 2; // 1024 bins

// Precomputed Hann window
const HANN_WINDOW = new Float32Array(FFT_SIZE);
for (let i = 0; i < FFT_SIZE; i++) {
  HANN_WINDOW[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
}

// Precomputed bit-reversal table
const BIT_REVERSE = new Uint32Array(FFT_SIZE);
for (let i = 0; i < FFT_SIZE; i++) {
  let reversed = 0;
  let temp = i;
  for (let b = 0; b < 11; b++) { // 2^11 = 2048
    reversed = (reversed << 1) | (temp & 1);
    temp >>= 1;
  }
  BIT_REVERSE[i] = reversed;
}

// Precomputed Twiddle factors
const COS_TABLE = new Float32Array(HALF_FFT);
const SIN_TABLE = new Float32Array(HALF_FFT);
for (let i = 0; i < HALF_FFT; i++) {
  const angle = (-2 * Math.PI * i) / FFT_SIZE;
  COS_TABLE[i] = Math.cos(angle);
  SIN_TABLE[i] = Math.sin(angle);
}

// Reusable scratch buffers to eliminate GC allocations during 60 FPS export
const realScratch = new Float32Array(FFT_SIZE);
const imagScratch = new Float32Array(FFT_SIZE);

/**
 * Performs an in-place Radix-2 Cooley-Tukey FFT on realScratch and imagScratch.
 */
function runRadix2FFT() {
  // Bit-reversal permutation
  for (let i = 0; i < FFT_SIZE; i++) {
    const rev = BIT_REVERSE[i];
    if (i < rev) {
      const tr = realScratch[i];
      realScratch[i] = realScratch[rev];
      realScratch[rev] = tr;

      const ti = imagScratch[i];
      imagScratch[i] = imagScratch[rev];
      imagScratch[rev] = ti;
    }
  }

  // Butterfly updates
  for (let halfSize = 1; halfSize < FFT_SIZE; halfSize <<= 1) {
    const step = halfSize << 1;
    const tableStep = HALF_FFT / halfSize;

    for (let k = 0; k < halfSize; k++) {
      const tableIdx = k * tableStep;
      const wr = COS_TABLE[tableIdx];
      const wi = SIN_TABLE[tableIdx];

      for (let i = k; i < FFT_SIZE; i += step) {
        const j = i + halfSize;
        const tr = wr * realScratch[j] - wi * imagScratch[j];
        const ti = wr * imagScratch[j] + wi * realScratch[j];

        realScratch[j] = realScratch[i] - tr;
        imagScratch[j] = imagScratch[i] - ti;

        realScratch[i] += tr;
        imagScratch[i] += ti;
      }
    }
  }
}

/**
 * Computes frequency spectrum bytes (0-255) from a 2048-sample audio window.
 * Matches Web Audio AnalyserNode specifications:
 * - minDecibels: -100 dB
 * - maxDecibels: -30 dB
 * - smoothingTimeConstant: 0.8
 */
export function analyzeAudioWindow(
  pcmSamples: Float32Array, // length 2048
  prevSmoothed: Float32Array, // length 1024
  outByteFft: Uint8Array,     // length 1024 or 512
  smoothing: number = 0.8
): { bass: number; mid: number; treble: number; rms: number } {
  // 1. Apply Hann window & compute RMS
  let sumSquares = 0;
  for (let i = 0; i < FFT_SIZE; i++) {
    const val = i < pcmSamples.length ? pcmSamples[i] : 0;
    sumSquares += val * val;
    realScratch[i] = val * HANN_WINDOW[i];
    imagScratch[i] = 0;
  }
  const rms = Math.min(1, Math.sqrt(sumSquares / FFT_SIZE) * 2.2);

  // 2. Run FFT
  runRadix2FFT();

  // 3. Convert to dB, apply Web Audio range [-100 dB, -30 dB], and smooth
  const minDb = -100;
  const maxDb = -30;
  const dbRange = maxDb - minDb; // 70 dB
  const normFactor = 2 / FFT_SIZE;

  const numBins = Math.min(HALF_FFT, outByteFft.length);

  for (let i = 0; i < numBins; i++) {
    const r = realScratch[i];
    const im = imagScratch[i];
    const mag = Math.sqrt(r * r + im * im) * normFactor;

    // Convert linear magnitude to dB
    const db = mag > 1e-10 ? 20 * Math.log10(mag) : minDb;
    const clampedDb = Math.max(minDb, Math.min(maxDb, db));
    const rawByte = Math.max(0, Math.min(255, Math.round(((clampedDb - minDb) / dbRange) * 255)));

    // Apply exponential smoothing constant identical to AnalyserNode
    const smoothed = smoothing * prevSmoothed[i] + (1 - smoothing) * rawByte;
    prevSmoothed[i] = smoothed;
    outByteFft[i] = Math.max(0, Math.min(255, Math.round(smoothed)));
  }

  // 4. Extract standard frequency bands matching getRealtimeAnalysis
  // Bass: 20Hz - 250Hz (bins 1 to 12)
  let bassSum = 0;
  for (let i = 1; i <= 12; i++) bassSum += outByteFft[i];
  const bass = Math.min(1, (bassSum / 12) / 255);

  // Mid: 250Hz - 4000Hz (bins 13 to 186)
  let midSum = 0;
  for (let i = 13; i <= 186; i++) midSum += outByteFft[i];
  const mid = Math.min(1, (midSum / (186 - 13)) / 255);

  // Treble: 4000Hz - 16000Hz (bins 187 to 744)
  let trebleSum = 0;
  const trebleEnd = Math.min(744, numBins - 1);
  for (let i = 187; i <= trebleEnd; i++) trebleSum += outByteFft[i];
  const treble = Math.min(1, (trebleSum / Math.max(1, trebleEnd - 187)) / 255);

  return { bass, mid, treble, rms };
}
