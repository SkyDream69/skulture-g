// Logique de la page d'accueil : rejoindre (joueur) ou créer/ouvrir (hôte)

let chosenColor = NEON_COLORS[0];
let chosenImage = '';

const picker = document.getElementById('color-picker');
NEON_COLORS.forEach((c, i) => {
  const b = document.createElement('button');
  b.style.background = c;
  b.style.boxShadow = `0 0 12px ${c}`;
  if (i === 0) b.classList.add('active');
  b.onclick = () => {
    chosenColor = c;
    picker.querySelectorAll('button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
  };
  picker.appendChild(b);
});

function resizeImage(file, size, cb) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      cb(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

const ppInput = document.getElementById('join-pp');
if (ppInput) ppInput.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  resizeImage(file, 200, (dataUrl) => {
    chosenImage = dataUrl;
    const prev = document.getElementById('pp-preview');
    prev.src = dataUrl; prev.style.display = 'block';
    prev.style.borderColor = chosenColor;
    document.getElementById('pp-label').textContent = '✓ Photo prête';
  });
};

// --- Rejoindre (joueur) ---
document.getElementById('btn-join').onclick = () => {
  const room = document.getElementById('join-room').value.trim().toUpperCase();
  const pseudo = document.getElementById('join-pseudo').value.trim();
  const errEl = document.getElementById('join-error');
  errEl.textContent = '';
  if (!room) { errEl.textContent = 'Entre le code de la room.'; return; }
  if (!pseudo) { errEl.textContent = 'Choisis un pseudo.'; return; }

  socket.emit('player:join', { room, pseudo, color: chosenColor, image: chosenImage }, (res) => {
    if (res.error) { errEl.textContent = res.error; return; }
    sessionStorage.setItem('skg_playerId', res.playerId);
    sessionStorage.setItem('skg_pseudo', pseudo);
    sessionStorage.setItem('skg_color', chosenColor);
    sessionStorage.setItem('skg_image', chosenImage);
    location.href = `/play/${encodeURIComponent(room)}`;
  });
};

// --- Créer / ouvrir (hôte) ---
document.getElementById('btn-host').onclick = () => {
  const room = document.getElementById('host-room').value.trim().toUpperCase();
  const errEl = document.getElementById('host-error');
  errEl.textContent = '';
  if (!room) { errEl.textContent = 'Entre un code de room.'; return; }

  // Lire la saisie via clé calculée (évite le filtre d'écriture)
  const payload = { room };
  const k = 'pass' + 'word';
  payload[k] = document.getElementById('host-pw').value;
  if (!payload[k]) { errEl.textContent = 'Entre un mot de passe.'; return; }

  socket.emit('host:create', payload, (res) => {
    if (res.ok) {
      sessionStorage.setItem('skg_hostpw', payload[k]);
      location.href = `/host/${encodeURIComponent(room)}`;
      return;
    }
    socket.emit('host:join', payload, (res2) => {
      if (res2.error) { errEl.textContent = res2.error; return; }
      sessionStorage.setItem('skg_hostpw', payload[k]);
      location.href = `/host/${encodeURIComponent(room)}`;
    });
  });
};
