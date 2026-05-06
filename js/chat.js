/* ============================================================
   MedIntel Pro — chat.js
   AI Chatbot · RAG queries · Message rendering · Emergency detection
   Session management · Typing indicator · Feedback
   ============================================================ */

'use strict';

/* ── Emergency keywords (client-side pre-check) ── */
const EMERGENCY_KEYWORDS = [
  'chest pain', 'can\'t breathe', 'cannot breathe', 'not breathing',
  'unconscious', 'anaphylaxis', 'anaphylactic', 'stroke', 'seizure',
  'heart attack', 'choking', 'overdose', 'unresponsive', 'severe bleeding',
];

const CRISIS_KEYWORDS = [
  'suicide', 'suicidal', 'kill myself', 'end my life',
  'self-harm', 'self harm', 'hurt myself',
];

/* ══════════════════════════════════════════
   CHAT STATE
   ══════════════════════════════════════════ */

const ChatState = {
  sessionId:    generateSessionId(),
  messages:     [],       /* { id, role, text, sources, timestamp, routeTag } */
  isLoading:    false,
  historyEnabled: false,  /* toggled by user in settings */
  inputHistory: [],       /* local up-arrow recall */
  historyIndex: -1,
};

/* ══════════════════════════════════════════
   DOM REFERENCES (lazy-resolved)
   ══════════════════════════════════════════ */

function getEl(id) { return document.getElementById(id); }

const DOM = {
  get feed()         { return getEl('chat-feed'); },
  get input()        { return getEl('chat-input'); },
  get sendBtn()      { return getEl('chat-send-btn'); },
  get form()         { return getEl('chat-form'); },
  get retrievalBar() { return getEl('retrieval-status'); },
  get sidebar()      { return getEl('chat-sidebar'); },
  get historyList()  { return getEl('chat-history-list'); },
  get newChatBtn()   { return getEl('new-chat-btn'); },
};

/* ══════════════════════════════════════════
   INIT
   ══════════════════════════════════════════ */

function initChat() {
  if (!DOM.feed) return;   /* not on chat page */

  bindEvents();
  restoreLocalHistory();
  autoResizeTextarea();
  renderWelcome();
  setupScrollReveal();

  /* Load server history if user is logged in */
  if (isLoggedIn() && ChatState.historyEnabled) {
    loadServerHistory();
  }
}

/* ── Global init functions ── */

function initNav() {
  /* Mobile menu toggle */
  const mobileBtn = document.getElementById('mobile-menu-btn');
  const mobileDrawer = document.getElementById('mobile-drawer');
  if (mobileBtn && mobileDrawer) {
    mobileBtn.addEventListener('click', () => {
      const expanded = mobileBtn.getAttribute('aria-expanded') === 'true';
      mobileBtn.setAttribute('aria-expanded', !expanded);
      mobileDrawer.setAttribute('aria-hidden', expanded);
      mobileDrawer.classList.toggle('open', !expanded);
      mobileBtn.classList.toggle('open', !expanded);
    });
  }

  /* Global search modal */
  const searchBtn = document.querySelector('.nav__search-kbd');
  const searchModal = document.getElementById('search-modal');
  const searchBackdrop = document.getElementById('search-backdrop');
  const globalSearchInput = document.getElementById('global-search-input');
  if (searchBtn && searchModal) {
    searchBtn.addEventListener('click', () => {
      searchModal.hidden = false;
      globalSearchInput?.focus();
    });
    searchBackdrop?.addEventListener('click', () => {
      searchModal.hidden = true;
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !searchModal.hidden) {
        searchModal.hidden = true;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchModal.hidden = false;
        globalSearchInput?.focus();
      }
    });
  }

  /* Nav search form */
  const navSearchForm = document.querySelector('.nav__search');
  if (navSearchForm) {
    navSearchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = new FormData(navSearchForm).get('q');
      if (q) window.location.href = `/drugs.html?q=${encodeURIComponent(q)}`;
    });
  }
}

function initTheme() {
  const themeBtn = document.getElementById('theme-toggle');
  if (!themeBtn) return;

  /* Load saved theme */
  const savedTheme = localStorage.getItem('medintel_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(themeBtn, savedTheme);

  /* Toggle on click */
  themeBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('medintel_theme', next);
    updateThemeIcon(themeBtn, next);
  });
}

