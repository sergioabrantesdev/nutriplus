import { GOOGLE_CLIENT_ID } from './config.js';

/* ─── Utilitários ─────────────────────────────────────────── */

function socialLoading(isLoading) {
  const btn = document.getElementById('btn-google');
  if (!btn) return;
  btn.disabled      = isLoading;
  btn.style.opacity = isLoading ? '0.6' : '1';
  btn.style.cursor  = isLoading ? 'wait' : 'pointer';
}

function showToast(msg, isError = true) {
  const toast = document.createElement('div');
  toast.textContent = msg;
  Object.assign(toast.style, {
    position: 'fixed', bottom: '1.5rem', left: '50%',
    transform: 'translateX(-50%)',
    background: isError ? '#2c2c29' : '#1a5c2e',
    color: '#fff', padding: '.75rem 1.4rem',
    borderRadius: '8px', fontSize: '.85rem', zIndex: '9999',
    boxShadow: '0 4px 16px rgba(0,0,0,.25)', whiteSpace: 'nowrap',
  });
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

/* ─── GOOGLE ──────────────────────────────────────────────── */

let googleTokenClient = null;

function initGoogle() {
  googleTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: 'openid email profile',
    callback: handleGoogleToken,
  });
}

async function handleGoogleToken(tokenResponse) {
  socialLoading(false);

  if (tokenResponse.error) {
    if (tokenResponse.error !== 'access_denied') {
      showToast('Erro no login com Google: ' + tokenResponse.error);
    }
    return;
  }

  try {
    // Busca dados do usuário para exibir na tela de boas-vindas
    const res  = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer ' + tokenResponse.access_token },
    });
    const user = await res.json();

    // Salva o access_token temporariamente para o welcome.html enviar ao backend
    sessionStorage.setItem('nutriplus_user_pending', JSON.stringify({
      access_token: tokenResponse.access_token,
      name:    user.name    || '',
      email:   user.email   || '',
      picture: user.picture || '',
    }));

    window.location.href = '/welcome.html';

  } catch (e) {
    showToast('Não foi possível obter os dados do Google.');
  }
}

function loginGoogle() {
  if (!googleTokenClient) {
    showToast('SDK do Google ainda carregando, tente novamente.');
    return;
  }
  socialLoading(true);
  googleTokenClient.requestAccessToken({ prompt: 'select_account' });
}

/* ─── Init ─────────────────────────────────────────────────── */

// Se o SDK já carregou antes do módulo, inicia direto.
// Caso contrário, registra para ser chamado pelo onGoogleLibraryLoad do HTML.
if (typeof google !== 'undefined' && google.accounts) {
  initGoogle();
} else {
  window.__googleInitPending = initGoogle;
}

window.loginGoogle = loginGoogle;
