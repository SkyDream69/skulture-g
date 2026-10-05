// Interface joueur — Modèle A : voit la grille + répond par écrit

const room = roomFromPath();
document.getElementById('me-room').textContent = room;

const myId = sessionStorage.getItem('skg_playerId') || '';
const pseudo = sessionStorage.getItem('skg_pseudo') || '';
const color = sessionStorage.getItem('skg_color') || '#B026FF';
document.getElementById('me-pseudo').textContent = pseudo || 'Joueur';
document.getElementById('me-pseudo').style.color = color;

const body = document.getElementById('play-body');
const DIFF_LABEL = { easy: 'Facile', medium: 'Médium', hard: 'Difficile' };
const DIFF_PTS = { easy: 5, medium: 10, hard: 15 };
const DIFFS = ['easy', 'medium', 'hard'];

socket.on('connect', () => {
  if (!pseudo) {
    body.innerHTML = `<div class="small" style="text-align:center;color:var(--red)">Reviens à <a href="/" style="color:var(--cyan)">l'accueil</a> pour entrer ton pseudo.</div>`;
    return;
  }
  socket.emit('player:join', { room, pseudo, color }, (res) => {
    if (res && res.error) body.innerHTML = `<div class="small" style="text-align:center;color:var(--red)">${esc(res.error)}</div>`;
  });
});

// On garde une trace de la question active pour ne pas écraser la saisie en cours
let activeKey = null;

socket.on('game:state', (state) => {
  const view = state.view || 'menu';
  if (view === 'menu') { activeKey = null; return renderLobby(); }
  if (view === 'grille') return renderGrille(state);
  activeKey = null;
  const labels = { blitz:'Le Blitz', rush:'Le Rush', vies:'Les Vies', finale:'La Finale' };
  body.innerHTML = `<div style="text-align:center" class="font-display neon-text-purple">${esc(labels[view] || view)}</div>
    <div class="small" style="text-align:center;color:var(--muted)">Épreuve en préparation…</div>`;
});

function renderLobby() {
  body.innerHTML = `
    <div style="text-align:center" class="font-display neon-text-purple">Tu es dans la partie !</div>
    <div class="small" style="text-align:center;color:var(--muted)">Attends que l'animateur lance une épreuve.</div>`;
}

function myScore(state) {
  const me = (state.players || []).find(p => p.id === myId);
  return me ? (me.scores?.grille || 0) : 0;
}

// Barre de scores de tous les joueurs (triée par score décroissant)
function scoresBar(state) {
  const players = [...(state.players || [])].sort((a, b) => (b.scores?.grille || 0) - (a.scores?.grille || 0));
  if (players.length === 0) return '';
  return `<div style="display:flex;gap:.5rem;overflow-x:auto;padding:.6rem 0;margin-top:1rem;border-top:1px solid var(--line);justify-content:center">
    ${players.map(p => `
      <div style="display:flex;flex-direction:column;align-items:center;gap:.2rem;min-width:60px;${p.id === myId ? 'opacity:1' : 'opacity:.85'}">
        ${avatarHTML(p, 42)}
        <div class="font-mono" style="font-size:.65rem;color:${p.color};max-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.pseudo)}</div>
        <div class="font-mono" style="font-size:.8rem;font-weight:700">${p.scores?.grille || 0}</div>
      </div>`).join('')}
  </div>`;
}

