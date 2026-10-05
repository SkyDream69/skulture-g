// Interface animateur — reconnexion, import de grille, pilotage La Grille

const room = roomFromPath();
document.getElementById('room-code').textContent = room;
document.getElementById('display-link').href = `/display/${encodeURIComponent(room)}`;

function reconnect() {
  const payload = { room };
  payload['password'] = sessionStorage.getItem('skg_hostpw');
  if (!payload[Object.keys(payload)[1]]) { showWarning(); return; }
  socket.emit('host:join', payload, (res) => {
    if (res && res.error) { showWarning(); }
  });
}
function showWarning() {
  document.getElementById('connect-warning').style.display = 'block';
}
socket.on('connect', reconnect);

document.querySelectorAll('.set-view').forEach(b => {
  b.onclick = () => socket.emit('host:setView', { view: b.dataset.view });
});

const DIFF_LABEL = { easy: 'Facile', medium: 'Médium', hard: 'Difficile' };
const DIFF_PTS = { easy: 5, medium: 10, hard: 15 };
const DIFFS = ['easy', 'medium', 'hard'];

// --- Import d'une grille exportée depuis Quiz Master ---
document.getElementById('grille-import-file').onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      socket.emit('grille:import', data, (res) => {
        const st = document.getElementById('grille-import-status');
        if (res && res.ok) {
          st.style.color = 'var(--green)';
          st.textContent = `✅ ${res.cells} cases · ${res.questions} questions importées`;
        } else {
          st.style.color = 'var(--red)';
          st.textContent = (res && res.error) || 'Erreur import';
        }
      });
    } catch (err) {
      const st = document.getElementById('grille-import-status');
      st.style.color = 'var(--red)';
      st.textContent = 'Fichier JSON invalide';
    }
  };
  reader.readAsText(file);
};

// --- Réception de l'état ---
socket.on('game:state', (state) => {
  const players = state.players || [];
  document.getElementById('player-count').textContent = players.filter(p => p.connected).length;
  const list = document.getElementById('player-list');
  if (players.length === 0) {
    list.innerHTML = '<div class="small" style="color:var(--muted)">Personne pour le moment.</div>';
  } else {
    list.innerHTML = players.map(p => `
      <div style="display:flex;align-items:center;gap:.6rem;opacity:${p.connected ? 1 : .4}">
        ${avatarHTML(p, 32)}
        <span class="font-display">${esc(p.pseudo)}</span>
        <span class="small font-mono" style="color:var(--muted);margin-left:auto">${(p.scores && p.scores.grille) || 0} pts</span>
      </div>`).join('');
  }
  renderBoard(state);
  renderActive(state);
});

// --- Grille cliquable (cases) ---
function renderBoard(state) {
  const g = state.grille || { cells: [], questions: [], grid_cols: 4 };
  const board = document.getElementById('grille-board');
  const status = document.getElementById('grille-import-status');
  if (g.cells && g.cells.length && status.textContent === 'Aucune grille chargée.') {
    status.textContent = `${g.cells.length} cases · ${(g.questions||[]).length} questions`;
  }
  if (!g.cells || g.cells.length === 0) {
    board.innerHTML = '<div class="small" style="color:var(--muted)">Importe une grille pour commencer.</div>';
    return;
  }
  const cols = g.grid_cols || 4;
  board.innerHTML = `<div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:.5rem">
    ${g.cells.map(cell => {
      const hasTheme = cell.theme && cell.theme.length > 0;
      return `<div style="border:1px solid var(--line);border-radius:8px;padding:.5rem;text-align:center">
        <div class="font-display" style="font-size:.9rem;margin-bottom:.4rem;min-height:1.2em;color:${hasTheme ? 'var(--text)' : 'var(--muted)'}">${esc(cell.theme || '—')}</div>
        <div style="display:flex;gap:.25rem;justify-content:center">
          ${DIFFS.map(d => {
            const used = cell['used_' + d];
            const n = countPool(g, cell.theme, d);
            const disabled = !hasTheme || used || n === 0;
            const title = used ? 'Déjà utilisée' : (!hasTheme ? 'Case sans thème' : (n === 0 ? 'Aucune question pour cette difficulté' : n + ' question(s) disponible(s)'));
            return `<button class="gr-select" data-cell="${cell.id}" data-d="${d}" ${disabled ? 'disabled' : ''} title="${title}"
              style="flex:1;padding:.3rem;font-size:.75rem;border-color:${disabled ? 'var(--line)' : 'var(--purple)'};color:${disabled ? 'var(--muted)' : 'var(--purple)'};${used ? 'text-decoration:line-through' : ''};${disabled ? 'cursor:default;opacity:.5' : ''}">+${DIFF_PTS[d]}</button>`;
          }).join('')}
        </div>
      </div>`;
    }).join('')}
  </div>`;
  board.querySelectorAll('.gr-select').forEach(el => {
    el.onclick = () => socket.emit('grille:select', { cellId: el.dataset.cell, difficulty: el.dataset.d });
  });
}

