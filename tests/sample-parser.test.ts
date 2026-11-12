import test from 'node:test';
import assert from 'node:assert';
import { parseSampleFileName, normalizeRoot, normalizeQuality } from '../src/core/sample-parser.ts';

test('SampleParser: Helper normalization functions', () => {
  // Root normalization
  assert.strictEqual(normalizeRoot('e'), 'E');
  assert.strictEqual(normalizeRoot('c#'), 'C#');
  assert.strictEqual(normalizeRoot('C#'), 'C#');
  assert.strictEqual(normalizeRoot('csharp'), 'C#');
  assert.strictEqual(normalizeRoot('ab'), 'Ab');
  assert.strictEqual(normalizeRoot('Ab'), 'Ab');
  assert.strictEqual(normalizeRoot('bflat'), 'Bb');
  assert.strictEqual(normalizeRoot('g'), 'G');

  // Quality normalization
  assert.strictEqual(normalizeQuality('m'), 'MIN');
  assert.strictEqual(normalizeQuality('min'), 'MIN');
  assert.strictEqual(normalizeQuality('minor'), 'MIN');
  assert.strictEqual(normalizeQuality('moll'), 'MIN');
  assert.strictEqual(normalizeQuality('maj'), 'MAJ');
  assert.strictEqual(normalizeQuality('major'), 'MAJ');
  assert.strictEqual(normalizeQuality('dur'), 'MAJ');
  assert.strictEqual(normalizeQuality(undefined), 'MAJ');
});

test('SampleParser: BPM Detection across various formats', () => {
  assert.strictEqual(parseSampleFileName('loop_120bpm.wav').bpm, 120);
  assert.strictEqual(parseSampleFileName('melody_140_BPM.mp3').bpm, 140);
  assert.strictEqual(parseSampleFileName('guitar 85 bpm.wav').bpm, 85);
  assert.strictEqual(parseSampleFileName('trap (130 bpm).wav').bpm, 130);
  assert.strictEqual(parseSampleFileName('synth [128 BPM].wav').bpm, 128);
  assert.strictEqual(parseSampleFileName('piano_85_bpm.wav').bpm, 85);
  assert.strictEqual(parseSampleFileName('bass_bpm-125.wav').bpm, 125);
  assert.strictEqual(parseSampleFileName('SO_FL_120_emin_loop.wav').bpm, 120);

  // Out of range or non-BPM numbers shouldn't be parsed as BPM
  assert.strictEqual(parseSampleFileName('808_sub_bass.wav').bpm, undefined);
  assert.strictEqual(parseSampleFileName('synth_2024_drop.wav').bpm, undefined);
});

test('SampleParser: Key Detection & Standard Normalization', () => {
  // Instruction examples: Emin, C#m, F# Minor, D# Major, Abm, Gmaj, Bbmin, C#_Minor
  assert.strictEqual(parseSampleFileName('track_Emin_120bpm.wav').key, 'E MIN');
  assert.strictEqual(parseSampleFileName('track_C#m_140bpm.wav').key, 'C# MIN');
  assert.strictEqual(parseSampleFileName('track F# Minor 130bpm.wav').key, 'F# MIN');
  assert.strictEqual(parseSampleFileName('track D# Major 150bpm.wav').key, 'D# MAJ');
  assert.strictEqual(parseSampleFileName('track_Abm_90bpm.wav').key, 'Ab MIN');
  assert.strictEqual(parseSampleFileName('track_Gmaj_120bpm.wav').key, 'G MAJ');
  assert.strictEqual(parseSampleFileName('track_Bbmin_130bpm.wav').key, 'Bb MIN');
  assert.strictEqual(parseSampleFileName('track_C#_Minor_110bpm.wav').key, 'C# MIN');

  // Additional key variations
  assert.strictEqual(parseSampleFileName('piano_Am_140bpm.wav').key, 'A MIN');
  assert.strictEqual(parseSampleFileName('lead C Major 120bpm.wav').key, 'C MAJ');
  assert.strictEqual(parseSampleFileName('arp (F# MIN) 130bpm.wav').key, 'F# MIN');
  assert.strictEqual(parseSampleFileName('sample key: Eb Minor 95bpm.wav').key, 'Eb MIN');
});

test('SampleParser: Producer Detection & Sanitization', () => {
  // Instruction examples: "prod. by serrot", "prodbyfrancisco", "@808mafia", "(prod. Murda)"
  assert.strictEqual(parseSampleFileName('Trap Loop (prod. by serrot) 140bpm.wav').producer, 'SERROT');
  assert.strictEqual(parseSampleFileName('Vintage Piano 85bpm prodbyfrancisco.wav').producer, 'FRANCISCO');
  assert.strictEqual(parseSampleFileName('Midnight Drive 128bpm @808mafia.wav').producer, '808MAFIA');
  assert.strictEqual(parseSampleFileName('(prod. Murda) Savage Beat 140bpm.wav').producer, 'MURDA');

  // Additional producer variations
  assert.strictEqual(parseSampleFileName('Dark Night 130bpm @MURDABEATZ.wav').producer, 'MURDABEATZ');
  assert.strictEqual(parseSampleFileName('Love Scars 160bpm @nickmira.wav').producer, 'NICKMIRA');
  assert.strictEqual(parseSampleFileName('Sunburst (140BPM, Gmaj, prod by Metro).wav').producer, 'METRO');
  assert.strictEqual(parseSampleFileName('prod. by Metro Boomin - Space Cadet 140bpm.wav').producer, 'METRO BOOMIN');
  assert.strictEqual(parseSampleFileName('Lil Baby Loop (130 bpm) @producer.wav').producer, 'PRODUCER');
});

