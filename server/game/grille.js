// Logique "La Grille" — alignée sur le modèle du Quiz Master
//
// state.grille = {
//   grid_rows, grid_cols,
//   cells: [ { id, theme, used_easy, used_medium, used_hard } ],
//   questions: [ { id, theme, difficulty, question, answer, image, audio, used } ],
//   active: null | {
//     cellId, difficulty, theme, question, answer, image, audio, points,
//     revealed,                 // réponse correcte révélée ?
//     answersRevealed,          // réponses des joueurs révélées ?
//     locked,                   // saisie des réponses fermée ?
//     answers: { playerId: 'texte' },
//     awarded: [playerId]
//   }
// }

const DIFF_POINTS = { easy: 5, medium: 10, hard: 15 };
const DIFF_LABEL = { easy: 'Facile', medium: 'Médium', hard: 'Difficile' };
const DIFFS = ['easy', 'medium', 'hard'];

export function makeGrilleState() {
  return { grid_rows: 3, grid_cols: 4, cells: [], questions: [], active: null };
}

export function ensureGrille(room) {
  if (!room.state.grille) room.state.grille = makeGrilleState();
  const g = room.state.grille;
  if (!Array.isArray(g.cells)) g.cells = [];
  if (!Array.isArray(g.questions)) g.questions = [];
  if (!g.grid_rows) g.grid_rows = 3;
  if (!g.grid_cols) g.grid_cols = 4;
  return g;
}

// Importer les données exportées depuis Quiz Master
export function importData(room, data) {
  const g = ensureGrille(room);
  g.grid_rows = Number(data.grid_rows) || 3;
  g.grid_cols = Number(data.grid_cols) || 4;
  g.cells = Array.isArray(data.cells) ? data.cells.map(c => ({
    id: c.id, theme: c.theme || '',
    used_easy: !!c.used_easy, used_medium: !!c.used_medium, used_hard: !!c.used_hard,
  })) : [];
  g.questions = Array.isArray(data.questions) ? data.questions.map(q => ({
    id: q.id, theme: q.theme || '', difficulty: q.difficulty || 'easy',
    question: q.question || '', answer: q.answer || '',
    image: q.image || '', audio: q.audio || '', used: !!q.used,
  })) : [];
  g.active = null;
  return { cells: g.cells.length, questions: g.questions.length };
}

// L'animateur sélectionne une case + difficulté → pioche une question du pool
export function selectCell(room, cellId, difficulty) {
  const g = ensureGrille(room);
  if (!DIFFS.includes(difficulty)) return;
  const cell = g.cells.find(c => c.id === cellId);
  if (!cell || !cell.theme) return;
  if (cell['used_' + difficulty]) return;
  const pool = g.questions.filter(q => q.theme === cell.theme && q.difficulty === difficulty && !q.used);
  if (pool.length === 0) return;
  const q = pool[0];
  const answers = {};
  room.state.players.forEach(p => { answers[p.id] = ''; });
  g.active = {
    cellId, difficulty, qId: q.id,
    theme: q.theme, question: q.question, answer: q.answer,
    image: q.image || '', audio: q.audio || '',
    points: DIFF_POINTS[difficulty],
    revealed: false, answersRevealed: false, locked: false,
    answers, awarded: [],
  };
}

// Un joueur soumet / modifie sa réponse écrite (tant que non verrouillé)
export function submitAnswer(room, playerId, text) {
  const g = ensureGrille(room);
  if (!g.active || g.active.locked) return;
  if (!g.active.answers) g.active.answers = {};
  g.active.answers[playerId] = String(text || '').slice(0, 200);
}

export function setLock(room, locked) {
  const g = ensureGrille(room);
  if (g.active) g.active.locked = !!locked;
}

// Révéler les réponses des joueurs (pour le débat)
export function revealAnswers(room) {
  const g = ensureGrille(room);
  if (g.active) { g.active.answersRevealed = true; g.active.locked = true; }
}

// Révéler la bonne réponse
export function revealCorrect(room) {
  const g = ensureGrille(room);
  if (g.active) g.active.revealed = true;
}

export function award(room, playerId) {
  const g = ensureGrille(room);
  if (!g.active || g.active.awarded.includes(playerId)) return;
  const player = room.state.players.find(p => p.id === playerId);
  if (!player) return;
  player.scores.grille = (player.scores.grille || 0) + g.active.points;
  g.active.awarded.push(playerId);
}

export function closeActive(room, markUsed = true) {
  const g = ensureGrille(room);
  if (!g.active) return;
  if (markUsed) {
    const cell = g.cells.find(c => c.id === g.active.cellId);
    if (cell) cell['used_' + g.active.difficulty] = true;
    const q = g.questions.find(x => x.id === g.active.qId);
    if (q) q.used = true;
  }
  g.active = null;
}

export { DIFF_POINTS, DIFF_LABEL, DIFFS };
