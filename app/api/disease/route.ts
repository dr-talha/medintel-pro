import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DiseaseKey = 'flu' | 'covid' | 'malaria' | 'dengue';

type DiseaseSource = {
  label: string;
  description: string;
  source: string;
  url: string;
};

type CountryMetric = {
  country: string;
  iso2: string;
  iso3: string;
  cases: number;
  deaths: number;
  incidence: number;
  updated?: string;
  source: string;
};

type DiseasePayload = {
  disease: DiseaseKey;
  label: string;
  description: string;
  source: string;
  generatedAt: string;
  countries: CountryMetric[];
  totals: {
    cases: number;
    deaths: number;
  };
};

type DiseaseShCountry = {
  country?: string;
  countryInfo?: {
    iso2?: string | null;
    iso3?: string | null;
  };
  cases?: number | null;
  deaths?: number | null;
  casesPerOneMillion?: number | null;
  updated?: number | null;
};

type WhoODataResponse<T> = {
  value?: T[];
};

type WhoCountryDimension = {
  Code?: string;
  Title?: string;
};

type WhoGhoRow = {
  SpatialDim?: string;
  TimeDim?: number;
  NumericValue?: number | string | null;
  Value?: string | null;
};

type DelphiDengueResponse = {
  result?: number;
  message?: string;
  epidata?: Array<{
    region?: string;
    epiweek?: number;
    num_dengue?: number | string | null;
    num_deaths?: number | string | null;
    incidence_rate?: number | string | null;
  }>;
};

const DISEASES: Record<DiseaseKey, DiseaseSource> = {
  flu: {
    label: 'Influenza',
    description: 'Latest country-level influenza detections reported to WHO FluNet.',
    source: 'WHO FluNet',
    url: 'https://xmart-api-public.who.int/FLUMART/VIW_FNT?%24format=csv',
  },
  covid: {
    label: 'COVID-19',
    description: 'Country-level COVID-19 case and death totals from disease.sh.',
    source: 'disease.sh COVID-19 country feed',
    url: 'https://disease.sh/v3/covid-19/countries?sort=cases&allowNull=false',
  },
  malaria: {
    label: 'Malaria',
    description: 'Latest country-level confirmed malaria case counts from WHO Global Health Observatory.',
    source: 'WHO Global Health Observatory - confirmed malaria cases',
    url: 'https://ghoapi.azureedge.net/api/MALARIA_CONF_CASES',
  },
  dengue: {
    label: 'Dengue',
    description: 'Latest cumulative dengue surveillance counts reported by PAHO/WHO and exposed through Delphi Epidata.',
    source: 'PAHO/WHO dengue surveillance via Delphi Epidata',
    url: 'https://api.delphi.cmu.edu/epidata/paho_dengue/',
  },
};

const REQUEST_TIMEOUT_MS = 12_000;
const MAX_COUNTRIES = 80;
const JSON_HEADERS = {
  'Cache-Control': 's-maxage=1800, stale-while-revalidate=86400',
};

export async function GET(request: NextRequest) {
  const requestedDisease = request.nextUrl.searchParams.get('disease');
  const disease = normalizeDisease(requestedDisease);

  if (!disease) {
    return NextResponse.json(
      {
        error: 'Unsupported disease selector.',
        supportedDiseases: Object.keys(DISEASES),
      },
      { status: 400, headers: JSON_HEADERS },
    );
  }

  try {
    const countries = await fetchDiseaseCountries(disease);
    const rankedCountries = countries
      .filter((country) => Number.isFinite(country.cases) && country.cases > 0)
      .sort((a, b) => b.cases - a.cases)
      .slice(0, MAX_COUNTRIES);

    if (rankedCountries.length === 0) {
      throw new Error(`${DISEASES[disease].source} returned no country rows with positive case counts.`);
    }

    return NextResponse.json(buildPayload(disease, rankedCountries), { headers: JSON_HEADERS });
  } catch (error) {
    console.error('Disease route error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unable to load disease surveillance data.',
        disease,
        source: DISEASES[disease].source,
      },
      { status: 502, headers: JSON_HEADERS },
    );
  }
}

