/* ============================================================
   MedIntel Pro — quiz.js
   Quiz Engine · Session · Timer · Scoring · Adaptive
   CME Mode · Daily Challenge · Leaderboard · Results
   ============================================================ */

'use strict';

/* ══════════════════════════════════════════
   QUIZ STATE
   ══════════════════════════════════════════ */

const QuizState = {
  questions:       [],
  currentIndex:    0,
  answers:         {},       /* { questionId: selectedAnswer } */
  results:         {},       /* { questionId: { correct, correctAnswer, explanation } } */
  sessionId:       null,
  mode:            'practice',   /* practice | timed | adaptive | cme | daily | custom */
  category:        null,
  difficulty:      null,
  startTime:       null,
  endTime:         null,
  timerInterval:   null,
  timeLimit:       0,            /* seconds, 0 = no limit */
  timeRemaining:   0,
  score:           0,
  streak:          0,
  maxStreak:       0,
  isFinished:      false,
  isLoading:       false,
};

/* Mode time limits (seconds per question × count) */
const MODE_TIMES = {
  practice: 0,
  timed:    90,   /* per question */
  cme:      120,
  daily:    60,
};

/* ══════════════════════════════════════════
   INIT
   ══════════════════════════════════════════ */

function initQuiz() {
  /* Quiz home page */
  if (document.getElementById('quiz-category-grid')) {
    loadCategories();
    bindModeSelector();
    bindDailyChallenge();
    return;
  }

  /* Active quiz session page */
  if (document.getElementById('quiz-session')) {
    startSessionFromURL();
    return;
  }
}

/* ── Load category cards ── */
async function loadCategories() {
  const grid = document.getElementById('quiz-category-grid');
  if (!grid) return;

  grid.innerHTML = skeletonGrid(10);

  try {
    const categories = await window.MedIntel.QuizAPI.getCategories();
    renderCategoryGrid(categories, grid);
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-warning"><span>⚠️</span><span>${err.message}</span></div>`;
  }
}

function renderCategoryGrid(categories, grid) {
  const ICONS = {
    pharmacology:    '💊', clinical:        '🩺', anatomy:   '🫀',
    pathology:       '🔬', microbiology:    '🦠', emergency: '🚨',
    nursing:         '💉', pharmacy:        '⚗️',  public_health: '🌍',
    traditional:     '🌿',
  };

  grid.innerHTML = categories.map(cat => `
    <a href="quiz-session.html?category=${encodeURIComponent(cat.slug)}"
       class="quiz-category-card hover-lift"
       data-reveal data-delay="${Math.min(cat._idx || 1, 6)}">
      <div class="quiz-category-card__icon">${ICONS[cat.slug] || '📚'}</div>
      <div class="quiz-category-card__name">${escapeHTML(cat.name)}</div>
      <div class="quiz-category-card__meta">
        <span class="quiz-category-card__count">${cat.question_count?.toLocaleString() || 0}+ questions</span>
        <div class="quiz-category-card__difficulty">
          ${[1,2,3,4,5].map(i => `<span class="${i <= (cat.avg_difficulty||2) ? 'filled' : ''}"></span>`).join('')}
        </div>
      </div>
    </a>
  `).join('');

  /* Trigger scroll reveals */
  requestAnimationFrame(() => {
    grid.querySelectorAll('[data-reveal]').forEach((el, i) => {
      el.dataset.delay = i + 1;
      setTimeout(() => el.classList.add('revealed'), i * 60);
    });
  });
}

/* ── Mode selector buttons ── */
function bindModeSelector() {
  document.querySelectorAll('.quiz-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.quiz-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      QuizState.mode = btn.dataset.mode || 'practice';
    });
  });
}

/* ── Daily challenge ── */
async function bindDailyChallenge() {
  const btn = document.getElementById('daily-challenge-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Loading…';
    try {
      const questions = await window.MedIntel.QuizAPI.getDailyChallenge();
      startSession(questions, { mode: 'daily', category: 'daily', timePerQ: 60 });
    } catch {
      btn.disabled = false;
      btn.textContent = "Today's Challenge";
    }
  });
}

