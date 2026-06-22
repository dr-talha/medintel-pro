import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type TriviaQuestion = {
  type: string;
  difficulty: string;
  category: string;
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
};

type TriviaResponse = {
  response_code: number;
  results: TriviaQuestion[];
};

const localQuestions = [
  {
    id: 'local-1',
    category: 'Medicine',
    difficulty: 'medium',
    question: 'Which vital sign is most directly used to calculate mean arterial pressure?',
    correctAnswer: 'Blood pressure',
    options: ['Blood pressure', 'Respiratory rate', 'Oxygen saturation', 'Temperature'],
  },
  {
    id: 'local-2',
    category: 'Pharmacology',
    difficulty: 'medium',
    question: 'Which medication class is commonly used as first-line therapy for anaphylaxis?',
    correctAnswer: 'Epinephrine',
    options: ['Epinephrine', 'Beta blocker', 'Loop diuretic', 'Statin'],
  },
  {
    id: 'local-3',
    category: 'Clinical Medicine',
    difficulty: 'easy',
    question: 'What does the “A” in the ABC approach to emergency assessment stand for?',
    correctAnswer: 'Airway',
    options: ['Airway', 'Artery', 'Assessment', 'Antibiotic'],
  },
  {
    id: 'local-4',
    category: 'Renal',
    difficulty: 'hard',
    question: 'Which laboratory value is commonly used in estimated glomerular filtration rate equations?',
    correctAnswer: 'Serum creatinine',
    options: ['Serum creatinine', 'Serum amylase', 'Troponin I', 'D-dimer'],
  },
  {
    id: 'local-5',
    category: 'Pulmonary',
    difficulty: 'easy',
    question: 'Which device is typically used to measure peripheral oxygen saturation?',
    correctAnswer: 'Pulse oximeter',
    options: ['Pulse oximeter', 'Spirometer', 'Stethoscope', 'Sphygmomanometer'],
  },
];

function decodeHtml(value: string) {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'")
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

export async function GET() {
  try {
    const response = await fetch('https://opentdb.com/api.php?amount=8&category=17&type=multiple', {
      next: { revalidate: 60 * 30 },
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) throw new Error(`Open Trivia DB returned ${response.status}`);

    const payload = (await response.json()) as TriviaResponse;
    if (payload.response_code !== 0 || payload.results.length === 0) throw new Error('Open Trivia DB returned no questions.');

    const questions = payload.results.map((item, index) => {
      const correctAnswer = decodeHtml(item.correct_answer);
      return {
        id: `opentdb-${index}-${correctAnswer}`,
        category: decodeHtml(item.category),
        difficulty: item.difficulty,
        question: decodeHtml(item.question),
        correctAnswer,
        options: shuffle([correctAnswer, ...item.incorrect_answers.map(decodeHtml)]),
      };
    });

    return NextResponse.json({ source: 'open-trivia-db', questions });
  } catch (error) {
    console.warn('Quiz API fallback activated:', error);
    return NextResponse.json({ source: 'local-medical-fallback', questions: localQuestions });
  }
}