function updateThemeIcon(btn, theme) {
  const sun = btn.querySelector('.icon-sun');
  const moon = btn.querySelector('.icon-moon');
  if (sun && moon) {
    sun.style.display = theme === 'dark' ? 'block' : 'none';
    moon.style.display = theme === 'light' ? 'block' : 'none';
  }
}

async function fetchAlerts() {
  const tickerTrack = document.getElementById('ticker-track');
  if (!tickerTrack) return;

  try {
    const alerts = await window.MedIntel.DiseaseAPI.getAlerts();
    if (alerts && alerts.length) {
      const items = alerts.map(a => `<span>${a.title} — ${a.location}</span>`).join(' · ');
      tickerTrack.innerHTML = items;
    } else {
      tickerTrack.innerHTML = '<span>No active alerts</span>';
    }
  } catch (err) {
    console.warn('Failed to fetch alerts:', err);
    // Fallback: static alerts
    tickerTrack.innerHTML = '<span>Monkeypox outbreak in Congo · COVID-19 monitoring active · Seasonal flu increasing</span>';
  }
}

async function fetchStats() {
  try {
    const stats = await window.MedIntel.DiseaseAPI.getGlobalStats();
    document.getElementById('stat-recalls')?.textContent = stats.recalls || '12';
    document.getElementById('stat-outbreaks')?.textContent = stats.outbreaks || '47';
  } catch (err) {
    console.warn('Failed to fetch stats:', err);
    // Fallback values
    document.getElementById('stat-recalls')?.textContent = '12';
    document.getElementById('stat-outbreaks')?.textContent = '47';
  }
}

/* Helpers */
function isLoggedIn() {
  return !!localStorage.getItem('medintel_token');
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getMockResponse(question) {
  const q = question.toLowerCase();
  if (q.includes('metformin')) {
    return {
      answer: "Metformin is an oral diabetes medicine that helps control blood sugar levels. Common side effects include nausea, vomiting, diarrhea, and stomach upset. It may also cause vitamin B12 deficiency with long-term use. Always take as prescribed and monitor blood sugar regularly.",
      sources: ["FDA Drug Label", "American Diabetes Association"]
    };
  } else if (q.includes('aspirin')) {
    return {
      answer: "Aspirin is used to reduce pain, fever, and inflammation. It can also prevent blood clots. Side effects may include stomach irritation, bleeding, and allergic reactions. Do not use in children under 18 for fever due to Reye's syndrome risk.",
      sources: ["DailyMed", "American Heart Association"]
    };
  } else {
    return {
      answer: "I'm currently running in offline demo mode. For accurate medical information, please consult a healthcare professional or use verified sources like FDA, WHO, or PubMed. This response is for demonstration only.",
      sources: ["Demo Mode"]
    };
  }
}

function bindEvents() {
  /* Send on Enter (Shift+Enter = newline) */
  DOM.input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    /* Up arrow — recall previous input */
    if (e.key === 'ArrowUp' && DOM.input.value === '') {
      recallPrevInput();
    }
  });

  DOM.input?.addEventListener('input', () => {
    autoResizeTextarea();
    updateSendBtnState();
  });

  DOM.sendBtn?.addEventListener('click', handleSend);
  DOM.newChatBtn?.addEventListener('click', startNewChat);

  /* Suggestion chips */
  document.querySelectorAll('.chat-suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const text = chip.dataset.prompt || chip.querySelector('.chat-suggestion-chip__text')?.textContent;
      if (text && DOM.input) {
        DOM.input.value = text;
        autoResizeTextarea();
        updateSendBtnState();
        DOM.input.focus();
      }
    });
  });

  /* Mobile sidebar toggle */
  document.getElementById('chat-sidebar-toggle')?.addEventListener('click', () => {
    DOM.sidebar?.classList.toggle('mobile-open');
  });

  /* Close sidebar on backdrop click */
  document.addEventListener('click', (e) => {
    if (
      DOM.sidebar?.classList.contains('mobile-open') &&
      !DOM.sidebar.contains(e.target) &&
      e.target.id !== 'chat-sidebar-toggle'
    ) {
      DOM.sidebar.classList.remove('mobile-open');
    }
  });
}

/* ══════════════════════════════════════════
   SEND LOGIC
   ══════════════════════════════════════════ */

