'use client';

import { ChangeEvent, useMemo, useState } from 'react';

type CalculatorInput = {
  key: string;
  label: string;
  unit: string;
  min?: number;
  step?: number;
};

type CalculatorConfig = {
  id: string;
  name: string;
  description: string;
  inputs: CalculatorInput[];
  calculate: (values: Record<string, number>) => string;
};

const calculators: CalculatorConfig[] = [
  {
    id: 'bmi',
    name: 'Body Mass Index (BMI)',
    description: 'Estimates weight category using weight and height.',
    inputs: [
      { key: 'weightKg', label: 'Weight', unit: 'kg', min: 0, step: 0.1 },
      { key: 'heightCm', label: 'Height', unit: 'cm', min: 0, step: 0.1 },
    ],
    calculate: ({ weightKg, heightCm }) => {
      if (!weightKg || !heightCm) return 'Enter weight and height.';
      const bmi = weightKg / (heightCm / 100) ** 2;
      return `${bmi.toFixed(1)} kg/m²`;
    },
  },
  {
    id: 'bsa',
    name: 'Body Surface Area (Mosteller)',
    description: 'Calculates BSA for medication and fluid dosing contexts.',
    inputs: [
      { key: 'weightKg', label: 'Weight', unit: 'kg', min: 0, step: 0.1 },
      { key: 'heightCm', label: 'Height', unit: 'cm', min: 0, step: 0.1 },
    ],
    calculate: ({ weightKg, heightCm }) => {
      if (!weightKg || !heightCm) return 'Enter weight and height.';
      const bsa = Math.sqrt((heightCm * weightKg) / 3600);
      return `${bsa.toFixed(2)} m²`;
    },
  },
  {
    id: 'gfr',
    name: 'Estimated GFR (Cockcroft-Gault)',
    description: 'Approximates creatinine clearance from age, weight, sex, and serum creatinine.',
    inputs: [
      { key: 'age', label: 'Age', unit: 'years', min: 0, step: 1 },
      { key: 'weightKg', label: 'Weight', unit: 'kg', min: 0, step: 0.1 },
      { key: 'serumCreatinine', label: 'Serum creatinine', unit: 'mg/dL', min: 0, step: 0.01 },
      { key: 'sexFactor', label: 'Sex factor (1 male, 0.85 female)', unit: 'factor', min: 0.85, step: 0.01 },
    ],
    calculate: ({ age, weightKg, serumCreatinine, sexFactor }) => {
      if (!age || !weightKg || !serumCreatinine || !sexFactor) return 'Enter all required values.';
      const crcl = (((140 - age) * weightKg) / (72 * serumCreatinine)) * sexFactor;
      return `${crcl.toFixed(1)} mL/min`;
    },
  },
];

export default function CalculatorsPage() {
  const [values, setValues] = useState<Record<string, Record<string, number>>>({});

  function handleInput(calculatorId: string, inputKey: string, event: ChangeEvent<HTMLInputElement>) {
    const nextValue = Number(event.target.value);
    setValues((current) => ({
      ...current,
      [calculatorId]: {
        ...(current[calculatorId] ?? {}),
        [inputKey]: Number.isNaN(nextValue) ? 0 : nextValue,
      },
    }));
  }

  const calculatorCount = useMemo(() => calculators.length, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-cyan-50 px-4 py-10 text-slate-950 dark:from-slate-950 dark:to-slate-900 dark:text-white sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-950">
          <p className="text-sm font-bold uppercase tracking-[0.32em] text-cyan-600 dark:text-cyan-300">PROMO #9 · Data-Driven Calculators</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Medical Calculators</h1>
          <p className="mt-4 max-w-3xl leading-7 text-slate-600 dark:text-slate-300">
            Calculator cards are rendered from a JSON-like configuration array. Add a calculator by adding one config object rather than hand-coding another form.
          </p>
          <p className="mt-3 text-sm font-semibold text-cyan-700 dark:text-cyan-300">{calculatorCount} calculators configured</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {calculators.map((calculator) => {
            const calculatorValues = values[calculator.id] ?? {};
            const result = calculator.calculate(calculatorValues);

            return (
              <article key={calculator.id} className="flex min-h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/30">
                <div className="mb-5">
                  <h2 className="text-2xl font-black tracking-tight">{calculator.name}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{calculator.description}</p>
                </div>

                <div className="flex-1 space-y-4">
                  {calculator.inputs.map((input) => (
                    <label key={input.key} className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">{input.label}</span>
                      <div className="flex overflow-hidden rounded-2xl border border-slate-300 bg-white focus-within:border-cyan-500 focus-within:ring-4 focus-within:ring-cyan-500/15 dark:border-slate-700 dark:bg-slate-900">
                        <input
                          type="number"
                          min={input.min}
                          step={input.step}
                          value={calculatorValues[input.key] ?? ''}
                          onChange={(event) => handleInput(calculator.id, input.key, event)}
                          className="min-h-12 w-full bg-transparent px-4 text-slate-950 outline-none dark:text-white"
                        />
                        <span className="grid min-w-20 place-items-center border-l border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{input.unit}</span>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="mt-6 rounded-2xl bg-cyan-50 p-5 dark:bg-cyan-950/40">
                  <p className="text-xs font-bold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Result</p>
                  <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{result}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
