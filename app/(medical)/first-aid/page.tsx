'use client';

import { useEffect, useMemo, useState } from 'react';

type Protocol = {
  title: string;
  priority: string;
  summary: string;
  steps: string[];
  callout: string;
};

const protocols: Protocol[] = [
  {
    title: 'Severe bleeding',
    priority: 'Life-threatening bleeding',
    summary: 'Apply firm, continuous pressure and activate emergency services immediately.',
    steps: [
      'Call emergency services now or tell a specific bystander to call.',
      'Put on gloves if available, then press firmly on the wound with sterile gauze or clean cloth.',
      'Keep steady pressure. Do not repeatedly lift the dressing to check the wound.',
      'If blood soaks through, add another layer on top and keep pressing.',
      'Keep the person lying down and warm until trained help arrives.',
    ],
    callout: 'If bleeding is from an arm or leg and will not stop, use a tourniquet only if trained or directed by emergency dispatch.',
  },
  {
    title: 'Choking adult or child',
    priority: 'Airway emergency',
    summary: 'Use abdominal thrusts for a conscious person who cannot cough, speak, or breathe.',
    steps: [
      'Ask, “Are you choking?” If they cannot speak or cough, tell someone to call emergency services.',
      'Stand behind the person and wrap your arms around their waist.',
      'Place a fist just above the navel and below the breastbone.',
      'Grasp your fist and deliver quick inward and upward thrusts.',
      'Continue until the object comes out or the person becomes unresponsive.',
    ],
    callout: 'If the person becomes unresponsive, lower them to the floor and begin CPR if trained.',
  },
  {
    title: 'Possible heart attack',
    priority: 'Chest pain or pressure',
    summary: 'Call emergency services and keep the person calm, seated, and closely observed.',
    steps: [
      'Call emergency services immediately for chest pressure, shortness of breath, sweating, nausea, or pain spreading to the arm, back, neck, or jaw.',
      'Have the person stop activity and sit in a comfortable position.',
      'Loosen tight clothing and keep them warm.',
      'Help them take prescribed nitroglycerin if they have it and can follow their care plan.',
      'Be ready to start CPR and use an AED if they become unresponsive and are not breathing normally.',
    ],
    callout: 'Do not drive the person to the hospital yourself unless emergency services are unavailable.',
  },
  {
    title: 'Burns',
    priority: 'Thermal injury',
    summary: 'Cool the burn with running water and protect the skin from contamination.',
    steps: [
      'Move the person away from the heat source when safe.',
      'Cool the burn under cool running water for at least 20 minutes.',
      'Remove jewelry or tight clothing near the burn unless stuck to the skin.',
      'Cover with a clean, non-stick dressing or plastic wrap.',
      'Seek urgent care for deep, large, chemical, electrical, face, hand, foot, genital, or airway burns.',
    ],
    callout: 'Do not apply ice, butter, toothpaste, or ointments to a serious burn.',
  },
];

function protocolSpeechText(protocol: Protocol) {
  return `${protocol.title}. ${protocol.summary} Steps. ${protocol.steps.join(' ')} Important. ${protocol.callout}`;
}

export default function FirstAidPage() {
  const [activeTitle, setActiveTitle] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(false);

  useEffect(() => {
    setSpeechSupported('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window);

    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const emergencyText = useMemo(() => protocols.map((protocol) => protocol.title).join(', '), []);

  function readProtocol(protocol: Protocol) {
    if (!speechSupported) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(protocolSpeechText(protocol));
    utterance.rate = 0.86;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onend = () => setActiveTitle(null);
    utterance.onerror = () => setActiveTitle(null);
    setActiveTitle(protocol.title);
    window.speechSynthesis.speak(utterance);
  }

  function stopReading() {
    window.speechSynthesis.cancel();
    setActiveTitle(null);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-red-50 via-white to-cyan-50 px-4 py-6 text-slate-950 dark:from-slate-950 dark:via-slate-900 dark:to-red-950 dark:text-white sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl">
        <div className="rounded-[2rem] border border-red-200 bg-white p-6 shadow-2xl shadow-red-900/10 dark:border-red-900/50 dark:bg-slate-950 dark:shadow-black/40 sm:p-8">
          <p className="text-sm font-black uppercase tracking-[0.32em] text-red-600 dark:text-red-300">PROMO #12 · First Aid TTS</p>
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-4xl font-black tracking-tight sm:text-6xl">Emergency first aid</h1>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-700 dark:text-slate-300">
                Large-tap protocols with native browser narration for high-stress moments. Call emergency services for any life-threatening situation.
              </p>
            </div>
            <a href="tel:911" className="inline-flex min-h-16 items-center justify-center rounded-3xl bg-red-600 px-8 text-xl font-black text-white shadow-xl shadow-red-600/25 transition hover:-translate-y-0.5 hover:bg-red-500 focus:outline-none focus:ring-4 focus:ring-red-500/30">
              Call 911
            </a>
          </div>
          <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
            Educational support only. Follow dispatcher instructions and local training. Protocols included: {emergencyText}.
          </p>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {protocols.map((protocol) => {
            const isReading = activeTitle === protocol.title;

            return (
              <article key={protocol.title} className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/30 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <span className="rounded-full bg-red-100 px-4 py-2 text-xs font-black uppercase tracking-wide text-red-700 dark:bg-red-950 dark:text-red-200">{protocol.priority}</span>
                    <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">{protocol.title}</h2>
                    <p className="mt-2 text-base leading-7 text-slate-600 dark:text-slate-300">{protocol.summary}</p>
                  </div>
                  {isReading ? (
                    <button type="button" onClick={stopReading} className="min-h-16 rounded-3xl bg-slate-950 px-6 text-lg font-black text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-400 dark:bg-white dark:text-slate-950">
                      Stop
                    </button>
                  ) : (
                    <button type="button" onClick={() => readProtocol(protocol)} disabled={!speechSupported} className="min-h-16 rounded-3xl bg-cyan-600 px-6 text-lg font-black text-white shadow-lg shadow-cyan-600/20 transition hover:-translate-y-0.5 hover:bg-cyan-500 focus:outline-none focus:ring-4 focus:ring-cyan-500/30 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300">
                      Read Aloud
                    </button>
                  )}
                </div>

                <ol className="mt-5 space-y-3">
                  {protocol.steps.map((step, index) => (
                    <li key={step} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-base font-semibold leading-7 dark:border-slate-800 dark:bg-slate-900/70">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-sm font-black text-white dark:bg-cyan-400 dark:text-slate-950">{index + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>

                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100">
                  {protocol.callout}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
