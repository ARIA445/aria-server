const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── SUPABASE CLIENT ──
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

async function supabase(method, table, data = null, filters = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}${filters}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': method === 'POST' ? 'return=representation' : ''
    },
    body: data ? JSON.stringify(data) : undefined
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error: ${err}`);
  }
  return res.status !== 204 ? res.json() : null;
}

// ── ROUTES TÂCHES ──
// Récupérer les tâches d'un utilisateur
app.get('/tasks/:userId', async (req, res) => {
  try {
    const tasks = await supabase('GET', 'tasks', null,
      `?user_id=eq.${req.params.userId}&order=created_at.asc`);
    res.json(tasks);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Créer une tâche
app.post('/tasks', async (req, res) => {
  try {
    const task = await supabase('POST', 'tasks', req.body);
    res.json(task);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Mettre à jour une tâche
app.patch('/tasks/:id', async (req, res) => {
  try {
    await supabase('PATCH', 'tasks', req.body, `?id=eq.${req.params.id}`);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Supprimer une tâche
app.delete('/tasks/:id', async (req, res) => {
  try {
    await supabase('DELETE', 'tasks', null, `?id=eq.${req.params.id}`);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── ROUTES RAPPELS ──
app.get('/reminders/:userId', async (req, res) => {
  try {
    const reminders = await supabase('GET', 'reminders', null,
      `?user_id=eq.${req.params.userId}&order=created_at.asc`);
    res.json(reminders);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/reminders', async (req, res) => {
  try {
    const reminder = await supabase('POST', 'reminders', req.body);
    res.json(reminder);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/reminders/:id', async (req, res) => {
  try {
    await supabase('DELETE', 'reminders', null, `?id=eq.${req.params.id}`);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── ROUTE CHAT IA ──
const providers = [
  {
    name: 'Claude (Anthropic)',
    enabled: !!process.env.ANTHROPIC_API_KEY,
    call: async (messages, system) => {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, system, messages })
      });
      if (!res.ok) throw new Error(`Claude: ${res.status}`);
      const data = await res.json();
      return data.content[0].text;
    }
  },
  {
    name: 'Groq (gratuit)',
    enabled: !!process.env.GROQ_API_KEY,
    call: async (messages, system) => {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', max_tokens: 1000, messages: [{ role: 'system', content: system }, ...messages] })
      });
      if (!res.ok) throw new Error(`Groq: ${res.status}`);
      const data = await res.json();
      return data.choices[0].message.content;
    }
  },
  {
    name: 'OpenAI',
    enabled: !!process.env.OPENAI_API_KEY,
    call: async (messages, system) => {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 1000, messages: [{ role: 'system', content: system }, ...messages] })
      });
      if (!res.ok) throw new Error(`OpenAI: ${res.status}`);
      const data = await res.json();
      return data.choices[0].message.content;
    }
  }
];

app.post('/chat', async (req, res) => {
  const { messages, system } = req.body;
  if (!messages || !system) return res.status(400).json({ error: 'Champs requis manquants' });
  const active = providers.filter(p => p.enabled);
  for (const provider of active) {
    try {
      console.log(`Essai: ${provider.name}`);
      const reply = await provider.call(messages, system);
      console.log(`✅ ${provider.name}`);
      return res.json({ reply, provider: provider.name });
    } catch (err) {
      console.warn(`❌ ${provider.name}: ${err.message}`);
    }
  }
  res.status(503).json({ error: 'Tous les services IA sont indisponibles.' });
});

app.listen(PORT, () => {
  console.log(`\n✅ Serveur ARIA démarré sur http://localhost:${PORT}`);
  console.log(`🗄️  Supabase: ${SUPABASE_URL ? 'Connecté' : 'Non configuré'}`);
  providers.forEach(p => console.log(`  ${p.enabled ? '✅' : '❌'} ${p.name}`));
});
