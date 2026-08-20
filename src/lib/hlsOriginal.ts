/**
 * Original Audited Script (Encapsulated as a TypeScript Module for Comparison & Testing)
 */

export function safeSetUint32(view: DataView, offset: number, value: number, context = '') {
  if (offset < 0 || offset + 4 > view.byteLength) {
    throw new Error(`WriteUint32 out of bounds (${context}): offset=${offset}, need=4, len=${view.byteLength}`);
  }
  view.setUint32(offset, value >>> 0, false);
}

export function safeGetUint32(view: DataView, offset: number, context = '') {
  if (offset < 0 || offset + 4 > view.byteLength) {
    throw new Error(`GetUint32 out of bounds (${context}): offset=${offset}, need=4, len=${view.byteLength}`);
  }
  return view.getUint32(offset, false);
}

export function safeGetInt32(view: DataView, offset: number, context = '') {
  if (offset < 0 || offset + 4 > view.byteLength) {
    throw new Error(`GetInt32 out of bounds (${context}): offset=${offset}, need=4, len=${view.byteLength}`);
  }
  return view.getInt32(offset, false);
}

export function safeGetUint64(view: DataView, offset: number, context = '') {
  if (offset < 0 || offset + 8 > view.byteLength) {
    throw new Error(`GetUint64 out of bounds (${context}): offset=${offset}, need=8, len=${view.byteLength}`);
  }
  const val = view.getBigUint64(offset, false);
  if (val > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`Uint64 at ${offset} exceeds MAX_SAFE_INTEGER (${context})`);
  }
  return Number(val);
}

export function safeSetUint64(view: DataView, offset: number, value: number | bigint, context = '') {
  if (offset < 0 || offset + 8 > view.byteLength) {
    throw new Error(`SetUint64 out of bounds (${context}): offset=${offset}, need=8, len=${view.byteLength}`);
  }
  const bigVal = typeof value === 'bigint' ? value : BigInt(Math.max(0, Math.round(value)));
  view.setBigUint64(offset, bigVal, false);
}

export function concatBuffers(buffers: Uint8Array[]) {
  let totalLength = 0;
  for (let i = 0; i < buffers.length; i++) {
    if (buffers[i] && buffers[i].length) totalLength += buffers[i].length;
  }
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (let i = 0; i < buffers.length; i++) {
    const b = buffers[i];
    if (b && b.length) {
      result.set(b, offset);
      offset += b.length;
    }
  }
  return result;
}

export interface IsoBox {
  type: string;
  relOffset: number;
  absOffset: number;
  size: number;
  headerSize: number;
  data: Uint8Array;
  view: DataView;
}

export function parseBoxes(buf: Uint8Array, parentAbsOffset = 0, start = 0, end = buf.length): IsoBox[] {
  const boxes: IsoBox[] = [];
  let offset = start;

  while (offset < end) {
    if (offset + 8 > end) {
      throw new Error(`Truncated box header at offset ${offset} (absolute ${parentAbsOffset + offset})`);
    }

    let size = ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>> 0;
    const type = String.fromCharCode(buf[offset + 4], buf[offset + 5], buf[offset + 6], buf[offset + 7]);
    let headerSize = 8;

    if (size === 1) {
      if (offset + 16 > end) {
        throw new Error(`Truncated 64-bit box header for ${type} at relative offset ${offset}`);
      }
      const view = new DataView(buf.buffer, buf.byteOffset + offset + 8, 8);
      const largeSize = view.getBigUint64(0, false);
      if (largeSize > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error(`Box ${type} size ${largeSize} exceeds safe JS integer limit`);
      }
      size = Number(largeSize);
      headerSize = 16;
    } else if (size === 0) {
      size = end - offset;
    }

    if (size < headerSize || offset + size > end) {
      throw new Error(`Invalid ${type} box bounds at relative offset ${offset}: size=${size}, available=${end - offset}`);
    }

    const absOffset = parentAbsOffset + offset;
    const data = buf.subarray(offset, offset + size);
    boxes.push({
      type,
      relOffset: offset,
      absOffset,
      size,
      headerSize,
      data,
      view: new DataView(buf.buffer, buf.byteOffset + offset, size)
    });

    offset += size;
  }
  return boxes;
}