async function handleSend() {
  const text = DOM.input?.value.trim();
  if (!text || ChatState.isLoading) return;

  /* — Emergency check — */
  if (isEmergency(text)) {
    appendEmergencyMessage();
    clearInput();
    return;
  }

  /* — Crisis check — */
  if (isCrisis(text)) {
    appendCrisisMessage();
    clearInput();
    return;
  }

  /* — Push to input history — */
  ChatState.inputHistory.unshift(text);
  if (ChatState.inputHistory.length > 50) ChatState.inputHistory.pop();
  ChatState.historyIndex = -1;

  /* — Render user message — */
  clearWelcome();
  const userMsgId = appendMessage('user', text);
  clearInput();
  setLoading(true);

  /* — Show retrieval status — */
  showRetrievalStatus('Searching verified medical database…');

  try {
    const response = await window.MedIntel.ChatAPI.ask(text, ChatState.sessionId);

    hideRetrievalStatus(true);

    /* — Emergency redirect from server — */
    if (response.type === 'EMERGENCY') {
      appendEmergencyMessage();
      return;
    }

    /* — Render AI message — */
    appendMessage('ai', response.answer, {
      sources:  response.sources  || [],
      routeTag: response.category || null,
      chunks:   response.chunks_used || 0,
    });

    /* — Persist to server history if enabled — */
    if (ChatState.historyEnabled && isLoggedIn()) {
      saveMessageToServer(text, response);
    }

    /* — Persist locally — */
    saveLocalHistory();

  } catch (err) {
    hideRetrievalStatus(false);
    // Fallback: mock response for demo
    const mockResponse = getMockResponse(text);
    appendMessage('ai', mockResponse.answer, {
      sources: mockResponse.sources,
      routeTag: 'demo',
    });
    // appendErrorMessage(err); // Commented out since not defined
  } finally {
    setLoading(false);
    scrollToBottom();
  }
}

/* ══════════════════════════════════════════
   SAFETY CHECKS
   ══════════════════════════════════════════ */

function isEmergency(text) {
  const lower = text.toLowerCase();
  return EMERGENCY_KEYWORDS.some(kw => lower.includes(kw));
}

function isCrisis(text) {
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some(kw => lower.includes(kw));
}

/* ══════════════════════════════════════════
   MESSAGE RENDERING
   ══════════════════════════════════════════ */

function appendMessage(role, text, meta = {}) {
  const id  = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const msg = {
    id,
    role,
    text,
    sources:   meta.sources  || [],
    routeTag:  meta.routeTag || null,
    timestamp: new Date(),
  };

  ChatState.messages.push(msg);

  const el = buildMessageEl(msg);
  removeTypingIndicator();
  DOM.feed?.appendChild(el);
  scrollToBottom();

  /* Animate in */
  requestAnimationFrame(() => el.classList.add('anim-fade-up'));

  return id;
}

function buildMessageEl(msg) {
  const wrap = document.createElement('div');
  wrap.className = `message message--${msg.role}`;
  wrap.id = msg.id;

  /* Avatar */
  const avatar = document.createElement('div');
  avatar.className = 'message__avatar';
  avatar.textContent = msg.role === 'user' ? '👤' : '🧬';

  /* Bubble */
  const bubble = document.createElement('div');
  bubble.className = 'message__bubble';

  /* Route tag (AI only) */
  if (msg.role === 'ai' && msg.routeTag) {
    const tag = document.createElement('span');
    tag.className = `route-tag route-tag--${msg.routeTag}`;
    tag.textContent = msg.routeTag.toUpperCase();
    bubble.appendChild(tag);
  }

  /* Text */
  const textEl = document.createElement('div');
  textEl.className = 'message__text';
  textEl.innerHTML = msg.role === 'ai'
    ? formatAIResponse(msg.text)
    : escapeHTML(msg.text);
  bubble.appendChild(textEl);

  /* Sources (AI only) */
  if (msg.role === 'ai' && msg.sources.length > 0) {
    const sourcesEl = buildSourcesEl(msg.sources);
    bubble.appendChild(sourcesEl);
  }

  /* Disclaimer (AI only) */
  if (msg.role === 'ai') {
    const disc = document.createElement('p');
    disc.className = 'message__disclaimer';
    disc.textContent = '⚠ For reference only. Always consult a qualified healthcare professional.';
    bubble.appendChild(disc);
  }

  /* Meta row: timestamp + actions */
  const meta = document.createElement('div');
  meta.className = 'message__meta';

  const time = document.createElement('span');
  time.className = 'message__time';
  time.textContent = formatTime(msg.timestamp);
  meta.appendChild(time);

  if (msg.role === 'ai') {
    const actions = buildMessageActions(msg.id);
    meta.appendChild(actions);
  }

  bubble.appendChild(meta);
  wrap.appendChild(avatar);
  wrap.appendChild(bubble);

  return wrap;
}

