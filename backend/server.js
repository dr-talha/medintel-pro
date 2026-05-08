require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const xml2js = require('xml2js');

const app = express();
const PORT = process.env.PORT || 3001;

/* ── CORS Configuration (environment-aware) ── */
const ALLOWED_ORIGINS = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',');

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Proxy for disease.sh API
app.get('/api/disease/countries', async (req, res) => {
  try {
    const response = await fetch('https://disease.sh/v3/covid-19/countries');
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch disease data' });
  }
});

app.get('/api/disease/all', async (req, res) => {
  try {
    const response = await fetch('https://disease.sh/v3/covid-19/all');
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch global disease data' });
  }
});

app.get('/api/disease/countries/:country', async (req, res) => {
  try {
    const response = await fetch(`https://disease.sh/v3/covid-19/countries/${req.params.country}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch country disease data' });
  }
});

// Proxy for WHO RSS feeds
app.get('/api/who/news', async (req, res) => {
  try {
    const response = await fetch('https://www.who.int/rss-feeds/news-english.xml');
    const xml = await response.text();
    xml2js.parseString(xml, (err, result) => {
      if (err) throw err;
      res.json(result);
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch WHO news' });
  }
});

app.get('/api/who/emergency', async (req, res) => {
  try {
    const response = await fetch('https://www.who.int/rss-feeds/emergency-english.xml');
    const xml = await response.text();
    xml2js.parseString(xml, (err, result) => {
      if (err) throw err;
      res.json(result);
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch WHO emergency news' });
  }
});

// Proxy for FDA drug enforcement
app.get('/api/fda/recalls', async (req, res) => {
  try {
    const response = await fetch('https://api.fda.gov/drug/enforcement.json?limit=10&sort=report_date:desc');
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch FDA recalls' });
  }
});

// Proxy for RxNorm
app.get('/api/rxnorm/drugs', async (req, res) => {
  try {
    const query = req.query.name;
    const response = await fetch(`https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(query)}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch drug info' });
  }
});

app.get('/api/rxnorm/drug/:rxcui', async (req, res) => {
  try {
    const response = await fetch(`https://rxnav.nlm.nih.gov/REST/RxTerms/rxcui/${req.params.rxcui}/allinfo.json`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch drug details' });
  }
});

/* ─────────────────────────────────────────
   DRUG SEARCH & INTERACTIONS (via RxNorm)
   ───────────────────────────────────────── */

// Drug Search (proxy to RxNorm)
app.get('/api/drugs/search', async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q.trim()) return res.json([]);
    const r = await fetch(`https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(q)}`);
    const data = await r.json();
    const drugGroup = data?.drugGroup?.conceptGroup || [];
    const results = [];
    for (const group of drugGroup) {
      for (const concept of (group.conceptProperties || [])) {
        results.push({ rxcui: concept.rxcui, name: concept.name, tty: concept.tty });
      }
    }
    res.json(results.slice(0, 20));
  } catch (err) {
    res.status(500).json({ error: 'Drug search failed', details: err.message });
  }
});

// Drug Detail by ID
app.get('/api/drugs/:id', async (req, res) => {
  try {
    const r = await fetch(`https://rxnav.nlm.nih.gov/REST/RxTerms/rxcui/${req.params.id}/allinfo.json`);
    const data = await r.json();
    res.json(data?.rxtermsProperties || {});
  } catch (err) {
    res.status(500).json({ error: 'Drug detail fetch failed' });
  }
});

// Drug Detail by RxCUI
app.get('/api/drugs/rxcui/:rxcui', async (req, res) => {
  try {
    const r = await fetch(`https://rxnav.nlm.nih.gov/REST/RxTerms/rxcui/${req.params.rxcui}/allinfo.json`);
    const data = await r.json();
    res.json(data?.rxtermsProperties || {});
  } catch (err) {
    res.status(500).json({ error: 'RxCUI lookup failed' });
  }
});

// Drug Interactions
app.post('/api/drugs/interactions', async (req, res) => {
  try {
    const { rxcuis } = req.body;
    if (!rxcuis || rxcuis.length < 2) {
      return res.status(400).json({ error: 'Provide at least 2 RxCUI codes' });
    }
    const interactions = [];
    for (let i = 0; i < rxcuis.length; i++) {
      const r = await fetch(`https://rxnav.nlm.nih.gov/REST/interaction/interaction.json?rxcui=${rxcuis[i]}`);
      const data = await r.json();
      const groups = data?.interactionTypeGroup || [];
      for (const group of groups) {
        for (const itype of (group.interactionType || [])) {
          for (const pair of (itype.interactionPair || [])) {
            interactions.push({
              severity: pair.severity || 'Unknown',
              description: pair.description || '',
              drugs: (pair.interactionConcept || []).map(c => c.minConceptItem?.name),
            });
          }
        }
      }
    }
    const order = { Major: 0, Moderate: 1, Minor: 2 };
    interactions.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));
    res.json(interactions);
  } catch (err) {
    res.status(500).json({ error: 'Interaction check failed' });
  }
});

