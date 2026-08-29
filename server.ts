import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini client lazily/safely
let genAiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!genAiClient && process.env.GEMINI_API_KEY) {
    genAiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return genAiClient;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Newsletter Subscribers Storage
const SUBSCRIBERS_FILE = path.join(process.cwd(), 'src', 'data', 'subscribers.json');

function getSubscribers() {
  try {
    if (fs.existsSync(SUBSCRIBERS_FILE)) {
      const data = fs.readFileSync(SUBSCRIBERS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading subscribers file:', err);
  }
  return [
    { email: 'cozygamer@example.com', subscribedAt: new Date(Date.now() - 86400000 * 3).toISOString(), source: 'footer_signup' },
    { email: 'decklover@example.com', subscribedAt: new Date(Date.now() - 86400000 * 10).toISOString(), source: 'footer_signup' }
  ];
}

function saveSubscribers(subscribers: any[]) {
  try {
    fs.mkdirSync(path.dirname(SUBSCRIBERS_FILE), { recursive: true });
    fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(subscribers, null, 2));
  } catch (err) {
    console.error('Error saving subscribers file:', err);
  }
}

// Newsletter Subscribe Endpoint
app.post('/api/newsletter/subscribe', (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || typeof email !== 'string' || !email.includes('@') || !email.includes('.')) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid email address.'
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const subscribers = getSubscribers();

    // Check if already subscribed
    const existing = subscribers.find((s: any) => s.email === trimmedEmail);
    if (existing) {
      return res.json({
        success: true,
        alreadySubscribed: true,
        message: "You're already subscribed to Cozy Dispatch! The next recap arrives Friday morning."
      });
    }

    subscribers.push({
      email: trimmedEmail,
      subscribedAt: new Date().toISOString(),
      source: 'footer_signup'
    });
    
    saveSubscribers(subscribers);

    // Simulate an email being sent
    console.log(`[Newsletter] New subscriber added: ${trimmedEmail}. A welcome email has been simulated.`);

    return res.json({
      success: true,
      message: 'Welcome aboard! You are now subscribed to the weekly Cozy Dispatch recap.',
      totalSubscribers: subscribers.length
    });
  } catch (error: any) {
    console.error('Newsletter subscription error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process subscription.'
    });
  }
});

// Subscriber Stats Endpoint
app.get('/api/newsletter/stats', (req, res) => {
  res.json({
    success: true,
    totalSubscribers: getSubscribers().length,
    latestEdition: 'Issue #42: Fields of Mistria Magic & Tiny Glade Zen'
  });
});