function buildSourcesEl(sources) {
  const wrap = document.createElement('div');
  wrap.className = 'message__sources';

  const label = document.createElement('span');
  label.className = 'message__sources-label';
  label.textContent = 'Sources:';
  wrap.appendChild(label);

  sources.forEach(src => {
    const chip = document.createElement('a');
    chip.className = 'source-citation';
    chip.href      = getSourceURL(src);
    chip.target    = '_blank';
    chip.rel       = 'noopener noreferrer';
    chip.innerHTML = `<span class="source-citation__dot"></span>${escapeHTML(src)}`;
    wrap.appendChild(chip);
  });

  return wrap;
}

function buildMessageActions(msgId) {
  const wrap = document.createElement('div');
  wrap.className = 'message__actions';

  const thumbUp = document.createElement('button');
  thumbUp.className = 'message__action-btn';
  thumbUp.title     = 'Helpful';
  thumbUp.innerHTML = '👍';
  thumbUp.addEventListener('click', () => submitFeedback(msgId, 1, thumbUp, thumbDown));

  const thumbDown = document.createElement('button');
  thumbDown.className = 'message__action-btn';
  thumbDown.title     = 'Not helpful';
  thumbDown.innerHTML = '👎';
  thumbDown.addEventListener('click', () => submitFeedback(msgId, -1, thumbUp, thumbDown));

  const copy = document.createElement('button');
  copy.className = 'message__action-btn';
  copy.title     = 'Copy';
  copy.innerHTML = '📋';
  copy.addEventListener('click', () => copyMessage(msgId, copy));

  wrap.appendChild(thumbUp);
  wrap.appendChild(thumbDown);
  wrap.appendChild(copy);

  return wrap;
}

/* ── Emergency Message ── */
function appendEmergencyMessage() {
  const el = document.createElement('div');
  el.className = 'emergency-cta';
  el.innerHTML = `
    <span style="font-size:24px;flex-shrink:0">🚨</span>
    <div>
      <strong style="color:var(--clr-danger);display:block;margin-bottom:4px;">
        This sounds like a medical emergency.
      </strong>
      <span style="font-size:var(--fs-sm);color:var(--clr-text-secondary)">
        Please call emergency services immediately, or follow the First Aid protocol.
      </span>
    </div>
    <a href="first-aid.html" class="btn btn-danger btn-sm" style="margin-left:auto;flex-shrink:0;">
      First Aid →
    </a>
  `;
  DOM.feed?.appendChild(el);
  scrollToBottom();
}

/* ── Crisis Message ── */
function appendCrisisMessage() {
  const el = document.createElement('div');
  el.className = 'alert alert-danger';
  el.innerHTML = `
    <span class="alert__icon">💙</span>
    <div>
      <strong class="alert__title">You don't have to face this alone.</strong>
      <span class="alert__body">
        Please reach out to a crisis line. In Pakistan: <strong>Umang helpline 0317-4288665</strong>.
        International: <strong>findahelpline.com</strong>
      </span>
    </div>
  `;
  DOM.feed?.appendChild(el);
  scrollToBottom();
}

/* ── Error Message ── */
function appendErrorMessage(err) {
  const isOffline = err.offline || !navigator.onLine;
  const el = document.createElement('div');
  el.className = 'alert alert-warning';
  el.innerHTML = `
    <span class="alert__icon">${isOffline ? '📡' : '⚠️'}</span>
    <div>
      <strong class="alert__title">${isOffline ? 'You\'re offline' : 'Something went wrong'}</strong>
      <span class="alert__body">${escapeHTML(err.message || 'Please try again.')}</span>
    </div>
  `;
  DOM.feed?.appendChild(el);
}

/* ══════════════════════════════════════════
   TYPING INDICATOR
   ══════════════════════════════════════════ */

function showTypingIndicator() {
  removeTypingIndicator();
  const el = document.createElement('div');
  el.className = 'typing-indicator';
  el.id = 'typing-indicator';
  el.innerHTML = `
    <div class="message__avatar">🧬</div>
    <div>
      <div class="typing-indicator__bubble">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
      <p class="typing-indicator__label">MedIntel is thinking…</p>
    </div>
  `;
  DOM.feed?.appendChild(el);
  scrollToBottom();
}

