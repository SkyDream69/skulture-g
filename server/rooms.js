// Gestion des rooms en mémoire (pas de base de données)
// Une room disparaît si le serveur redémarre — acceptable pour du quiz événementiel.

import crypto from 'crypto';

const rooms = new Map(); // roomCode -> room object

function hashPassword(pw) {
  return crypto.createHash('sha256').update(pw).digest('hex');
}

function makeDefaultState() {
  return {
    phase: 'lobby',          // lobby | grille | blitz | rush | vies | finale
    view: 'menu',            // ce qui est affiché sur le display
    players: [],             // { id, pseudo, color, connected, scores:{} }
    // Les états détaillés de chaque épreuve seront ajoutés au fil des phases
    grille: null,
    blitz: null,
    rush: null,
    vies: null,
    finale: null,
  };
}

export function createRoom(code, password) {
  code = code.toUpperCase().trim();
  if (rooms.has(code)) return { error: 'Cette room existe déjà.' };
  if (!code || code.length < 3) return { error: 'Code de room trop court (min 3 caractères).' };
  if (!password || password.length < 3) return { error: 'Mot de passe trop court (min 3 caractères).' };

  const room = {
    code,
    passwordHash: hashPassword(password),
    createdAt: Date.now(),
    hostSocketId: null,
    state: makeDefaultState(),
  };
  rooms.set(code, room);
  return { room };
}

export function getRoom(code) {
  if (!code) return null;
  return rooms.get(code.toUpperCase().trim()) || null;
}

export function checkHostPassword(code, password) {
  const room = getRoom(code);
  if (!room) return false;
  return room.passwordHash === hashPassword(password);
}

export function addPlayer(code, pseudo, color, image) {
  const room = getRoom(code);
  if (!room) return { error: 'Room introuvable.' };
  pseudo = (pseudo || '').trim().slice(0, 20);
  if (!pseudo) return { error: 'Pseudo requis.' };

  // Réutiliser l'entrée existante si le pseudo revient (reconnexion)
  let player = room.state.players.find(p => p.pseudo.toLowerCase() === pseudo.toLowerCase());
  if (player) {
    player.connected = true;
    player.color = color || player.color;
    if (image) player.image = image;
  } else {
    player = {
      id: crypto.randomUUID(),
      pseudo,
      color: color || '#B026FF',
      image: image || '',
      connected: true,
      scores: { grille: 0, blitz: 0, rush: 0, finale: 0 },
      lives: 4,
    };
    room.state.players.push(player);
  }
  return { room, player };
}

export function removeRoom(code) {
  rooms.delete(code.toUpperCase().trim());
}

// Nettoyage : supprimer les rooms inactives depuis plus de 6 heures
export function cleanupOldRooms() {
  const now = Date.now();
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  for (const [code, room] of rooms.entries()) {
    if (now - room.createdAt > SIX_HOURS) rooms.delete(code);
  }
}

export function roomCount() {
  return rooms.size;
}