// Generate Daily Cozy Indie News Digest
app.post('/api/gemini/daily-briefing', async (req, res) => {
  try {
    const { category, focusTopic } = req.body;
    const ai = getGenAI();

    if (!ai) {
      // Return a rich structured fallback if no key
      return res.json({
        success: true,
        digest: {
          date: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
          headline: `Daily Cozy & Indie Dispatch: ${category ? category.toUpperCase() : 'ALL CATEGORIES'} Edition`,
          greeting: "Welcome to today's cozy edition! Here is your curated roundup of the most relaxing and inspiring indie gaming moments.",
          curatedPicks: [
            {
              gameTitle: "Fields of Mistria",
              highlight: "90s magical anime farming sim expands festival events and heart interactions in recent community updates.",
              vibeTag: "Wholesome Magic"
            },
            {
              gameTitle: "Tiny Glade",
              highlight: "Procedural building sensation celebrates over 20,000 positive reviews for its zero-stress castle crafting.",
              vibeTag: "Zen Architecture"
            },
            {
              gameTitle: "Balatro",
              highlight: "Continues reigning as the premier Steam Deck travel companion with record-setting battery efficiency.",
              vibeTag: "Card Roguelike"
            }
          ],
          industryWhispers: [
            "Indie developers report growing popularity of desktop-friendly idle sims like Rusty's Retirement.",
            "Steam Deck OLED optimizations are driving a renaissance for low-TDP 2D pixel art and cozy narrative adventures.",
            "Wholesome Direct showcase plans indicate an abundance of botanical and culinary simulators slated for 2025."
          ],
          communityVibeCheck: "Warm and contented. Gamers are embracing mindful, low-stress play sessions.",
          aiGenerated: false
        }
      });
    }

    const prompt = `You are the chief editor of "Cozy & Indie Game Dispatch", a warm, witty, and deeply informed publication dedicated to cozy games, wholesome indie titles, simulation games, and Steam Deck optimization.
Generate today's daily briefing for ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.
Focus: ${focusTopic || category || 'Cozy & Indie Gaming Highlights, updates, and relaxing recommendations'}.

Format your response as a JSON object with:
- headline (string: catchy, warm, creative morning headline)
- greeting (string: 1-2 sentence warm morning welcome mentioning tea/coffee/relaxing)
- curatedPicks (array of 3-4 objects, each with { gameTitle: string, highlight: string (1-2 sentences about what's happening or why to play), vibeTag: string (e.g. "Cottagecore Farming", "Deck Verified Masterpiece", "Tactile Zen") })
- industryWhispers (array of 3 interesting short bullet points about upcoming trends, rumors, or developer updates in indie/cozy space)
- communityVibeCheck (string: 1-2 sentence warm summary of how the cozy gaming community is feeling today)
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            headline: { type: Type.STRING },
            greeting: { type: Type.STRING },
            curatedPicks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  gameTitle: { type: Type.STRING },
                  highlight: { type: Type.STRING },
                  vibeTag: { type: Type.STRING },
                },
                required: ['gameTitle', 'highlight', 'vibeTag'],
              },
            },
            industryWhispers: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            communityVibeCheck: { type: Type.STRING },
          },
          required: ['headline', 'greeting', 'curatedPicks', 'industryWhispers', 'communityVibeCheck'],
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({
      success: true,
      digest: {
        ...parsed,
        date: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
        aiGenerated: true
      }
    });
  } catch (error: any) {
    console.error('Error generating daily briefing:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate briefing'
    });
  }
});

// Interactive AI Cozy Vibe Matcher
app.post('/api/gemini/vibe-recommend', async (req, res) => {
  try {
    const { energyLevel, setting, gameplayFocus, timeCommitment, steamDeckRequired, customNotes } = req.body;
    const ai = getGenAI();

    if (!ai) {
      return res.json({
        success: true,
        recommendations: [
          {
            title: "Fields of Mistria",
            tagline: "The perfect romantic magic farming escape",
            matchReason: `Matches your desire for a ${setting || 'farm'} setting with gentle ${gameplayFocus || 'farming'} vibes and complete relaxation.`,
            cozyFactor: 9.8,
            steamDeckFit: "Verified - 60FPS lock with under 6W power draw",
            suggestedActivity: "Spend a relaxing afternoon fishing by the river and tending to magical rainbow chickens."
          },
          {
            title: "Tiny Glade",
            tagline: "Pure tactile building joy with zero stress",
            matchReason: "Gridless castle doodling fits your requested chill energy level perfectly.",
            cozyFactor: 10.0,
            steamDeckFit: "Verified - Intuitive touch and trackpad sculpting",
            suggestedActivity: "Draw an overgrown mossy cottage with climbing roses and a family of sheep."
          },
          {
            title: "Minami Lane",
            tagline: "Wholesome bite-sized Japanese street management",
            matchReason: "Short, satisfying bursts of organizing boba cafes and petting stray cats.",
            cozyFactor: 9.7,
            steamDeckFit: "Verified - Great on gamepad",
            suggestedActivity: "Design the perfect ramen recipe to make your neighborhood elders smile."
          }
        ]
      });
    }

    const prompt = `You are an expert cozy game sommelier. A user is looking for indie/cozy game recommendations based on their current mood and setup:
- Energy Level: ${energyLevel || 'Zen / Gentle'}
- Preferred Setting: ${setting || 'Cozy Village or Nature'}
- Gameplay Focus: ${gameplayFocus || 'Relaxing Crafting / Farming / Building'}
- Time Commitment: ${timeCommitment || 'Flexible'}
- Steam Deck Required: ${steamDeckRequired ? 'YES (must run great on Steam Deck)' : 'Not required'}
- Additional user notes: ${customNotes || 'Looking for something wholesome and low-stress'}

Recommend 3 real indie/cozy/simulation games that fit this exact vibe perfectly.
Provide structured JSON array of recommendations:
- title (string)
- tagline (string)
- matchReason (string, 2 sentences explaining why it fits their vibe)
- cozyFactor (number from 1.0 to 10.0)
- steamDeckFit (string, notes on controls/performance)
- suggestedActivity (string, specific heartwarming in-game activity to try first)
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              tagline: { type: Type.STRING },
              matchReason: { type: Type.STRING },
              cozyFactor: { type: Type.NUMBER },
              steamDeckFit: { type: Type.STRING },
              suggestedActivity: { type: Type.STRING },
            },
            required: ['title', 'tagline', 'matchReason', 'cozyFactor', 'steamDeckFit', 'suggestedActivity'],
          }
        }
      }
    });

    const parsed = JSON.parse(response.text || '[]');
    return res.json({
      success: true,
      recommendations: parsed
    });
  } catch (error: any) {
    console.error('Error generating vibe recommendations:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to match cozy vibes'
    });
  }
});

// AI Patch Note / News Article Summarizer
app.post('/api/gemini/summarize-news', async (req, res) => {
  try {
    const { title, text, type } = req.body;
    const ai = getGenAI();

    if (!ai) {
      return res.json({
        success: true,
        summary: `Key takeaways for ${title}: Major quality of life improvements, enhanced controller and Steam Deck responsiveness, and new content drops to keep gameplay relaxing and rewarding.`,
        bullets: [
          'Performance tuned for seamless handheld play.',
          'Enhanced user interface with cleaner readability and less clutter.',
          'Community-requested balance adjustments integrated.'
        ]
      });
    }

    const prompt = `Summarize the following ${type || 'indie game news article / patch notes'} into a cozy, friendly, 30-second bulleted takeaway.
Title: ${title}
Content: ${text}

Output JSON with:
- summary (string: 2 sentences conversational summary)
- bullets (array of 3-4 concise bullet points explaining what players care about most)
- steamDeckImpact (string: 1 sentence on performance or handheld impact, if applicable)
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            bullets: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            steamDeckImpact: { type: Type.STRING }
          },
          required: ['summary', 'bullets']
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({
      success: true,
      ...parsed
    });
  } catch (error: any) {
    console.error('Error summarizing news:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to summarize'
    });
  }
});

// Vite Middleware for development vs static production serve
async function setupViteMiddleware() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Express 5 / path-to-regexp v8 requires a named wildcard; a bare '*' throws
    // "Missing parameter name at index 1" and crashes the server on startup.
    app.get('/{*splat}', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Cozy Indie Dispatch server running on port ${PORT}`);
  });
}

setupViteMiddleware().catch((err) => {
  console.error('Failed to start server:', err);
});