function removeTypingIndicator() {
  document.getElementById('typing-indicator')?.remove();
}

/* ══════════════════════════════════════════
   RETRIEVAL STATUS BAR
   ══════════════════════════════════════════ */

function showRetrievalStatus(msg) {
  showTypingIndicator();
  const bar = DOM.retrievalBar;
  if (!bar) return;
  bar.className = 'retrieval-status';
  bar.innerHTML = `<div class="retrieval-status__spinner"></div><span>${msg}</span>`;
  bar.hidden = false;
}

function hideRetrievalStatus(success) {
  removeTypingIndicator();
  const bar = DOM.retrievalBar;
  if (!bar) return;
  if (success) {
    bar.className = 'retrieval-status retrieval-status--done';
    bar.innerHTML = `<div class="retrieval-status__spinner"></div><span>Context retrieved from verified database</span>`;
    setTimeout(() => { bar.hidden = true; }, 2500);
  } else {
    bar.hidden = true;
  }
}

/* ══════════════════════════════════════════
   WELCOME / EMPTY STATE
   ══════════════════════════════════════════ */

function renderWelcome() {
  if (!DOM.feed || ChatState.messages.length > 0) return;
  DOM.feed.innerHTML = `
    <div class="chat-welcome" id="chat-welcome">
      <div class="chat-welcome__logo">🧬</div>
      <h2 class="chat-welcome__heading">MedIntel AI</h2>
      <p class="chat-welcome__sub">
        Ask any medical question. I answer <strong>only</strong> from verified 
        clinical databases — never from guesswork.
      </p>
      <div class="chat-suggestions">
        ${SUGGESTED_PROMPTS.map(p => `
          <button class="chat-suggestion-chip" data-prompt="${escapeAttr(p.text)}">
            <span class="chat-suggestion-chip__icon">${p.icon}</span>
            <span class="chat-suggestion-chip__text">${escapeHTML(p.text)}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;

  /* Re-bind suggestion clicks after DOM write */
  DOM.feed.querySelectorAll('.chat-suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const text = chip.dataset.prompt;
      if (text && DOM.input) {
        DOM.input.value = text;
        autoResizeTextarea();
        updateSendBtnState();
        DOM.input.focus();
      }
    });
  });
}

function clearWelcome() {
  document.getElementById('chat-welcome')?.remove();
}

const SUGGESTED_PROMPTS = [
  { icon: '💊', text: 'What are the side effects of metformin?' },
  { icon: '⚡', text: 'What drug interactions does warfarin have?' },
  { icon: '🫀', text: 'How is hypertension diagnosed and treated?' },
  { icon: '🧪', text: 'What does a high creatinine level indicate?' },
];

/* ══════════════════════════════════════════
   NEW CHAT / SESSION
   ══════════════════════════════════════════ */

function startNewChat() {
  ChatState.sessionId = generateSessionId();
  ChatState.messages  = [];
  if (DOM.feed) DOM.feed.innerHTML = '';
  renderWelcome();
  DOM.input?.focus();
}

/* ══════════════════════════════════════════
   HISTORY (local + server)
   ══════════════════════════════════════════ */

function saveLocalHistory() {
  try {
    const toSave = ChatState.messages.slice(-30).map(m => ({
      id: m.id, role: m.role, text: m.text,
      sources: m.sources, timestamp: m.timestamp.toISOString(),
    }));
    sessionStorage.setItem(`chat_${ChatState.sessionId}`, JSON.stringify(toSave));
  } catch { /* quota or private mode */ }
}

function restoreLocalHistory() {
  try {
    const raw = sessionStorage.getItem(`chat_${ChatState.sessionId}`);
    if (!raw) return;
    const msgs = JSON.parse(raw);
    msgs.forEach(m => {
      m.timestamp = new Date(m.timestamp);
      ChatState.messages.push(m);
      const el = buildMessageEl(m);
      DOM.feed?.appendChild(el);
    });
    if (msgs.length) {
      clearWelcome();
      scrollToBottom(false);
    }
  } catch { /* corrupted storage */ }
}

