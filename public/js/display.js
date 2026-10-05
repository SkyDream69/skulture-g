// Écran display / preview — grille complète + question active (grand écran, sans interaction)

const room = roomFromPath();
const root = document.getElementById('display-root');
const DIFF_LABEL = { easy: 'Facile', medium: 'Médium', hard: 'Difficile' };
const DIFF_PTS = { easy: 5, medium: 10, hard: 15 };
const DIFFS = ['easy', 'medium', 'hard'];

socket.on('connect', () => {
  socket.emit('display:join', { room }, (res) => {
    if (res && res.error) root.innerHTML = `<div class="font-display neon-text-red" style="font-size:2rem">Room introuvable</div>`;
  });
});

socket.on('game:state', (state) => render(state));

function scoreStrip(players) {
  const list = (players || []).filter(p => p.connected);
  if (list.length === 0) return '';
  return `<div class="players-strip" style="margin-top:2rem">${list.map(p => `
    <div class="player-badge">
      ${avatarHTML(p, 70)}
      <div class="font-display" style="color:${p.color};text-shadow:0 0 10px ${p.color}">${esc(p.pseudo)}</div>
      <div class="font-mono small">${(p.scores && p.scores.grille) || 0} pts</div>
    </div>`).join('')}</div>`;
}

function render(state) {
  const view = state.view || 'menu';
  if (view === 'menu') {
    root.innerHTML = `
      <div class="font-mono small uppercase tracking-xwide" style="color:var(--purple)">// préparation</div>
      <h1 class="font-display neon-text-purple" style="font-size:clamp(3rem,10vw,7rem);margin:.5rem 0">Sk'ultureG</h1>
      <div class="font-mono small uppercase" style="letter-spacing:.3em;color:var(--muted)">Le jeu va commencer</div>
      ${scoreStrip(state.players)}`;
    return;
  }
  if (view === 'grille') return renderGrilleDisplay(state);
  const labels = { blitz:'Le Blitz', rush:'Le Rush', vies:'Les Vies', finale:'La Finale' };
  root.innerHTML = `
    <div class="font-mono small uppercase tracking-xwide" style="color:var(--cyan)">// épreuve</div>
    <h1 class="font-display neon-text-purple" style="font-size:clamp(2.5rem,8vw,6rem);margin:.5rem 0">${esc(labels[view] || view)}</h1>
    ${scoreStrip(state.players)}`;
}

function renderGrilleDisplay(state) {
  const g = state.grille || { cells: [], questions: [], active: null };

  if (g.active) {
    const a = g.active;
    const players = state.players || [];
    const answersHtml = a.answersRevealed
      ? `<div style="display:flex;flex-wrap:wrap;gap:1rem;justify-content:center;margin-top:1.5rem">
          ${players.filter(p=>p.connected).map(p => {
            const ans = (a.answers && a.answers[p.id]) || '';
            return `<div style="min-width:140px;text-align:center">
              <div class="font-display" style="color:${p.color}">${esc(p.pseudo)}</div>
              <div class="font-mono" style="font-size:1.1rem;margin-top:.2rem">${esc(ans || '—')}</div>
            </div>`;
          }).join('')}
        </div>`
      : `<div class="font-mono small" style="text-align:center;color:var(--muted);margin-top:1.5rem">${players.filter(p=>p.connected && a.answers && a.answers[p.id]).length} / ${players.filter(p=>p.connected).length} ont répondu</div>`;

    root.innerHTML = `
      <div style="width:90%;max-width:1100px">
        <div class="font-mono" style="color:var(--purple);letter-spacing:.2em;text-align:center">${esc(a.theme)} · ${DIFF_LABEL[a.difficulty]} · +${a.points} pts</div>
        <div class="font-display neon-text-purple" style="font-size:clamp(2rem,5vw,3.5rem);text-align:center;margin:1.5rem 0">${esc(a.question)}</div>
        ${a.revealed ? `<div class="font-display neon-text-green" style="font-size:clamp(1.5rem,3vw,2.5rem);text-align:center">✅ ${esc(a.answer)}</div>` : ''}
        ${answersHtml}
      </div>`;
    return;
  }

  if (!g.cells || g.cells.length === 0) {
    root.innerHTML = `<div class="font-display neon-text-purple" style="font-size:3rem">La Grille</div>
      <div class="small" style="color:var(--muted)">En attente d'import…</div>`;
    return;
  }
  const cols = g.grid_cols || 4;
  root.innerHTML = `
    <div style="width:95%;max-width:1400px">
      <h1 class="font-display neon-text-purple" style="font-size:clamp(1.8rem,4vw,3rem);text-align:center;margin:0 0 1.2rem">La Grille</h1>
      <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:.6rem">
        ${g.cells.map(cell => `
          <div style="border:1px solid rgba(176,38,255,.4);border-radius:10px;padding:.6rem;text-align:center">
            <div class="font-display" style="font-size:clamp(.9rem,1.6vw,1.3rem);margin-bottom:.5rem;min-height:1.2em">${esc(cell.theme || '—')}</div>
            <div style="display:flex;gap:.3rem;justify-content:center">
              ${DIFFS.map(d => `<div style="flex:1;padding:.5rem .2rem;border-radius:6px;border:1px solid ${cell['used_'+d] ? 'var(--line)' : 'rgba(176,38,255,.6)'};box-shadow:${cell['used_'+d] ? 'none' : '0 0 8px rgba(176,38,255,.25)'};opacity:${cell['used_'+d] ? .3 : 1};font-family:'JetBrains Mono';font-weight:700;font-size:clamp(.75rem,1.2vw,1rem)">+${DIFF_PTS[d]}</div>`).join('')}
            </div>
          </div>`).join('')}
      </div>
      ${scoreStrip(state.players)}
    </div>`;
}
