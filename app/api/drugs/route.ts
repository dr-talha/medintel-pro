import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RxNormApproximateTerm = {
  rxcui?: string;
  name?: string;
  score?: string;
  rank?: string;
};

type RxNormResponse = {
  approximateGroup?: {
    candidate?: RxNormApproximateTerm[];
  };
};

type OpenFdaResponse = {
  meta?: unknown;
  results?: unknown[];
};

type DrugProxyResponse = {
  query: string;
  rxNorm: {
    matches: RxNormApproximateTerm[];
    error: string | null;
  };
  openFda: {
    meta: unknown | null;
    results: unknown[];
    error: string | null;
  };
};

const RXNORM_MAX_ENTRIES = '8';
const OPENFDA_LIMIT = '5';
const REQUEST_TIMEOUT_MS = 8_000;

function sanitizeOpenFdaSearchTerm(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...init?.headers,
      },
      next: { revalidate: 60 * 60 },
    });

    if (!response.ok) {
      throw new Error(`External API request failed with status ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function buildOpenFdaUrl(drugName: string) {
  const openFdaUrl = new URL('https://api.fda.gov/drug/event.json');
  const fdaApiKey = process.env.FDA_API_KEY?.trim();

  if (fdaApiKey) openFdaUrl.searchParams.set('api_key', fdaApiKey);
  openFdaUrl.searchParams.set('search', `patient.drug.medicinalproduct:"${sanitizeOpenFdaSearchTerm(drugName)}"`);
  openFdaUrl.searchParams.set('limit', OPENFDA_LIMIT);

  return openFdaUrl.toString();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const drugName = searchParams.get('name')?.trim();

  if (!drugName) {
    return NextResponse.json({ error: 'A drug name query parameter is required.' }, { status: 400 });
  }

  const rxNormUrl = `https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(
    drugName,
  )}&maxEntries=${RXNORM_MAX_ENTRIES}`;

  const [rxNormResult, openFdaResult] = await Promise.allSettled([
    fetchJson<RxNormResponse>(rxNormUrl),
    fetchJson<OpenFdaResponse>(buildOpenFdaUrl(drugName)),
  ]);

  if (rxNormResult.status === 'rejected' && openFdaResult.status === 'rejected') {
    console.error('Drug proxy route error:', {
      rxNorm: rxNormResult.reason,
      openFda: openFdaResult.reason,
    });

    return NextResponse.json(
      {
        error: 'Both RxNorm and openFDA failed to respond. Please try again later.',
        details: {
          rxNorm: getErrorMessage(rxNormResult.reason, 'RxNorm request failed.'),
          openFda: getErrorMessage(openFdaResult.reason, 'openFDA request failed.'),
        },
      },
      { status: 502 },
    );
  }

  const payload: DrugProxyResponse = {
    query: drugName,
    rxNorm: {
      matches: rxNormResult.status === 'fulfilled' ? rxNormResult.value.approximateGroup?.candidate ?? [] : [],
      error: rxNormResult.status === 'rejected' ? getErrorMessage(rxNormResult.reason, 'RxNorm request failed.') : null,
    },
    openFda: {
      meta: openFdaResult.status === 'fulfilled' ? openFdaResult.value.meta ?? null : null,
      results: openFdaResult.status === 'fulfilled' ? openFdaResult.value.results ?? [] : [],
      error: openFdaResult.status === 'rejected' ? getErrorMessage(openFdaResult.reason, 'openFDA request failed.') : null,
    },
  };

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
