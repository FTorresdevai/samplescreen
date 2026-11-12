/**
 * Sample Metadata Parser
 * Automatically parses audio sample file names to detect Title, BPM, Key, and Producer tag.
 * Supports Splice, Looperman, Cymatics, and common producer community naming conventions.
 */

export interface ParsedSampleMeta {
  raw: string;
  title: string;
  bpm?: number;
  key?: string;
  producer?: string;
  detectedSummary?: string;
}

/**
 * Normalizes musical root note (e.g. "c#" -> "C#", "ab" -> "Ab", "fsharp" -> "F#")
 */
export function normalizeRoot(rawRoot: string): string {
  const note = rawRoot.charAt(0).toUpperCase();
  const acc = rawRoot.slice(1).toLowerCase();
  if (acc === '#' || acc === 'sharp') return `${note}#`;
  if (acc === 'b' || acc === 'flat') return `${note}b`;
  return note;
}

/**
 * Normalizes musical key quality (e.g. "minor", "min", "m", "moll" -> "MIN"; "major", "maj", "dur" -> "MAJ")
 */
export function normalizeQuality(rawQuality?: string): 'MIN' | 'MAJ' {
  if (!rawQuality) return 'MAJ';
  const q = rawQuality.toLowerCase();
  if (q.startsWith('min') || q === 'm' || q.startsWith('moll')) {
    return 'MIN';
  }
  return 'MAJ';
}

/**
 * Parses an audio sample filename to automatically extract:
 * - Title: Cleaned and uppercase title without metadata tags, ID prefixes, and extensions
 * - BPM: Numerical tempo (e.g. 120, 140, 85, 130)
 * - Key: Standardized musical key (e.g. "E MIN", "C# MIN", "F# MIN", "D# MAJ")
 * - Producer: Cleaned producer handle or tag without "@" or "prod." prefix
 * - Detected Summary: e.g. "Detected: 130 BPM • F# MIN • PROD. MURDA"
 */
