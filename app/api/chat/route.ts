import { openai } from '@ai-sdk/openai';
import { createClient } from '@supabase/supabase-js';
import { embed, generateText, type CoreMessage } from 'ai';

export const runtime = 'nodejs';

const MEDICAL_DISCLAIMER =
  'Medical disclaimer: This information is for education only and is not a diagnosis, treatment plan, or substitute for professional medical care. For emergencies, call local emergency services immediately; for personal medical decisions, consult a licensed clinician.';

const FALLBACK_PREFIX =
  'I could not find this in the verified MedIntel database, but based on a live web search...';

type ChatRequestMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type MedicalDocumentMatch = {
  id: string;
  title: string;
  content: string;
  source_url?: string | null;
  similarity?: number | null;
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function normalizeMessages(messages: unknown): ChatRequestMessage[] {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter((message): message is ChatRequestMessage => {
      if (!message || typeof message !== 'object') return false;
      const candidate = message as Partial<ChatRequestMessage>;
      return (
        (candidate.role === 'user' || candidate.role === 'assistant' || candidate.role === 'system') &&
        typeof candidate.content === 'string' &&
        candidate.content.trim().length > 0
      );
    })
    .slice(-12);
}

function buildVerifiedContext(matches: MedicalDocumentMatch[]) {
  return matches
    .map((match, index) => {
      const source = match.source_url ? `\nSource URL: ${match.source_url}` : '';
      const similarity = typeof match.similarity === 'number' ? `\nSimilarity: ${match.similarity.toFixed(3)}` : '';
      return `Document ${index + 1}: ${match.title}${similarity}${source}\n${match.content}`;
    })
    .join('\n\n---\n\n');
}

async function searchVerifiedMedicalDatabase(query: string) {
  const supabase = createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });

  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: query,
  });

  const { data, error } = await supabase.rpc('match_medical_documents', {
    query_embedding: embedding,
    match_count: 5,
    match_threshold: 0.78,
  });

  if (error) throw error;
  return (data ?? []) as MedicalDocumentMatch[];
}

async function runLiveWebSearch(query: string) {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: requireEnv('TAVILY_API_KEY'),
      query,
      search_depth: 'advanced',
      include_answer: false,
      include_raw_content: false,
      max_results: 5,
    }),
  });

  if (!response.ok) {
    throw new Error(`Live web search failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string; score?: number }>;
  };

  return (payload.results ?? [])
    .map((result, index) => {
      return `Search result ${index + 1}: ${result.title ?? 'Untitled'}\nURL: ${result.url ?? 'Unavailable'}\nSummary: ${result.content ?? 'No summary provided.'}`;
    })
    .join('\n\n---\n\n');
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { messages?: ChatRequestMessage[] };
    const messages = normalizeMessages(body.messages);
    const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user');

    if (!latestUserMessage) {
      return Response.json({ error: 'A user message is required.' }, { status: 400 });
    }

    const verifiedMatches = await searchVerifiedMedicalDatabase(latestUserMessage.content);
    const hasVerifiedContext = verifiedMatches.length > 0;
    const conversationMessages: CoreMessage[] = messages.map((message) => ({
      role: message.role as 'user' | 'assistant',
      content: message.content,
    }));

    if (hasVerifiedContext) {
      const result = await generateText({
        model: openai('gpt-4o-mini'),
        system: `You are MedIntel Pro, a careful medical education assistant. Answer using the verified MedIntel database context below. Do not use live web search. If the context is incomplete, say what is not covered by the verified database. Be concise, clinically cautious, and end with this exact disclaimer: ${MEDICAL_DISCLAIMER}\n\nVerified MedIntel database context:\n${buildVerifiedContext(verifiedMatches)}`,
        messages: conversationMessages,
        temperature: 0.2,
      });

      return Response.json({
        role: 'assistant',
        content: result.text,
        source: 'verified-medintel-database',
        matches: verifiedMatches.map(({ id, title, source_url, similarity }) => ({ id, title, source_url, similarity })),
      });
    }

    const webContext = await runLiveWebSearch(latestUserMessage.content);
    const result = await generateText({
      model: openai('gpt-4o-mini'),
      system: `You are MedIntel Pro, a careful medical education assistant. No verified MedIntel Supabase context was found for this question. You may answer only from the live web search context below. Your response MUST start exactly with this phrase, including capitalization and punctuation: "${FALLBACK_PREFIX}" After that phrase, summarize cautiously, name uncertainty, cite source URLs inline, and never present web search findings as verified MedIntel database content. You MUST end with this exact disclaimer: ${MEDICAL_DISCLAIMER}\n\nLive web search context:\n${webContext || 'No usable web search results were returned.'}`,
      messages: conversationMessages,
      temperature: 0.2,
    });

    const content = result.text.startsWith(FALLBACK_PREFIX) ? result.text : `${FALLBACK_PREFIX}\n\n${result.text}`;
    const finalContent = content.includes(MEDICAL_DISCLAIMER) ? content : `${content}\n\n${MEDICAL_DISCLAIMER}`;

    return Response.json({
      role: 'assistant',
      content: finalContent,
      source: 'live-web-search-fallback',
      matches: [],
    });
  } catch (error) {
    console.error('MedIntel chat route error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unexpected chat route error.' },
      { status: 500 },
    );
  }
}