export function getChildBoxes(box: IsoBox): IsoBox[] {
  return parseBoxes(box.data, box.absOffset, box.headerSize, box.data.length);
}

export function findChildBox(box: IsoBox, type: string): IsoBox | null {
  const children = getChildBoxes(box);
  for (let i = 0; i < children.length; i++) {
    if (children[i].type === type) return children[i];
  }
  return null;
}

export function findChildBoxes(box: IsoBox, type: string): IsoBox[] {
  return getChildBoxes(box).filter(b => b.type === type);
}

export function findTopBox(buf: Uint8Array, type: string): IsoBox | null {
  const topBoxes = parseBoxes(buf, 0);
  for (let i = 0; i < topBoxes.length; i++) {
    if (topBoxes[i].type === type) return topBoxes[i];
  }
  return null;
}

export function parseHlsAttributeList(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  let cursor = 0;
  const len = attrStr.length;

  while (cursor < len) {
    while (cursor < len && (attrStr[cursor] === ' ' || attrStr[cursor] === ',')) cursor++;
    if (cursor >= len) break;

    const equalPos = attrStr.indexOf('=', cursor);
    if (equalPos === -1) break;

    const key = attrStr.substring(cursor, equalPos).trim();
    cursor = equalPos + 1;

    while (cursor < len && attrStr[cursor] === ' ') cursor++;
    if (cursor >= len) break;

    let value = '';
    if (attrStr[cursor] === '"') {
      cursor++;
      const valStart = cursor;
      while (cursor < len) {
        if (attrStr[cursor] === '\\' && cursor + 1 < len) {
          cursor += 2;
        } else if (attrStr[cursor] === '"') {
          break;
        } else {
          cursor++;
        }
      }
      value = attrStr.substring(valStart, cursor).replace(/\\"/g, '"');
      if (cursor < len && attrStr[cursor] === '"') cursor++;
    } else {
      const valStart = cursor;
      while (cursor < len && attrStr[cursor] !== ',') cursor++;
      value = attrStr.substring(valStart, cursor).trim();
    }

    attrs[key] = value;
    while (cursor < len && attrStr[cursor] === ',') cursor++;
  }
  return attrs;
}

export function parseMasterPlaylist(manifestText: string, baseUrl: string) {
  const lines = manifestText.split('\n').map(l => l.trim()).filter(Boolean);
  const variants: any[] = [];
  const audioTracks: any[] = [];
  let isEncrypted = false;
  let encryptionMethod: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('#EXT-X-KEY:')) {
      const attrs = parseHlsAttributeList(line.substring(11));
      if (attrs.METHOD && attrs.METHOD !== 'NONE') {
        isEncrypted = true;
        encryptionMethod = attrs.METHOD;
      }
    }

    if (line.startsWith('#EXT-X-MEDIA:')) {
      const attrs = parseHlsAttributeList(line.substring(13));
      if (attrs.TYPE === 'AUDIO' && attrs.URI) {
        audioTracks.push({
          uri: new URL(attrs.URI, baseUrl).href,
          name: attrs.NAME || 'Audio',
          groupId: attrs['GROUP-ID'] || null,
          isDefault: attrs.DEFAULT === 'YES',
          autoSelect: attrs.AUTOSELECT === 'YES',
          language: attrs.LANGUAGE || null
        });
      }
    }

    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      const attrs = parseHlsAttributeList(line.substring(18));
      const nextLine = lines[i + 1];
      if (nextLine && !nextLine.startsWith('#')) {
        const variantUrl = new URL(nextLine, baseUrl).href;
        let width = 0;
        let height = 0;
        if (attrs.RESOLUTION) {
          const parts = attrs.RESOLUTION.split('x');
          width = parseInt(parts[0], 10) || 0;
          height = parseInt(parts[1], 10) || 0;
        }

        let qualityLabel = attrs.RESOLUTION ? `${height}p` : 'Auto';
        if (height >= 2160) qualityLabel = '4K (UHD)';
        else if (height >= 1440) qualityLabel = '1440p (2K)';
        else if (height >= 1080) qualityLabel = '1080p (Full HD)';
        else if (height >= 720) qualityLabel = '720p (HD)';
        else if (height >= 540) qualityLabel = '540p';
        else if (height >= 360) qualityLabel = '360p';
        else if (height >= 240) qualityLabel = '240p';

        variants.push({
          url: variantUrl,
          bandwidth: attrs.BANDWIDTH ? parseInt(attrs.BANDWIDTH, 10) : 0,
          resolution: attrs.RESOLUTION || null,
          width,
          height,
          qualityLabel,
          codecs: attrs.CODECS || null,
          audioGroupId: attrs.AUDIO || null
        });
      }
    }
  }

  variants.sort((a, b) => (b.height - a.height) || (b.bandwidth - a.bandwidth));

  return {
    isMaster: variants.length > 0,
    isEncrypted,
    encryptionMethod,
    variants,
    audioTracks
  };
}

