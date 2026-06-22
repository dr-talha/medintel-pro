'use client';

import { useEffect, useMemo, useState } from 'react';

type QuizQuestion = {
  id: string;
  category: string;
  difficulty: string;
  question: string;
  correctAnswer: string;
  options: string[];
};

export default function QuizPage() {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadQuiz() {
      try {
        setIsLoading(true);
        const response = await fetch('/api/quiz', { cache: 'no-store' });
        const payload = (await response.json()) as { questions?: QuizQuestion[]; error?: string };
        if (!response.ok || !payload.questions?.length) throw new Error(payload.error ?? 'Unable to load quiz questions.');
        setQuestions(payload.questions);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load quiz.');
      } finally {
        setIsLoading(false);
      }
    }

    loadQuiz();
  }, []);

  const currentQuestion = questions[currentIndex];
  const score = useMemo(() => questions.reduce((total, question) => total + (answers[question.id] === question.correctAnswer ? 1 : 0), 0), [answers, questions]);
  const progress = questions.length ? Math.round(((currentIndex + 1) / questions.length) * 100) : 0;

  function resetQuiz() {
    setAnswers({});
    setCurrentIndex(0);
    setIsFinished(false);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950 dark:bg-slate-950 dark:text-white sm:px-6 lg:px-8">
      <section className="mx-auto max-w-4xl">
        <div className="mb-8 rounded-3xl bg-gradient-to-r from-cyan-600 to-blue-700 p-8 text-white shadow-2xl shadow-cyan-900/20 dark:from-cyan-500 dark:to-blue-600 dark:text-slate-950">
          <p className="text-sm font-bold uppercase tracking-[0.32em] opacity-80">PROMO #8 · Dynamic Quiz</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Medical Knowledge Quiz</h1>
          <p className="mt-4 max-w-2xl leading-7 opacity-90">Questions load from a Next.js API route backed by Open Trivia DB with a local medical fallback.</p>
        </div>

        {isLoading ? <div className="rounded-3xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">Loading quiz questions…</div> : null}
        {error ? <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div> : null}

        {currentQuestion && !isFinished ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-8">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-cyan-600 dark:text-cyan-300">Question {currentIndex + 1} of {questions.length}</p>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{currentQuestion.category} · {currentQuestion.difficulty}</p>
              </div>
              <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full bg-cyan-500" style={{ width: `${progress}%` }} /></div>
            </div>

            <h2 className="text-2xl font-bold leading-snug">{currentQuestion.question}</h2>
            <div className="mt-6 grid gap-3">
              {currentQuestion.options.map((option) => {
                const selected = answers[currentQuestion.id] === option;
                return (
                  <button key={option} type="button" onClick={() => setAnswers((value) => ({ ...value, [currentQuestion.id]: option }))} className={`rounded-2xl border p-4 text-left font-semibold transition ${selected ? 'border-cyan-500 bg-cyan-50 text-cyan-800 ring-4 ring-cyan-500/15 dark:bg-cyan-950/50 dark:text-cyan-100' : 'border-slate-200 bg-slate-50 hover:border-cyan-300 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-cyan-700'}`}>{option}</button>
                );
              })}
            </div>

            <div className="mt-8 flex flex-wrap justify-between gap-3">
              <button type="button" onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))} disabled={currentIndex === 0} className="rounded-2xl border border-slate-300 px-5 py-3 font-bold disabled:opacity-40 dark:border-slate-700">Previous</button>
              {currentIndex === questions.length - 1 ? <button type="button" onClick={() => setIsFinished(true)} className="rounded-2xl bg-cyan-600 px-6 py-3 font-bold text-white dark:bg-cyan-400 dark:text-slate-950">Finish Quiz</button> : <button type="button" onClick={() => setCurrentIndex((index) => Math.min(questions.length - 1, index + 1))} className="rounded-2xl bg-cyan-600 px-6 py-3 font-bold text-white dark:bg-cyan-400 dark:text-slate-950">Next</button>}
            </div>
          </div>
        ) : null}

        {isFinished ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-bold uppercase tracking-[0.32em] text-cyan-600 dark:text-cyan-300">Final Results</p>
            <h2 className="mt-3 text-4xl font-black">{score} / {questions.length}</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">You answered {questions.length ? Math.round((score / questions.length) * 100) : 0}% correctly.</p>
            <button type="button" onClick={resetQuiz} className="mt-6 rounded-2xl bg-cyan-600 px-6 py-3 font-bold text-white dark:bg-cyan-400 dark:text-slate-950">Restart Quiz</button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
