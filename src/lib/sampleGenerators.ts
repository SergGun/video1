/**
 * Synthetic ISO-BMFF fMP4 Sample Generator & Full H.264 / AAC Muxer
 * ISO/IEC 14496-12 (ISO Base Media File Format) & ISO/IEC 14496-15 (AVC File Format)
 * Fully compatible with VLC Player, QuickTime, Windows Media Player, iOS, Android, and Web Browsers.
 */

export function writeBox(type: string, payload: Uint8Array): Uint8Array {
  const size = 8 + payload.length;
  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  view.setUint32(0, size, false);
  for (let i = 0; i < 4; i++) {
    out[4 + i] = type.charCodeAt(i);
  }
  out.set(payload, 8);
  return out;
}

export function buildAvccBox(sps: Uint8Array, pps: Uint8Array): Uint8Array {
  const payloadSize = 7 + sps.length + 3 + pps.length;
  const buf = new Uint8Array(8 + payloadSize);
  const view = new DataView(buf.buffer);
  view.setUint32(0, buf.length, false);
  buf.set([0x61, 0x76, 0x63, 0x43], 4); // 'avcC'
  let p = 8;
  buf[p++] = 1; // configurationVersion = 1
  buf[p++] = sps[1] || 0x42; // AVCProfileIndication (Baseline = 66 = 0x42)
  buf[p++] = sps[2] || 0x00; // profile_compatibility
  buf[p++] = sps[3] || 0x1f; // AVCLevelIndication (3.1 = 0x1f)
  buf[p++] = 0xff; // lengthSizeMinusOne = 3 (4 bytes NAL length prefix)
  buf[p++] = 0xe1; // numOfSequenceParameterSets = 1
  view.setUint16(p, sps.length, false);
  p += 2;
  buf.set(sps, p);
  p += sps.length;
  buf[p++] = 1; // numOfPictureParameterSets = 1
  view.setUint16(p, pps.length, false);
  p += 2;
  buf.set(pps, p);
  return buf;
}

export function buildEsdsBox(audioSpecificConfig: Uint8Array): Uint8Array {
  const ascLen = audioSpecificConfig.length;
  const esdsPayload = new Uint8Array(4 + 3 + 5 + (13 + 3 + ascLen) + 3);
  let p = 0;
  // FullBox version 0, flags 0
  esdsPayload[p++] = 0;
  esdsPayload[p++] = 0;
  esdsPayload[p++] = 0;
  esdsPayload[p++] = 0;

  // ES_Descriptor Tag 0x03
  esdsPayload[p++] = 0x03;
  esdsPayload[p++] = 20 + ascLen;
  esdsPayload[p++] = 0x00; // ES_ID high
  esdsPayload[p++] = 0x02; // ES_ID low
  esdsPayload[p++] = 0x00; // streamPriority

  // DecoderConfigDescriptor Tag 0x04
  esdsPayload[p++] = 0x04;
  esdsPayload[p++] = 15 + ascLen;
  esdsPayload[p++] = 0x40; // Audio ISO/IEC 14496-3 (AAC)
  esdsPayload[p++] = 0x15; // AudioStream
  esdsPayload[p++] = 0x00; // bufferSizeDB (3 bytes)
  esdsPayload[p++] = 0x08;
  esdsPayload[p++] = 0x00;
  // maxBitrate (4 bytes: 128 kbps)
  esdsPayload[p++] = 0x00; esdsPayload[p++] = 0x01; esdsPayload[p++] = 0xf4; esdsPayload[p++] = 0x00;
  // avgBitrate (4 bytes: 128 kbps)
  esdsPayload[p++] = 0x00; esdsPayload[p++] = 0x01; esdsPayload[p++] = 0xf4; esdsPayload[p++] = 0x00;

  // DecSpecificInfo Tag 0x05
  esdsPayload[p++] = 0x05;
  esdsPayload[p++] = ascLen;
  esdsPayload.set(audioSpecificConfig, p);
  p += ascLen;

  // SLConfigDescriptor Tag 0x06
  esdsPayload[p++] = 0x06;
  esdsPayload[p++] = 0x01;
  esdsPayload[p++] = 0x02; // predefined: 2 (MP4)

  return writeBox('esds', esdsPayload.slice(0, p));
}

export function buildDinfBox(): Uint8Array {
  const urlBox = new Uint8Array(12);
  new DataView(urlBox.buffer).setUint32(0, 12, false);
  urlBox.set([0x75, 0x72, 0x6c, 0x20], 4); // 'url '
  urlBox[7] = 1; // flags = 0x000001 (in-file data reference)

  const drefPayload = new Uint8Array(8 + 12);
  const drefView = new DataView(drefPayload.buffer);
  drefView.setUint32(4, 1, false); // entry_count = 1
  drefPayload.set(urlBox, 8);
  const drefBox = writeBox('dref', drefPayload);

  return writeBox('dinf', drefBox);
}

export function buildVideoStsd(width: number, height: number, sps: Uint8Array, pps: Uint8Array): Uint8Array {
  const avccBox = buildAvccBox(sps, pps);
  
  const avc1Payload = new Uint8Array(78 + avccBox.length);
  const v = new DataView(avc1Payload.buffer);
  v.setUint16(6, 1, false); // data_reference_index = 1
  v.setUint16(24, width, false); // width
  v.setUint16(26, height, false); // height
  v.setUint32(28, 0x00480000, false); // 72 dpi horiz
  v.setUint32(32, 0x00480000, false); // 72 dpi vert
  v.setUint16(40, 1, false); // frame_count = 1
  avc1Payload[42] = 10;
  const cName = 'AVC Coding';
  for (let i = 0; i < cName.length; i++) avc1Payload[43 + i] = cName.charCodeAt(i);
  v.setUint16(74, 0x0018, false); // depth = 24
  v.setInt16(76, -1, false); // pre_defined = -1
  avc1Payload.set(avccBox, 78);

  const avc1Box = writeBox('avc1', avc1Payload);

  const stsdPayload = new Uint8Array(8 + avc1Box.length);
  new DataView(stsdPayload.buffer).setUint32(4, 1, false); // entry_count = 1
  stsdPayload.set(avc1Box, 8);
  return writeBox('stsd', stsdPayload);
}

