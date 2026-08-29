import React from 'react';
import { Game, GameCategory } from '../types';
import { formatRating } from '../utils/format';
import { 
  Coffee, 
  Sparkles, 
  Layers, 
  Tv, 
  Ghost, 
  UtensilsCrossed, 
  Briefcase, 
  Truck, 
  BookOpen, 
  Dices, 
  Sprout, 
  Puzzle as PuzzleIcon, 
  ArrowRight,
  Star,
  CheckCircle2,
  Gamepad2
} from 'lucide-react';

interface CategoriesSectionProps {
  games: Game[];
  onSelectCategory: (category: GameCategory) => void;
  onSelectGame: (game: Game) => void;
}

interface CategoryConfig {
  id: GameCategory;
  name: string;
  tagline: string;
  description: string;
  icon: typeof Coffee;
  accentColor: string;
  badge: string;
  topTags: string[];
}

const CATEGORY_CONFIGS: CategoryConfig[] = [
  {
    id: 'cozy',
    name: 'Cozy & Wholesome',
    tagline: 'Warm, low-stress worlds filled with gentle routine and heart.',
    description: 'Farming, cottagecore, wholesome town life, gentle crafting, and heartwarming relationships with no stressful death penalties.',
    icon: Coffee,
    accentColor: 'from-[#8BA888]/20 to-[#8BA888]/5 text-[#4A6B47] border-brand/30',
    badge: 'Trending',
    topTags: ['Farming Sim', 'Pastoral', 'Wholesome', 'Cute', 'Life Sim']
  },
  {
    id: 'indie',
    name: 'Indie Gems',
    tagline: 'Passionate artistic vision, original mechanics, and soul.',
    description: 'Inventive art directions, emotional storytelling, unique gameplay mechanics, and groundbreaking independent design on Steam.',
    icon: Sparkles,
    accentColor: 'from-amber-500/20 to-amber-500/5 text-amber-800 border-amber-500/30',
    badge: 'Hot Hits',
    topTags: ['Artistic', 'Original Soundtrack', 'Story Rich', 'Atmospheric']
  },
  {
    id: 'simulation',
    name: 'Simulation & Sandbox',
    tagline: 'Tactile builders, gridless toys, and organic sandboxes.',
    description: 'Gridless castle building, medieval management, ecology sandboxes, and relaxing physics toys designed for immersive creative flow.',
    icon: Layers,
    accentColor: 'from-blue-500/20 to-blue-500/5 text-blue-800 border-blue-500/30',
    badge: 'Popular',
    topTags: ['Gridless Builder', 'Physics', 'Sandbox', 'Management', 'Resource-Free']
  },
  {
    id: 'steam-deck',
    name: 'Steam Deck Handhelds',
    tagline: 'Locked 60 FPS performance, low TDP, and native controller support.',
    description: 'Curated handheld PC champions optimized for the Steam Deck display, long battery life, and comfortable trackpad/joystick controls.',
    icon: Tv,
    accentColor: 'from-teal-500/20 to-teal-500/5 text-teal-800 border-teal-500/30',
    badge: 'Verified',
    topTags: ['60 FPS', 'Low TDP', 'Trackpad Ready', 'Sleep/Resume']
  },
  {
    id: 'horror',
    name: 'Indie Horror & Mystery',
    tagline: 'Atmospheric chills, creepy investigations, and co-op panics.',
    description: 'Paranormal investigations, eldritch fishing mystery, industrial scavenger horror, and tense psychological thrillers.',
    icon: Ghost,
    accentColor: 'from-rose-500/20 to-rose-500/5 text-rose-800 border-rose-500/30',
    badge: 'Spooky',
    topTags: ['Co-op Horror', 'Eldritch', 'Psychological', 'Proximity Chat']
  },
  {
    id: 'cooking',
    name: 'Cozy Cooking & Cafes',
    tagline: 'Satisfying recipes, potion brewing, and culinary magic.',
    description: 'Master intricate recipes, manage bustling restaurants, alchemy potion brewing, and serve happy customers in charming cafes.',
    icon: UtensilsCrossed,
    accentColor: 'from-orange-500/20 to-orange-500/5 text-orange-800 border-orange-500/30',
    badge: 'Delicious',
    topTags: ['Cooking Sim', 'Restaurant', 'Potion Brewing', 'Recipe Crafting']
  },
  {
    id: 'job-sim',
    name: 'Job & Career Simulators',
    tagline: 'Oddly satisfying cleaning, card shops, and storekeeping.',
    description: 'Powerwashing dirt away, organizing supermarket shelves, running card game shops, and crafting custom sticker orders.',
    icon: Briefcase,
    accentColor: 'from-emerald-500/20 to-emerald-500/5 text-emerald-800 border-emerald-500/30',
    badge: 'Satisfying',
    topTags: ['Store Management', 'Cleaning Zen', 'Sticker Shop', 'Organization']
  },
  {
    id: 'driving-sim',
    name: 'Driving & Vehicle Sims',
    tagline: 'Scenic highway hauls, atmospheric road trips, and tuning.',
    description: 'Relaxing long-haul trucking across Europe, surreal survival road trips through anomaly zones, and off-road exploration.',
    icon: Truck,
    accentColor: 'from-cyan-500/20 to-cyan-500/5 text-cyan-800 border-cyan-500/30',
    badge: 'Cruising',
    topTags: ['Trucking', 'Survival Roadtrip', 'Radio Tunes', 'Atmospheric']
  },
  {
    id: 'rpg',
    name: 'RPGs & Story-Rich',
    tagline: 'Deep character decisions, worldbuilding, and romance.',
    description: 'Atmospheric narrative roleplaying, choices that alter fates, ancient magic, romance options, and unforgettable character arcs.',
    icon: BookOpen,
    accentColor: 'from-purple-500/20 to-purple-500/5 text-purple-800 border-purple-500/30',
    badge: 'Deep Story',
    topTags: ['Choices Matter', 'Sci-Fi RPG', '90s Anime', 'Character Rich']
  },
  {
    id: 'roguelike',
    name: 'Roguelikes & Deckbuilders',
    tagline: 'Hypnotic combos, joker synergies, and strategic depth.',
    description: 'Poker roguelikes, illegal card combos, cult colony management, and infinite tactical replayability with chill soundtracks.',
    icon: Dices,
    accentColor: 'from-indigo-500/20 to-indigo-500/5 text-indigo-800 border-indigo-500/30',
    badge: 'Addictive',
    topTags: ['Deckbuilder', 'Combo Mechanics', 'Proc Generation', 'Jokers']
  },
  {
    id: 'farming',
    name: 'Farming & Life Sims',
    tagline: 'Seasonal crops, breeding genetics, and community restoration.',
    description: 'Plant fields, raise whimsical livestock, repair ancient towns, attend seasonal festivals, and forge lifelong friendships.',
    icon: Sprout,
    accentColor: 'from-lime-500/20 to-lime-500/5 text-lime-800 border-lime-500/30',
    badge: 'Classic',
    topTags: ['Crops', 'Livestock', 'Breeding Genetics', 'Town Life']
  },
  {
    id: 'puzzle',
    name: 'Puzzle & Organization',
    tagline: 'Mindful sorting, unpacking boxes, and spatial zen.',
    description: 'Unpacking life stories from cardboard boxes, tidying cozy rooms, connecting hexagonal tile landscapes, and spatial organization.',
    icon: PuzzleIcon,
    accentColor: 'from-fuchsia-500/20 to-fuchsia-500/5 text-fuchsia-800 border-fuchsia-500/30',
    badge: 'Mindful',
    topTags: ['Unpacking', 'Spatial Sorting', 'Relaxing', 'No Timers']
  }
];

