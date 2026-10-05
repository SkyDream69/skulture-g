# Sk'ultureG

Quiz de culture générale multijoueur en ligne, en temps réel.

## Lancer en local

```bash
npm install
npm start
```

Puis ouvre http://localhost:3000

- **Accueil** : `/` — rejoindre une partie (joueur) ou ouvrir l'espace animateur
- **Animateur** : `/host/CODE` — contrôle (protégé par mot de passe)
- **Affichage** : `/display/CODE` — écran à streamer / 2e écran
- **Joueur** : `/play/CODE` — interface mobile des joueurs

## Comment ça marche

1. L'animateur crée une room (code + mot de passe) depuis l'accueil (section "Je suis l'animateur").
2. Les joueurs rejoignent avec le code de la room + un pseudo.
3. L'animateur ouvre l'écran d'affichage sur sa source de capture (OBS, 2e écran).
4. L'animateur lance les épreuves ; les joueurs interagissent depuis leur téléphone.

## Épreuves (en cours de développement)

- ✅ **Phase 1** — Fondations : rooms, connexion, buzz, synchro temps réel
- ⬜ **La Grille** — grille de thèmes/difficultés
- ⬜ **Le Blitz** — questions en rafale avec timer
- ⬜ **Le Rush** — Duo / Carré / Cash
- ⬜ **Les Vies** — élimination par cœurs
- ⬜ **La Finale** — entonnoir à indices + clepsydre

## Stack

- Node.js + Express (serveur HTTP)
- Socket.io (temps réel)
- État en mémoire (pas de base de données)

## Déploiement

Poussé sur GitHub puis connecté à Render (voir `render.yaml`). Plan gratuit suffisant.
