const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const xml2js = require('xml2js');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
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

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});