test('SampleParser: Title Cleaning and Formatting', () => {
  const parsed1 = parseSampleFileName('Trap Melody (prod. by serrot) 140bpm C#m.wav');
  assert.strictEqual(parsed1.title, 'TRAP MELODY');
  assert.strictEqual(parsed1.bpm, 140);
  assert.strictEqual(parsed1.key, 'C# MIN');
  assert.strictEqual(parsed1.producer, 'SERROT');

  const parsed2 = parseSampleFileName('DARK NIGHT_130BPM_F# MINOR_@MURDABEATZ.wav');
  assert.strictEqual(parsed2.title, 'DARK NIGHT');
  assert.strictEqual(parsed2.bpm, 130);
  assert.strictEqual(parsed2.key, 'F# MIN');
  assert.strictEqual(parsed2.producer, 'MURDABEATZ');

  const parsed3 = parseSampleFileName('Vintage_Piano_85_bpm_Abm_prodbyfrancisco.mp3');
  assert.strictEqual(parsed3.title, 'VINTAGE PIANO');
  assert.strictEqual(parsed3.bpm, 85);
  assert.strictEqual(parsed3.key, 'Ab MIN');
  assert.strictEqual(parsed3.producer, 'FRANCISCO');

  const parsed4 = parseSampleFileName('[FREE] Lil Baby Type Loop - Pain (130 bpm) (C# Min) @producer.wav');
  assert.strictEqual(parsed4.title, '[FREE] LIL BABY TYPE LOOP - PAIN');

  const parsed5 = parseSampleFileName('140_BPM_C#m.wav');
  // Title fallback when entire filename consists of metadata
  assert.strictEqual(parsed5.title.length > 0, true);
});

test('SampleParser: Splice Naming Conventions', () => {
  const res1 = parseSampleFileName('SO_FL_120_emin_melodic_loop.wav');
  assert.strictEqual(res1.bpm, 120);
  assert.strictEqual(res1.key, 'E MIN');
  assert.strictEqual(res1.title, 'SO FL MELODIC LOOP');

  const res2 = parseSampleFileName('splice_guitar_loop_Am_140bpm.wav');
  assert.strictEqual(res2.bpm, 140);
  assert.strictEqual(res2.key, 'A MIN');
  assert.strictEqual(res2.title, 'SPLICE GUITAR LOOP');

  const res3 = parseSampleFileName('CGS_130_Gmin_vocal_lead.wav');
  assert.strictEqual(res3.bpm, 130);
  assert.strictEqual(res3.key, 'G MIN');
  assert.strictEqual(res3.title, 'CGS VOCAL LEAD');
});

test('SampleParser: Cymatics Naming Conventions', () => {
  const res1 = parseSampleFileName('Cymatics - Odyssey - Melody Loop 14 - 138 BPM C# Minor.wav');
  assert.strictEqual(res1.bpm, 138);
  assert.strictEqual(res1.key, 'C# MIN');
  assert.strictEqual(res1.title, 'CYMATICS - ODYSSEY - MELODY LOOP 14');

  const res2 = parseSampleFileName('Cymatics - Titan Melody 4 - 150 BPM D# Maj.wav');
  assert.strictEqual(res2.bpm, 150);
  assert.strictEqual(res2.key, 'D# MAJ');
  assert.strictEqual(res2.title, 'CYMATICS - TITAN MELODY 4');
});

test('SampleParser: Looperman Naming Conventions', () => {
  const res1 = parseSampleFileName('looperman-l-1234567-0123456-pianoloop-140bpm-E-minor.wav');
  assert.strictEqual(res1.bpm, 140);
  assert.strictEqual(res1.key, 'E MIN');
  assert.strictEqual(res1.title, 'PIANOLOOP');

  const res2 = parseSampleFileName('looperman-l-9876543-0987654-ambient-texture-110bpm-C#-Minor.wav');
  assert.strictEqual(res2.bpm, 110);
  assert.strictEqual(res2.key, 'C# MIN');
  assert.strictEqual(res2.title, 'AMBIENT TEXTURE');
});

test('SampleParser: Detected Summary Badge Output', () => {
  const resAll = parseSampleFileName('Trap Melody (prod. by serrot) 140bpm C#m.wav');
  assert.strictEqual(resAll.detectedSummary, 'Detected: 140 BPM • C# MIN • PROD. SERROT');

  const resBpmKey = parseSampleFileName('Cymatics - Odyssey - Melody Loop 14 - 138 BPM C# Minor.wav');
  assert.strictEqual(resBpmKey.detectedSummary, 'Detected: 138 BPM • C# MIN');

  const resBpmOnly = parseSampleFileName('Drums_128bpm.wav');
  assert.strictEqual(resBpmOnly.detectedSummary, 'Detected: 128 BPM');

  const resNone = parseSampleFileName('plain_drum_loop.wav');
  assert.strictEqual(resNone.detectedSummary, undefined);
});