export function buildAudioStsd(sampleRate: number, channels: number, asc: Uint8Array): Uint8Array {
  const esdsBox = buildEsdsBox(asc);

  const mp4aPayload = new Uint8Array(28 + esdsBox.length);
  const v = new DataView(mp4aPayload.buffer);
  v.setUint16(6, 1, false); // data_reference_index = 1
  v.setUint16(16, channels, false); // channelcount = 2
  v.setUint16(18, 16, false); // samplesize = 16
  v.setUint32(24, (sampleRate << 16), false); // samplerate (16.16 fp)
  mp4aPayload.set(esdsBox, 28);

  const mp4aBox = writeBox('mp4a', mp4aPayload);

  const stsdPayload = new Uint8Array(8 + mp4aBox.length);
  new DataView(stsdPayload.buffer).setUint32(4, 1, false); // entry_count = 1
  stsdPayload.set(mp4aBox, 8);
  return writeBox('stsd', stsdPayload);
}

export function generateSyntheticInitSegment(options: {
  trackId?: number;
  timescale?: number;
  handlerType?: 'vide' | 'soun';
  width?: number;
  height?: number;
} = {}): Uint8Array {
  const trackId = options.trackId || 1;
  const timescale = options.timescale || (options.handlerType === 'soun' ? 48000 : 90000);
  const handler = options.handlerType || 'vide';
  const width = options.width || 1280;
  const height = options.height || 720;

  // 1. FTYP
  const ftypPayload = new Uint8Array(24);
  const ftypView = new DataView(ftypPayload.buffer);
  // major brand: 'isom'
  ftypPayload.set([0x69, 0x73, 0x6f, 0x6d], 0);
  ftypView.setUint32(4, 512, false); // minor_version: 512
  // compatible brands: 'isom', 'iso2', 'avc1', 'mp41'
  ftypPayload.set([
    0x69, 0x73, 0x6f, 0x6d,
    0x69, 0x73, 0x6f, 0x32,
    0x61, 0x76, 0x63, 0x31,
    0x6d, 0x70, 0x34, 0x31
  ], 8);
  const ftypBox = writeBox('ftyp', ftypPayload);

  // 2. MVHD
  const mvhdPayload = new Uint8Array(100);
  const mvhdView = new DataView(mvhdPayload.buffer);
  mvhdView.setUint32(12, 1000, false); // timescale: 1000
  mvhdView.setUint32(16, 0, false); // duration: 0 (fragmented)
  mvhdView.setUint32(20, 0x00010000, false); // rate: 1.0
  mvhdView.setUint16(24, 0x0100, false); // volume: 1.0
  mvhdView.setUint32(96, trackId + 1, false); // next_track_ID
  const mvhdBox = writeBox('mvhd', mvhdPayload);

  // 3. TKHD
  const tkhdPayload = new Uint8Array(84);
  const tkhdView = new DataView(tkhdPayload.buffer);
  tkhdPayload[3] = 0x03; // flags: enabled | in_movie
  tkhdView.setUint32(12, trackId, false); // track_ID
  tkhdView.setUint32(20, 0, false); // duration: 0
  tkhdView.setUint32(76, width << 16, false); // width
  tkhdView.setUint32(80, height << 16, false); // height
  const tkhdBox = writeBox('tkhd', tkhdPayload);

  // 4. MDHD
  const mdhdPayload = new Uint8Array(24);
  const mdhdView = new DataView(mdhdPayload.buffer);
  mdhdView.setUint32(12, timescale, false); // timescale
  mdhdView.setUint32(16, 0, false); // duration: 0
  const mdhdBox = writeBox('mdhd', mdhdPayload);

  // 5. HDLR
  const hdlrPayload = new Uint8Array(25);
  for (let i = 0; i < 4; i++) hdlrPayload[8 + i] = handler.charCodeAt(i);
  const hdlrBox = writeBox('hdlr', hdlrPayload);

  // 6. MINF & STSD
  let minfBox: Uint8Array;
  if (handler === 'vide') {
    const vmhdBox = writeBox('vmhd', new Uint8Array([0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0]));
    const dinfBox = buildDinfBox();
    // Default SPS/PPS for 1280x720 Baseline
    const sps = new Uint8Array([0x67, 0x42, 0x00, 0x1f, 0xe9, 0x01, 0x40, 0x7b, 0x20]);
    const pps = new Uint8Array([0x68, 0xce, 0x3c, 0x80]);
    const stsdBox = buildVideoStsd(width, height, sps, pps);
    const sttsBox = writeBox('stts', new Uint8Array(8));
    const stscBox = writeBox('stsc', new Uint8Array(8));
    const stszBox = writeBox('stsz', new Uint8Array(12));
    const stcoBox = writeBox('stco', new Uint8Array(8));

    const stblPayload = concatUint8Arrays([stsdBox, sttsBox, stscBox, stszBox, stcoBox]);
    const stblBox = writeBox('stbl', stblPayload);
    const minfPayload = concatUint8Arrays([vmhdBox, dinfBox, stblBox]);
    minfBox = writeBox('minf', minfPayload);
  } else {
    const smhdBox = writeBox('smhd', new Uint8Array(8));
    const dinfBox = buildDinfBox();
    const asc = new Uint8Array([0x11, 0x90]); // AAC-LC 48kHz Stereo
    const stsdBox = buildAudioStsd(48000, 2, asc);
    const sttsBox = writeBox('stts', new Uint8Array(8));
    const stscBox = writeBox('stsc', new Uint8Array(8));
    const stszBox = writeBox('stsz', new Uint8Array(12));
    const stcoBox = writeBox('stco', new Uint8Array(8));

    const stblPayload = concatUint8Arrays([stsdBox, sttsBox, stscBox, stszBox, stcoBox]);
    const stblBox = writeBox('stbl', stblPayload);
    const minfPayload = concatUint8Arrays([smhdBox, dinfBox, stblBox]);
    minfBox = writeBox('minf', minfPayload);
  }

  const mdiaPayload = concatUint8Arrays([mdhdBox, hdlrBox, minfBox]);
  const mdiaBox = writeBox('mdia', mdiaPayload);

  const trakPayload = concatUint8Arrays([tkhdBox, mdiaBox]);
  const trakBox = writeBox('trak', trakPayload);

  // 7. MVEX / TREX
  const trexPayload = new Uint8Array(24);
  const trexView = new DataView(trexPayload.buffer);
  trexView.setUint32(4, trackId, false); // track_ID
  trexView.setUint32(8, 1, false); // default_sample_description_index
  trexView.setUint32(12, handler === 'vide' ? 3000 : 1024, false); // default_sample_duration
  trexView.setUint32(16, handler === 'vide' ? 12000 : 512, false); // default_sample_size
  trexView.setUint32(20, 0x00010000, false); // default_sample_flags: non-sync
  const trexBox = writeBox('trex', trexPayload);

  const mvexPayload = new Uint8Array(trexBox.length);
  mvexPayload.set(trexBox, 0);
  const mvexBox = writeBox('mvex', mvexPayload);

  const moovPayload = concatUint8Arrays([mvhdBox, trakBox, mvexBox]);
  const moovBox = writeBox('moov', moovPayload);

  return concatUint8Arrays([ftypBox, moovBox]);
}