/* ══════════════════════════════════════════
   SESSION START
   ══════════════════════════════════════════ */

async function startSessionFromURL() {
  const params     = new URLSearchParams(window.location.search);
  const category   = params.get('category') || null;
  const difficulty = params.get('difficulty') ? parseInt(params.get('difficulty')) : null;
  const mode       = params.get('mode') || QuizState.mode || 'practice';
  const limit      = parseInt(params.get('limit') || '10');

  QuizState.mode       = mode;
  QuizState.category   = category;
  QuizState.difficulty = difficulty;

  renderSessionLoading();

  try {
    const questions = await window.MedIntel.QuizAPI.getQuestions({
      category, difficulty, limit, mode,
    });

    if (!questions?.length) {
      renderNoQuestions();
      return;
    }

    startSession(questions, { mode, category, timePerQ: MODE_TIMES[mode] || 0 });
  } catch (err) {
    renderSessionError(err);
  }
}

function startSession(questions, opts = {}) {
  const { mode = 'practice', category = null, timePerQ = 0 } = opts;

  Object.assign(QuizState, {
    questions,
    currentIndex:  0,
    answers:       {},
    results:       {},
    sessionId:     generateId(),
    mode,
    category,
    startTime:     Date.now(),
    endTime:       null,
    score:         0,
    streak:        0,
    maxStreak:     0,
    isFinished:    false,
    timeLimit:     timePerQ * questions.length,
    timeRemaining: timePerQ * questions.length,
  });

  renderQuestion(0);
  renderQuestionMap();
  renderSidebarStats();

  if (timePerQ > 0) startTimer();
}

/* ══════════════════════════════════════════
   QUESTION RENDER
   ══════════════════════════════════════════ */

function renderQuestion(index) {
  const q   = QuizState.questions[index];
  const container = document.getElementById('quiz-session');
  if (!q || !container) return;

  QuizState.currentIndex = index;
  updateProgressBar();
  updateQuestionMap();

  const options = Array.isArray(q.options) ? q.options : Object.values(q.options || {});
  const answered = QuizState.answers[q.id];

  container.innerHTML = `
    <div class="question-card" id="question-card">
      <div class="question-card__meta">
        <span class="question-card__number">Question ${index + 1} of ${QuizState.questions.length}</span>
        ${q.category ? `<span class="badge badge-muted">${escapeHTML(q.category)}</span>` : ''}
        ${q.usmle_step ? `<span class="badge badge-info">USMLE ${escapeHTML(q.usmle_step)}</span>` : ''}
        ${renderDifficultyDots(q.difficulty)}
      </div>

      <div class="question-card__body">
        <p class="question-card__stem">${escapeHTML(q.question)}</p>

        <div class="answer-options" id="answer-options">
          ${options.map((opt, i) => {
            const letter = String.fromCharCode(65 + i);
            const isSelected = answered === letter;
            return `
              <div class="answer-option${isSelected ? ' selected' : ''}"
                   data-letter="${letter}"
                   onclick="QuizEngine.selectAnswer('${q.id}', '${letter}', this)">
                <div class="answer-option__key">${letter}</div>
                <div class="answer-option__text">${escapeHTML(opt)}</div>
              </div>
            `;
          }).join('')}
        </div>

        <div id="explanation-wrap"></div>
      </div>

      <div class="question-card__footer">
        <button class="question-card__skip-btn" onclick="QuizEngine.skipQuestion()">
          Skip
        </button>
        <div style="display:flex;gap:10px;">
          ${index > 0 ? `<button class="btn btn-secondary btn-sm" onclick="QuizEngine.prevQuestion()">← Prev</button>` : ''}
          <button class="btn btn-primary btn-sm" id="next-btn"
                  onclick="QuizEngine.nextQuestion()"
                  ${!answered ? 'disabled' : ''}>
            ${index === QuizState.questions.length - 1 ? 'Finish Quiz' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  `;

  /* If already answered, show explanation immediately */
  if (answered && QuizState.results[q.id]) {
    revealExplanation(q.id, answered, QuizState.results[q.id]);
  }

  /* Animate in */
  requestAnimationFrame(() => {
    container.querySelector('.question-card')?.classList.add('anim-scale-in');
  });
}

