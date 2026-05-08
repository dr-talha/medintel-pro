/* ============================================================
   MedIntel Pro — calculators.js
   All Medical Calculator Formulas · UI · Validation · Results
   Cardiology · Nephrology · Critical Care · Obstetrics
   Pharmacology · Pediatrics · General · Nutrition
   ============================================================ */

'use strict';

/* ══════════════════════════════════════════
   CALCULATOR REGISTRY
   All formulas run CLIENT-SIDE — fully offline
   ══════════════════════════════════════════ */

const CALCULATORS = {

  /* ── CARDIOLOGY ── */
  chads_vasc: {
    name:     'CHA₂DS₂-VASc Score',
    category: 'cardiology',
    desc:     'Stroke risk in non-valvular atrial fibrillation',
    fields: [
      { id: 'chf',             label: 'Congestive Heart Failure',    type: 'boolean' },
      { id: 'hypertension',    label: 'Hypertension',                type: 'boolean' },
      { id: 'age75',           label: 'Age ≥ 75 years',              type: 'boolean', points: 2 },
      { id: 'diabetes',        label: 'Diabetes Mellitus',           type: 'boolean' },
      { id: 'stroke_tia',      label: 'Prior Stroke / TIA',         type: 'boolean', points: 2 },
      { id: 'vascular',        label: 'Vascular Disease',            type: 'boolean' },
      { id: 'age65_74',        label: 'Age 65–74 years',             type: 'boolean' },
      { id: 'female',          label: 'Female Sex',                  type: 'boolean' },
    ],
    compute(v) {
      let score = 0;
      if (v.chf)          score++;
      if (v.hypertension) score++;
      if (v.age75)        score += 2;
      if (v.diabetes)     score++;
      if (v.stroke_tia)   score += 2;
      if (v.vascular)     score++;
      if (v.age65_74)     score++;
      if (v.female)       score++;
      return {
        result:         score,
        unit:           'points',
        interpretation: getCHADSInterpretation(score),
        color:          score >= 2 ? 'danger' : score === 1 ? 'warning' : 'success',
      };
    },
  },

  bmi: {
    name:     'Body Mass Index (BMI)',
    category: 'general',
    desc:     'Weight classification based on height and weight',
    fields: [
      { id: 'weight_kg', label: 'Weight', type: 'number', unit: 'kg',  min: 1,   max: 500,  step: 0.1 },
      { id: 'height_cm', label: 'Height', type: 'number', unit: 'cm',  min: 50,  max: 250,  step: 0.5 },
    ],
    compute(v) {
      const h = v.height_cm / 100;
      const bmi = v.weight_kg / (h * h);
      return {
        result:         bmi.toFixed(1),
        unit:           'kg/m²',
        interpretation: getBMICategory(bmi),
        color:          bmi < 18.5 || bmi >= 30 ? 'warning' : 'success',
      };
    },
  },

  gfr_ckd_epi: {
    name:     'GFR (CKD-EPI 2021)',
    category: 'nephrology',
    desc:     'Estimated glomerular filtration rate — race-free formula',
    fields: [
      { id: 'creatinine', label: 'Serum Creatinine', type: 'number', unit: 'mg/dL', min: 0.1, max: 30, step: 0.01 },
      { id: 'age',        label: 'Age',               type: 'number', unit: 'years', min: 18,  max: 120, step: 1 },
      { id: 'sex',        label: 'Biological Sex',    type: 'select', options: [{ value:'M', label:'Male' },{ value:'F', label:'Female' }] },
    ],
    compute(v) {
      const k     = v.sex === 'F' ? 0.7 : 0.9;
      const alpha = v.sex === 'F' ? -0.241 : -0.302;
      const cr_k  = v.creatinine / k;
      const gfr   = 142
        * Math.pow(Math.min(cr_k, 1), alpha)
        * Math.pow(Math.max(cr_k, 1), -1.200)
        * Math.pow(0.9938, v.age)
        * (v.sex === 'F' ? 1.012 : 1);
      return {
        result:         Math.round(gfr),
        unit:           'mL/min/1.73m²',
        interpretation: getCKDStage(gfr),
        color:          gfr < 30 ? 'danger' : gfr < 60 ? 'warning' : 'success',
      };
    },
  },

  sofa: {
    name:     'SOFA Score',
    category: 'critical_care',
    desc:     'Sequential Organ Failure Assessment — ICU mortality prediction',
    fields: [
      { id: 'pao2_fio2', label: 'PaO₂/FiO₂ Ratio',  type: 'number', unit: 'mmHg',   min: 0, max: 600, step: 1 },
      { id: 'platelets', label: 'Platelets',           type: 'number', unit: '×10³/μL', min: 0, max: 1000, step: 1 },
      { id: 'bilirubin', label: 'Bilirubin',           type: 'number', unit: 'mg/dL',  min: 0, max: 50,  step: 0.1 },
      { id: 'map',       label: 'Mean Arterial Pressure', type: 'number', unit: 'mmHg', min: 0, max: 200, step: 1 },
      { id: 'gcs',       label: 'Glasgow Coma Scale',  type: 'number', unit: 'pts',    min: 3, max: 15,  step: 1 },
      { id: 'creatinine',label: 'Creatinine',          type: 'number', unit: 'mg/dL',  min: 0, max: 20,  step: 0.1 },
    ],
    compute(v) {
      let score = 0;
      if (v.pao2_fio2 < 100)      score += 4;
      else if (v.pao2_fio2 < 200) score += 3;
      else if (v.pao2_fio2 < 300) score += 2;
      else if (v.pao2_fio2 < 400) score += 1;
      if (v.platelets < 20)       score += 4;
      else if (v.platelets < 50)  score += 3;
      else if (v.platelets < 100) score += 2;
      else if (v.platelets < 150) score += 1;
      if (v.bilirubin >= 12)      score += 4;
      else if (v.bilirubin >= 6)  score += 3;
      else if (v.bilirubin >= 2)  score += 2;
      else if (v.bilirubin >= 1.2)score += 1;
      if (v.map < 70)             score += 1;
      if (v.gcs < 6)              score += 4;
      else if (v.gcs < 9)         score += 3;
      else if (v.gcs < 12)        score += 2;
      else if (v.gcs < 14)        score += 1;
      if (v.creatinine >= 5)      score += 4;
      else if (v.creatinine >= 3.5) score += 3;
      else if (v.creatinine >= 2)   score += 2;
      else if (v.creatinine >= 1.2) score += 1;
      return {
        result:         score,
        unit:           'points',
        interpretation: getSOFAMortality(score),
        color:          score >= 11 ? 'danger' : score >= 7 ? 'warning' : 'success',
      };
    },
  },

  wells_dvt: {
    name:     'Wells Score (DVT)',
    category: 'critical_care',
    desc:     'Pre-test probability of deep vein thrombosis',
    fields: [
      { id: 'active_cancer',      label: 'Active cancer (treatment within 6 months)',         type: 'boolean' },
      { id: 'paralysis',          label: 'Paralysis / paresis / immobilisation of lower limb', type: 'boolean' },
      { id: 'bedridden',          label: 'Bedridden > 3 days or surgery within 4 weeks',       type: 'boolean' },
      { id: 'tenderness',         label: 'Localised tenderness along deep veins',               type: 'boolean' },
      { id: 'entire_leg',         label: 'Entire leg swollen',                                 type: 'boolean' },
      { id: 'calf_swelling',      label: 'Calf swelling > 3 cm vs other leg',                  type: 'boolean' },
      { id: 'pitting_oedema',     label: 'Pitting oedema (symptomatic leg only)',               type: 'boolean' },
      { id: 'collateral_veins',   label: 'Collateral superficial veins',                        type: 'boolean' },
      { id: 'previous_dvt',       label: 'Previously documented DVT',                          type: 'boolean' },
      { id: 'alt_diagnosis',      label: 'Alternative diagnosis at least as likely',            type: 'boolean', points: -2 },
    ],
    compute(v) {
      let score = 0;
      if (v.active_cancer)    score++;
      if (v.paralysis)        score++;
      if (v.bedridden)        score++;
      if (v.tenderness)       score++;
      if (v.entire_leg)       score++;
      if (v.calf_swelling)    score++;
      if (v.pitting_oedema)   score++;
      if (v.collateral_veins) score++;
      if (v.previous_dvt)     score++;
      if (v.alt_diagnosis)    score -= 2;
      return {
        result:         score,
        unit:           'points',
        interpretation: score >= 3 ? 'High probability (75%)' : score >= 1 ? 'Moderate probability (17%)' : 'Low probability (3%)',
        color:          score >= 3 ? 'danger' : score >= 1 ? 'warning' : 'success',
      };
    },
  },

  cockroft_gault: {
    name:     'Creatinine Clearance (Cockcroft-Gault)',
    category: 'pharmacology',
    desc:     'Estimate creatinine clearance for drug dosing',
    fields: [
      { id: 'age',        label: 'Age',         type: 'number', unit: 'years',  min: 1,  max: 120, step: 1 },
      { id: 'weight_kg',  label: 'Weight',      type: 'number', unit: 'kg',     min: 1,  max: 500, step: 0.5 },
      { id: 'creatinine', label: 'Creatinine',  type: 'number', unit: 'mg/dL',  min: 0.1,max: 30,  step: 0.01 },
      { id: 'sex',        label: 'Biological Sex', type: 'select', options: [{ value:'M', label:'Male' },{ value:'F', label:'Female' }] },
    ],
    compute(v) {
      let cl = ((140 - v.age) * v.weight_kg) / (72 * v.creatinine);
      if (v.sex === 'F') cl *= 0.85;
      return {
        result:         cl.toFixed(1),
        unit:           'mL/min',
        interpretation: cl < 30 ? 'Severe renal impairment — dose adjust' :
                        cl < 60 ? 'Moderate renal impairment — consider dose adjustment' :
                        'Normal renal function',
        color: cl < 30 ? 'danger' : cl < 60 ? 'warning' : 'success',
      };
    },
  },

  map_calc: {
    name:     'Mean Arterial Pressure',
    category: 'general',
    desc:     'Average arterial pressure during one cardiac cycle',
    fields: [
      { id: 'sbp', label: 'Systolic BP',   type: 'number', unit: 'mmHg', min: 60, max: 300, step: 1 },
      { id: 'dbp', label: 'Diastolic BP',  type: 'number', unit: 'mmHg', min: 20, max: 200, step: 1 },
    ],
    compute(v) {
      const map = v.dbp + (v.sbp - v.dbp) / 3;
      return {
        result:         map.toFixed(1),
        unit:           'mmHg',
        interpretation: map < 60 ? 'Below normal — risk of organ hypoperfusion' :
                        map > 100 ? 'Elevated — hypertension' : 'Normal range (70–100 mmHg)',
        color:          map < 60 ? 'danger' : map > 100 ? 'warning' : 'success',
      };
    },
  },

  harris_benedict: {
    name:     'Harris-Benedict (BMR)',
    category: 'nutrition',
    desc:     'Basal Metabolic Rate — caloric needs at rest',
    fields: [
      { id: 'weight_kg', label: 'Weight',  type: 'number', unit: 'kg',    min: 1,  max: 500,  step: 0.5 },
      { id: 'height_cm', label: 'Height',  type: 'number', unit: 'cm',    min: 50, max: 250,  step: 0.5 },
      { id: 'age',       label: 'Age',     type: 'number', unit: 'years', min: 1,  max: 120,  step: 1 },
      { id: 'sex',       label: 'Biological Sex', type: 'select', options: [{ value:'M', label:'Male' },{ value:'F', label:'Female' }] },
      { id: 'activity',  label: 'Activity Level', type: 'select', options: [
        { value: '1.2',  label: 'Sedentary (desk job)' },
        { value: '1.375',label: 'Light (1–3 days/wk)' },
        { value: '1.55', label: 'Moderate (3–5 days/wk)' },
        { value: '1.725',label: 'Active (6–7 days/wk)' },
        { value: '1.9',  label: 'Very active (athlete)' },
      ]},
    ],
    compute(v) {
      let bmr;
      if (v.sex === 'M') {
        bmr = 88.362 + (13.397 * v.weight_kg) + (4.799 * v.height_cm) - (5.677 * v.age);
      } else {
        bmr = 447.593 + (9.247 * v.weight_kg) + (3.098 * v.height_cm) - (4.330 * v.age);
      }
      const tdee = bmr * parseFloat(v.activity || 1.2);
      return {
        result:         Math.round(tdee),
        unit:           'kcal/day',
        interpretation: `BMR: ${Math.round(bmr)} kcal · TDEE: ${Math.round(tdee)} kcal`,
        color:          'info',
      };
    },
  },

  apgar: {
    name:     'Apgar Score',
    category: 'obstetrics',
    desc:     'Newborn health assessment at 1 and 5 minutes',
    fields: [
      { id: 'appearance',   label: 'Appearance (skin colour)',  type: 'select', options: [{ value:'0', label:'0 — Blue/pale all over' },{ value:'1', label:'1 — Blue extremities' },{ value:'2', label:'2 — Pink all over' }] },
      { id: 'pulse',        label: 'Pulse (heart rate)',         type: 'select', options: [{ value:'0', label:'0 — Absent' },{ value:'1', label:'1 — < 100 bpm' },{ value:'2', label:'2 — ≥ 100 bpm' }] },
      { id: 'grimace',      label: 'Grimace (reflex)',           type: 'select', options: [{ value:'0', label:'0 — No response' },{ value:'1', label:'1 — Grimace' },{ value:'2', label:'2 — Cry / cough' }] },
      { id: 'activity',     label: 'Activity (muscle tone)',     type: 'select', options: [{ value:'0', label:'0 — Limp' },{ value:'1', label:'1 — Some flexion' },{ value:'2', label:'2 — Active motion' }] },
      { id: 'respiration',  label: 'Respiration',                type: 'select', options: [{ value:'0', label:'0 — Absent' },{ value:'1', label:'1 — Weak / irregular' },{ value:'2', label:'2 — Strong cry' }] },
    ],
    compute(v) {
      const score = Number(v.appearance) + Number(v.pulse) + Number(v.grimace) + Number(v.activity) + Number(v.respiration);
      return {
        result:         score,
        unit:           '/ 10',
        interpretation: score >= 7 ? 'Normal (7–10) — reassuring' :
                        score >= 4 ? 'Moderate concern (4–6) — may require intervention' :
                        'Critical (0–3) — requires immediate resuscitation',
        color:          score >= 7 ? 'success' : score >= 4 ? 'warning' : 'danger',
      };
    },
  },

  gcs: {
    name:     'Glasgow Coma Scale',
    category: 'critical_care',
    desc:     'Level of consciousness assessment',
    fields: [
      { id: 'eye',    label: 'Eye Opening',    type: 'select', options: [{ value:'4', label:'4 — Spontaneous' },{ value:'3', label:'3 — To voice' },{ value:'2', label:'2 — To pain' },{ value:'1', label:'1 — None' }] },
      { id: 'verbal', label: 'Verbal Response', type: 'select', options: [{ value:'5', label:'5 — Oriented' },{ value:'4', label:'4 — Confused' },{ value:'3', label:'3 — Words' },{ value:'2', label:'2 — Sounds' },{ value:'1', label:'1 — None' }] },
      { id: 'motor',  label: 'Motor Response',  type: 'select', options: [{ value:'6', label:'6 — Obeys commands' },{ value:'5', label:'5 — Localises pain' },{ value:'4', label:'4 — Withdraws' },{ value:'3', label:'3 — Abnormal flexion' },{ value:'2', label:'2 — Extension' },{ value:'1', label:'1 — None' }] },
    ],
    compute(v) {
      const score = Number(v.eye) + Number(v.verbal) + Number(v.motor);
      return {
        result:         score,
        unit:           '/ 15',
        interpretation: score >= 13 ? 'Mild impairment (13–15)' :
                        score >= 9  ? 'Moderate impairment (9–12)' :
                        'Severe impairment (≤ 8) — consider intubation',
        color:          score >= 13 ? 'success' : score >= 9 ? 'warning' : 'danger',
      };
    },
  },

  anion_gap: {
    name:     'Anion Gap',
    category: 'nephrology',
    desc:     'Identify metabolic acidosis cause',
    fields: [
      { id: 'sodium',    label: 'Sodium (Na⁺)',    type: 'number', unit: 'mEq/L', min: 100, max: 200, step: 1 },
      { id: 'chloride',  label: 'Chloride (Cl⁻)',  type: 'number', unit: 'mEq/L', min: 50,  max: 150, step: 1 },
      { id: 'bicarb',    label: 'Bicarbonate (HCO₃⁻)', type: 'number', unit: 'mEq/L', min: 1, max: 50, step: 1 },
    ],
    compute(v) {
      const ag = v.sodium - (v.chloride + v.bicarb);
      return {
        result:         ag.toFixed(1),
        unit:           'mEq/L',
        interpretation: ag > 12 ? `High anion gap (>${12}) — MUDPILES causes` :
                        ag < 8  ? 'Low anion gap — consider hypoalbuminaemia' :
                        'Normal anion gap (8–12) — hyperchloraemic acidosis',
        color:          ag > 12 || ag < 8 ? 'warning' : 'success',
      };
    },
  },

};