function normalizeDisease(value: string | null): DiseaseKey | null {
  if (value === 'flu' || value === 'covid' || value === 'malaria' || value === 'dengue') return value;
  if (!value) return 'flu';
  return null;
}

async function fetchDiseaseCountries(disease: DiseaseKey): Promise<CountryMetric[]> {
  switch (disease) {
    case 'covid':
      return fetchCovidCountries();
    case 'flu':
      return fetchFluNetCountries();
    case 'malaria':
      return fetchWhoGhoCountries('malaria');
    case 'dengue':
      return fetchDengueCountries();
  }
}

function buildPayload(disease: DiseaseKey, countries: CountryMetric[]): DiseasePayload {
  return {
    disease,
    label: DISEASES[disease].label,
    description: DISEASES[disease].description,
    source: DISEASES[disease].source,
    generatedAt: new Date().toISOString(),
    countries,
    totals: countries.reduce(
      (total, country) => ({
        cases: total.cases + country.cases,
        deaths: total.deaths + country.deaths,
      }),
      { cases: 0, deaths: 0 },
    ),
  };
}

async function fetchCovidCountries(): Promise<CountryMetric[]> {
  const data = await fetchJson<DiseaseShCountry[]>(DISEASES.covid.url, 'disease.sh COVID-19');

  return data.map((item) => ({
    country: item.country ?? item.countryInfo?.iso3 ?? 'Unknown',
    iso2: item.countryInfo?.iso2 ?? '',
    iso3: item.countryInfo?.iso3 ?? '',
    cases: toNumber(item.cases),
    deaths: toNumber(item.deaths),
    incidence: toNumber(item.casesPerOneMillion),
    updated: item.updated ? new Date(item.updated).toISOString() : undefined,
    source: DISEASES.covid.source,
  }));
}

async function fetchFluNetCountries(): Promise<CountryMetric[]> {
  const csv = await fetchText(DISEASES.flu.url, 'WHO FluNet', 'text/csv');
  const rows = parseCsv(csv);
  const latestByCountry = new Map<string, CountryMetric>();

  for (const row of rows) {
    const country = firstField(row, ['COUNTRY_AREA_TERRITORY', 'Country', 'COUNTRY', 'Country Name']);
    if (!country) continue;

    const week = firstField(row, ['SDATE', 'ISO_WEEKSTARTDATE', 'YearWeek', 'WEEK', 'ISO_WEEK']);
    const iso2 = firstField(row, ['ISO2', 'ISO_2_CODE', 'COUNTRY_CODE']);
    const iso3 = firstField(row, ['ISO3', 'ISO_3_CODE']);
    const detections = sumFields(row, [
      'INF_A',
      'INF_B',
      'INF_ALL',
      'ALL_INF',
      'TOTAL_INF',
      'INF_A_H1',
      'INF_A_H1N1',
      'INF_A_H3',
      'INF_A_H5',
      'INF_A_NOTSUBTYPED',
      'INF_B_VICTORIA',
      'INF_B_YAMAGATA',
      'INF_B_LINEAGE_NOT_DETERMINED',
    ]);
    const specimens = sumFields(row, ['SPEC_PROCESSED_NB', 'SPEC_RECEIVED_NB', 'SPEC_PROCESSED', 'SPECIMENS_PROCESSED']);
    const previous = latestByCountry.get(country);

    if (!previous || String(week) >= String(previous.updated ?? '')) {
      latestByCountry.set(country, {
        country,
        iso2,
        iso3,
        cases: detections,
        deaths: 0,
        incidence: specimens > 0 ? round((detections / specimens) * 100, 2) : detections,
        updated: week || undefined,
        source: DISEASES.flu.source,
      });
    }
  }

  return Array.from(latestByCountry.values());
}