function renderDifficultyDots(level = 1) {
  const dots = [1,2,3,4,5].map(i =>
    `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;
     background:${i <= level ? 'var(--clr-primary)' : 'var(--clr-bg-raised)'};
     margin-right:2px;"></span>`
  ).join('');
  return `<span title="Difficulty ${level}/5">${dots}</span>`;
}

/* ══════════════════════════════════════════
   ANSWER LOGIC
   ══════════════════════════════════════════ */

async function selectAnswer(questionId, letter, el) {
  /* Prevent re-selection if already answered */
  if (QuizState.answers[questionId]) return;

  QuizState.answers[questionId] = letter;

  /* Visual: mark selected */
  document.querySelectorAll('.answer-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected', 'just-selected');
  el.classList.add('disabled');
  document.querySelectorAll('.answer-option').forEach(o => o.classList.add('disabled'));

  /* Enable next button */
  document.getElementById('next-btn')?.removeAttribute('disabled');

  /* Fetch result (practice mode — immediate feedback) */
  if (QuizState.mode !== 'timed') {
    try {
      const result = await window.MedIntel.QuizAPI.submitAnswer(questionId, letter);
      QuizState.results[questionId] = result;

      updateScore(result.correct);
      markOptionVisuals(letter, result.correct_answer);
      revealExplanation(questionId, letter, result);
      updateQuestionMap();
      updateSidebarStats();
    } catch {
      /* Offline — reveal on next fetch */
    }
  } else {
    /* Timed: store answer, reveal on session end */
    updateQuestionMap();
  }
}

function markOptionVisuals(selected, correct) {
  document.querySelectorAll('.answer-option').forEach(opt => {
    const letter = opt.dataset.letter;
    if (letter === correct) {
      opt.classList.add('correct');
    } else if (letter === selected && selected !== correct) {
      opt.classList.add('incorrect');
    }
  });
}

function revealExplanation(questionId, selected, result) {
  const wrap = document.getElementById('explanation-wrap');
  if (!wrap) return;

  wrap.innerHTML = `
    <div class="explanation-panel">
      <div class="explanation-panel__header">
        <span style="font-size:20px;">${result.correct ? '✅' : '❌'}</span>
        <span class="explanation-panel__title">
          ${result.correct ? 'Correct!' : `Incorrect — Answer: ${result.correct_answer}`}
        </span>
      </div>
      <div class="explanation-panel__body">${escapeHTML(result.explanation || '')}</div>
      ${result.source ? `
        <div class="explanation-panel__citation">
          📚 ${escapeHTML(result.source)}
        </div>
      ` : ''}
      <div class="explanation-panel__actions">
        <button class="btn btn-ghost btn-xs"
                onclick="QuizEngine.flagQuestion('${questionId}')">
          🚩 Flag question
        </button>
      </div>
    </div>
  `;
}

function updateScore(isCorrect) {
  if (isCorrect) {
    QuizState.score++;
    QuizState.streak++;
    QuizState.maxStreak = Math.max(QuizState.streak, QuizState.maxStreak);
  } else {
    QuizState.streak = 0;
  }
}

/* ══════════════════════════════════════════
   NAVIGATION
   ══════════════════════════════════════════ */

function nextQuestion() {
  const { currentIndex, questions } = QuizState;

  if (currentIndex >= questions.length - 1) {
    finishQuiz();
    return;
  }

  renderQuestion(currentIndex + 1);
}

function prevQuestion() {
  if (QuizState.currentIndex > 0) {
    renderQuestion(QuizState.currentIndex - 1);
  }
}

function skipQuestion() {
  const q = QuizState.questions[QuizState.currentIndex];
  if (q) QuizState.answers[q.id] = 'SKIP';
  nextQuestion();
}

/* ══════════════════════════════════════════
   PROGRESS BAR
   ══════════════════════════════════════════ */

