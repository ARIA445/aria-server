# ARIA Server — Guide de déploiement complet

## Ce que tu vas faire (20 min chrono)

```
[aria-server]  →  GitHub  →  Railway  →  URL serveur
[aria-pwa]     →  Netlify              →  URL front
                                            ↓
                                    Lien à partager ✅
```

---

## ÉTAPE 1 — Tester en local (2 min)

```bash
# Dans le dossier aria-server/
cp .env.example .env
# Ouvre .env et colle ta clé Anthropic à la place de "sk-ant-xxx..."

npm install
npm start
# → Tu dois voir : ARIA SERVER v2.0 — ONLINE sur http://localhost:3000
```

**Teste que ça marche :**
Ouvre http://localhost:3000 dans ton navigateur → tu dois voir `{"status":"ARIA SERVER ONLINE"}`

---

## ÉTAPE 2 — Mettre le serveur sur GitHub (3 min)

```bash
# Dans le dossier aria-server/
git init
git add .
git commit -m "ARIA Server v2.0"
```

Sur github.com :
1. Clique **New repository**
2. Nom : `aria-server`
3. Visibilité : **Private** ← important (clé API dedans)
4. Clique **Create repository**

```bash
# Remplace TON_USERNAME par ton nom GitHub
git remote add origin https://github.com/TON_USERNAME/aria-server.git
git branch -M main
git push -u origin main
```

---

## ÉTAPE 3 — Déployer le serveur sur Railway (5 min)

1. Va sur **railway.app** → connecte-toi avec GitHub
2. Clique **New Project → Deploy from GitHub repo**
3. Sélectionne `aria-server`
4. Railway détecte Node.js automatiquement ✅

**Ajouter ta clé API (CRITIQUE) :**
- Dans Railway → ton projet → onglet **Variables**
- Clique **New Variable**
- Nom : `ANTHROPIC_API_KEY`
- Valeur : ta clé `sk-ant-...`
- Clique **Add**

Railway redémarre le serveur automatiquement.

**Récupère ton URL Railway :**
- Onglet **Settings → Networking → Generate Domain**
- Tu obtiens quelque chose comme : `https://aria-server-production-xxxx.up.railway.app`
- **Copie cette URL** → tu en auras besoin à l'étape 5

---

## ÉTAPE 4 — Déployer le front sur Netlify (3 min)

1. Va sur **netlify.com** → connecte-toi
2. Glisse le dossier **`aria-pwa/`** dans la zone de drop
3. Netlify génère une URL : `https://aria-xxxxx.netlify.app`
4. **Copie cette URL**

---

## ÉTAPE 5 — Connecter front ↔ serveur (5 min)

### 5a — Mettre l'URL Railway dans le front

Ouvre `aria-pwa/index.html`, cherche cette ligne :

```js
const BACKEND = window.location.origin;
```

Remplace par :

```js
const BACKEND = 'https://aria-server-production-xxxx.up.railway.app';
```
(mets ton URL Railway réelle)

### 5b — Mettre l'URL Netlify dans Railway

Dans Railway → Variables, ajoute :
- Nom : `ALLOWED_ORIGIN`
- Valeur : `https://aria-xxxxx.netlify.app`

### 5c — Re-déployer le front

Retourne sur Netlify → glisse à nouveau le dossier `aria-pwa/` mis à jour.

---

## ÉTAPE 6 — Tester (2 min)

1. Ouvre ton URL Netlify sur ton téléphone
2. Envoie "Bonjour" à ARIA
3. ARIA répond ✅

**Sur iPhone :** Safari → bouton Partager → "Sur l'écran d'accueil" → ARIA installée comme une vraie app

**Sur Android :** Chrome → menu → "Ajouter à l'écran d'accueil"

---

## En cas de problème

**ARIA ne répond pas :**
- Ouvre la console du navigateur (F12 → Console)
- Cherche une erreur rouge → souvent CORS ou URL mal copiée

**Erreur CORS :**
- Vérifie que `ALLOWED_ORIGIN` dans Railway = exactement ton URL Netlify (sans slash final)

**Erreur 401 :**
- Ta clé API Anthropic est invalide ou mal copiée dans Railway

**Le serveur Railway est down :**
- Railway → ton projet → Deployments → voir les logs

---

## Coût estimé

| Service | Coût |
|---------|------|
| Railway | Gratuit jusqu'à 5$/mois de compute (largement suffisant) |
| Netlify | Gratuit (100GB bande passante/mois) |
| Claude API | ~0.003$ par message (Sonnet) |

---

## Pour aller plus loin

**Persistance des tâches après redémarrage serveur :**
Ajouter Supabase (gratuit) → je peux te faire le code si besoin.

**Domaine personnalisé (aria.tonsite.com) :**
Netlify → Domain Settings → Add custom domain.
