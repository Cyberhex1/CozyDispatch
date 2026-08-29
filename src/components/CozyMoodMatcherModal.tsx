import React, { useState } from 'react';
import { Game } from '../types';
import { 
  X, 
  HeartHandshake, 
  Sparkles, 
  Coffee, 
  Tv, 
  Star, 
  ArrowRight, 
  Check, 
  Compass, 
  Gamepad2,
  TreePine,
  Home,
  Waves
} from 'lucide-react';

interface CozyMoodMatcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  allGames: Game[];
  onSelectGame: (game: Game) => void;
}

interface AIRecommendation {
  title: string;
  tagline: string;
  matchReason: string;
  cozyFactor: number;
  steamDeckFit: string;
  suggestedActivity: string;
}

export const CozyMoodMatcherModal: React.FC<CozyMoodMatcherModalProps> = ({
  isOpen,
  onClose,
  allGames,
  onSelectGame
}) => {
  const [energyLevel, setEnergyLevel] = useState<'zen' | 'gentle' | 'active'>('zen');
  const [setting, setSetting] = useState<string>('farm');
  const [gameplayFocus, setGameplayFocus] = useState<string>('farming');
  const [steamDeckRequired, setSteamDeckRequired] = useState<boolean>(true);
  const [customNote, setCustomNote] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [aiResults, setAiResults] = useState<AIRecommendation[] | null>(null);

  if (!isOpen) return null;

  const handleMatchVibe = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/gemini/vibe-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          energyLevel,
          setting,
          gameplayFocus,
          steamDeckRequired,
          customNotes: customNote
        })
      });
      const data = await response.json();
      if (data.success && data.recommendations) {
        setAiResults(data.recommendations);
      } else {
        throw new Error('Fallback needed');
      }
    } catch {
      // Local fallback matches
      setAiResults([
        {
          title: 'Fields of Mistria',
          tagline: '90s anime magic farming with zero stress',
          matchReason: `Matches your desire for a ${setting} setting and relaxing ${gameplayFocus} mechanics.`,
          cozyFactor: 9.8,
          steamDeckFit: 'Verified - 60 FPS locked with gentle battery draw',
          suggestedActivity: 'Tend to colorful magical chickens and fish along the misty riverbank.'
        },
        {
          title: 'Tiny Glade',
          tagline: 'Pure tactile building joy with no fail states',
          matchReason: 'Gridless castle doodling fits your requested chill energy level perfectly.',
          cozyFactor: 10.0,
          steamDeckFit: 'Verified - Intuitive touchscreen & trackpad sculpting',
          suggestedActivity: 'Doodle a mossy cottage with climbing ivy and watch sheep graze.'
        },
        {
          title: 'Balatro',
          tagline: 'Hypnotic indie roguelike card bliss',
          matchReason: 'Perfect for cozy handheld sessions curled up on the couch.',
          cozyFactor: 8.8,
          steamDeckFit: 'Verified - 6+ hours OLED battery life',
          suggestedActivity: 'Test an unorthodox multi-joker poker build at your own leisurely pace.'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFindGameAndOpen = (title: string) => {
    const matched = allGames.find((g) => g.title.toLowerCase().includes(title.toLowerCase()));
    if (matched) {
      onSelectGame(matched);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="relative bg-white text-text-main rounded-3xl border border-border shadow-xl max-w-2xl w-full overflow-hidden my-8">
        {/* Header */}
        <div className="p-6 bg-base border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-brand text-brand border border-brand/30 flex items-center justify-center">
              <HeartHandshake className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h2 className="font-serif-natural text-xl font-normal text-text-heading">
                Cozy Vibe Sommelier
              </h2>
              <p className="text-xs text-text-muted">
                Tell us your mood & setup, and we'll match your ideal relaxing game.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white hover:bg-surface text-text-muted hover:text-text-main transition-colors cursor-pointer border border-border shadow-xs"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[75vh] overflow-y-auto">
          {!aiResults ? (
            <div className="space-y-6">
              {/* Question 1: Energy Level */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold uppercase tracking-wider text-brand block">
                  1. What is your energy level right now?
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'zen', label: 'Maximum Zen ☕', desc: 'No timers, no failure, pure comfort' },
                    { id: 'gentle', label: 'Gentle Wholesome 🌿', desc: 'Farming, town life & mild quests' },
                    { id: 'active', label: 'Playful Indie ⚡', desc: 'Roguelike, strategy or puzzle itch' }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setEnergyLevel(opt.id as any)}
                      className={`p-3 rounded-2xl text-left border transition-all cursor-pointer ${
                        energyLevel === opt.id
                          ? 'bg-surface-brand border-brand text-text-heading ring-1 ring-[#8BA888]/40'
                          : 'bg-base border-border hover:bg-surface text-text-muted'
                      }`}
                    >
                      <div className="font-bold text-xs">{opt.label}</div>
                      <div className="text-[10px] text-text-muted mt-1">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Question 2: Setting / Vibe */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold uppercase tracking-wider text-brand block">
                  2. What setting calls to you?
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'farm', label: 'Pastoral Farm & Valley' },
                    { id: 'castle', label: 'Mossy Castle & Cottage' },
                    { id: 'cafe', label: 'Japanese Street & Cafe' },
                    { id: 'ocean', label: 'Warm Ocean & Roadtrip' }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setSetting(opt.id)}
                      className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                        setting === opt.id
                          ? 'bg-surface-brand border-brand text-text-heading'
                          : 'bg-base border-border hover:bg-surface text-text-muted'
                      }`}
                    >
                      <div className="font-semibold text-xs">{opt.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Question 3: Gameplay Focus */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold uppercase tracking-wider text-brand block">
                  3. What do you feel like doing in-game?
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'farming', label: 'Farming & Decorating' },
                    { id: 'building', label: 'Tactile Creative Building' },
                    { id: 'idle', label: 'Idle Desktop Multitask' },
                    { id: 'puzzle', label: 'Cards & Satisfying Puzzles' }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setGameplayFocus(opt.id)}
                      className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                        gameplayFocus === opt.id
                          ? 'bg-surface-brand border-brand text-text-heading'
                          : 'bg-base border-border hover:bg-surface text-text-muted'
                      }`}
                    >
                      <div className="font-semibold text-xs">{opt.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Steam Deck Toggle */}
              <div className="flex items-center justify-between p-3.5 bg-base rounded-2xl border border-border">
                <div className="flex items-center gap-2.5">
                  <Tv className="w-5 h-5 text-brand" />
                  <div>
                    <div className="text-xs font-bold text-text-heading">Steam Deck Optimization Priority</div>
                    <div className="text-[10px] text-text-muted">Must run great on handheld with great battery life</div>
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={steamDeckRequired}
                  onChange={(e) => setSteamDeckRequired(e.target.checked)}
                  className="w-4 h-4 accent-[#8BA888] cursor-pointer"
                />
              </div>

              {/* Custom prompt note */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted block">
                  Any specific mood requests? (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., 'Had a tiring workday and need something rainy with cute animal characters'"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-base border border-border text-xs sm:text-sm text-text-main placeholder-[#A0A090] focus:outline-hidden focus:border-brand"
                />
              </div>

              {/* Submit */}
              <button
                onClick={handleMatchVibe}
                disabled={isLoading}
                className="w-full py-3.5 rounded-2xl bg-brand hover:bg-brand-hover text-white font-bold text-sm transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>{isLoading ? 'Crafting Your Cozy Pairing...' : 'Find My Perfect Cozy Game'}</span>
              </button>
            </div>
          ) : (
            /* Results View */
            <div className="space-y-5 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-brand">
                    Curated For Your Mood
                  </span>
                  <h3 className="font-serif-natural text-lg font-normal text-text-heading">
                    3 Matches Hand-Picked For You
                  </h3>
                </div>
                <button
                  onClick={() => setAiResults(null)}
                  className="text-xs font-bold text-text-muted hover:text-text-main cursor-pointer"
                >
                  Adjust Mood
                </button>
              </div>

              <div className="space-y-4">
                {aiResults.map((rec, i) => (
                  <div
                    key={i}
                    className="bg-base border border-border rounded-2xl p-4 sm:p-5 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-serif-natural text-base font-normal text-text-heading">
                            {rec.title}
                          </h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-brand text-text-heading border border-brand/30">
                            ★ {rec.cozyFactor}/10
                          </span>
                        </div>
                        <p className="text-xs text-text-muted italic mt-0.5">
                          "{rec.tagline}"
                        </p>
                      </div>

                      <button
                        onClick={() => handleFindGameAndOpen(rec.title)}
                        className="px-3 py-1.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                      >
                        <span>Open Specs</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-xs text-text-muted leading-relaxed">
                      {rec.matchReason}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                      <div className="p-2.5 rounded-xl bg-white border border-border">
                        <strong className="text-brand block text-[10px] uppercase font-bold">First Cozy Activity:</strong>
                        <span className="text-text-muted">{rec.suggestedActivity}</span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-surface-brand border border-brand/40">
                        <strong className="text-text-heading block text-[10px] uppercase font-bold">Handheld Fit:</strong>
                        <span className="text-text-muted">{rec.steamDeckFit}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setAiResults(null)}
                className="w-full py-2.5 rounded-xl bg-surface hover:bg-border text-text-muted font-bold text-xs transition-colors cursor-pointer border border-border"
              >
                Try Another Mood Vibe
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