function updateProgressBar() {
  const { currentIndex, questions } = QuizState;
  const pct = Math.round(((currentIndex) / questions.length) * 100);

  const bar   = document.getElementById('quiz-progress-fill');
  const count = document.getElementById('quiz-progress-count');

  if (bar)   bar.style.width = `${pct}%`;
  if (count) count.innerHTML = `<strong>${currentIndex + 1}</strong> / ${questions.length}`;
}

/* ══════════════════════════════════════════
   QUESTION MAP (sidebar dots)
   ══════════════════════════════════════════ */

function renderQuestionMap() {
  const map = document.getElementById('question-map');
  if (!map) return;

  map.innerHTML = QuizState.questions.map((q, i) => `
    <div class="question-map__dot" data-index="${i}" onclick="QuizEngine.goToQuestion(${i})">
      ${i + 1}
    </div>
  `).join('');
}

function updateQuestionMap() {
  const map = document.getElementById('question-map');
  if (!map) return;

  QuizState.questions.forEach((q, i) => {
    const dot = map.querySelector(`[data-index="${i}"]`);
    if (!dot) return;

    dot.className = 'question-map__dot';

    if (i === QuizState.currentIndex) {
      dot.classList.add('current');
    } else if (QuizState.answers[q.id] === 'SKIP') {
      dot.classList.add('skipped');
    } else if (QuizState.results[q.id]?.correct === true) {
      dot.classList.add('correct');
    } else if (QuizState.results[q.id]?.correct === false) {
      dot.classList.add('wrong');
    }
  });
}

function goToQuestion(index) {
  renderQuestion(index);
}

/* ══════════════════════════════════════════
   SIDEBAR STATS
   ══════════════════════════════════════════ */

function renderSidebarStats() {
  updateSidebarStats();
}

function updateSidebarStats() {
  const answered = Object.keys(QuizState.answers).filter(k => QuizState.answers[k] !== 'SKIP').length;
  const correct  = Object.values(QuizState.results).filter(r => r.correct).length;
  const pct      = answered ? Math.round((correct / answered) * 100) : 0;

  setEl('sidebar-answered', answered);
  setEl('sidebar-correct',  correct);
  setEl('sidebar-score',    pct + '%');
  setEl('sidebar-streak',   QuizState.streak);
}

/* ══════════════════════════════════════════
   TIMER
   ══════════════════════════════════════════ */

function startTimer() {
  stopTimer();
  QuizState.timerInterval = setInterval(tickTimer, 1000);
}

function stopTimer() {
  if (QuizState.timerInterval) {
    clearInterval(QuizState.timerInterval);
    QuizState.timerInterval = null;
  }
}

function tickTimer() {
  QuizState.timeRemaining--;
  renderTimer();

  if (QuizState.timeRemaining <= 0) {
    stopTimer();
    finishQuiz();
  }
}

function renderTimer() {
  const timerEl = document.getElementById('quiz-timer');
  if (!timerEl) return;

  const t   = QuizState.timeRemaining;
  const min = Math.floor(t / 60).toString().padStart(2, '0');
  const sec = (t % 60).toString().padStart(2, '0');

  timerEl.textContent = `${min}:${sec}`;

  timerEl.closest('.quiz-timer')?.classList.toggle('quiz-timer--warning',  t <= 60 && t > 20);
  timerEl.closest('.quiz-timer')?.classList.toggle('quiz-timer--critical', t <= 20);
}

/* ══════════════════════════════════════════
   FINISH / RESULTS
   ══════════════════════════════════════════ */