function countPool(g, theme, d) {
  if (!theme) return 0;
  return (g.questions || []).filter(q => q.theme === theme && q.difficulty === d && !q.used).length;
}

// --- Question active : réponses écrites + attribution ---
function renderActive(state) {
  const g = state.grille || {};
  const box = document.getElementById('grille-active');
  if (!g.active) { box.innerHTML = ''; return; }
  const a = g.active;
  const players = state.players || [];

  const answersHtml = players.map(p => {
    const ans = (a.answers && a.answers[p.id]) || '';
    const hasAns = ans.length > 0;
    const shown = a.answersRevealed;
    return `<div style="display:flex;align-items:center;gap:.5rem;justify-content:space-between;padding:.3rem 0;border-bottom:1px solid var(--line)">
      <span style="color:${p.color};min-width:90px">${esc(p.pseudo)}</span>
      <span class="font-mono small" style="flex:1;color:${hasAns ? 'var(--text)' : 'var(--muted)'}">${shown ? (hasAns ? esc(ans) : '—') : (hasAns ? '✓ a répondu' : '… en attente')}</span>
      <button class="gr-award" data-id="${p.id}" ${a.awarded.includes(p.id) ? 'disabled' : ''} style="padding:.2rem .6rem;font-size:.75rem;border-color:var(--green);color:#b6ffc8">${a.awarded.includes(p.id) ? '✓ +'+a.points : '+ '+a.points}</button>
    </div>`;
  }).join('');

  box.innerHTML = `
    <div class="card accent" style="border-color:var(--purple)">
      <div class="small font-mono" style="color:var(--purple);letter-spacing:.15em">${esc(a.theme)} · ${DIFF_LABEL[a.difficulty]} · +${a.points} pts</div>
      <div class="font-display" style="font-size:1.2rem;margin:.4rem 0">${esc(a.question)}</div>
      <div class="small font-mono" style="color:#7afa9b">Bonne réponse : ${esc(a.answer)}</div>

      <div class="row" style="display:flex;gap:.4rem;margin:.8rem 0;flex-wrap:wrap">
        <button id="gr-lock" class="${a.locked ? 'danger' : 'green'}">${a.locked ? '🔒 Saisie fermée' : '🔓 Saisie ouverte'}</button>
        <button id="gr-reveal-ans" ${a.answersRevealed ? 'disabled' : ''}>👁️ Révéler les réponses</button>
        <button id="gr-reveal-correct" ${a.revealed ? 'disabled' : ''}>✅ Révéler la bonne réponse</button>
        <button id="gr-close" class="danger">✕ Fermer</button>
      </div>

      <div class="small font-mono" style="color:var(--muted);margin-bottom:.3rem">Réponses des joueurs :</div>
      ${players.length ? answersHtml : '<div class="small" style="color:var(--muted)">Aucun joueur.</div>'}
    </div>`;

  document.getElementById('gr-lock').onclick = () => socket.emit('grille:lock', { locked: !a.locked });
  const ra = document.getElementById('gr-reveal-ans'); if (ra) ra.onclick = () => socket.emit('grille:revealAnswers', {});
  const rc = document.getElementById('gr-reveal-correct'); if (rc) rc.onclick = () => socket.emit('grille:revealCorrect', {});
  document.getElementById('gr-close').onclick = () => socket.emit('grille:close', { markUsed: true });
  box.querySelectorAll('.gr-award').forEach(el => {
    el.onclick = () => socket.emit('grille:award', { playerId: el.dataset.id });
  });
}
