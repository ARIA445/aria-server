const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── PROVIDERS IA (ordre de priorité) ──
// Le serveur essaie chaque provider dans l'ordre
// Si l'un échoue (pas de crédits, erreur), il passe au suivant automatiquement

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
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: system,
          messages: messages
        })
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 1000,
          messages: [{ role: 'system', content: system }, ...messages]
        })
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 1000,
          messages: [{ role: 'system', content: system }, ...messages]
        })
      });
      if (!res.ok) throw new Error(`OpenAI: ${res.status}`);
      const data = await res.json();
      return data.choices[0].message.content;
    }
  }
];

// ── ROUTE PRINCIPALE ──
app.post('/chat', async (req, res) => {
  const { messages, system } = req.body;

  if (!messages || !system) {
    return res.status(400).json({ error: 'Champs messages et system requis' });
  }

  // Essaie chaque provider dans l'ordre
  const activeProviders = providers.filter(p => p.enabled);

  if (activeProviders.length === 0) {
    return res.status(500).json({ error: 'Aucune clé API configurée dans .env' });
  }

  for (const provider of activeProviders) {
    try {
      console.log(`Essai avec : ${provider.name}`);
      const reply = await provider.call(messages, system);
      console.log(`✅ Réponse obtenue via : ${provider.name}`);
      return res.json({ reply, provider: provider.name });
    } catch (err) {
      console.warn(`❌ ${provider.name} a échoué : ${err.message}`);
      // Passe au provider suivant automatiquement
    }
  }

  // Tous les providers ont échoué
  res.status(503).json({ error: 'Tous les services IA sont indisponibles. Vérifie tes clés API.' });
});

// ── STATUT ──
app.get('/status', (req, res) => {
  res.json({
    status: 'ARIA opérationnelle',
    providers: providers.map(p => ({
      name: p.name,
      active: p.enabled
    }))
  });
});

app.listen(PORT, () => {
  console.log(`\nServeur ARIA démarré sur http://localhost:${PORT}`);
  console.log(`Providers actifs :`);
  providers.forEach(p => {
    console.log(`  ${p.enabled ? '✅' : '❌'} ${p.name}`);
  });
  console.log('');
});