async function finishQuiz() {
  stopTimer();
  QuizState.isFinished = true;
  QuizState.endTime    = Date.now();

  /* Fetch results for any unanswered (timed mode) */
  await batchFetchResults();

  const container = document.getElementById('quiz-session');
  if (!container) return;

  const total    = QuizState.questions.length;
  const correct  = Object.values(QuizState.results).filter(r => r.correct).length;
  const wrong    = Object.values(QuizState.results).filter(r => r.correct === false).length;
  const skipped  = Object.values(QuizState.answers).filter(a => a === 'SKIP').length;
  const pct      = Math.round((correct / total) * 100);
  const elapsed  = Math.round((QuizState.endTime - QuizState.startTime) / 1000);
  const avgTime  = Math.round(elapsed / total);
  const circumference = 2 * Math.PI * 54; /* r=54 */
  const dashOffset    = circumference - (pct / 100) * circumference;

  container.innerHTML = `
    <div class="quiz-results">
      <!-- Score Ring -->
      <div class="quiz-results__score-ring">
        <svg class="quiz-results__ring-svg" width="140" height="140" viewBox="0 0 140 140">
          <circle class="quiz-results__ring-bg"   cx="70" cy="70" r="54"/>
          <circle class="quiz-results__ring-fill"  cx="70" cy="70" r="54"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${dashOffset}"
            style="stroke:${pct >= 60 ? 'var(--clr-primary)' : 'var(--clr-danger)'}"/>
        </svg>
        <div class="quiz-results__score-text">
          <span class="quiz-results__percent">${pct}%</span>
          <span class="quiz-results__fraction">${correct}/${total}</span>
        </div>
      </div>

      <h2 class="quiz-results__heading">${getResultsHeading(pct)}</h2>
      <p class="quiz-results__sub">${getResultsSub(pct, QuizState.maxStreak)}</p>

      <!-- Stats row -->
      <div class="quiz-results__stats">
        <div class="quiz-stat quiz-stat--correct">
          <div class="quiz-stat__val">${correct}</div>
          <div class="quiz-stat__label">Correct</div>
        </div>
        <div class="quiz-stat quiz-stat--wrong">
          <div class="quiz-stat__val">${wrong}</div>
          <div class="quiz-stat__label">Incorrect</div>
        </div>
        <div class="quiz-stat quiz-stat--time">
          <div class="quiz-stat__val">${avgTime}s</div>
          <div class="quiz-stat__label">Avg Time</div>
        </div>
      </div>

      <!-- Actions -->
      <div class="quiz-results__actions">
        <button class="btn btn-primary" onclick="QuizEngine.retakeQuiz()">Retake Quiz</button>
        <button class="btn btn-secondary" onclick="QuizEngine.reviewAnswers()">Review Answers</button>
        <a href="quiz.html" class="btn btn-ghost">← More Quizzes</a>
        ${QuizState.mode === 'cme' && pct >= 70 ? `
          <button class="btn btn-outline" onclick="QuizEngine.downloadCMECertificate()">
            🏆 Download Certificate
          </button>` : ''}
      </div>

      <!-- Leaderboard (daily mode) -->
      ${QuizState.mode === 'daily' ? `<div id="leaderboard-section"><div class="spinner"></div></div>` : ''}

      <!-- Answer review -->
      <div id="answer-review" style="display:none;"></div>
    </div>
  `;

  /* Submit session to server */
  submitSessionToServer(correct, total, elapsed);

  /* Load leaderboard if daily */
  if (QuizState.mode === 'daily') loadLeaderboard();
}

async function batchFetchResults() {
  const unanswered = QuizState.questions.filter(q =>
    QuizState.answers[q.id] && !QuizState.results[q.id] && QuizState.answers[q.id] !== 'SKIP'
  );

  await Promise.allSettled(
    unanswered.map(async q => {
      try {
        const result = await window.MedIntel.QuizAPI.submitAnswer(q.id, QuizState.answers[q.id]);
        QuizState.results[q.id] = result;
        if (result.correct) QuizState.score++;
      } catch { /* offline */ }
    })
  );
}

function getResultsHeading(pct) {
  if (pct >= 90) return '🏆 Excellent!';
  if (pct >= 75) return '🎯 Great Job!';
  if (pct >= 60) return '📘 Good Effort';
  return '💪 Keep Studying';
}

function getResultsSub(pct, streak) {
  if (pct >= 90) return `Outstanding performance! Best streak: ${streak} in a row.`;
  if (pct >= 75) return `Solid knowledge. Review the missed questions to improve further.`;
  if (pct >= 60) return `You're on the right track. Use Adaptive mode to strengthen weak areas.`;
  return `Don't give up — review the explanations and try again.`;
}

