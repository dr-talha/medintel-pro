/* ============================================================
   MedIntel Pro — auth.js
   Authentication · JWT · Session · Guest mode · Nav state
   ============================================================ */

'use strict';

/* ══════════════════════════════════════════
   AUTH STATE
   ══════════════════════════════════════════ */

const AuthState = {
  user:    null,      /* { id, email, preferences } | null */
  token:   null,
  isGuest: true,
};

const AUTH_TOKEN_KEY = 'medintel_token';
const AUTH_USER_KEY  = 'medintel_user';

/* ══════════════════════════════════════════
   INIT — called on every page load
   ══════════════════════════════════════════ */

function authInit() {
  try {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const user  = localStorage.getItem(AUTH_USER_KEY);
    if (token && user) {
      AuthState.token  = token;
      AuthState.user   = JSON.parse(user);
      AuthState.isGuest = false;
    }
  } catch (e) {
    authClear();
  }
  _updateNavUI();
}

/* ══════════════════════════════════════════
   SIGN IN (email + password)
   ══════════════════════════════════════════ */

async function authSignIn(email, password) {
  _assertAPI();
  const data = await window.MedIntel.api.post('/api/auth/signin', { email, password });
  _persistSession(data.token, data.user);
  _updateNavUI();
  return data.user;
}

/* ══════════════════════════════════════════
   REGISTER
   ══════════════════════════════════════════ */

async function authRegister(email, password, displayName, specialty) {
  _assertAPI();
  const data = await window.MedIntel.api.post('/api/auth/register', {
    email, password, displayName, specialty,
  });
  _persistSession(data.token, data.user);
  _updateNavUI();
  return data.user;
}

/* ══════════════════════════════════════════
   MAGIC LINK (passwordless)
   ══════════════════════════════════════════ */

async function authSendMagicLink(email) {
  _assertAPI();
  return window.MedIntel.api.post('/api/auth/magic-link', { email });
}

/* ══════════════════════════════════════════
   SIGN OUT
   ══════════════════════════════════════════ */

function authSignOut() {
  authClear();
  _updateNavUI();
  /* Redirect to home if on a protected page */
  const protectedPaths = ['/profile.html'];
  if (protectedPaths.some(p => window.location.pathname.includes(p))) {
    window.location.href = '/';
  }
}

/* ══════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════ */

function authIsLoggedIn() {
  return !AuthState.isGuest && !!AuthState.token;
}

function authGetUser() {
  return AuthState.user;
}

function authGetToken() {
  return AuthState.token;
}

function authRequire(redirectUrl = '/profile.html') {
  if (!authIsLoggedIn()) {
    window.location.href = redirectUrl;
    return false;
  }
  return true;
}

/* ── Persist session to localStorage ── */
function _persistSession(token, user) {
  AuthState.token   = token;
  AuthState.user    = user;
  AuthState.isGuest = false;
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } catch (e) {
    console.warn('Auth: could not persist session', e);
  }
}

function authClear() {
  AuthState.token   = null;
  AuthState.user    = null;
  AuthState.isGuest = true;
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  } catch (e) { /* ignore */ }
}

function _assertAPI() {
  if (!window.MedIntel || !window.MedIntel.api) {
    throw new Error('Auth: MedIntel API not loaded. Include api.js before auth.js.');
  }
}

/* ── Update nav sign-in / avatar button ── */
function _updateNavUI() {
  const btn = document.getElementById('nav-auth-btn');
  if (!btn) return;

  if (authIsLoggedIn() && AuthState.user) {
    const initials = (AuthState.user.displayName || AuthState.user.email || '?')
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
    btn.textContent = initials;
    btn.setAttribute('aria-label', 'My account');
    btn.classList.add('btn--avatar');
  } else {
    btn.textContent = 'Sign in';
    btn.removeAttribute('aria-label');
    btn.classList.remove('btn--avatar');
  }
}

/* ══════════════════════════════════════════
   TOKEN REFRESH (silent)
   ══════════════════════════════════════════ */

