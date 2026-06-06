// ═══════════════════════════════════════════
//  ARIA SERVER v2.0
//  Express + Anthropic Claude API
//  Déploiement : Railway / Render / Fly.io
// ═══════════════════════════════════════════

require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const Anthropic = require('@anthropic-ai/sdk');

const app  = express();
const port = process.env.PORT || 3000;

// ── Anthropic client ──
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ── CORS ──
// En prod : restreindre à ton domaine Netlify
// En dev  : tout accepter
const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';

app.use(cors({
  origin: allowedOrigin === '*'
    ? '*'
    : (origin, cb) => {
        // Accepte aussi les requêtes sans origin (apps mobiles, PWA installée)
        if (!origin || origin === allowedOrigin) cb(null, true);
        else cb(new Error(`CORS bloqué : ${origin}`));
      },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json({ limit: '2mb' }));

// ── Santé du serveur ──
app.get('/', (req, res) => {
  res.json({
    status: 'ARIA SERVER ONLINE',
    version: '2.0.0',
    time: new Date().toISOString(),
  });
});

// ════════════════════════════════════════════
//  ROUTE : CHAT  →  Claude API
// ════════════════════════════════════════════
app.post('/chat', async (req, res) => {
  const { system, messages } = req.body;

  // Validation basique
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages requis' });
  }

  // Sécurité : limiter la taille de l'historique envoyé
  // Garde les 20 derniers messages pour éviter de dépasser le context window
  const trimmed = messages.slice(-20);

  try {
    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',   // Sonnet 4 — rapide + intelligent
      max_tokens: 1024,
      system:     system || 'Tu es ARIA, une secrétaire IA executive.',
      messages:   trimmed,
    });

    const reply = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    res.json({ reply });

  } catch (err) {
    console.error('[CHAT ERROR]', err.message);

    // Erreur clé API
    if (err.status === 401) {
      return res.status(401).json({ error: 'Clé API invalide ou manquante.' });
    }
    // Rate limit
    if (err.status === 429) {
      return res.status(429).json({ error: 'Limite de requêtes atteinte. Réessaie dans quelques secondes.' });
    }

    res.status(500).json({ error: 'Erreur serveur. Réessaie.' });
  }
});

// ════════════════════════════════════════════
//  ROUTE : TÂCHES  (stockage mémoire serveur)
//  Note : redémarre le serveur = tâches perdues
//  Pour persistance réelle → ajouter une DB (Supabase, PlanetScale)
// ════════════════════════════════════════════

// Stockage en mémoire { userId: [tasks] }
const taskStore = new Map();

function getUserTasks(userId) {
  if (!taskStore.has(userId)) taskStore.set(userId, []);
  return taskStore.get(userId);
}

// GET /tasks/:userId — Récupérer les tâches
app.get('/tasks/:userId', (req, res) => {
  const tasks = getUserTasks(req.params.userId);
  res.json(tasks);
});

// POST /tasks — Créer une tâche
app.post('/tasks', (req, res) => {
  const { user_id, text, tag, done, time_start, time_end } = req.body;
  if (!user_id || !text) return res.status(400).json({ error: 'user_id et text requis' });

  const task = {
    id:         `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    user_id,
    text:       text.trim(),
    tag:        tag || 'perso',
    done:       done || false,
    time_start: time_start || '',
    time_end:   time_end || '',
    created_at: new Date().toISOString(),
  };

  getUserTasks(user_id).push(task);
  res.status(201).json([task]);
});

// PATCH /tasks/:id — Mettre à jour (done/undone)
app.patch('/tasks/:id', (req, res) => {
  const { id } = req.params;
  const { done } = req.body;
  let found = false;

  for (const tasks of taskStore.values()) {
    const task = tasks.find(t => t.id === id);
    if (task) {
      task.done = done;
      task.updated_at = new Date().toISOString();
      found = true;
      res.json(task);
      break;
    }
  }

  if (!found) res.status(404).json({ error: 'Tâche introuvable' });
});

// DELETE /tasks/:id — Supprimer une tâche
app.delete('/tasks/:id', (req, res) => {
  const { id } = req.params;
  let found = false;

  for (const [userId, tasks] of taskStore.entries()) {
    const idx = tasks.findIndex(t => t.id === id);
    if (idx !== -1) {
      tasks.splice(idx, 1);
      taskStore.set(userId, tasks);
      found = true;
      res.json({ deleted: id });
      break;
    }
  }

  if (!found) res.status(404).json({ error: 'Tâche introuvable' });
});

// ── Catch-all 404 ──
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} inconnue` });
});

// ── Démarrage ──
app.listen(port, () => {
  console.log(`
  ╔══════════════════════════════════╗
  ║   ARIA SERVER v2.0 — ONLINE      ║
  ║   http://localhost:${port}         ║
  ║   Model : claude-sonnet-4-6      ║
  ╚══════════════════════════════════╝
  `);
});