export function parseSampleFileName(fileName: string): ParsedSampleMeta {
  const raw = fileName;
  const baseName = fileName.split(/[\\/]/).pop() || fileName;
  // Strip file extension (.wav, .mp3, .aif, .flac, etc.)
  let working = baseName.replace(/\.[a-zA-Z0-9]{2,5}$/i, '');

  let detectedBpm: number | undefined;
  let bpmMatchStr = '';

  let detectedKey: string | undefined;
  let keyMatchStr = '';

  let detectedProducer: string | undefined;
  let producerMatchStr = '';

  // ---------------------------------------------------------------------------
  // 1. EXTRACT PRODUCER
  // ---------------------------------------------------------------------------
  // Matches:
  // a) Bracketed producer tag or handle: (prod. by serrot), [prod. Murda], (@808mafia)
  const bracketedProdRegex = /[\(\[\{]\s*(?:@([a-zA-Z0-9_\-\.]+)|(?:prodby|prod(?:uced)?\.?\s+by\b|prod(?:uced)?\.?|prod\s*[:\-_])\s*([^,\)\]\}]+))\s*[\)\]\}]/i;
  const bracketedProdMatch = working.match(bracketedProdRegex);

  if (bracketedProdMatch) {
    producerMatchStr = bracketedProdMatch[0];
    const name = bracketedProdMatch[1] || bracketedProdMatch[2];
    detectedProducer = name.trim().replace(/^@+/, '').replace(/^by\s+/i, '').replace(/^[\s\-_.:]+|[\s\-_.:]+$/g, '').toUpperCase();
  } else {
    // b) @handle anywhere: @808mafia, @MURDABEATZ, @nickmira, @producer
    const atProdRegex = /(?:^|[\s_\-,])@([a-zA-Z0-9_\-\.]+)(?=[\s_\-,\)\]\}]|$)/i;
    const atProdMatch = working.match(atProdRegex);
    if (atProdMatch) {
      producerMatchStr = atProdMatch[0].trim();
      detectedProducer = atProdMatch[1].trim().replace(/^[\s\-_.:]+|[\s\-_.:]+$/g, '').toUpperCase();
    } else {
      // c) Unbracketed prod tag: "prod. by serrot", "prodbyfrancisco", "prod. Murda", "produced by Metro", "prod. by Metro Boomin"
      const unbracketedProdRegex = /(?:^|[\s_\-,])((?:prodby|prod(?:uced)?\.?\s+by\b|prod(?:uced)?\.?|prod\s*[:\-_])\s*([a-zA-Z0-9_\-\.]+(?:\s+[a-zA-Z0-9_\-\.]+)*?))(?=\s*[-_,]|\s+\d{2,3}\s*bpm|\s*[\)\]\}]|$)/i;
      const unbracketedProdMatch = working.match(unbracketedProdRegex);
      if (unbracketedProdMatch) {
        producerMatchStr = unbracketedProdMatch[1];
        detectedProducer = unbracketedProdMatch[2].trim().replace(/^by\s+/i, '').replace(/^[\s\-_.:]+|[\s\-_.:]+$/g, '').toUpperCase();
      } else {
        // d) Inline within comma/parentheses e.g. "Sunburst (140BPM, Gmaj, prod by Metro)"
        const inlineProdRegex = /((?:prodby|prod(?:uced)?\.?\s+by\b|prod(?:uced)?\.?|prod\s*[:\-_])\s*([a-zA-Z0-9_\-\.]+(?:\s+[a-zA-Z0-9_\-\.]+)*?))(?=\s*[-_,]|\s+\d{2,3}\s*bpm|\s*[\)\]\}]|$)/i;
        const inlineProdMatch = working.match(inlineProdRegex);
        if (inlineProdMatch) {
          producerMatchStr = inlineProdMatch[1];
          detectedProducer = inlineProdMatch[2].trim().replace(/^by\s+/i, '').replace(/^[\s\-_.:]+|[\s\-_.:]+$/g, '').toUpperCase();
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 2. EXTRACT BPM
  // ---------------------------------------------------------------------------
  // Priority 1: Explicit BPM indicator: "120bpm", "140_BPM", "85 bpm", "(130 bpm)", "85_bpm"
  const explicitBpmRegex = /(?:[\(\[\{]\s*)?(?:(\d{2,3})[\s_\-]*bpm|bpm[\s_\-:=]*(\d{2,3}))(?:\s*[\)\]\}])?/i;
  const explicitBpmMatch = working.match(explicitBpmRegex);
  if (explicitBpmMatch) {
    const val = parseInt(explicitBpmMatch[1] || explicitBpmMatch[2], 10);
    if (val >= 40 && val <= 300) {
      detectedBpm = val;
      bpmMatchStr = explicitBpmMatch[0];
    }
  }

  // Priority 2: Standalone 2-3 digit number (50 - 240) delimited by _ or -
  if (!detectedBpm) {
    const standaloneBpmRegex = /(?:^|[_\-\s\(\[])([5-9]\d|1\d\d|2[0-3]\d)(?=[_\-\s\)\]]|$)/g;
    let m;
    while ((m = standaloneBpmRegex.exec(working)) !== null) {
      const val = parseInt(m[1], 10);
      if (val >= 50 && val <= 240) {
        detectedBpm = val;
        bpmMatchStr = m[0];
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. EXTRACT MUSICAL KEY
  // ---------------------------------------------------------------------------
  // a) Explicit "key: X"
  const explicitKeyPrefixRegex = /(?:[\(\[\{]\s*)?(?:key\s*[:=\-_]\s*)([A-Ga-g][#b]?)(?:[\s_\-]*(maj(?:or)?|min(?:or)?|moll|dur|m))?(?:\s*[\)\]\}])?/i;
  // b) Accidental roots (C#, Db, F#, Ab, etc.) with or without quality: (C#m, F# Minor, D# Major, Abm, Bbmin, C#_Minor, F#)
  const accidentalKeyRegex = /(?:[\(\[\{]\s*)?([A-Ga-g][#b])(?:[\s_\-]*)(maj(?:or)?|min(?:or)?|moll|dur|m)?(?:\s*[\)\]\}])?(?=[\s_\-\)\]\},]|$)/i;
  // c) Natural roots with explicit quality: Emin, Gmaj, A Minor, C Major, E-minor, etc.
  const naturalKeyWithQualityRegex = /(?:[\(\[\{]\s*)?([A-Ga-g])(?:[\s_\-]*)(maj(?:or)?|min(?:or)?|moll|dur)(?:\s*[\)\]\}])?(?=[\s_\-\)\]\},]|$)/i;
  // d) Natural roots with 'min' or 'm' delimited: Emin, Gmin, Am, Em, etc.
  const naturalKeySingleMRegex = /(?:^|[\s_\-\(\[\{,])([A-Ga-g])(?:min|m)(?=[\s_\-\)\]\},]|$)/i;

  const mExplicit = working.match(explicitKeyPrefixRegex);
  const mAccidental = working.match(accidentalKeyRegex);
  const mNaturalQuality = working.match(naturalKeyWithQualityRegex);
  const mNaturalSingleM = working.match(naturalKeySingleMRegex);

  let chosenKeyMatch: RegExpMatchArray | null = null;
  let root = '';
  let quality: string | undefined = undefined;

  if (mExplicit) {
    chosenKeyMatch = mExplicit;
    root = mExplicit[1];
    quality = mExplicit[2];
  } else if (mAccidental) {
    chosenKeyMatch = mAccidental;
    root = mAccidental[1];
    quality = mAccidental[2];
  } else if (mNaturalQuality) {
    chosenKeyMatch = mNaturalQuality;
    root = mNaturalQuality[1];
    quality = mNaturalQuality[2];
  } else if (mNaturalSingleM) {
    chosenKeyMatch = mNaturalSingleM;
    root = mNaturalSingleM[1];
    quality = 'min';
  }

  if (chosenKeyMatch && root) {
    keyMatchStr = chosenKeyMatch[0].trim();
    const normRoot = normalizeRoot(root);
    const normQuality = normalizeQuality(quality);
    detectedKey = `${normRoot} ${normQuality}`;
  }

  // ---------------------------------------------------------------------------
  // 4. CLEAN AND FORMAT TITLE
  // ---------------------------------------------------------------------------
  let title = working;

  // Remove Looperman prefix first if present (e.g. looperman-l-1234567-0123456-)
  title = title.replace(/^looperman-[a-z]-\d+-\d+-?/i, '');

  // Strip matched producer
  if (producerMatchStr) {
    title = title.replace(producerMatchStr, ' ');
  }

  // Strip matched BPM
  if (bpmMatchStr) {
    title = title.replace(bpmMatchStr, ' ');
  }

  // Strip matched Key
  if (keyMatchStr) {
    title = title.replace(keyMatchStr, ' ');
  }

  // Strip empty brackets/parentheses and artifacts leftover (e.g. ( ), ( , ), [ ])
  title = title
    .replace(/[\(\[\{][\s,_\-]*[\)\]\}]/g, ' ')
    .replace(/,\s*,/g, ' ')
    .replace(/[,;]/g, ' ');

  // Clean unmatched brackets if any were orphaned by token removal
  const openParens = (title.match(/\(/g) || []).length;
  const closeParens = (title.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    title = title.replace(/[\(\)]/g, ' ');
  }
  const openBrackets = (title.match(/\[/g) || []).length;
  const closeBrackets = (title.match(/\]/g) || []).length;
  if (openBrackets !== closeBrackets) {
    title = title.replace(/[\[\]]/g, ' ');
  }

  // Replace kebab-case hyphens (e.g. "ambient-texture" -> "ambient texture")
  title = title.replace(/([a-zA-Z0-9])-([a-zA-Z0-9])/g, '$1 $2');

  // Replace underscores and multiple hyphens with clean spacing
  title = title
    .replace(/_/g, ' ')
    .replace(/\s*-\s*-+\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim();

  // Strip leading and trailing hyphens, dots, colons, underscores
  title = title.replace(/^[\s\-_.:]+|[\s\-_.:]+$/g, '').trim();

  // If title became empty, fallback to base name without extension
  if (!title) {
    title = baseName.replace(/\.[a-zA-Z0-9]{2,5}$/i, '').replace(/_/g, ' ').trim();
  }

  if (!title) {
    title = 'SAMPLE';
  }

  // Format title: uppercase for display styling
  title = title.toUpperCase();

  // Construct detectedSummary badge (e.g. "Detected: 130 BPM • F# MIN • PROD. MURDA")
  const summaryParts: string[] = [];
  if (detectedBpm) summaryParts.push(`${detectedBpm} BPM`);
  if (detectedKey) summaryParts.push(detectedKey);
  if (detectedProducer) summaryParts.push(`PROD. ${detectedProducer}`);
  const detectedSummary = summaryParts.length > 0 ? `Detected: ${summaryParts.join(' • ')}` : undefined;

  return {
    raw,
    title,
    bpm: detectedBpm,
    key: detectedKey,
    producer: detectedProducer,
    detectedSummary,
  };
}