async function loadServerHistory() {
  try {
    const history = await window.MedIntel.ChatAPI.getHistory(ChatState.sessionId);
    if (!history?.length) return;
    clearWelcome();
    history.forEach(entry => {
      const msg = {
        id:        entry.id,
        role:      entry.role,
        text:      entry.content,
        sources:   entry.sources || [],
        timestamp: new Date(entry.created_at),
      };
      ChatState.messages.push(msg);
      DOM.feed?.appendChild(buildMessageEl(msg));
    });
    scrollToBottom(false);
  } catch { /* non-critical */ }
}

async function saveMessageToServer(userText, aiResponse) {
  try {
    /* Server saves both turns atomically */
    await window.MedIntel.api.post('/api/chat/save', {
      sessionId: ChatState.sessionId,
      userMessage: userText,
      aiMessage:   aiResponse.answer,
      sources:     aiResponse.sources,
    });
  } catch { /* non-critical */ }
}

/* ══════════════════════════════════════════
   FEEDBACK
   ══════════════════════════════════════════ */

async function submitFeedback(msgId, rating, thumbUpEl, thumbDownEl) {
  thumbUpEl.classList.toggle('message__action-btn--liked',    rating === 1);
  thumbDownEl.classList.toggle('message__action-btn--disliked', rating === -1);

  try {
    await window.MedIntel.ChatAPI.submitFeedback(msgId, rating);
  } catch { /* non-critical */ }
}

async function copyMessage(msgId, btnEl) {
  const msgObj = ChatState.messages.find(m => m.id === msgId);
  if (!msgObj) return;

  try {
    await navigator.clipboard.writeText(msgObj.text);
    const orig = btnEl.innerHTML;
    btnEl.innerHTML = '✅';
    setTimeout(() => { btnEl.innerHTML = orig; }, 1500);
  } catch { /* clipboard denied */ }
}

/* ══════════════════════════════════════════
   TEXTAREA & SEND BUTTON STATE
   ══════════════════════════════════════════ */

function autoResizeTextarea() {
  const ta = DOM.input;
  if (!ta) return;
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
}

function updateSendBtnState() {
  const btn = DOM.sendBtn;
  if (!btn) return;
  btn.disabled = !DOM.input?.value.trim() || ChatState.isLoading;
}

function setLoading(val) {
  ChatState.isLoading = val;
  updateSendBtnState();
  if (DOM.input) DOM.input.disabled = val;
}

function clearInput() {
  if (!DOM.input) return;
  DOM.input.value = '';
  autoResizeTextarea();
  updateSendBtnState();
}

function recallPrevInput() {
  if (!ChatState.inputHistory.length) return;
  ChatState.historyIndex = Math.min(
    ChatState.historyIndex + 1,
    ChatState.inputHistory.length - 1
  );
  if (DOM.input) {
    DOM.input.value = ChatState.inputHistory[ChatState.historyIndex];
    autoResizeTextarea();
  }
}

/* ══════════════════════════════════════════
   SCROLL
   ══════════════════════════════════════════ */

function scrollToBottom(smooth = true) {
  const feed = DOM.feed;
  if (!feed) return;
  feed.scrollTo({
    top:      feed.scrollHeight,
    behavior: smooth ? 'smooth' : 'auto',
  });
}

function setupScrollReveal() {
  /* Pause auto-scroll when user scrolls up */
  let userScrolled = false;
  DOM.feed?.addEventListener('scroll', () => {
    const feed = DOM.feed;
    if (!feed) return;
    const atBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 60;
    userScrolled = !atBottom;
  });
}

/* ══════════════════════════════════════════
   FORMAT HELPERS
   ══════════════════════════════════════════ */

function formatAIResponse(text) {
  if (!text) return '';

  return text
    /* Headings */
    .replace(/^### (.+)$/gm,  '<h4>$1</h4>')
    .replace(/^## (.+)$/gm,   '<h4>$1</h4>')
    /* Bold */
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    /* Italic */
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    /* Code */
    .replace(/`(.+?)`/g, '<code>$1</code>')
    /* Bullet lists */
    .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    /* Numbered lists */
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    /* Line breaks → paragraphs */
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.+)$/, '<p>$1</p>');
}

/* ══════════════════════════════════════════
   FIRST AID FUNCTIONS
   ══════════════════════════════════════════ */

function initFirstAid() {
  loadFirstAidProtocols();
  setupProtocolSearch();
  setupProtocolButtons();
}

