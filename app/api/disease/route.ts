import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DiseaseGlobalResponse = {
  updated?: number;
  cases?: number;
  todayCases?: number;
  deaths?: number;
  todayDeaths?: number;
  recovered?: number;
  active?: number;
  critical?: number;
  casesPerOneMillion?: number;
  deathsPerOneMillion?: number;
  tests?: number;
  testsPerOneMillion?: number;
  population?: number;
  affectedCountries?: number;
};

async function fetchDiseaseGlobalData() {
  const response = await fetch('https://disease.sh/v3/covid-19/all', {
    headers: { Accept: 'application/json' },
    next: { revalidate: 15 * 60 },
  });

  if (!response.ok) {
    throw new Error(`Disease data request failed with status ${response.status}`);
  }

  return (await response.json()) as DiseaseGlobalResponse;
}

export async function GET() {
  try {
    const data = await fetchDiseaseGlobalData();

    return NextResponse.json({
      source: 'disease.sh',
      scope: 'global-covid-19',
      data,
    });
  } catch (error) {
    console.error('Disease proxy route error:', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected disease proxy error.' },
      { status: 500 },
    );
  }
}