export function parseMediaPlaylist(playlistText: string, baseUrl: string) {
  const lines = playlistText.split('\n').map(l => l.trim()).filter(Boolean);
  let initUrl: string | null = null;
  let initByteRange: { offset: number; length: number } | null = null;
  const segments: any[] = [];
  let isEncrypted = false;
  let encryptionMethod: string | null = null;
  let targetDuration = 0;
  let totalDuration = 0;
  let hasDiscontinuity = false;
  let currentByteRange: { offset: number; length: number } | null = null;
  let prevByteRangeEnd = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line === '#EXT-X-DISCONTINUITY') {
      hasDiscontinuity = true;
    }

    if (line.startsWith('#EXT-X-KEY:')) {
      const attrs = parseHlsAttributeList(line.substring(11));
      if (attrs.METHOD && attrs.METHOD !== 'NONE') {
        isEncrypted = true;
        encryptionMethod = attrs.METHOD;
      }
    }

    if (line.startsWith('#EXT-X-TARGETDURATION:')) {
      targetDuration = parseFloat(line.split(':')[1]) || 0;
    }

    if (line.startsWith('#EXT-X-MAP:')) {
      const attrs = parseHlsAttributeList(line.substring(11));
      if (attrs.URI) {
        initUrl = new URL(attrs.URI, baseUrl).href;
      }
      if (attrs.BYTERANGE) {
        const parts = attrs.BYTERANGE.split('@');
        const length = parseInt(parts[0], 10);
        const offset = parts.length > 1 ? parseInt(parts[1], 10) : 0;
        initByteRange = { offset, length };
      }
    }

    if (line.startsWith('#EXT-X-BYTERANGE:')) {
      const val = line.substring(17).trim();
      const parts = val.split('@');
      const length = parseInt(parts[0], 10);
      const offset = parts.length > 1 ? parseInt(parts[1], 10) : prevByteRangeEnd;
      currentByteRange = { offset, length };
      prevByteRangeEnd = offset + length;
    }

    if (line.startsWith('#EXTINF:')) {
      const durStr = line.substring(8).split(',')[0];
      const dur = parseFloat(durStr) || 0;
      totalDuration += dur;
      const nextLine = lines[i + 1];
      if (nextLine && !nextLine.startsWith('#')) {
        segments.push({
          url: new URL(nextLine, baseUrl).href,
          duration: dur,
          byteRange: currentByteRange
        });
        currentByteRange = null;
      }
    }
  }

  return {
    isEncrypted,
    encryptionMethod,
    hasDiscontinuity,
    initUrl,
    initByteRange,
    targetDuration,
    totalDuration,
    segments,
    isFmp4: !!initUrl,
    isTs: !initUrl && segments.length > 0
  };
}