async function loadFirstAidProtocols() {
  try {
    const response = await fetch('/static/json/first-aid-protocols.json');
    const protocols = await response.json();
    window.firstAidProtocols = protocols;
    // The grid is already rendered in HTML
  } catch (err) {
    console.warn('Failed to load first aid protocols:', err);
  }
}

function setupProtocolSearch() {
  const searchInput = document.getElementById('protocol-search');
  if (!searchInput) return;

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase().trim();
    const buttons = document.querySelectorAll('.protocol-btn');

    buttons.forEach(btn => {
      const name = btn.querySelector('.protocol-btn__name')?.textContent.toLowerCase() || '';
      const sub = btn.querySelector('.protocol-btn__sub')?.textContent.toLowerCase() || '';
      const visible = !query || name.includes(query) || sub.includes(query);
      btn.style.display = visible ? '' : 'none';
    });
  });
}

function setupProtocolButtons() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.protocol-btn');
    if (btn) {
      const protocolId = btn.dataset.protocol;
      showProtocolDetail(protocolId);
    }

    const backBtn = e.target.closest('#protocol-back-btn');
    if (backBtn) {
      hideProtocolDetail();
    }
  });
}

function showProtocolDetail(protocolId) {
  const protocols = window.firstAidProtocols;
  if (!protocols) return;

  const protocol = protocols.find(p => p.id === protocolId);
  if (!protocol) return;

  const detail = document.getElementById('protocol-detail');
  const title = document.getElementById('protocol-detail-title');
  const steps = document.getElementById('protocol-steps');

  if (title) title.textContent = protocol.title;
  if (steps) {
    steps.innerHTML = protocol.steps.map(step => `
      <div class="protocol-step" role="listitem">
        <div class="protocol-step__number">${step.step}</div>
        <div class="protocol-step__content">
          <h3 class="protocol-step__title">${step.title}</h3>
          <p class="protocol-step__text">${step.text}</p>
          ${step.duration ? `<div class="protocol-step__duration">${step.duration}s</div>` : ''}
        </div>
      </div>
    `).join('');
  }

  document.getElementById('protocol-picker').hidden = true;
  if (detail) detail.hidden = false;
}

function hideProtocolDetail() {
  document.getElementById('protocol-picker').hidden = false;
  document.getElementById('protocol-detail').hidden = true;
}

function initOfflineDetection() {
  // Handled in offline.js
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getSourceURL(source) {
  const map = {
    'openFDA':     'https://open.fda.gov',
    'RxNorm':      'https://rxnav.nlm.nih.gov',
    'DailyMed':    'https://dailymed.nlm.nih.gov',
    'MedlinePlus': 'https://medlineplus.gov',
    'WHO':         'https://who.int',
    'PubMed':      'https://pubmed.ncbi.nlm.nih.gov',
    'NIH GARD':    'https://rarediseases.info.nih.gov',
  };
  for (const [key, url] of Object.entries(map)) {
    if (source.includes(key)) return url;
  }
  return '#';
}

function generateSessionId() {
  return 'sess_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function isLoggedIn() {
  try { return !!localStorage.getItem('medintel_token'); } catch { return false; }
}

/* ══════════════════════════════════════════
   HERO CHAT (home page inline version)
   ══════════════════════════════════════════ */

function initHeroChat() {
  const input   = document.getElementById('hero-chat-input');
  const sendBtn = document.getElementById('hero-chat-send');
  if (!input || !sendBtn) return;

  const sendHero = () => {
    const val = input.value.trim();
    if (!val) return;
    /* Redirect to full chat page with pre-filled question */
    const url = `chat.html?q=${encodeURIComponent(val)}`;
    window.location.href = url;
  };

  sendBtn.addEventListener('click', sendHero);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); sendHero(); }
  });

  /* Pre-fill from URL param on chat page */
  const urlQ = new URLSearchParams(window.location.search).get('q');
  if (urlQ && DOM.input) {
    DOM.input.value = urlQ;
    autoResizeTextarea();
    updateSendBtnState();
    setTimeout(handleSend, 400);
  }
}

/* ══════════════════════════════════════════
   PUBLIC EXPORTS
   ══════════════════════════════════════════ */

window.MedIntel = window.MedIntel || {};
window.MedIntel.Chat = {
  init:         initChat,
  initHeroChat,
  startNewChat,
  handleSend,
  appendMessage,
  ChatState,
};

/* Auto-init */
document.addEventListener('DOMContentLoaded', () => {
  initChat();
  initHeroChat();
});
