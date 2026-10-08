import log from 'electron-log/main';
import fs from 'node:fs';

const MIME_TYPES: Record<string, string> = {
  // video
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  qt: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  mpg: 'video/mpeg',
  mpeg: 'video/mpeg',
  wmv: 'video/x-ms-wmv',
  flv: 'video/x-flv',
  '3gp': 'video/3gpp',
  ts: 'video/mp2t',
  ogv: 'video/ogg',
  // audio
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  aac: 'audio/aac',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  flac: 'audio/flac',
  opus: 'audio/opus',
  wma: 'audio/x-ms-wma',
  // images
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  avif: 'image/avif',
  // other
  pdf: 'application/pdf',
  json: 'application/json',
  txt: 'text/plain; charset=utf-8',
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
};

function getMimeType(filePath: string): string {
  const dot = filePath.lastIndexOf('.');
  if (dot < 0) return 'application/octet-stream';
  const ext = filePath.substring(dot + 1).toLowerCase();
  return MIME_TYPES[ext] ?? 'application/octet-stream';
}

function resolveLocalPath(requestUrl: string): string | null {
  const url = new URL(requestUrl);
  if (url.protocol !== 'localfile:') return null;
  // New format: localfile:///C:/Users/.../file.mp4  (path based)
  // Legacy format: localfile://C%3A%5CUsers%5C...%5Cfile.mp4  (whole path in authority)
  const raw = url.host ? url.host + url.pathname : url.pathname;
  let filePath = decodeURIComponent(raw);
  // URL path always starts with "/", on Windows that slash is not part of the path
  if (/^\/[A-Za-z]:/.test(filePath)) filePath = filePath.substring(1);
  return filePath || null;
}

type ParsedRange = {
  ranged: boolean;
  invalid: boolean;
  start: number;
  end: number | null;
};

function parseRange(rangeHeader: string | null, fileSize: number): ParsedRange {
  if (!rangeHeader)
    return { ranged: false, invalid: false, start: 0, end: null };

  const match = rangeHeader.trim().match(/^bytes=(\d*)-(\d*)$/i);
  if (!match) {
    // Malformed or multi-range header: serve the full file instead of failing
    return { ranged: false, invalid: false, start: 0, end: null };
  }

  const rawStart = match[1];
  const rawEnd = match[2];

  if (!rawStart && !rawEnd) {
    return { ranged: true, invalid: true, start: 0, end: null };
  }

  if (!rawStart) {
    // Suffix range: bytes=-500 -> last 500 bytes
    const suffixLength = parseInt(rawEnd, 10);
    if (!suffixLength)
      return { ranged: true, invalid: true, start: 0, end: null };
    const start = Math.max(0, fileSize - suffixLength);
    return { ranged: true, invalid: false, start, end: fileSize - 1 };
  }

  const start = parseInt(rawStart, 10);
  if (start >= fileSize) {
    return { ranged: true, invalid: true, start, end: null };
  }

  const end = rawEnd
    ? Math.min(parseInt(rawEnd, 10), fileSize - 1)
    : fileSize - 1;
  if (end < start) {
    return { ranged: true, invalid: true, start, end: null };
  }

  return { ranged: true, invalid: false, start, end };
}

async function serveFile(
  filePath: string,
  rangeHeader: string | null,
  method: string,
): Promise<Response> {
  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(filePath);
  } catch {
    log.info(`localfile: 404 ${method} ${filePath}`);
    return new Response('File not found', { status: 404 });
  }
  if (!stat.isFile()) {
    log.info(`localfile: 404 ${method} not a file: ${filePath}`);
    return new Response('File not found', { status: 404 });
  }

  const range = parseRange(rangeHeader, stat.size);
  if (range.invalid) {
    log.info(
      `localfile: 416 ${method} range="${rangeHeader}" size=${stat.size} ${filePath}`,
    );
    return new Response(null, {
      status: 416,
      headers: {
        'Content-Range': `bytes */${stat.size}`,
        'Accept-Ranges': 'bytes',
      },
    });
  }

  const contentLength =
    range.end !== null ? range.end - range.start + 1 : stat.size - range.start;
  const status = range.ranged ? 206 : 200;
  const headers: Record<string, string> = {
    'Content-Type': getMimeType(filePath),
    'Accept-Ranges': 'bytes',
    'Content-Length': String(contentLength),
  };
  if (range.ranged) {
    headers['Content-Range'] =
      `bytes ${range.start}-${range.start + contentLength - 1}/${stat.size}`;
  }

  log.info(
    `localfile: ${status} ${method} ` +
      (range.ranged ? `bytes=${range.start}-${range.end ?? ''} ` : '') +
      `(${contentLength}/${stat.size}) ${filePath}`,
  );

  if (method === 'HEAD') {
    return new Response(null, { status, headers });
  }

  const startOffset = range.start;
  const endOffset = range.end !== null ? range.end + 1 : stat.size;

  let fd: fs.promises.FileHandle | null = null;
  let cancelled = false;

  const body = new ReadableStream({
    async start(controller) {
      try {
        fd = await fs.promises.open(filePath, 'r');
        let pos = startOffset;
        while (pos < endOffset) {
          const toRead = Math.min(endOffset - pos, 65536);
          const buf = Buffer.alloc(toRead);
          const { bytesRead } = await fd.read(buf, 0, toRead, pos);
          if (bytesRead === 0) break;
          pos += bytesRead;
          if (cancelled) break;
          controller.enqueue(buf.subarray(0, bytesRead));
        }
        if (!cancelled) controller.close();
      } catch (err) {
        if (!cancelled) {
          log.error(`localfile: stream failed ${filePath}`, err);
          try {
            controller.error(err);
          } catch {
            // controller may already be closed
          }
        }
      } finally {
        const handle = fd;
        fd = null;
        if (handle) await handle.close().catch(() => {});
      }
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(body, { status, headers });
}

export async function handleLocalFile(request: Request): Promise<Response> {
  try {
    const filePath = resolveLocalPath(request.url);
    if (!filePath) {
      log.error(`localfile: cannot resolve path from ${request.url}`);
      return new Response('Bad request', { status: 400 });
    }
    return await serveFile(
      filePath,
      request.headers.get('range'),
      request.method,
    );
  } catch (err: any) {
    log.error('localfile:', err);
    return new Response(err?.message ?? 'Error', { status: 500 });
  }
}