function renderGrille(state) {
  const g = state.grille || { cells: [], questions: [], active: null };
  const scoreBar = `<div class="font-mono small" style="text-align:center;color:${color};margin-bottom:.5rem">Ton score : <b style="font-size:1.1rem">${myScore(state)}</b> pts</div>`;

  // Question active → réponse écrite
  if (g.active) {
    const a = g.active;
    const key = a.cellId + '_' + a.difficulty;
    const myAns = (a.answers && a.answers[myId]) || '';
    // Ne reconstruire le DOM que si on change de question (préserve la saisie)
    if (activeKey !== key) {
      activeKey = key;
      body.innerHTML = `
        ${scoreBar}
        <div class="card accent" style="border-color:var(--purple)">
          <div class="font-mono small" style="color:var(--purple);letter-spacing:.15em">${esc(a.theme)} · ${DIFF_LABEL[a.difficulty]} · +${a.points} pts</div>
          <div class="font-display" style="font-size:1.3rem;margin:.6rem 0">${esc(a.question)}</div>
        </div>
        <div id="answer-zone" style="margin-top:1rem"></div>
        <div id="scores-bar">${scoresBar(state)}</div>`;
    }
    renderAnswerZone(a, myAns);
    // Met à jour la barre de scores + le score perso à chaque état (sans casser la saisie)
    const sb = document.getElementById('scores-bar');
    if (sb) sb.innerHTML = scoresBar(state);
    return;
  }

  // Pas de question active → afficher la grille (lecture)
  activeKey = null;
  if (!g.cells || g.cells.length === 0) {
    body.innerHTML = `${scoreBar}<div class="small" style="text-align:center;color:var(--muted)">En attente de la grille…</div>`;
    return;
  }
  const cols = g.grid_cols || 4;
  body.innerHTML = `
    ${scoreBar}
    <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:.4rem">
      ${g.cells.map(cell => `
        <div style="border:1px solid rgba(176,38,255,.4);border-radius:8px;padding:.4rem;text-align:center">
          <div class="font-display" style="font-size:.8rem;margin-bottom:.3rem;min-height:1em">${esc(cell.theme || '—')}</div>
          <div style="display:flex;gap:.2rem;justify-content:center">
            ${DIFFS.map(d => `<div style="flex:1;font-family:'JetBrains Mono';font-size:.7rem;padding:.2rem;border-radius:4px;border:1px solid ${cell['used_'+d] ? 'var(--line)' : 'rgba(176,38,255,.5)'};opacity:${cell['used_'+d] ? .35 : 1}">+${DIFF_PTS[d]}</div>`).join('')}
          </div>
        </div>`).join('')}
    </div>
    <div class="small" style="text-align:center;color:var(--muted);margin-top:.8rem">L'animateur va lancer une question.</div>
    ${scoresBar(state)}`;
}

function renderAnswerZone(a, myAns) {
  const zone = document.getElementById('answer-zone');
  if (!zone) return;

  if (a.revealed) {
    zone.innerHTML = `<div class="card" style="text-align:center">
      <div class="small font-mono" style="color:var(--muted)">Bonne réponse</div>
      <div class="font-display neon-text-green" style="font-size:1.4rem;margin-top:.3rem">${esc(a.answer)}</div>
      <div class="small font-mono" style="margin-top:.6rem;color:var(--muted)">Ta réponse : <b style="color:var(--text)">${esc(myAns || '—')}</b></div>
    </div>`;
    return;
  }

  if (a.locked) {
    zone.innerHTML = `<div style="text-align:center;color:var(--amber);margin-top:.5rem" class="font-mono small">🔒 Réponses fermées</div>
      <div class="small font-mono" style="text-align:center;margin-top:.4rem;color:var(--muted)">Ta réponse : <b style="color:var(--text)">${esc(myAns || '—')}</b></div>`;
    return;
  }

  // Saisie ouverte — n'écrase pas si le champ existe déjà (saisie en cours)
  if (!zone.querySelector('#answer-input')) {
    zone.innerHTML = `
      <input id="answer-input" placeholder="Ta réponse…" value="${esc(myAns)}" style="font-size:1.1rem;padding:.8rem">
      <div class="small font-mono" style="color:var(--muted);text-align:center;margin-top:.4rem" id="answer-feedback">Tape ta réponse — elle reste cachée jusqu'à la révélation.</div>`;
    const input = zone.querySelector('#answer-input');
    let timer = null;
    input.oninput = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        socket.emit('grille:answer', { text: input.value });
        const fb = document.getElementById('answer-feedback');
        if (fb) { fb.textContent = '✓ Réponse enregistrée'; fb.style.color = 'var(--green)'; }
      }, 400);
    };
  }
}