export const CategoriesSection: React.FC<CategoriesSectionProps> = ({
  games,
  onSelectCategory,
  onSelectGame
}) => {
  return (
    <section className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-10">
      {/* Section Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-border shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-brand/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface text-text-muted text-xs font-semibold uppercase tracking-wider border border-border">
            <Gamepad2 className="w-3.5 h-3.5 text-brand" />
            <span>Genre Explorer</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#2C2C24] tracking-tight font-serif">
            Steam Relative Categories
          </h1>
          <p className="text-[#505045] text-sm sm:text-base leading-relaxed">
            Explore carefully curated categories spanning cozy farming, gridless builders, handheld Steam Deck staples, atmospheric horror, job simulators, and narrative RPGs on Steam.
          </p>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {CATEGORY_CONFIGS.map((cat) => {
          // Get games in this category
          const categoryGames = games.filter((g) => {
            if (cat.id === 'steam-deck') return g.steamDeckStatus === 'Verified';
            return g.category === cat.id;
          });

          const totalGames = categoryGames.length;
          const topGame = categoryGames.sort((a, b) => b.ratingScore - a.ratingScore)[0];
          const Icon = cat.icon;

          return (
            <div 
              key={cat.id}
              className="group bg-white rounded-2xl p-6 border border-border hover:border-brand shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between relative overflow-hidden"
            >
              <div className="space-y-4">
                {/* Header row */}
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-2xl bg-gradient-to-br ${cat.accentColor} border shadow-xs`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-surface text-text-muted text-xs font-bold border border-border">
                    {cat.badge}
                  </span>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-[#2C2C24] group-hover:text-[#4A6B47] transition-colors font-serif">
                    {cat.name}
                  </h3>
                  <p className="text-xs text-text-muted mt-1 font-medium">
                    {cat.tagline}
                  </p>
                </div>

                <p className="text-xs text-[#505045] leading-relaxed">
                  {cat.description}
                </p>

                {/* Top tags */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {cat.topTags.map((tag) => (
                    <span 
                      key={tag}
                      className="px-2 py-0.5 rounded-md bg-surface text-[#505045] text-[11px] font-medium border border-border"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                {/* Featured games thumbnails preview */}
                {categoryGames.length > 0 && (
                  <div className="pt-2 border-t border-border/60 space-y-2">
                    <div className="flex items-center justify-between text-xs text-text-muted">
                      <span className="font-semibold text-[#2C2C24]">Featured Titles:</span>
                      <span className="font-bold text-brand">{totalGames} Games</span>
                    </div>
                    
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                      {categoryGames.slice(0, 4).map((g) => (
                        <button
                          key={g.id}
                          onClick={() => onSelectGame(g)}
                          title={`${g.title} (${formatRating(g.ratingScore, ' Positive')})`}
                          className="shrink-0 relative group/thumb overflow-hidden rounded-lg border border-border hover:border-brand transition-all cursor-pointer"
                        >
                          <img 
                            src={g.coverImage} 
                            alt={g.title}
                            className="w-16 h-9 object-cover group-hover/thumb:scale-105 transition-transform duration-300" 
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                            <Star className="w-3 h-3 text-amber-300 fill-amber-300" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="pt-5 mt-4 border-t border-border/60 flex items-center justify-between">
                {topGame ? (
                  <div className="text-xs text-text-muted">
                    <span className="text-[10px] uppercase tracking-wider text-text-alt block">Top Rated</span>
                    <span className="font-bold text-[#2C2C24] truncate max-w-[130px] block">{topGame.title}</span>
                  </div>
                ) : (
                  <span className="text-xs text-text-alt">Explore Catalog</span>
                )}

                <button
                  onClick={() => onSelectCategory(cat.id)}
                  className="px-4 py-2 rounded-xl bg-inverse hover:bg-[#4A6B47] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Browse {totalGames}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