/* ══════════════════════════════════════════
   INTERPRETATION HELPERS
   ══════════════════════════════════════════ */

function getCHADSInterpretation(score) {
  if (score === 0) return 'Low risk — anticoagulation not recommended';
  if (score === 1) return 'Low-moderate risk — consider anticoagulation (especially males)';
  return `High risk (score ${score}) — oral anticoagulation recommended`;
}

function getBMICategory(bmi) {
  if (bmi < 16)   return 'Severe thinness (< 16)';
  if (bmi < 17)   return 'Moderate thinness (16–16.9)';
  if (bmi < 18.5) return 'Mild thinness (17–18.4)';
  if (bmi < 25)   return 'Normal weight (18.5–24.9)';
  if (bmi < 30)   return 'Overweight (25–29.9)';
  if (bmi < 35)   return 'Obese Class I (30–34.9)';
  if (bmi < 40)   return 'Obese Class II (35–39.9)';
  return 'Obese Class III (≥ 40)';
}

function getCKDStage(gfr) {
  if (gfr >= 90) return 'G1 — Normal or high (≥ 90)';
  if (gfr >= 60) return 'G2 — Mildly decreased (60–89)';
  if (gfr >= 45) return 'G3a — Mild-moderate decrease (45–59)';
  if (gfr >= 30) return 'G3b — Moderate-severe decrease (30–44)';
  if (gfr >= 15) return 'G4 — Severely decreased (15–29)';
  return 'G5 — Kidney failure (< 15) — dialysis consideration';
}