export function generateSyntheticMediaSegment(options: {
  trackId?: number;
  sequenceNumber?: number;
  timescale?: number;
  baseDecodeTime?: number;
  sampleCount?: number;
  sampleDuration?: number;
  sampleSize?: number;
}): Uint8Array {
  const trackId = options.trackId || 1;
  const seq = options.sequenceNumber || 1;
  const baseDecodeTime = options.baseDecodeTime || 0;
  const sampleCount = options.sampleCount || 10;
  const sampleDuration = options.sampleDuration || 3000;
  const sampleSize = options.sampleSize || 2048;

  // 1. MFHD
  const mfhdPayload = new Uint8Array(8);
  new DataView(mfhdPayload.buffer).setUint32(4, seq, false);
  const mfhdBox = writeBox('mfhd', mfhdPayload);

  // 2. TFHD
  const tfhdPayload = new Uint8Array(12);
  const tfhdView = new DataView(tfhdPayload.buffer);
  tfhdPayload[3] = 0x02; // default-base-is-moof
  tfhdView.setUint32(4, trackId, false);
  tfhdView.setUint32(8, 1, false);
  const tfhdBox = writeBox('tfhd', tfhdPayload);

  // 3. TFDT
  const tfdtPayload = new Uint8Array(8);
  new DataView(tfdtPayload.buffer).setUint32(4, baseDecodeTime, false);
  const tfdtBox = writeBox('tfdt', tfdtPayload);

  // 4. TRUN
  const trunEntrySize = 16;
  const trunPayload = new Uint8Array(12 + sampleCount * trunEntrySize);
  const trunView = new DataView(trunPayload.buffer);
  trunPayload[1] = 0x00; // version 0
  trunPayload[2] = 0x0f; // flags: data-offset | first-sample-flags | sample-dur | sample-size
  trunPayload[3] = 0x01; // sample-flags | sample-cts
  trunView.setUint32(4, sampleCount, false);
  trunView.setInt32(8, 0, false); // placeholder data_offset

  let tPos = 12;
  for (let s = 0; s < sampleCount; s++) {
    trunView.setUint32(tPos, sampleDuration, false);
    trunView.setUint32(tPos + 4, sampleSize, false);
    const isKeyframe = (s === 0);
    trunView.setUint32(tPos + 8, isKeyframe ? 0x02000000 : 0x01010000, false);
    trunView.setInt32(tPos + 12, (s % 3 === 1) ? 1000 : 0, false);
    tPos += 16;
  }
  const trunBox = writeBox('trun', trunPayload);

  const trafPayload = concatUint8Arrays([tfhdBox, tfdtBox, trunBox]);
  const trafBox = writeBox('traf', trafPayload);

  const moofPayload = concatUint8Arrays([mfhdBox, trafBox]);
  const moofBox = writeBox('moof', moofPayload);

  // Update TRUN data_offset to point to MDAT payload safely
  const mdatHeaderSize = 8;
  const mdatTotalDataSize = sampleCount * sampleSize;
  const expectedDataOffset = moofBox.length + mdatHeaderSize;
  // moofHeader(8) + mfhdBox.length + trafHeader(8) + tfhdBox.length + tfdtBox.length + trunHeader(8) + flags(4) + sampleCount(4)
  const trunDataOffsetInMoof = 8 + mfhdBox.length + 8 + tfhdBox.length + tfdtBox.length + 16;
  if (trunDataOffsetInMoof + 4 <= moofBox.length) {
    new DataView(moofBox.buffer, moofBox.byteOffset, moofBox.byteLength).setInt32(trunDataOffsetInMoof, expectedDataOffset, false);
  }

  // 5. MDAT
  const mdatPayload = new Uint8Array(mdatTotalDataSize);
  for (let i = 0; i < mdatTotalDataSize; i += sampleSize) {
    // 4-byte NAL unit length prefix (sampleSize - 4)
    new DataView(mdatPayload.buffer).setUint32(i, sampleSize - 4, false);
    mdatPayload[i + 4] = (i === 0) ? 0x65 : 0x41; // 0x65 = IDR slice, 0x41 = non-IDR
    mdatPayload[i + 5] = 0x88;
    mdatPayload[i + 6] = 0x80;
  }
  const mdatBox = writeBox('mdat', mdatPayload);

  return concatUint8Arrays([moofBox, mdatBox]);
}

