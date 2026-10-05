// Connexion Socket.io partagée + helpers communs
const socket = io();

// Couleurs néon disponibles pour les avatars
const NEON_COLORS = ['#B026FF', '#FF003C', '#00FF41', '#FFD400', '#00E5FF', '#FF6B00', '#FF1493', '#7B68EE'];

// Récupère le code room depuis l'URL (/play/QUIZ42 -> QUIZ42)
function roomFromPath() {
  const parts = location.pathname.split('/').filter(Boolean);
  return parts.length >= 2 ? decodeURIComponent(parts[1]).toUpperCase() : '';
}

// Échappe le HTML pour éviter l'injection
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Rendu d'un avatar : photo si disponible, sinon pastille avec l'initiale
function avatarHTML(p, size) {
  size = size || 54;
  const common = `width:${size}px;height:${size}px;border-radius:50%;border:2px solid ${p.color};box-shadow:0 0 10px ${p.color};flex-shrink:0`;
  if (p.image) {
    return `<img src="${p.image}" style="${common};object-fit:cover">`;
  }
  const initial = (p.pseudo || '?').charAt(0).toUpperCase();
  return `<div style="${common};background:${p.color};display:flex;align-items:center;justify-content:center;font-family:'Poppins',sans-serif;font-weight:800;font-size:${size*0.42}px;color:#fff">${esc(initial)}</div>`;
}