/* ─────────────────────────────────────────
   NEWS & ALERTS (WHO RSS)
   ───────────────────────────────────────── */

app.get('/api/news/alerts', async (req, res) => {
  try {
    const r = await fetch('https://www.who.int/rss-feeds/emergency-english.xml');
    const xml = await r.text();
    xml2js.parseString(xml, (err, result) => {
      if (err) return res.status(500).json({ error: 'RSS parse failed' });
      const items = (result?.rss?.channel?.[0]?.item || []).slice(0, 5).map(item => ({
        title: item.title?.[0] || '',
        link: item.link?.[0] || '',
        date: item.pubDate?.[0] || '',
        description: item.description?.[0] || '',
      }));
      res.json(items);
    });
  } catch (err) {
    res.status(500).json({ error: 'Alerts fetch failed' });
  }
});

/* ─────────────────────────────────────────
   AI CHAT (with Anthropic Claude integration)
   ───────────────────────────────────────── */

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  const EMERGENCY_WORDS = ['chest pain', 'not breathing', 'unconscious', 'anaphylaxis', 'stroke', 'seizure'];
  if (EMERGENCY_WORDS.some(w => message.toLowerCase().includes(w))) {
    return res.json({
      type: 'EMERGENCY',
      answer: '⚠️ This sounds like a medical emergency. Please call emergency services immediately.',
      sources: [],
    });
  }

  // Replace with Anthropic Claude RAG pipeline when DB ready
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: 'You are MedIntel Pro, a medical reference assistant. Answer only from verified medical knowledge. Always end with: "⚠️ For reference only. Always consult a qualified healthcare professional." Never provide diagnosis.',
          messages: [{ role: 'user', content: message }],
        }),
      });
      const aiData = await aiRes.json();
      const answer = aiData?.content?.[0]?.text || 'Unable to process your question.';
      return res.json({ answer, sources: ['Anthropic Claude'], type: 'AI' });
    } catch (aiErr) {
      console.error('Claude API error:', aiErr.message);
    }
  }

  return res.json({
    answer: 'AI chat requires a database and API key setup. Please configure ANTHROPIC_API_KEY in your .env file.',
    sources: [],
    type: 'SETUP_REQUIRED',
  });
});

app.get('/api/chat/history', (req, res) => res.json([]));
app.post('/api/chat/save', (req, res) => res.json({ saved: true }));
app.post('/api/chat/feedback', (req, res) => res.json({ received: true }));

/* ─────────────────────────────────────────
   QUIZ (requires DB with question bank)
   ───────────────────────────────────────── */

app.get('/api/quiz/categories', (req, res) => {
  res.json([
    { id: 'pharmacology', name: 'Pharmacology', count: 2400 },
    { id: 'clinical', name: 'Clinical Medicine', count: 3000 },
    { id: 'anatomy', name: 'Anatomy & Physiology', count: 1800 },
    { id: 'pathology', name: 'Pathology', count: 1500 },
    { id: 'emergency', name: 'Emergency Medicine', count: 800 },
  ]);
});

app.get('/api/quiz/session', (req, res) => res.json({ questions: [], message: 'Quiz database not yet seeded.' }));
app.post('/api/quiz/answer', (req, res) => res.json({ correct: false, message: 'Quiz database not yet seeded.' }));
app.get('/api/quiz/daily', (req, res) => res.json({ questions: [] }));
app.post('/api/quiz/flag', (req, res) => res.json({ flagged: true }));

/* ─────────────────────────────────────────
   AUTH (stub — replace with real JWT/Supabase)
   ───────────────────────────────────────── */

app.post('/api/auth/signin', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  res.status(501).json({ error: 'Auth backend not yet implemented. Set up Supabase or JWT auth.' });
});

app.post('/api/auth/register', (req, res) => res.status(501).json({ error: 'Auth backend not yet implemented.' }));
app.post('/api/auth/magic-link', (req, res) => res.status(501).json({ error: 'Auth backend not yet implemented.' }));
app.post('/api/auth/refresh', (req, res) => res.status(501).json({ error: 'Auth backend not yet implemented.' }));

/* ─────────────────────────────────────────
   USER / HEALTH LOGS (requires auth + DB)
   ───────────────────────────────────────── */

app.get('/api/user/profile', (req, res) => res.status(401).json({ error: 'Authentication required.' }));
app.put('/api/user/profile', (req, res) => res.status(401).json({ error: 'Authentication required.' }));
app.get('/api/user/health-logs', (req, res) => res.status(401).json({ error: 'Authentication required.' }));
app.post('/api/user/health-logs', (req, res) => res.status(401).json({ error: 'Authentication required.' }));
app.get('/api/user/bookmarks', (req, res) => res.status(401).json({ error: 'Authentication required.' }));
app.post('/api/user/bookmarks', (req, res) => res.status(401).json({ error: 'Authentication required.' }));
app.get('/api/user/notifications', (req, res) => res.json([]));
app.get('/api/user/export', (req, res) => res.status(401).json({ error: 'Authentication required.' }));
app.delete('/api/user/account', (req, res) => res.status(401).json({ error: 'Authentication required.' }));

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});