function reviewAnswers() {
  const wrap = document.getElementById('answer-review');
  if (!wrap) return;

  wrap.style.display = 'block';
  wrap.innerHTML = `
    <h3 style="font-size:var(--fs-lg);margin-bottom:16px;font-family:var(--font-body);">Answer Review</h3>
    <div class="quiz-review-list">
      ${QuizState.questions.map((q, i) => {
        const answer = QuizState.answers[q.id];
        const result = QuizState.results[q.id];
        const status = !answer || answer === 'SKIP'
          ? 'skipped'
          : result?.correct ? 'correct' : 'wrong';

        return `
          <div class="quiz-review-item quiz-review-item--${status}">
            <div class="quiz-review-item__header">
              <span style="font-family:var(--font-mono);font-size:var(--fs-xs);color:var(--clr-text-faint);">Q${i+1}</span>
              <div class="quiz-review-item__q">${escapeHTML(q.question)}</div>
              <span class="quiz-review-item__result">
                ${status === 'correct' ? '✅' : status === 'wrong' ? '❌' : '—'}
              </span>
            </div>
            ${result ? `
              <div style="padding:12px 16px;font-size:var(--fs-sm);color:var(--clr-text-secondary);">
                <strong>Correct answer: ${escapeHTML(result.correct_answer)}</strong>
                ${result.explanation ? `<p style="margin-top:6px;">${escapeHTML(result.explanation)}</p>` : ''}
              </div>
            ` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
  wrap.scrollIntoView({ behavior: 'smooth' });
}

function retakeQuiz() {
  startSession(QuizState.questions, {
    mode:     QuizState.mode,
    category: QuizState.category,
    timePerQ: MODE_TIMES[QuizState.mode] || 0,
  });
}

/* ══════════════════════════════════════════
   LEADERBOARD
   ══════════════════════════════════════════ */

async function loadLeaderboard() {
  const section = document.getElementById('leaderboard-section');
  if (!section) return;

  try {
    const board = await window.MedIntel.QuizAPI.getLeaderboard(QuizState.category, 10);
    section.innerHTML = `
      <h3 style="font-size:var(--fs-md);margin:24px 0 12px;font-family:var(--font-body);">
        Today's Leaderboard
      </h3>
      <div class="leaderboard">
        ${board.map((entry, i) => `
          <div class="leaderboard-row ${i < 3 ? 'leaderboard-row--top' : ''}">
            <span class="leaderboard-row__rank">
              ${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
            </span>
            <div class="avatar avatar--sm">${escapeHTML((entry.display_name || '?')[0].toUpperCase())}</div>
            <span style="font-size:var(--fs-sm);color:var(--clr-text-secondary);">
              ${escapeHTML(entry.display_name || 'Anonymous')}
            </span>
            <span class="leaderboard-row__score">${entry.score}%</span>
          </div>
        `).join('')}
      </div>
    `;
  } catch { section.innerHTML = ''; }
}

/* ══════════════════════════════════════════
   CME CERTIFICATE
   ══════════════════════════════════════════ */

function downloadCMECertificate() {
  const correct = Object.values(QuizState.results).filter(r => r.correct).length;
  const total   = QuizState.questions.length;
  const pct     = Math.round((correct / total) * 100);

  if (pct < 70) {
    alert('A score of 70% or higher is required for CME certificate.');
    return;
  }

  /* Build a printable certificate page */
  const win = window.open('', '_blank');
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>CME Certificate — MedIntel Pro</title>
      <style>
        body { font-family: Georgia, serif; text-align: center; padding: 60px; background: #fff; color: #111; }
        h1   { font-size: 36px; margin-bottom: 8px; }
        h2   { font-size: 22px; font-weight: normal; color: #444; margin-bottom: 40px; }
        .line{ border-top: 2px solid #111; width: 400px; margin: 8px auto; }
        .score { font-size: 48px; color: #2aa874; font-family: monospace; }
        .footer { margin-top: 60px; font-size: 12px; color: #888; }
      </style>
    </head>
    <body>
      <h1>🏆 Certificate of Completion</h1>
      <h2>MedIntel Pro — Continuing Medical Education</h2>
      <p>This certifies successful completion of</p>
      <h2><strong>${escapeHTML(QuizState.category || 'Medical Knowledge')} Quiz</strong></h2>
      <div class="score">${pct}%</div>
      <p>${correct} / ${total} correct · ${new Date().toLocaleDateString()}</p>
      <div class="line"></div>
      <p class="footer">
        MedIntel Pro · app.medintel.pro · For educational purposes only.
      </p>
      <script>window.onload = () => window.print();</script>
    </body>
    </html>
  `);
}

/* ══════════════════════════════════════════
   FLAG QUESTION
   ══════════════════════════════════════════ */

async function flagQuestion(questionId) {
  try {
    await window.MedIntel.QuizAPI.flagQuestion(questionId, 'User reported issue');
    showToast('Question flagged for review. Thank you!', 'success');
  } catch {
    showToast('Could not submit flag. Please try again.', 'warning');
  }
}

/* ══════════════════════════════════════════
   SUBMIT SESSION
   ══════════════════════════════════════════ */

async function submitSessionToServer(correct, total, elapsed) {
  try {
    await window.MedIntel.QuizAPI.submitSession({
      sessionId: QuizState.sessionId,
      category:  QuizState.category,
      mode:      QuizState.mode,
      score:     Math.round((correct / total) * 100),
      correct, total, elapsed,
      answers:   QuizState.answers,
    });
  } catch { /* non-critical */ }
}

/* ══════════════════════════════════════════
   LOADING / ERROR STATES
   ══════════════════════════════════════════ */

function renderSessionLoading() {
  const container = document.getElementById('quiz-session');
  if (!container) return;
  container.innerHTML = `
    <div class="card" style="display:flex;flex-direction:column;gap:20px;">
      <div class="skeleton" style="height:24px;width:30%;"></div>
      <div class="skeleton" style="height:60px;"></div>
      <div class="skeleton" style="height:52px;"></div>
      <div class="skeleton" style="height:52px;"></div>
      <div class="skeleton" style="height:52px;"></div>
      <div class="skeleton" style="height:52px;"></div>
    </div>
  `;
}

function renderNoQuestions() {
  const container = document.getElementById('quiz-session');
  if (!container) return;
  container.innerHTML = `
    <div class="alert alert-info">
      <span>ℹ️</span>
      <div>
        <strong class="alert__title">No questions available</strong>
        <span class="alert__body">Try a different category or difficulty level.</span>
      </div>
    </div>
    <a href="quiz.html" class="btn btn-primary" style="margin-top:16px;">← Back to Quizzes</a>
  `;
}

function renderSessionError(err) {
  const container = document.getElementById('quiz-session');
  if (!container) return;
  container.innerHTML = `
    <div class="alert alert-warning">
      <span>⚠️</span>
      <div>
        <strong class="alert__title">Failed to load questions</strong>
        <span class="alert__body">${escapeHTML(err.message)}</span>
      </div>
    </div>
    <a href="quiz.html" class="btn btn-primary" style="margin-top:16px;">← Back to Quizzes</a>
  `;
}

/* ══════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════ */

function skeletonGrid(n) {
  return Array.from({ length: n }, () =>
    `<div class="skeleton" style="height:140px;border-radius:var(--r-xl);"></div>`
  ).join('');
}

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function generateId() {
  return 'qsess_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `<span>${escapeHTML(message)}</span>`;
  (document.getElementById('toast-container') || document.body).appendChild(toast);
  setTimeout(() => { toast.classList.add('dismissing'); setTimeout(() => toast.remove(), 300); }, 3000);
}

/* ══════════════════════════════════════════
   PUBLIC EXPORTS
   ══════════════════════════════════════════ */

const QuizEngine = {
  init: initQuiz,
  selectAnswer,
  nextQuestion,
  prevQuestion,
  skipQuestion,
  goToQuestion,
  flagQuestion,
  retakeQuiz,
  reviewAnswers,
  downloadCMECertificate,
  QuizState,
};

window.MedIntel   = window.MedIntel || {};
window.MedIntel.Quiz = QuizEngine;
window.QuizEngine    = QuizEngine;   /* inline onclick access */

document.addEventListener('DOMContentLoaded', initQuiz);