async function fetchWhoGhoCountries(disease: Extract<DiseaseKey, 'malaria'>): Promise<CountryMetric[]> {
  const [countryMap, data] = await Promise.all([
    fetchWhoCountryMap(),
    fetchJson<WhoODataResponse<WhoGhoRow>>(
      `${DISEASES[disease].url}?$filter=SpatialDimType eq 'COUNTRY'`,
      DISEASES[disease].source,
    ),
  ]);
  const latestByCountry = new Map<string, CountryMetric>();

  for (const row of data.value ?? []) {
    const iso3 = row.SpatialDim ?? '';
    const country = countryMap.get(iso3) ?? iso3;
    const cases = toNumber(row.NumericValue ?? row.Value);
    const year = row.TimeDim;
    const previous = latestByCountry.get(iso3);

    if (!iso3 || !country || cases <= 0) continue;

    if (!previous || Number(year ?? 0) >= Number(previous.updated ?? 0)) {
      latestByCountry.set(iso3, {
        country,
        iso2: '',
        iso3,
        cases,
        deaths: 0,
        incidence: cases,
        updated: year ? String(year) : undefined,
        source: DISEASES[disease].source,
      });
    }
  }

  return Array.from(latestByCountry.values());
}

async function fetchDengueCountries(): Promise<CountryMetric[]> {
  const params = new URLSearchParams({
    regions: '*',
    epiweeks: 'latest',
  });
  const data = await fetchJson<DelphiDengueResponse>(`${DISEASES.dengue.url}?${params}`, DISEASES.dengue.source);

  if (data.result !== 1 || !Array.isArray(data.epidata)) {
    throw new Error(data.message || `${DISEASES.dengue.source} returned an invalid response.`);
  }

  return data.epidata.map((item) => ({
    country: normalizeRegionName(item.region ?? 'Unknown'),
    iso2: '',
    iso3: String(item.region ?? '').toUpperCase(),
    cases: toNumber(item.num_dengue),
    deaths: toNumber(item.num_deaths),
    incidence: toNumber(item.incidence_rate),
    updated: item.epiweek ? String(item.epiweek) : undefined,
    source: DISEASES.dengue.source,
  }));
}

async function fetchWhoCountryMap() {
  const data = await fetchJson<WhoODataResponse<WhoCountryDimension>>(
    'https://ghoapi.azureedge.net/api/DIMENSION/COUNTRY/DimensionValues',
    'WHO country dimension values',
  );

  return new Map((data.value ?? []).map((country) => [country.Code ?? '', country.Title ?? country.Code ?? '']));
}

async function fetchJson<T>(url: string, label: string): Promise<T> {
  const response = await fetchWithTimeout(url, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 60 * 30 },
  });

  if (!response.ok) throw new Error(`${label} request failed with status ${response.status}.`);
  return (await response.json()) as T;
}

async function fetchText(url: string, label: string, accept: string): Promise<string> {
  const response = await fetchWithTimeout(url, {
    headers: { Accept: accept },
    next: { revalidate: 60 * 30 },
  });

  if (!response.ok) throw new Error(`${label} request failed with status ${response.status}.`);
  return response.text();
}

async function fetchWithTimeout(url: string, init: RequestInit & { next?: { revalidate: number } }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function parseCsv(csv: string) {
  const [headerLine, ...lines] = csv.trim().split(/\r?\n/);
  const headers = splitCsvLine(headerLine);

  return lines.map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = values[index] ?? '';
      return row;
    }, {});
  });
}

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function firstField(row: Record<string, string>, names: string[]) {
  for (const name of names) {
    const value = row[name];
    if (value) return value;
  }

  return '';
}

function sumFields(row: Record<string, string>, names: string[]) {
  return names.reduce((total, name) => total + toNumber(row[name]), 0);
}

function toNumber(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;

  const parsed = Number(value.replaceAll(',', '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number, decimals: number) {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}

function normalizeRegionName(region: string) {
  return region
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}
