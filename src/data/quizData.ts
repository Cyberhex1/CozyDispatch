import { Game, QuizRecommendationResult, DiscoveryQuizAnswers } from '../types';

export interface QuizQuestionOption {
  id: string;
  label: string;
  description: string;
  iconName: string;
  badge?: string;
  scoreTags: string[];
}

export interface QuizQuestion {
  id: keyof DiscoveryQuizAnswers | 'pacing';
  title: string;
  subtitle: string;
  category: string;
  isMultiSelect?: boolean;
  options: QuizQuestionOption[];
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'genres',
    title: 'What type of cozy PC gaming experience are you craving?',
    subtitle: 'Select one or more themes that speak to your heart.',
    category: 'Theme & Style',
    isMultiSelect: true,
    options: [
      {
        id: 'farming_community',
        label: 'Farming, Magic & Town Romance',
        description: 'Plant seasonal crops, breed magical animals, and build heartwarming relationships.',
        iconName: 'Sprout',
        badge: 'Top Pick',
        scoreTags: ['Farming Sim', 'Farming', 'Town Life', 'Romance', 'Life Sim', 'Animal Breeding']
      },
      {
        id: 'zen_builder',
        label: 'Tactile Architecture & Gridless Building',
        description: 'Doodle romantic castles, mossy cottages, and peaceful village landscapes with zero stress.',
        iconName: 'Castle',
        scoreTags: ['Gridless Builder', 'Atmospheric', 'Pure Sandbox', 'Tile Placement', 'Cozy Castle']
      },
      {
        id: 'deck_strategy',
        label: 'Hypnotic Roguelike & Card Synergy',
        description: 'Engaging turn-based mechanics with crisp audiovisual feedback and chill replayability.',
        iconName: 'Layers',
        badge: 'Addictive',
        scoreTags: ['Roguelike Deckbuilder', 'Strategy', 'Card Roguelike', 'Addictive']
      },
      {
        id: 'idle_companion',
        label: 'Desktop Idle & Casual Multitasking',
        description: 'Runs peacefully at the bottom of your screen while studying, working, or listening to music.',
        iconName: 'Tv',
        scoreTags: ['Idle Farming', 'Bottom Screen', 'Productivity Buddy', 'Bite-Sized']
      },
      {
        id: 'asmr_organizing',
        label: 'Tactile Organization & Room ASMR',
        description: 'Unpack nostalgic items, decorate cozy rooms, and enjoy satisfying sound design.',
        iconName: 'Box',
        scoreTags: ['Organization', 'Narrative Puzzle', 'Decorating', 'No Fail State']
      },
      {
        id: 'exploration_cooking',
        label: 'Ocean Adventure & Cafe Management',
        description: 'Dive deep into mysterious waters by day and serve delicious cuisine by night.',
        iconName: 'Coffee',
        scoreTags: ['Underwater Exploration', 'Sushi Restaurant', 'Ocean Exploration', 'Management']
      }
    ]
  },
  {
    id: 'artStyle',
    title: 'Which visual aesthetic speaks to you most?',
    subtitle: 'Choose the art direction that makes your eyes feel at ease.',
    category: 'Visual Aesthetics',
    isMultiSelect: false,
    options: [
      {
        id: 'anime_pastel',
        label: '90s Shoujo Anime / Pastel Watercolors',
        description: 'Nostalgic cel anime aesthetics reminiscent of vintage classics.',
        iconName: 'Sparkles',
        scoreTags: ['90s Anime', 'Pastel Watercolor', 'Pastel Hand-Drawn', 'Wholesome']
      },
      {
        id: 'tactile_3d',
        label: 'Tactile 3D & Procedural Architecture',
        description: 'Fluid, soft physics with procedural ivy, gentle lighting, and sunny weather.',
        iconName: 'Sun',
        scoreTags: ['Procedural Art', 'Tactile', 'Gridless Builder', 'Atmospheric']
      },
      {
        id: 'pixel_art',
        label: 'Detailed 16-Bit Pixel Art Craft',
        description: 'Meticulously animated sprites, seasonal foliage, and warm pixel lighting.',
        iconName: 'Gamepad2',
        scoreTags: ['Pixel Art', 'Classic', 'Stone Age', 'Multiplayer']
      },
      {
        id: 'retro_crt',
        label: 'Retro CRT Glow & Stylized Card Design',
        description: 'Hypnotic CRT scanlines, neon lo-fi palettes, and tactile card flourishes.',
        iconName: 'Tv',
        scoreTags: ['Retro CRT', 'Hypnotic', 'Lofi Synth']
      }
    ]
  },
  {
    id: 'moodVibe',
    title: 'What emotional mood do you want to immerse in?',
    subtitle: 'Match the state of mind you want your session to cultivate.',
    category: 'Vibe & Atmosphere',
    isMultiSelect: false,
    options: [
      {
        id: 'pure_zen',
        label: 'Pure Zero-Stress Zen (No Failure / No Timers)',
        description: 'Completely unpressured playground where you can never lose or run out of time.',
        iconName: 'Heart',
        scoreTags: ['Zero Stress', 'No Fail State', 'No Combat', 'Pet the Sheep']
      },
      {
        id: 'pastoral_warmth',
        label: 'Heartwarming Pastoral Community & Friendship',
        description: 'Wholesome villagers, lively seasonal festivals, and warm country atmosphere.',
        iconName: 'Users',
        scoreTags: ['Nostalgic Wholesome', 'Warm Community', 'Charming Townsfolk', 'Town Life']
      },
      {
        id: 'quiet_focus',
        label: 'Meditative Focus & Satisfying Flow',
        description: 'Strategic puzzles and tile-snapping where you get lost in thoughtful loops.',
        iconName: 'Compass',
        scoreTags: ['Hexagon Puzzle', 'Satisfying Multipliers', 'Tile Placement', 'Relaxed Pacing']
      },
      {
        id: 'nostalgic_poignant',
        label: 'Gentle Storytelling & Nostalgic Memories',
        description: 'Emotional narratives told through keepsakes, dialogue, and scenic journeys.',
        iconName: 'BookOpen',
        scoreTags: ['Environmental Storytelling', 'Van Life', 'Post-Apocalyptic', 'Narrative']
      }
    ]
  },
  {
    id: 'gameplayMechanics',
    title: 'What gameplay mechanics feel most satisfying to you?',
    subtitle: 'Select the interactive loops you love spending time with.',
    category: 'Interactive Mechanics',
    isMultiSelect: true,
    options: [
      {
        id: 'mech_farming',
        label: 'Planting, Watering & Animal Breeding',
        description: 'Seasonal cycles, tending livestock, and harvesting bountiful produce.',
        iconName: 'Sprout',
        scoreTags: ['Farming Sim', 'Farming', 'Animal Breeding', 'Crafting']
      },
      {
        id: 'mech_building',
        label: 'Customizing, Decorating & Freehand Building',
        description: 'Sculpting structures, placing furniture, and organizing serene spaces.',
        iconName: 'Wrench',
        scoreTags: ['Gridless Builder', 'Decorating', 'Organization', 'Pure Sandbox']
      },
      {
        id: 'mech_social',
        label: 'Dialogue Choices, Gifting & Community Festivals',
        description: 'Befriending unique townsfolk, giving gifts, and attending seasonal events.',
        iconName: 'Heart',
        scoreTags: ['Romance', 'Town Life', 'Community', 'Wholesome NPCs']
      },
      {
        id: 'mech_cards_puzzles',
        label: 'Tile Placement, Card Drafts & Relaxing Puzzles',
        description: 'Satisfying logic, high-score runs, and strategic layout choices.',
        iconName: 'Layers',
        scoreTags: ['Roguelike Deckbuilder', 'Hexagon Puzzle', 'Puzzle Sim', 'Strategy']
      }
    ]
  },
  {
    id: 'handheldPreference',
    title: 'How do you plan to play this PC game?',
    subtitle: 'We feature only PC games and optimize for your preferred setup.',
    category: 'PC Setup',
    isMultiSelect: false,
    options: [
      {
        id: 'steam_deck_priority',
        label: 'Steam Deck Handheld (OLED / LCD)',
        description: 'Prioritize Steam Deck Verified games with great controller support and low battery draw.',
        iconName: 'Tv',
        badge: 'Deck Verified',
        scoreTags: ['Steam Deck', 'Verified']
      },
      {
        id: 'desktop_pc',
        label: 'Desktop / Laptop PC (Keyboard & Mouse / Monitor)',
        description: 'Great for multi-monitor desktop companions, high-res builders, and simulation classics.',
        iconName: 'Monitor',
        scoreTags: ['PC', 'Steam', 'Desktop']
      },
      {
        id: 'any_pc',
        label: 'Flexible (Play on Both Desktop & Handheld)',
        description: 'Love cloud-synced games that switch seamlessly between desktop and handheld PC.',
        iconName: 'Gamepad2',
        scoreTags: ['PC', 'Steam Deck', 'Steam', 'Epic Games']
      }
    ]
  },
  {
    id: 'pricePreference',
    title: 'Are you looking for active deals or budget-friendly titles?',
    subtitle: 'Filter our PC recommendations to suit your spending mood.',
    category: 'Store & Deals',
    isMultiSelect: false,
    options: [
      {
        id: 'any',
        label: 'Show All Games Regardless of Price',
        description: 'Recommend the best matches regardless of current discounts.',
        iconName: 'Tag',
        scoreTags: []
      },
      {
        id: 'on_sale',
        label: 'Prioritize Active Steam & Epic Games Deals',
        description: 'Only highlight games currently discounted on PC stores.',
        iconName: 'Percent',
        badge: 'Deals & Sales',
        scoreTags: ['sale']
      },
      {
        id: 'under_15',
        label: 'Under $15 (Great Value)',
        description: 'Focus on affordable indie gems under $15.',
        iconName: 'DollarSign',
        scoreTags: ['under15']
      },
      {
        id: 'under_10',
        label: 'Under $10 / Budget Sanctuary',
        description: 'Pocket-friendly masterpieces under $10.',
        iconName: 'Coins',
        scoreTags: ['under10']
      }
    ]
  }
];