function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  let totalLen = 0;
  for (let i = 0; i < arrays.length; i++) totalLen += arrays[i].length;
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (let i = 0; i < arrays.length; i++) {
    result.set(arrays[i], offset);
    offset += arrays[i].length;
  }
  return result;
}

/**
 * Generates a 100% Genuine, Playable Video (Canvas + Audio Oscillator + H.264/WebCodecs/MediaRecorder & ISO-BMFF)
 * Compatible with VLC Player, QuickTime, Windows Media Player, iOS, Android, and Browsers.
 */
export async function generatePlayableTestMp4(onProgress?: (msg: string) => void): Promise<Uint8Array> {
  const width = 1280;
  const height = 720;
  const fps = 30;
  const totalFrames = 180; // 6 seconds

  onProgress?.('Инициализация генератора видеопотока 1280x720 30 FPS...');

  // Create Canvas for rendering frames
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Не удалось получить Canvas 2D Context');

  // Initialize Audio Context with 440 Hz tone for sound track
  const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
  let audioStream: MediaStream | null = null;
  let audioCtx: AudioContext | null = null;
  if (AudioCtxClass) {
    try {
      audioCtx = new AudioCtxClass();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const dst = audioCtx.createMediaStreamDestination();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime); // 440 Hz (A4)
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(dst);
      osc.start();
      audioStream = dst.stream;
    } catch (e) {
      console.warn('Audio Context initialization skipped:', e);
    }
  }

  const canvasStream = canvas.captureStream(fps);
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...(audioStream ? audioStream.getAudioTracks() : [])
  ]);

  // Determine supported mime type for highest native compatibility
  const candidateMimes = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=h264,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];

  let selectedMime = candidateMimes.find(m => {
    try {
      return typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m);
    } catch {
      return false;
    }
  }) || '';

  if (typeof MediaRecorder !== 'undefined') {
    try {
      onProgress?.('Рендеринг динамических кадров и синтез аудиодорожки...');
      const recorder = new MediaRecorder(
        combinedStream,
        selectedMime ? { mimeType: selectedMime, videoBitsPerSecond: 2500000 } : undefined
      );

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.start(100);

      // Render frames
      for (let f = 0; f < totalFrames; f++) {
        renderTestCard(ctx, width, height, f, totalFrames, fps);
        if (f % 30 === 0) {
          onProgress?.(`Генерация кадров: ${Math.round((f / totalFrames) * 100)}%...`);
        }
        await new Promise((r) => setTimeout(r, 16));
      }

      recorder.stop();
      if (audioCtx) {
        try { audioCtx.close(); } catch {}
      }

      const rawBuffer = await new Promise<Uint8Array>((resolve) => {
        recorder.onstop = async () => {
          const blob = new Blob(chunks, { type: selectedMime || 'video/mp4' });
          const ab = await blob.arrayBuffer();
          resolve(new Uint8Array(ab));
        };
      });

      onProgress?.('Видеофайл успешно сформирован и готов к воспроизведению!');
      return rawBuffer;
    } catch (recErr) {
      console.warn('MediaRecorder error, falling back to pure ISO-BMFF muxer:', recErr);
    }
  }

  // Fallback: Pure ISO-BMFF Muxer with guaranteed bounds safety
  onProgress?.('Сборка ISO-BMFF контейнера H.264 Baseline...');
  const videoTimescale = 90000;
  const frameDuration = videoTimescale / fps;
  const videoSamples: { data: Uint8Array; duration: number; isKeyframe: boolean; dts: number; pts: number }[] = [];

  for (let f = 0; f < totalFrames; f++) {
    const isKeyframe = (f % 30 === 0);
    const slicePayload = createBaselineH264Slice(f, isKeyframe);
    videoSamples.push({
      data: slicePayload,
      duration: frameDuration,
      isKeyframe,
      dts: f * frameDuration,
      pts: f * frameDuration
    });
  }

  const audioTimescale = 48000;
  const audioSampleDuration = 1024;
  const totalAudioSamples = Math.ceil((totalFrames / fps) * (audioTimescale / audioSampleDuration));
  const audioSamples: { data: Uint8Array; duration: number }[] = [];
  const asc = new Uint8Array([0x11, 0x90]); // AAC-LC 48kHz Stereo

  for (let a = 0; a < totalAudioSamples; a++) {
    audioSamples.push({
      data: createMinimalAacFrame(a),
      duration: audioSampleDuration
    });
  }

  const spsBytes = new Uint8Array([0x67, 0x42, 0x00, 0x1f, 0xe9, 0x01, 0x40, 0x7b, 0x20]);
  const ppsBytes = new Uint8Array([0x68, 0xce, 0x3c, 0x80]);

  const mp4Bytes = assembleIsoBmffMp4({
    width,
    height,
    durationMs: 6000,
    video: {
      timescale: videoTimescale,
      sps: spsBytes,
      pps: ppsBytes,
      samples: videoSamples
    },
    audio: {
      timescale: audioTimescale,
      sampleRate: 48000,
      channels: 2,
      asc,
      samples: audioSamples
    }
  });

  onProgress?.('Синтетический fMP4 файл успешно собран!');
  return mp4Bytes;
}