function getSOFAMortality(score) {
  if (score < 2)  return '< 10% predicted mortality';
  if (score < 6)  return '10–20% predicted mortality';
  if (score < 9)  return '21–33% predicted mortality';
  if (score < 11) return '34–50% predicted mortality';
  if (score < 13) return '50–70% predicted mortality';
  return '> 70% predicted mortality';
}

/* ══════════════════════════════════════════
   UI — CALCULATOR PAGE
   ══════════════════════════════════════════ */

function initCalculators() {
  if (!document.getElementById('calc-category-grid') &&
      !document.getElementById('calc-form'))  return;

  renderCategoryGrid();
  bindCategoryNav();

  /* URL param: auto-open calculator */
  const calcId = new URLSearchParams(window.location.search).get('calc');
  if (calcId && CALCULATORS[calcId]) openCalculator(calcId);
}

// Add new init for calculators.html page
function initCalculatorsPage() {
  // Bind sidebar category buttons
  document.querySelectorAll('.calc-cat-btn[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      filterByCategory(cat);
      // Update active state
      document.querySelectorAll('.calc-cat-btn').forEach(b => b.classList.remove('calc-cat-btn--active'));
      btn.classList.add('calc-cat-btn--active');
    });
  });

  // Bind calc-card clicks
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.calc-card');
    if (card && card.dataset.calc) {
      openCalculatorPanel(card.dataset.calc);
    }
  });

  // Bind back button
  const backBtn = document.getElementById('calc-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', closeCalculatorPanel);
  }

  // Bind search
  const searchInput = document.getElementById('calc-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchCalculators(e.target.value);
    });
  }

  // Show all by default
  filterByCategory('all');
}