export function calculateQuizMatches(
  answers: DiscoveryQuizAnswers,
  games: Game[]
): QuizRecommendationResult[] {
  const scored = games.map((game) => {
    let score = 50; // base score
    const matchHighlights: string[] = [];
    let cozyFeatureMatch = '';

    // 1. Genre score match
    const selectedGenreTags: string[] = [];
    QUIZ_QUESTIONS[0].options.forEach((opt) => {
      if (answers.genres.includes(opt.id)) {
        selectedGenreTags.push(...opt.scoreTags);
      }
    });

    const matchedGenreTagCount = game.tags.filter((t) =>
      selectedGenreTags.some((st) => st.toLowerCase() === t.toLowerCase())
    ).length;

    if (matchedGenreTagCount > 0) {
      score += Math.min(25, matchedGenreTagCount * 8);
      matchHighlights.push(`Matches your genre taste (${game.tags.slice(0, 2).join(', ')})`);
    }

    // 2. Art style match
    const artOpt = QUIZ_QUESTIONS[1].options.find((o) => o.id === answers.artStyle);
    if (artOpt) {
      const artMatch = game.tags.some((t) => artOpt.scoreTags.includes(t)) ||
        (game.artStyle && artOpt.scoreTags.some((st) => game.artStyle?.toLowerCase().includes(st.toLowerCase())));
      if (artMatch) {
        score += 15;
        matchHighlights.push(`Aesthetic matches: ${game.artStyle || artOpt.label}`);
      }
    }

    // 3. Mood match
    const moodOpt = QUIZ_QUESTIONS[2].options.find((o) => o.id === answers.moodVibe);
    if (moodOpt) {
      const moodMatch = game.vibes.some((v) =>
        moodOpt.scoreTags.some((st) => v.toLowerCase().includes(st.toLowerCase()))
      ) || (game.primaryMood && moodOpt.scoreTags.some((st) => game.primaryMood?.toLowerCase().includes(st.toLowerCase())));
      if (moodMatch) {
        score += 12;
        matchHighlights.push(`Vibe alignment: ${game.primaryMood || moodOpt.label}`);
      }
    }

    // 4. Gameplay mechanics
    const selectedMechTags: string[] = [];
    QUIZ_QUESTIONS[3].options.forEach((opt) => {
      if (answers.gameplayMechanics.includes(opt.id)) {
        selectedMechTags.push(...opt.scoreTags);
      }
    });
    const matchedMechCount = game.tags.filter((t) =>
      selectedMechTags.some((st) => st.toLowerCase() === t.toLowerCase())
    ).length;
    if (matchedMechCount > 0) {
      score += Math.min(15, matchedMechCount * 6);
    }

    // 5. Handheld / Steam Deck preference
    if (answers.handheldPreference === 'steam_deck_priority') {
      if (game.steamDeckStatus === 'Verified') {
        score += 10;
        matchHighlights.push('Steam Deck Verified (Native controller & 60 FPS)');
      } else if (game.steamDeckStatus === 'Playable') {
        score += 5;
      }
    }

    // 6. Price / Deals preference
    const priceNum = parseFloat(game.price.replace('$', '')) || 0;
    if (answers.pricePreference === 'on_sale') {
      if (game.isOnSale) {
        score += 18;
        matchHighlights.push(`Currently On Sale (${game.discountPercent}% Off on ${game.storePlatform || 'Steam'})`);
      } else {
        score -= 8;
      }
    } else if (answers.pricePreference === 'under_15') {
      if (priceNum <= 15) {
        score += 8;
        matchHighlights.push(`Affordable price point (${game.price})`);
      }
    } else if (answers.pricePreference === 'under_10') {
      if (priceNum <= 10) {
        score += 12;
        matchHighlights.push(`Budget-friendly pick (${game.price})`);
      } else {
        score -= 5;
      }
    }

    // Cozy Score weight
    score += Math.round((game.cozyScore - 8) * 4);

    // Clamp score between 65 and 99
    const finalScore = Math.min(99, Math.max(65, score));

    // Formulate cozy rationale
    cozyFeatureMatch = game.vibes.length > 0 ? game.vibes.slice(0, 3).join(' • ') : game.tags.slice(0, 3).join(' • ');
    const vibeRationale = game.featuredReason || game.shortDescription;

    return {
      game,
      matchScore: finalScore,
      matchHighlights: matchHighlights.slice(0, 3),
      vibeRationale,
      cozyFeatureMatch
    };
  });

  return scored.sort((a, b) => b.matchScore - a.matchScore);
}
