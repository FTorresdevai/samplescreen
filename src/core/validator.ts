/**
 * Security & Input Validation Guard for SampleScreen
 * Compliant with "Security For Vibe-Coded Apps" standards
 */

export const MAX_AUDIO_BYTES = 150 * 1024 * 1024; // 150 MB limit
export const MAX_AUDIO_DURATION_SECONDS = 15 * 60;  // 15 minutes max
export const MAX_MIDI_BYTES = 5 * 1024 * 1024;     // 5 MB limit

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateAudioDuration(durationSeconds: number): ValidationResult {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return { valid: false, error: 'Audio file duration is invalid or empty.' };
  }
  if (durationSeconds > MAX_AUDIO_DURATION_SECONDS) {
    const minutes = Math.floor(durationSeconds / 60);
    return {
      valid: false,
      error: `Audio duration too long (${minutes} min). Maximum limit is 15 minutes to prevent memory overflow.`,
    };
  }
  return { valid: true };
}

export function validateAudioFile(file: File): ValidationResult {
  if (!file) {
    return { valid: false, error: 'Audio file does not exist.' };
  }

  if (file.size > MAX_AUDIO_BYTES) {
    return {
      valid: false,
      error: `File too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum security limit is 150MB.`,
    };
  }

  const validExtensions = ['.wav', '.mp3', '.flac', '.ogg', '.m4a', '.aac'];
  const fileName = file.name.toLowerCase();
  const hasValidExt = validExtensions.some(ext => fileName.endsWith(ext));

  if (!hasValidExt && !file.type.startsWith('audio/')) {
    return {
      valid: false,
      error: 'Unsupported format. Please upload a WAV, MP3, or FLAC audio file.',
    };
  }

  return { valid: true };
}

export function validateMidiFile(file: File): ValidationResult {
  if (!file) {
    return { valid: false, error: 'MIDI file does not exist.' };
  }

  if (file.size > MAX_MIDI_BYTES) {
    return {
      valid: false,
      error: `MIDI file too large (${(file.size / 1024).toFixed(1)}KB). Maximum limit is 5MB.`,
    };
  }

  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith('.mid') && !fileName.endsWith('.midi')) {
    return {
      valid: false,
      error: 'Please upload a valid file with .mid or .midi extension.',
    };
  }

  return { valid: true };
}

/**
 * XSS & String Sanitizer for Producer metadata (title, handle, watermark)
 * Strips script tags, HTML injection, and limits length
 */
export function sanitizeText(input: string, maxLength = 64): string {
  if (!input) return '';
  return input
    .replace(/[<>]/g, '') // strip HTML brackets
    .slice(0, maxLength);
}