function filterByCategory(category) {
  const sections = document.querySelectorAll('.calc-section');
  sections.forEach(section => {
    if (category === 'all' || section.dataset.cat === category) {
      section.style.display = 'block';
    } else {
      section.style.display = 'none';
    }
  });
}

function searchCalculators(query) {
  const cards = document.querySelectorAll('.calc-card');
  const lowerQuery = query.toLowerCase();

  cards.forEach(card => {
    const name = card.querySelector('.calc-card__name').textContent.toLowerCase();
    const desc = card.querySelector('.calc-card__desc').textContent.toLowerCase();
    const tag = card.querySelector('.calc-card__tag').textContent.toLowerCase();

    const matches = name.includes(lowerQuery) || desc.includes(lowerQuery) || tag.includes(lowerQuery);
    card.style.display = matches || !query ? 'block' : 'none';
  });

  // Show/hide sections based on visible cards
  const sections = document.querySelectorAll('.calc-section');
  sections.forEach(section => {
    const visibleCards = section.querySelectorAll('.calc-card[style*="block"]');
    section.style.display = visibleCards.length > 0 || !query ? 'block' : 'none';
  });
}

function openCalculatorPanel(calcId) {
  const calc = CALCULATORS[calcId];
  if (!calc) return;

  const panel = document.getElementById('calc-panel');
  const inner = document.getElementById('calc-panel-inner');
  if (!panel || !inner) return;

  // Render calculator form
  inner.innerHTML = `
    <div class="calc-header">
      <h2>${escapeHTML(calc.name)}</h2>
      <p>${escapeHTML(calc.desc)}</p>
    </div>
    <form class="calc-form" id="calc-form-${calcId}">
      ${calc.fields.map(field => buildFieldHTML(field)).join('')}
      <button type="button" class="btn btn-primary btn-full" onclick="computeAndShowResult('${calcId}')">
        Calculate
      </button>
    </form>
    <div id="calc-result-${calcId}" class="calc-result-container"></div>
  `;

  panel.removeAttribute('hidden');
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeCalculatorPanel() {
  const panel = document.getElementById('calc-panel');
  if (panel) {
    panel.setAttribute('hidden', '');
  }
}

function computeAndShowResult(calcId) {
  const calc = CALCULATORS[calcId];
  if (!calc) return;

  const form = document.getElementById(`calc-form-${calcId}`);
  const resultEl = document.getElementById(`calc-result-${calcId}`);
  if (!form || !resultEl) return;

  // Collect values
  const values = {};
  let hasErrors = false;

  calc.fields.forEach(field => {
    const el = form.querySelector(`[name="${field.id}"]`);
    if (!el) return;

    if (field.type === 'boolean') {
      values[field.id] = el.checked;
    } else if (field.type === 'select') {
      values[field.id] = el.value;
    } else {
      const val = parseFloat(el.value);
      if (isNaN(val)) {
        el.classList.add('form-input--error');
        hasErrors = true;
      } else {
        el.classList.remove('form-input--error');
        values[field.id] = val;
      }
    }
  });

  if (hasErrors) {
    showToast('Please fill in all required fields.', 'warning');
    return;
  }

  try {
    const result = calc.compute(values);
    renderResultInPanel(result, calc.name, resultEl);
  } catch (err) {
    showToast('Calculation error: ' + err.message, 'warning');
  }
}

function renderResultInPanel(result, calcName, container) {
  const colorMap = {
    success: 'var(--clr-success)',
    warning: 'var(--clr-warning)',
    danger:  'var(--clr-danger)',
    info:    'var(--clr-info)',
  };

  const color = colorMap[result.color] || 'var(--clr-primary)';

  container.innerHTML = `
    <div class="calc-result">
      <div class="calc-result__label">${escapeHTML(calcName)}</div>
      <div>
        <span class="calc-result__value" style="color:${color};">
          ${escapeHTML(String(result.result))}
        </span>
        <span class="calc-result__unit">${escapeHTML(result.unit || '')}</span>
      </div>
      <div class="calc-result__interpretation"
           style="background:${color}22;color:${color};border-radius:var(--r-md);padding:10px 16px;margin-top:12px;">
        ${escapeHTML(result.interpretation || '')}
      </div>
      <div class="disclaimer-strip" style="margin-top:16px;text-align:left;">
        All calculators use validated clinical formulas. Verify results with clinical judgment.
      </div>
    </div>
  `;

  container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  container.querySelector('.calc-result')?.classList.add('anim-scale-in');
}

function loadRecentCalcs() {
  // Mock recent calculations - in real app, load from localStorage or API
  const recent = [
    { id: 'bmi', name: 'BMI Calculator', time: '2 hours ago' },
    { id: 'chads_vasc', name: 'CHA₂DS₂-VASc Score', time: '1 day ago' },
    { id: 'gfr', name: 'eGFR Calculator', time: '3 days ago' }
  ];

  const container = document.getElementById('recent-calcs');
  if (!container) return;

  container.innerHTML = recent.map(calc => `
    <button class="recent-calc-item" onclick="openCalculatorPanel('${calc.id}')">
      <span class="recent-calc-name">${escapeHTML(calc.name)}</span>
      <span class="recent-calc-time">${escapeHTML(calc.time)}</span>
    </button>
  `).join('');
}

function renderCategoryGrid() {
  const grid = document.getElementById('calc-category-grid');
  if (!grid) return;

  const CATEGORY_META = {
    cardiology:    { icon: '🫀', label: 'Cardiology' },
    nephrology:    { icon: '🩺', label: 'Nephrology' },
    critical_care: { icon: '🚨', label: 'Critical Care' },
    obstetrics:    { icon: '🤱', label: 'Obstetrics' },
    pharmacology:  { icon: '⚗️',  label: 'Pharmacology' },
    general:       { icon: '📏', label: 'General' },
    nutrition:     { icon: '🥗', label: 'Nutrition' },
  };

  /* Group by category */
  const groups = {};
  Object.entries(CALCULATORS).forEach(([id, calc]) => {
    const cat = calc.category || 'general';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push({ id, ...calc });
  });

  grid.innerHTML = Object.entries(CATEGORY_META).map(([cat, meta]) => {
    const calcs = groups[cat] || [];
    if (!calcs.length) return '';
    return `
      <div class="calc-category-tile hover-lift"
           onclick="CalcModule.openCategory('${cat}')"
           data-reveal data-delay="1">
        <div class="calc-category-tile__icon">${meta.icon}</div>
        <div class="calc-category-tile__name">${meta.label}</div>
        <div class="calc-category-tile__count">${calcs.length} calculators</div>
      </div>
    `;
  }).join('');
}

function openCategory(category) {
  const calcs = Object.entries(CALCULATORS)
    .filter(([, c]) => c.category === category)
    .map(([id, c]) => ({ id, ...c }));

  const listEl = document.getElementById('calc-list');
  if (!listEl) return;

  listEl.innerHTML = calcs.map(c => `
    <button class="btn btn-secondary" style="justify-content:flex-start;text-align:left;gap:12px;"
            onclick="CalcModule.openCalculator('${c.id}')">
      <span>${c.name}</span>
      <small style="color:var(--clr-text-faint);font-weight:400;margin-left:auto;">${c.desc}</small>
    </button>
  `).join('');

  document.getElementById('calc-list-section')?.removeAttribute('hidden');
}

function openCalculator(id) {
  const calc = CALCULATORS[id];
  if (!calc) return;

  const formEl = document.getElementById('calc-form');
  if (!formEl) {
    /* Navigate to calc page with id in URL */
    window.location.href = `calculators.html?calc=${id}`;
    return;
  }

  /* Clear previous results */
  const resultEl = document.getElementById('calc-result');
  if (resultEl) resultEl.innerHTML = '';

  /* Render heading */
  const titleEl = document.getElementById('calc-title');
  const descEl  = document.getElementById('calc-desc');
  if (titleEl) titleEl.textContent = calc.name;
  if (descEl)  descEl.textContent  = calc.desc;

  /* Render form fields */
  formEl.innerHTML = calc.fields.map(field => buildFieldHTML(field)).join('');
  formEl.innerHTML += `
    <button type="button" class="btn btn-primary btn-full"
            onclick="CalcModule.computeCalc('${id}')">
      Calculate
    </button>
  `;

  document.getElementById('calc-section')?.removeAttribute('hidden');
  formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

  /* Update URL */
  history.pushState({}, '', `?calc=${id}`);
}

function buildFieldHTML(field) {
  if (field.type === 'boolean') {
    return `
      <div class="form-group" style="flex-direction:row;align-items:center;justify-content:space-between;">
        <label class="form-label" style="margin:0;">${escapeHTML(field.label)}</label>
        <label class="toggle">
          <input type="checkbox" id="calc-field-${field.id}" name="${field.id}">
          <span class="toggle-slider"></span>
        </label>
      </div>
    `;
  }

  if (field.type === 'select') {
    return `
      <div class="form-group">
        <label class="form-label" for="calc-field-${field.id}">${escapeHTML(field.label)}</label>
        <select class="form-input" id="calc-field-${field.id}" name="${field.id}">
          ${field.options.map(o => `<option value="${escapeAttr(o.value)}">${escapeHTML(o.label)}</option>`).join('')}
        </select>
      </div>
    `;
  }

  /* Default: number */
  return `
    <div class="form-group">
      <label class="form-label" for="calc-field-${field.id}">${escapeHTML(field.label)}</label>
      <div class="calc-field">
        <input type="number" class="form-input" id="calc-field-${field.id}"
               name="${field.id}"
               min="${field.min ?? ''}" max="${field.max ?? ''}"
               step="${field.step ?? 1}"
               placeholder="Enter value">
        ${field.unit ? `<div class="calc-field__unit">${escapeHTML(field.unit)}</div>` : ''}
      </div>
    </div>
  `;
}

function computeCalc(id) {
  const calc = CALCULATORS[id];
  if (!calc) return;

  /* Collect values */
  const values = {};
  let hasErrors = false;

  calc.fields.forEach(field => {
    const el = document.getElementById(`calc-field-${field.id}`);
    if (!el) return;

    if (field.type === 'boolean') {
      values[field.id] = el.checked;
    } else if (field.type === 'select') {
      values[field.id] = el.value;
    } else {
      const val = parseFloat(el.value);
      if (isNaN(val)) {
        el.classList.add('form-input--error');
        hasErrors = true;
      } else {
        el.classList.remove('form-input--error');
        values[field.id] = val;
      }
    }
  });

  if (hasErrors) {
    showToast('Please fill in all required fields.', 'warning');
    return;
  }

  try {
    const result = calc.compute(values);
    renderResult(result, calc.name);
  } catch (err) {
    showToast('Calculation error: ' + err.message, 'warning');
  }
}

function renderResult(result, calcName) {
  const el = document.getElementById('calc-result');
  if (!el) return;

  const colorMap = {
    success: 'var(--clr-success)',
    warning: 'var(--clr-warning)',
    danger:  'var(--clr-danger)',
    info:    'var(--clr-info)',
  };

  const color = colorMap[result.color] || 'var(--clr-primary)';

  el.innerHTML = `
    <div class="calc-result">
      <div class="calc-result__label">${escapeHTML(calcName)}</div>
      <div>
        <span class="calc-result__value" style="color:${color};">
          ${escapeHTML(String(result.result))}
        </span>
        <span class="calc-result__unit">${escapeHTML(result.unit || '')}</span>
      </div>
      <div class="calc-result__interpretation"
           style="background:${color}22;color:${color};border-radius:var(--r-md);padding:10px 16px;margin-top:12px;">
        ${escapeHTML(result.interpretation || '')}
      </div>
      <div class="disclaimer-strip" style="margin-top:16px;text-align:left;">
        All calculators use validated clinical formulas. Verify results with clinical judgment.
      </div>
    </div>
  `;

  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  el.querySelector('.calc-result')?.classList.add('anim-scale-in');
}

function bindCategoryNav() {
  document.querySelectorAll('[data-calc-category]').forEach(btn => {
    btn.addEventListener('click', () => {
      openCategory(btn.dataset.calcCategory);
    });
  });

  document.querySelectorAll('[data-calc-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      openCalculator(btn.dataset.calcId);
    });
  });
}

/* ══════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════ */

function escapeAttr(str) {
  return String(str ?? '').replace(/"/g,'&quot;');
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `<span>${escapeHTML(message)}</span>`;
  (document.getElementById('toast-container') || document.body).appendChild(toast);
  setTimeout(() => { toast.classList.add('dismissing'); setTimeout(() => toast.remove(), 300); }, 3000);
}

/* ══════════════════════════════════════════
   EXPORTS
   ══════════════════════════════════════════ */

const CalcModule = {
  init:           initCalculators,
  initPage:       initCalculatorsPage,
  openCategory,
  openCalculator,
  openCalculatorPanel,
  closeCalculatorPanel,
  computeCalc,
  computeAndShowResult,
  loadRecentCalcs,
  CALCULATORS,
};

window.MedIntel       = window.MedIntel || {};
window.MedIntel.Calc  = CalcModule;
window.CalcModule     = CalcModule;

/* ── Direct exports for onclick handlers ── */
window.computeAndShowResult = computeAndShowResult;

document.addEventListener('DOMContentLoaded', initCalculators);