async function authRefreshToken() {
  if (!AuthState.token) return;
  try {
    const data = await window.MedIntel.api.post('/api/auth/refresh', {});
    _persistSession(data.token, data.user || AuthState.user);
  } catch (e) {
    /* Token expired or invalid — sign out silently */
    authClear();
    _updateNavUI();
  }
}

/* Auto-refresh every 20 minutes if logged in */
setInterval(() => {
  if (authIsLoggedIn()) authRefreshToken();
}, 20 * 60 * 1000);

/* ══════════════════════════════════════════
   EXPORTS
   ══════════════════════════════════════════ */

window.MedIntel = window.MedIntel || {};
Object.assign(window.MedIntel, {
  auth: {
    init:          authInit,
    signIn:        authSignIn,
    register:      authRegister,
    sendMagicLink: authSendMagicLink,
    signOut:       authSignOut,
    isLoggedIn:    authIsLoggedIn,
    getUser:       authGetUser,
    getToken:      authGetToken,
    require:       authRequire,
    clear:         authClear,
    refresh:       authRefreshToken,
  },
});

/* Auto-init when DOM is ready */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', authInit);
} else {
  authInit();
}

/* ── Direct window exports for onclick handlers ── */
window.signIn = authSignIn;
window.signOut = authSignOut;
window.register = authRegister;
window.sendMagicLink = authSendMagicLink;

/* ── Profile page functions ── */
function showSection(sectionName) {
  // Hide all sections
  document.querySelectorAll('.account-section').forEach(section => {
    section.classList.remove('account-section--active');
    section.hidden = true;
  });
  // Show selected section
  const targetSection = document.getElementById('section-' + sectionName);
  if (targetSection) {
    targetSection.classList.add('account-section--active');
    targetSection.hidden = false;
  }
  // Update nav buttons
  document.querySelectorAll('.account-nav-btn').forEach(btn => {
    btn.classList.remove('account-nav-btn--active');
  });
  const navBtn = document.querySelector(`[data-section="${sectionName}"]`);
  if (navBtn) navBtn.classList.add('account-nav-btn--active');
}

function switchAuthTab(tab) {
  if (tab === 'register') {
    document.getElementById('auth-tab-signin').classList.remove('auth-tab--active');
    document.getElementById('auth-tab-register').classList.add('auth-tab--active');
    document.getElementById('auth-signin').hidden = true;
    document.getElementById('auth-register').hidden = false;
  } else {
    document.getElementById('auth-tab-register').classList.remove('auth-tab--active');
    document.getElementById('auth-tab-signin').classList.add('auth-tab--active');
    document.getElementById('auth-register').hidden = true;
    document.getElementById('auth-signin').hidden = false;
  }
}

function deleteChatHistory() {
  if (confirm('Delete all AI chat history? This cannot be undone.')) {
    // Implement delete
    console.log('Delete chat history');
  }
}

function deleteAllHealthLogs() {
  if (confirm('Delete all health logs? This cannot be undone.')) {
    // Implement delete
    console.log('Delete all health logs');
  }
}

function deleteAccount() {
  if (confirm('Permanently delete your account and all data? This cannot be undone.')) {
    // Implement delete
    console.log('Delete account');
  }
}

function exportAllData() {
  // Implement export
  console.log('Export all data');
}

function exportHealthLogs() {
  // Implement export
  console.log('Export health logs');
}

function downloadOfflineData(type) {
  // Implement download
  console.log('Download offline data:', type);
}

function downloadAllOfflineData() {
  // Implement download all
  console.log('Download all offline data');
}

function saveNotificationSettings() {
  // Implement save
  console.log('Save notification settings');
}

function openNewLogModal() {
  // Implement modal
  console.log('Open new log modal');
}

window.showSection = showSection;
window.switchAuthTab = switchAuthTab;
window.deleteChatHistory = deleteChatHistory;
window.deleteAllHealthLogs = deleteAllHealthLogs;
window.deleteAccount = deleteAccount;
window.exportAllData = exportAllData;
window.exportHealthLogs = exportHealthLogs;
window.downloadOfflineData = downloadOfflineData;
window.downloadAllOfflineData = downloadAllOfflineData;
window.saveNotificationSettings = saveNotificationSettings;
window.openNewLogModal = openNewLogModal;