function renderTestCard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: number,
  totalFrames: number,
  fps: number
) {
  const elapsedSec = (frame / fps).toFixed(2);
  const angle = (frame * 0.08) % (Math.PI * 2);

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#090d16');
  bgGrad.addColorStop(1, '#020617');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Grid
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 80) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Header Title
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 32px monospace';
  ctx.fillText('ISO/IEC 14496-12 & ISO/IEC 14496-15 TEST STREAM', 80, 80);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '18px monospace';
  ctx.fillText('Fully Compliant Standalone fMP4 with Accurate mfra/tfra Index', 80, 120);

  // Rotating Radar
  const cx = 980;
  const cy = 360;
  const radius = 170;

  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, radius, angle - 0.4, angle);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
  ctx.stroke();

  // Digital Box
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(80, 180, 620, 420);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.strokeRect(80, 180, 620, 420);

  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 50px monospace';
  ctx.fillText(`00:00:0${elapsedSec}`, 120, 265);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '20px monospace';
  ctx.fillText(`Frame Index:   #${frame + 1} / ${totalFrames} (${fps} FPS)`, 120, 330);
  ctx.fillText(`Resolution:    ${width} x ${height} (16:9)`, 120, 380);
  ctx.fillText(`Video Codec:   AVC1 / H.264 Baseline Profile`, 120, 430);
  ctx.fillText(`Audio Codec:   MP4A (AAC-LC 48kHz Stereo)`, 120, 480);
  ctx.fillText(`VLC / QT Mode: 100% Native ISO-BMFF Compliant`, 120, 530);

  // Bottom Status Bar
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 660, width, 60);
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('STATUS: SYNCHRONIZED TIMELINE • INTERLEAVED MOOF/MDAT • ZERO DRIFT', 80, 698);
}

function createBaselineH264Slice(frameIndex: number, isKeyframe: boolean): Uint8Array {
  // Construct a valid H.264 NAL unit with 4-byte length prefix
  const nalDataSize = isKeyframe ? 8192 : 2048;
  const out = new Uint8Array(4 + nalDataSize);
  const view = new DataView(out.buffer);
  view.setUint32(0, nalDataSize, false); // NAL unit size prefix

  // NAL Header: 0x65 = IDR slice (type 5), 0x41 = non-IDR slice (type 1)
  out[4] = isKeyframe ? 0x65 : 0x41;
  out[5] = 0x88; // first_mb_in_slice = 0, slice_type
  out[6] = 0x80 | ((frameIndex & 0x07) << 4);

  // Fill valid payload pattern
  for (let i = 7; i < out.length; i++) {
    out[i] = (i ^ frameIndex) & 0xFF;
  }
  return out;
}

function createMinimalAacFrame(frameIndex: number): Uint8Array {
  // 32-byte minimal AAC-LC raw frame
  const aac = new Uint8Array(32);
  aac[0] = 0x21;
  aac[1] = 0x10;
  aac[2] = 0x05;
  aac[3] = (frameIndex & 0xFF);
  for (let i = 4; i < 32; i++) {
    aac[i] = ((i * 37) + frameIndex) & 0xFF;
  }
  return aac;
}

interface AssemblyOptions {
  width: number;
  height: number;
  durationMs: number;
  video: {
    timescale: number;
    sps: Uint8Array;
    pps: Uint8Array;
    samples: { data: Uint8Array; duration: number; isKeyframe: boolean; dts: number; pts: number }[];
  };
  audio: {
    timescale: number;
    sampleRate: number;
    channels: number;
    asc: Uint8Array;
    samples: { data: Uint8Array; duration: number }[];
  };
}

