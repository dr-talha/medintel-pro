import { openai } from '@ai-sdk/openai';
import { createClient } from '@supabase/supabase-js';
import { embed } from 'ai';

export const runtime = 'nodejs';
export const maxDuration = 120; // allow up to 2 minutes for large files

// ── helpers ────────────────────────────────────────────────────────────────

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

/** Convert a Google Drive share URL to a direct-download URL */
function toDirectDownload(url: string): string {
  // Handle /file/d/FILE_ID/view  or  /open?id=FILE_ID
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) {
    return `https://drive.google.com/uc?export=download&id=${fileMatch[1]}`;
  }
  const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch) {
    return `https://drive.google.com/uc?export=download&id=${openMatch[1]}`;
  }
  // Already a direct link or other URL — return as-is
  return url;
}

/** Split text into overlapping ~400-word chunks */
function chunkText(text: string, chunkWords = 400, overlapWords = 60): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    const chunk = words.slice(i, i + chunkWords).join(' ');
    if (chunk.trim().length > 40) chunks.push(chunk); // skip tiny fragments
    i += chunkWords - overlapWords;
  }
  return chunks;
}

/** Extract plain text from a PDF buffer using pdf-parse */
async function extractPdf(buffer: Buffer): Promise<string> {
  // dynamic import — pdf-parse has no ESM build
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
  const result = await pdfParse(buffer);
  return result.text;
}

/** Extract plain text from a DOCX buffer using mammoth */
async function extractDocx(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require('mammoth') as {
    extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
  };
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

// ── main handler ───────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      url?: string;
      title?: string;
      password?: string;
    };

    // Simple password gate — set INGEST_PASSWORD in your .env.local
    const ingestPassword = process.env.INGEST_PASSWORD ?? 'medintel-admin';
    if (body.password !== ingestPassword) {
      return Response.json({ error: 'Invalid admin password.' }, { status: 401 });
    }

    if (!body.url) {
      return Response.json({ error: 'No URL provided.' }, { status: 400 });
    }

    const downloadUrl = toDirectDownload(body.url);
    const fileTitle = body.title ?? new URL(downloadUrl).pathname.split('/').pop() ?? 'Untitled';

    // ── 1. Download the file ──────────────────────────────────────────────
    const fileResponse = await fetch(downloadUrl, {
      headers: { 'User-Agent': 'MedIntelPro-Ingest/1.0' },
      redirect: 'follow',
    });

    if (!fileResponse.ok) {
      return Response.json(
        { error: `Failed to download file: HTTP ${fileResponse.status}. Make sure the file is shared as "Anyone with the link".` },
        { status: 400 },
      );
    }

    const contentType = fileResponse.headers.get('content-type') ?? '';
    const buffer = Buffer.from(await fileResponse.arrayBuffer());

    // ── 2. Extract text ───────────────────────────────────────────────────
    let text = '';
    let detectedType = 'unknown';

    if (contentType.includes('pdf') || downloadUrl.toLowerCase().includes('.pdf')) {
      text = await extractPdf(buffer);
      detectedType = 'pdf';
    } else if (
      contentType.includes('wordprocessingml') ||
      contentType.includes('msword') ||
      downloadUrl.toLowerCase().includes('.docx') ||
      downloadUrl.toLowerCase().includes('.doc')
    ) {
      text = await extractDocx(buffer);
      detectedType = 'docx';
    } else {
      // Try PDF first, then DOCX
      try {
        text = await extractPdf(buffer);
        detectedType = 'pdf';
      } catch {
        try {
          text = await extractDocx(buffer);
          detectedType = 'docx';
        } catch {
          return Response.json(
            { error: 'Could not extract text. Only PDF and DOCX files are supported.' },
            { status: 400 },
          );
        }
      }
    }

    if (!text.trim()) {
      return Response.json(
        { error: 'No text found in the file. The file may be a scanned image without OCR.' },
        { status: 400 },
      );
    }

    // ── 3. Chunk text ─────────────────────────────────────────────────────
    const chunks = chunkText(text);

    // ── 4. Embed + store each chunk ───────────────────────────────────────
    const supabase = createClient(
      requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
      requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false } },
    );

    let stored = 0;
    const errors: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      try {
        const { embedding } = await embed({
          model: openai.embedding('text-embedding-3-small'),
          value: chunks[i],
        });

        const { error } = await supabase.from('medical_documents').insert({
          title: fileTitle,
          content: chunks[i],
          source_url: body.url,
          metadata: {
            file_type: detectedType,
            chunk_index: i,
            total_chunks: chunks.length,
            ingested_at: new Date().toISOString(),
          },
          embedding,
        });

        if (error) errors.push(`Chunk ${i}: ${error.message}`);
        else stored++;
      } catch (embedError) {
        errors.push(`Chunk ${i}: ${embedError instanceof Error ? embedError.message : 'Embed error'}`);
      }
    }

    return Response.json({
      success: true,
      title: fileTitle,
      fileType: detectedType,
      totalChunks: chunks.length,
      stored,
      errors: errors.length ? errors : undefined,
      characterCount: text.length,
    });
  } catch (error) {
    console.error('Ingest error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unexpected ingest error.' },
      { status: 500 },
    );
  }
}

/** List all ingested documents */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const password = searchParams.get('password') ?? '';
  const ingestPassword = process.env.INGEST_PASSWORD ?? 'medintel-admin';

  if (password !== ingestPassword) {
    return Response.json({ error: 'Invalid admin password.' }, { status: 401 });
  }

  const supabase = createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase
    .from('medical_documents')
    .select('id, title, source_url, metadata, created_at')
    .order('created_at', { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Group by title/source to show per-file stats
  const grouped = new Map<string, { title: string; source_url: string; chunks: number; ingested_at: string }>();
  for (const row of data ?? []) {
    const key = row.source_url ?? row.title;
    if (!grouped.has(key)) {
      grouped.set(key, {
        title: row.title,
        source_url: row.source_url ?? '',
        chunks: 0,
        ingested_at: row.created_at,
      });
    }
    grouped.get(key)!.chunks++;
  }

  return Response.json({ documents: Array.from(grouped.values()) });
}

/** Delete all chunks for a specific source URL */
export async function DELETE(request: Request) {
  const body = (await request.json()) as { source_url?: string; password?: string };
  const ingestPassword = process.env.INGEST_PASSWORD ?? 'medintel-admin';

  if (body.password !== ingestPassword) {
    return Response.json({ error: 'Invalid admin password.' }, { status: 401 });
  }

  if (!body.source_url) {
    return Response.json({ error: 'source_url is required.' }, { status: 400 });
  }

  const supabase = createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } },
  );

  const { error, count } = await supabase
    .from('medical_documents')
    .delete({ count: 'exact' })
    .eq('source_url', body.source_url);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ success: true, deleted: count });
}
