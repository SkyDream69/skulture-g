// Serveur Sk'ultureG — Express + Socket.io
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import path from 'path';

import {
  createRoom, getRoom, checkHostPassword, addPlayer,
  cleanupOldRooms, roomCount
} from './rooms.js';
import * as grille from './game/grille.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  // Délais de ping plus tolérants : évite les fausses déconnexions
  // quand un mobile met l'écran en veille ou sur un réseau lent.
  pingInterval: 25000,
  pingTimeout: 60000,
});

// Sert les fichiers statiques (HTML, CSS, JS client)
app.use(express.static(PUBLIC_DIR));

// Routes — chaque page renvoie son HTML. Le :room est géré côté client via l'URL.
app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
app.get('/host/:room', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'host.html')));
app.get('/display/:room', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'display.html')));
app.get('/play/:room', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'play.html')));

// ---- Helpers ----
// Diffuse l'état complet d'une room à tous ses membres (host, display, players)
function broadcastState(room) {
  io.to(room.code).emit('game:state', room.state);
}

// ---- Socket.io ----
io.on('connection', (socket) => {

  // --- HÔTE : créer une room ---
  socket.on('host:create', ({ room, password }, cb) => {
    const result = createRoom(room, password);
    if (result.error) return cb && cb({ error: result.error });
    result.room.hostSocketId = socket.id;
    socket.join(result.room.code);
    socket.data = { role: 'host', room: result.room.code };
    cb && cb({ ok: true, room: result.room.code });
  });

  // --- HÔTE : se reconnecter à une room existante (avec mot de passe) ---
  socket.on('host:join', ({ room, password }, cb) => {
    if (!checkHostPassword(room, password)) return cb && cb({ error: 'Mot de passe incorrect ou room inexistante.' });
    const r = getRoom(room);
    r.hostSocketId = socket.id;
    socket.join(r.code);
    socket.data = { role: 'host', room: r.code };
    cb && cb({ ok: true, room: r.code });
    broadcastState(r);
  });

  // --- DISPLAY : rejoindre en lecture seule ---
  socket.on('display:join', ({ room }, cb) => {
    const r = getRoom(room);
    if (!r) return cb && cb({ error: 'Room introuvable.' });
    socket.join(r.code);
    socket.data = { role: 'display', room: r.code };
    cb && cb({ ok: true });
    broadcastState(r);
  });

  // --- JOUEUR : rejoindre ---
  socket.on('player:join', ({ room, pseudo, color, image }, cb) => {
    const result = addPlayer(room, pseudo, color, image);
    if (result.error) return cb && cb({ error: result.error });
    socket.join(result.room.code);
    socket.data = { role: 'player', room: result.room.code, playerId: result.player.id };
    // Mémorise le socket actif de ce joueur (pour gérer les reconnexions proprement)
    result.player.socketId = socket.id;
    cb && cb({ ok: true, playerId: result.player.id, player: result.player });
    broadcastState(result.room);
  });

  // --- HÔTE : changer la vue affichée (menu, épreuve) ---
  socket.on('host:setView', ({ view }) => {
    const r = getRoom(socket.data?.room);
    if (!r || socket.data.role !== 'host') return;
    r.state.view = view;
    broadcastState(r);
  });

  // --- HÔTE : changer la phase (épreuve en cours) ---
  socket.on('host:setPhase', ({ phase }) => {
    const r = getRoom(socket.data?.room);
    if (!r || socket.data.role !== 'host') return;
    r.state.phase = phase;
    broadcastState(r);
  });

  // --- JOUEUR : buzzer ---
  // --- JOUEUR : soumettre une réponse écrite ---
  socket.on('grille:answer', ({ text }) => {
    const r = getRoom(socket.data?.room);
    if (!r || socket.data.role !== 'player') return;
    grille.submitAnswer(r, socket.data.playerId, text);
    broadcastState(r);
  });

  // ===== ÉPREUVE : LA GRILLE =====
  const isHost = () => socket.data && socket.data.role === 'host';

  // Import des données depuis Quiz Master
  socket.on('grille:import', (data, cb) => {
    const r = getRoom(socket.data?.room); if (!r || !isHost()) return cb && cb({ error: 'Non autorisé.' });
    try {
      const summary = grille.importData(r, data);
      broadcastState(r);
      cb && cb({ ok: true, cells: summary.cells, questions: summary.questions });
    } catch (e) {
      cb && cb({ error: 'Fichier invalide.' });
    }
  });

  // Déroulé (animateur)
  socket.on('grille:select', ({ cellId, difficulty }) => {
    const r = getRoom(socket.data?.room); if (!r || !isHost()) return;
    grille.selectCell(r, cellId, difficulty); broadcastState(r);
  });
  socket.on('grille:lock', ({ locked }) => {
    const r = getRoom(socket.data?.room); if (!r || !isHost()) return;
    grille.setLock(r, locked); broadcastState(r);
  });
  socket.on('grille:revealAnswers', () => {
    const r = getRoom(socket.data?.room); if (!r || !isHost()) return;
    grille.revealAnswers(r); broadcastState(r);
  });
  socket.on('grille:revealCorrect', () => {
    const r = getRoom(socket.data?.room); if (!r || !isHost()) return;
    grille.revealCorrect(r); broadcastState(r);
  });
  socket.on('grille:award', ({ playerId }) => {
    const r = getRoom(socket.data?.room); if (!r || !isHost()) return;
    grille.award(r, playerId); broadcastState(r);
  });
  socket.on('grille:close', ({ markUsed }) => {
    const r = getRoom(socket.data?.room); if (!r || !isHost()) return;
    grille.closeActive(r, markUsed !== false); broadcastState(r);
  });

  // --- Déconnexion ---
  socket.on('disconnect', () => {
    const r = getRoom(socket.data?.room);
    if (!r) return;
    if (socket.data.role === 'player') {
      const player = r.state.players.find(p => p.id === socket.data.playerId);
      // Ne marquer déconnecté QUE si ce socket est encore le socket actif du joueur.
      // (évite qu'un ancien socket remplacé marque le joueur offline par erreur)
      if (player && player.socketId === socket.id) {
        player.connected = false;
        broadcastState(r);
      }
    }
  });
});

// Nettoyage périodique des vieilles rooms
setInterval(cleanupOldRooms, 30 * 60 * 1000);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`✅ Sk'ultureG démarré sur le port ${PORT}`);
  console.log(`   → http://localhost:${PORT}`);
});