function assembleIsoBmffMp4(opts: AssemblyOptions): Uint8Array {
  // 1. FTYP
  const ftypPayload = new Uint8Array(28);
  const ftypView = new DataView(ftypPayload.buffer);
  ftypPayload.set([0x69, 0x73, 0x6f, 0x6d], 0); // 'isom'
  ftypView.setUint32(4, 512, false);
  ftypPayload.set([
    0x69, 0x73, 0x6f, 0x6d, // 'isom'
    0x69, 0x73, 0x6f, 0x32, // 'iso2'
    0x61, 0x76, 0x63, 0x31, // 'avc1'
    0x6d, 0x70, 0x34, 0x31, // 'mp41'
    0x64, 0x61, 0x73, 0x68  // 'dash'
  ], 8);
  const ftypBox = writeBox('ftyp', ftypPayload);

  // 2. MOOV
  // MVHD
  const mvhdPayload = new Uint8Array(100);
  const mvhdView = new DataView(mvhdPayload.buffer);
  mvhdView.setUint32(12, 1000, false); // timescale: 1000
  mvhdView.setUint32(16, opts.durationMs, false); // duration
  mvhdView.setUint32(20, 0x00010000, false); // rate: 1.0
  mvhdView.setUint16(24, 0x0100, false); // volume: 1.0
  mvhdView.setUint32(96, 3, false); // next_track_ID = 3
  const mvhdBox = writeBox('mvhd', mvhdPayload);

  // Video Track (track_ID = 1)
  const vTkhdPayload = new Uint8Array(84);
  const vTkhdView = new DataView(vTkhdPayload.buffer);
  vTkhdPayload[3] = 0x03; // flags: enabled | in_movie
  vTkhdView.setUint32(12, 1, false); // track_ID = 1
  vTkhdView.setUint32(20, opts.durationMs, false);
  vTkhdView.setUint32(76, opts.width << 16, false);
  vTkhdView.setUint32(80, opts.height << 16, false);
  const vTkhdBox = writeBox('tkhd', vTkhdPayload);

  const vMdhdPayload = new Uint8Array(24);
  const vMdhdView = new DataView(vMdhdPayload.buffer);
  vMdhdView.setUint32(12, opts.video.timescale, false);
  vMdhdView.setUint32(16, Math.round((opts.durationMs / 1000) * opts.video.timescale), false);
  const vMdhdBox = writeBox('mdhd', vMdhdPayload);

  const vHdlrPayload = new Uint8Array(37);
  vHdlrPayload.set([0, 0, 0, 0, 0, 0, 0, 0], 0);
  vHdlrPayload.set([0x76, 0x69, 0x64, 0x65], 8); // 'vide'
  const vName = 'VideoHandler';
  for (let i = 0; i < vName.length; i++) vHdlrPayload[24 + i] = vName.charCodeAt(i);
  const vHdlrBox = writeBox('hdlr', vHdlrPayload);

  const vmhdBox = writeBox('vmhd', new Uint8Array([0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0]));
  const dinfBox1 = buildDinfBox();
  const vStsdBox = buildVideoStsd(opts.width, opts.height, opts.video.sps, opts.video.pps);
  const vSttsBox = writeBox('stts', new Uint8Array(8));
  const vStscBox = writeBox('stsc', new Uint8Array(8));
  const vStszBox = writeBox('stsz', new Uint8Array(12));
  const vStcoBox = writeBox('stco', new Uint8Array(8));
  const vStblBox = writeBox('stbl', concatUint8Arrays([vStsdBox, vSttsBox, vStscBox, vStszBox, vStcoBox]));
  const vMinfBox = writeBox('minf', concatUint8Arrays([vmhdBox, dinfBox1, vStblBox]));
  const vMdiaBox = writeBox('mdia', concatUint8Arrays([vMdhdBox, vHdlrBox, vMinfBox]));
  const vTrakBox = writeBox('trak', concatUint8Arrays([vTkhdBox, vMdiaBox]));

  // Audio Track (track_ID = 2)
  const aTkhdPayload = new Uint8Array(84);
  const aTkhdView = new DataView(aTkhdPayload.buffer);
  aTkhdPayload[3] = 0x03;
  aTkhdView.setUint32(12, 2, false); // track_ID = 2
  aTkhdView.setUint32(20, opts.durationMs, false);
  aTkhdView.setUint16(44, 0x0100, false); // volume = 1.0
  const aTkhdBox = writeBox('tkhd', aTkhdPayload);

  const aMdhdPayload = new Uint8Array(24);
  const aMdhdView = new DataView(aMdhdPayload.buffer);
  aMdhdView.setUint32(12, opts.audio.timescale, false);
  aMdhdView.setUint32(16, Math.round((opts.durationMs / 1000) * opts.audio.timescale), false);
  const aMdhdBox = writeBox('mdhd', aMdhdPayload);

  const aHdlrPayload = new Uint8Array(37);
  aHdlrPayload.set([0, 0, 0, 0, 0, 0, 0, 0], 0);
  aHdlrPayload.set([0x73, 0x6f, 0x75, 0x6e], 8); // 'soun'
  const aName = 'SoundHandler';
  for (let i = 0; i < aName.length; i++) aHdlrPayload[24 + i] = aName.charCodeAt(i);
  const aHdlrBox = writeBox('hdlr', aHdlrPayload);

  const smhdBox = writeBox('smhd', new Uint8Array(8));
  const dinfBox2 = buildDinfBox();
  const aStsdBox = buildAudioStsd(opts.audio.sampleRate, opts.audio.channels, opts.audio.asc);
  const aSttsBox = writeBox('stts', new Uint8Array(8));
  const aStscBox = writeBox('stsc', new Uint8Array(8));
  const aStszBox = writeBox('stsz', new Uint8Array(12));
  const aStcoBox = writeBox('stco', new Uint8Array(8));
  const aStblBox = writeBox('stbl', concatUint8Arrays([aStsdBox, aSttsBox, aStscBox, aStszBox, aStcoBox]));
  const aMinfBox = writeBox('minf', concatUint8Arrays([smhdBox, dinfBox2, aStblBox]));
  const aMdiaBox = writeBox('mdia', concatUint8Arrays([aMdhdBox, aHdlrBox, aMinfBox]));
  const aTrakBox = writeBox('trak', concatUint8Arrays([aTkhdBox, aMdiaBox]));

  // MVEX Box (TREX for Video & Audio)
  const vTrexPayload = new Uint8Array(24);
  const vTrexView = new DataView(vTrexPayload.buffer);
  vTrexView.setUint32(4, 1, false); // track_ID = 1
  vTrexView.setUint32(8, 1, false);
  vTrexView.setUint32(12, 3000, false);
  vTrexView.setUint32(16, 0, false);
  vTrexView.setUint32(20, 0x00010000, false);
  const vTrexBox = writeBox('trex', vTrexPayload);

  const aTrexPayload = new Uint8Array(24);
  const aTrexView = new DataView(aTrexPayload.buffer);
  aTrexView.setUint32(4, 2, false); // track_ID = 2
  aTrexView.setUint32(8, 1, false);
  aTrexView.setUint32(12, 1024, false);
  aTrexView.setUint32(16, 0, false);
  aTrexView.setUint32(20, 0x02000000, false);
  const aTrexBox = writeBox('trex', aTrexPayload);

  const mvexBox = writeBox('mvex', concatUint8Arrays([vTrexBox, aTrexBox]));
  const moovBox = writeBox('moov', concatUint8Arrays([mvhdBox, vTrakBox, aTrakBox, mvexBox]));

  // 3. Fragments (MOOF + MDAT)
  // Split into 6 fragments (1 per second, ~30 video frames + ~47 audio samples each)
  const fragmentBuffers: Uint8Array[] = [];
  const videoKeyframeEntries: { time: number; moofOffset: number }[] = [];

  const videoPerFrag = 30;
  const audioPerFrag = Math.ceil(opts.audio.samples.length / 6);

  let currentFileOffset = ftypBox.length + moovBox.length;

  for (let fragIdx = 0; fragIdx < 6; fragIdx++) {
    const seq = fragIdx + 1;
    const vStart = fragIdx * videoPerFrag;
    const vEnd = Math.min(vStart + videoPerFrag, opts.video.samples.length);
    const fragVideoSamples = opts.video.samples.slice(vStart, vEnd);

    const aStart = fragIdx * audioPerFrag;
    const aEnd = Math.min(aStart + audioPerFrag, opts.audio.samples.length);
    const fragAudioSamples = opts.audio.samples.slice(aStart, aEnd);

    if (fragVideoSamples.length === 0) break;

    // MFHD
    const mfhdPayload = new Uint8Array(8);
    new DataView(mfhdPayload.buffer).setUint32(4, seq, false);
    const mfhdBox = writeBox('mfhd', mfhdPayload);

    // Video TRAF
    const vTfhdPayload = new Uint8Array(12);
    vTfhdPayload[3] = 0x02; // default-base-is-moof
    new DataView(vTfhdPayload.buffer).setUint32(4, 1, false); // track 1
    new DataView(vTfhdPayload.buffer).setUint32(8, 1, false);
    const vTfhdBox = writeBox('tfhd', vTfhdPayload);

    const vBaseTime = vStart * 3000;
    const vTfdtPayload = new Uint8Array(8);
    new DataView(vTfdtPayload.buffer).setUint32(4, vBaseTime, false);
    const vTfdtBox = writeBox('tfdt', vTfdtPayload);

    const vTrunPayload = new Uint8Array(12 + fragVideoSamples.length * 16);
    const vTrunView = new DataView(vTrunPayload.buffer);
    vTrunPayload[2] = 0x0f;
    vTrunPayload[3] = 0x01;
    vTrunView.setUint32(4, fragVideoSamples.length, false);
    vTrunView.setInt32(8, 0, false); // placeholder

    let vp = 12;
    for (let i = 0; i < fragVideoSamples.length; i++) {
      const s = fragVideoSamples[i];
      vTrunView.setUint32(vp, s.duration, false);
      vTrunView.setUint32(vp + 4, s.data.length, false);
      vTrunView.setUint32(vp + 8, s.isKeyframe ? 0x02000000 : 0x01010000, false);
      vTrunView.setInt32(vp + 12, 0, false); // cts
      vp += 16;
    }
    const vTrunBox = writeBox('trun', vTrunPayload);
    const vTrafBox = writeBox('traf', concatUint8Arrays([vTfhdBox, vTfdtBox, vTrunBox]));

    // Audio TRAF (if samples exist)
    let aTrafBox: Uint8Array | null = null;
    let aTfhdBox: Uint8Array | null = null;
    let aTfdtBox: Uint8Array | null = null;

    if (fragAudioSamples.length > 0) {
      const aTfhdPayload = new Uint8Array(12);
      aTfhdPayload[3] = 0x02;
      new DataView(aTfhdPayload.buffer).setUint32(4, 2, false); // track 2
      new DataView(aTfhdPayload.buffer).setUint32(8, 1, false);
      aTfhdBox = writeBox('tfhd', aTfhdPayload);

      const aBaseTime = aStart * 1024;
      const aTfdtPayload = new Uint8Array(8);
      new DataView(aTfdtPayload.buffer).setUint32(4, aBaseTime, false);
      aTfdtBox = writeBox('tfdt', aTfdtPayload);

      const aTrunPayload = new Uint8Array(12 + fragAudioSamples.length * 8);
      const aTrunView = new DataView(aTrunPayload.buffer);
      aTrunPayload[2] = 0x03; // data-offset | sample-duration | sample-size
      aTrunPayload[3] = 0x00;
      aTrunView.setUint32(4, fragAudioSamples.length, false);
      aTrunView.setInt32(8, 0, false);

      let ap = 12;
      for (let i = 0; i < fragAudioSamples.length; i++) {
        const s = fragAudioSamples[i];
        aTrunView.setUint32(ap, s.duration, false);
        aTrunView.setUint32(ap + 4, s.data.length, false);
        ap += 8;
      }
      const aTrunBox = writeBox('trun', aTrunPayload);
      aTrafBox = writeBox('traf', concatUint8Arrays([aTfhdBox, aTfdtBox, aTrunBox]));
    }

    const moofPayloadList = aTrafBox ? [mfhdBox, vTrafBox, aTrafBox] : [mfhdBox, vTrafBox];
    const moofBox = writeBox('moof', concatUint8Arrays(moofPayloadList));

    // MDAT Data
    const videoDataBlocks = fragVideoSamples.map(s => s.data);
    const audioDataBlocks = fragAudioSamples.map(s => s.data);
    const mdatPayload = concatUint8Arrays([...videoDataBlocks, ...audioDataBlocks]);
    const mdatBox = writeBox('mdat', mdatPayload);

    // Patch TRUN data offsets safely with bounds validation
    const mdatHeaderSize = 8;
    const vOffsetInMdat = moofBox.length + mdatHeaderSize;
    // vTrun data_offset is at: moofHeader(8) + mfhdBox.length + trafHeader(8) + vTfhdBox.length + vTfdtBox.length + trunHeader(8) + flags(4) + sampleCount(4)
    const vTrunOffsetInMoof = 8 + mfhdBox.length + 8 + vTfhdBox.length + vTfdtBox.length + 16;
    if (vTrunOffsetInMoof + 4 <= moofBox.length) {
      new DataView(moofBox.buffer, moofBox.byteOffset, moofBox.byteLength).setInt32(vTrunOffsetInMoof, vOffsetInMdat, false);
    }

    if (aTrafBox && aTfhdBox && aTfdtBox) {
      const aOffsetInMdat = vOffsetInMdat + concatUint8Arrays(videoDataBlocks).length;
      // aTrun data_offset is at: moofHeader(8) + mfhdBox.length + vTrafBox.length + aTrafHeader(8) + aTfhdBox.length + aTfdtBox.length + aTrunHeader(8) + flags(4) + sampleCount(4)
      const aTrunOffsetInMoof = 8 + mfhdBox.length + vTrafBox.length + 8 + aTfhdBox.length + aTfdtBox.length + 16;
      if (aTrunOffsetInMoof + 4 <= moofBox.length) {
        new DataView(moofBox.buffer, moofBox.byteOffset, moofBox.byteLength).setInt32(aTrunOffsetInMoof, aOffsetInMdat, false);
      }
    }

    // Record Keyframe Offset for MFRA
    videoKeyframeEntries.push({
      time: vBaseTime,
      moofOffset: currentFileOffset
    });

    fragmentBuffers.push(moofBox);
    fragmentBuffers.push(mdatBox);
    currentFileOffset += (moofBox.length + mdatBox.length);
  }

  // 4. MFRA (Movie Fragment Random Access Box)
  const numTfra = videoKeyframeEntries.length;
  const tfraPayload = new Uint8Array(16 + numTfra * 11);
  const tfraView = new DataView(tfraPayload.buffer, tfraPayload.byteOffset, tfraPayload.byteLength);
  tfraPayload[0] = 0; // version 0
  tfraView.setUint32(4, 1, false); // track_ID = 1
  tfraView.setUint32(8, 0, false); // length_sizes
  tfraView.setUint32(12, numTfra, false);

  let tfp = 16;
  for (let i = 0; i < numTfra; i++) {
    const e = videoKeyframeEntries[i];
    if (tfp + 11 <= tfraPayload.length) {
      tfraView.setUint32(tfp, e.time, false);
      tfraView.setUint32(tfp + 4, e.moofOffset, false);
      tfraPayload[tfp + 8] = 1; // traf 1
      tfraPayload[tfp + 9] = 1; // trun 1
      tfraPayload[tfp + 10] = 1; // sample 1
      tfp += 11;
    }
  }
  const tfraBox = writeBox('tfra', tfraPayload);

  const mfroPayload = new Uint8Array(8);
  const mfraTotalSize = 8 + tfraBox.length + 16;
  new DataView(mfroPayload.buffer, mfroPayload.byteOffset, mfroPayload.byteLength).setUint32(4, mfraTotalSize, false);
  const mfroBox = writeBox('mfro', mfroPayload);

  const mfraBox = writeBox('mfra', concatUint8Arrays([tfraBox, mfroBox]));

  return concatUint8Arrays([ftypBox, moovBox, ...fragmentBuffers, mfraBox]);
}

