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

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required server environment variable: ${name}`);
  }

  return value;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
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
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const drugName = searchParams.get('name')?.trim();

    if (!drugName) {
      return NextResponse.json({ error: 'A drug name query parameter is required.' }, { status: 400 });
    }

    const fdaApiKey = requireEnv('FDA_API_KEY');
    const encodedDrugName = encodeURIComponent(drugName);

    const rxNormUrl = `https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodedDrugName}&maxEntries=8`;
    const openFdaUrl = new URL('https://api.fda.gov/drug/event.json');
    openFdaUrl.searchParams.set('api_key', fdaApiKey);
    openFdaUrl.searchParams.set('search', `patient.drug.medicinalproduct:"${drugName.replaceAll('"', '\\"')}"`);
    openFdaUrl.searchParams.set('limit', '5');

    const [rxNorm, openFda] = await Promise.all([
      fetchJson<RxNormResponse>(rxNormUrl),
      fetchJson<OpenFdaResponse>(openFdaUrl.toString()),
    ]);

    return NextResponse.json({
      query: drugName,
      rxNorm: {
        matches: rxNorm.approximateGroup?.candidate ?? [],
      },
      openFda: {
        meta: openFda.meta ?? null,
        results: openFda.results ?? [],
      },
    });
  } catch (error) {
    console.error('Drug proxy route error:', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected drug proxy error.' },
      { status: 500 },
    );
  }
}