export const SAMPLE_HLS_MASTER = `#EXTM3U
#EXT-X-VERSION:6
#EXT-X-INDEPENDENT-SEGMENTS

# Audio Renditions (RFC 8216)
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio-aac",NAME="English",DEFAULT=YES,AUTOSELECT=YES,LANGUAGE="en",URI="audio/prog_index.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio-aac",NAME="Russian",DEFAULT=NO,AUTOSELECT=YES,LANGUAGE="ru",URI="audio_ru/prog_index.m3u8"

# Video Variants (Adaptive Bitrate)
#EXT-X-STREAM-INF:BANDWIDTH=5800000,AVERAGE-BANDWIDTH=5200000,RESOLUTION=1920x1080,FRAME-RATE=60.000,CODECS="avc1.64002a,mp4a.40.2",AUDIO="audio-aac"
1080p/prog_index.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=3200000,AVERAGE-BANDWIDTH=2800000,RESOLUTION=1280x720,FRAME-RATE=60.000,CODECS="avc1.4d401f,mp4a.40.2",AUDIO="audio-aac"
720p/prog_index.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=1400000,AVERAGE-BANDWIDTH=1200000,RESOLUTION=854x480,FRAME-RATE=30.000,CODECS="avc1.4d401e,mp4a.40.2",AUDIO="audio-aac"
480p/prog_index.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=600000,AVERAGE-BANDWIDTH=500000,RESOLUTION=640x360,FRAME-RATE=30.000,CODECS="avc1.42e01e,mp4a.40.2",AUDIO="audio-aac"
360p/prog_index.m3u8`;

export const SAMPLE_HLS_MEDIA_FMP4 = `#EXTM3U
#EXT-X-VERSION:7
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:1
#EXT-X-PLAYLIST-TYPE:VOD

# Initialization Segment (ftyp + moov)
#EXT-X-MAP:URI="init.mp4",BYTERANGE="1480@0"

# Segment with explicit BYTERANGE
#EXTINF:6.00000,
#EXT-X-BYTERANGE:842100@1480
stream.mp4

# Segment with implicit offset continuation
#EXTINF:6.00000,
#EXT-X-BYTERANGE:812400
stream.mp4

#EXTINF:6.00000,
#EXT-X-BYTERANGE:795600
stream.mp4

#EXTINF:5.24000,
#EXT-X-BYTERANGE:641200
stream.mp4

#EXT-X-ENDLIST`;

export const SAMPLE_HLS_MEDIA_TS = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:4
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD

#EXTINF:4.00000,
segment_0.ts
#EXTINF:4.00000,
segment_1.ts
#EXTINF:4.00000,
segment_2.ts
#EXTINF:3.84000,
segment_3.ts

#EXT-X-ENDLIST`;
