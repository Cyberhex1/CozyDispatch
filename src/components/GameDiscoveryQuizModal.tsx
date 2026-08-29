import React, { useState, useMemo } from 'react';
import { Game, DiscoveryQuizAnswers, QuizRecommendationResult } from '../types';
import { QUIZ_QUESTIONS, calculateQuizMatches } from '../data/quizData';
import { 
  Sparkles, 
  ChevronRight, 
  ChevronLeft, 
  RotateCcw, 
  Check, 
  Heart, 
  ExternalLink, 
  Star, 
  Tv, 
  TrendingDown, 
  ShieldCheck, 
  X,
  Sprout,
  Castle,
  Layers,
  Box,
  Coffee,
  Sun,
  Gamepad2,
  Users,
  Compass,
  BookOpen,
  Wrench,
  Monitor,
  Tag,
  Percent,
  DollarSign,
  Coins
} from 'lucide-react';

interface GameDiscoveryQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  games: Game[];
  onSelectGame: (game: Game) => void;
  onToggleWishlist: (gameId: string) => void;
  isWishlisted: (gameId: string) => boolean;
  onSavePreferencesToProfile?: (preferences: Partial<DiscoveryQuizAnswers>) => void;
}

// Icon helper mapping
const renderQuizIcon = (iconName: string, className = "w-5 h-5") => {
  switch (iconName) {
    case 'Sprout': return <Sprout className={className} />;
    case 'Castle': return <Castle className={className} />;
    case 'Layers': return <Layers className={className} />;
    case 'Box': return <Box className={className} />;
    case 'Coffee': return <Coffee className={className} />;
    case 'Sun': return <Sun className={className} />;
    case 'Gamepad2': return <Gamepad2 className={className} />;
    case 'Users': return <Users className={className} />;
    case 'Compass': return <Compass className={className} />;
    case 'BookOpen': return <BookOpen className={className} />;
    case 'Wrench': return <Wrench className={className} />;
    case 'Monitor': return <Monitor className={className} />;
    case 'Tag': return <Tag className={className} />;
    case 'Percent': return <Percent className={className} />;
    case 'DollarSign': return <DollarSign className={className} />;
    case 'Coins': return <Coins className={className} />;
    case 'Tv': return <Tv className={className} />;
    case 'Sparkles':
    default:
      return <Sparkles className={className} />;
  }
};

const INITIAL_ANSWERS: DiscoveryQuizAnswers = {
  genres: ['farming_community'],
  artStyle: 'anime_pastel',
  moodVibe: 'pure_zen',
  gameplayMechanics: ['mech_farming', 'mech_social'],
  handheldPreference: 'steam_deck_priority',
  pricePreference: 'any'
};

export const GameDiscoveryQuizModal: React.FC<GameDiscoveryQuizModalProps> = ({
  isOpen,
  onClose,
  games,
  onSelectGame,
  onToggleWishlist,
  isWishlisted,
  onSavePreferencesToProfile
}) => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [answers, setAnswers] = useState<DiscoveryQuizAnswers>(INITIAL_ANSWERS);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [savedToProfile, setSavedToProfile] = useState<boolean>(false);

  const recommendations: QuizRecommendationResult[] = useMemo(() => {
    if (!isCompleted) return [];
    return calculateQuizMatches(answers, games || []);
  }, [isCompleted, answers, games]);

  if (!isOpen) return null;

  const currentQuestion = QUIZ_QUESTIONS[currentStep];
  const totalSteps = QUIZ_QUESTIONS.length;

  const handleOptionToggle = (questionId: keyof DiscoveryQuizAnswers, optionId: string, isMulti?: boolean) => {
    if (isMulti) {
      const existing = (answers[questionId] as string[]) || [];
      const updated = existing.includes(optionId)
        ? existing.filter((item) => item !== optionId)
        : [...existing, optionId];
      if (updated.length > 0) {
        setAnswers({ ...answers, [questionId]: updated });
      }
    } else {
      setAnswers({ ...answers, [questionId]: optionId });
    }
  };

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setIsCompleted(true);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleReset = () => {
    setCurrentStep(0);
    setIsCompleted(false);
    setAnswers(INITIAL_ANSWERS);
    setSavedToProfile(false);
  };

  const handleSaveProfile = () => {
    if (onSavePreferencesToProfile) {
      onSavePreferencesToProfile(answers);
      setSavedToProfile(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#FDFBF7] rounded-3xl border border-[#E6E2D3] w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        
        {/* Modal Top Header */}
        <div className="px-6 py-4 border-b border-[#E6E2D3] bg-[#F5F5F0]/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#8BA888]/20 flex items-center justify-center text-[#8BA888]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-serif-natural text-lg font-normal text-[#5A5A40] leading-tight">
                Cozy & Indie PC Discovery Quiz
              </h2>
              <p className="text-[11px] text-[#707060]">
                {isCompleted ? 'Your Tailored PC Recommendations' : `Step ${currentStep + 1} of ${totalSteps} • ${currentQuestion.category}`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#707060] hover:text-[#5A5A40] hover:bg-[#E6E2D3]/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {!isCompleted ? (
            <>
              {/* Step Progress Bar */}
              <div className="space-y-2">
                <div className="w-full bg-[#E6E2D3] h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-[#8BA888] h-full transition-all duration-300 rounded-full"
                    style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-[#707060] font-medium">
                  <span>Question {currentStep + 1} / {totalSteps}</span>
                  <span>{Math.round(((currentStep + 1) / totalSteps) * 100)}% Complete</span>
                </div>
              </div>

              {/* Question Header */}
              <div className="space-y-1">
                <h3 className="font-serif-natural text-xl sm:text-2xl text-[#5A5A40]">
                  {currentQuestion.title}
                </h3>
                <p className="text-xs sm:text-sm text-[#707060]">
                  {currentQuestion.subtitle}
                </p>
              </div>

              {/* Options Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {currentQuestion.options.map((option) => {
                  const isSelected = currentQuestion.isMultiSelect
                    ? ((answers[currentQuestion.id as keyof DiscoveryQuizAnswers] as string[]) || []).includes(option.id)
                    : answers[currentQuestion.id as keyof DiscoveryQuizAnswers] === option.id;

                  return (
                    <button
                      key={option.id}
                      onClick={() => handleOptionToggle(currentQuestion.id as keyof DiscoveryQuizAnswers, option.id, currentQuestion.isMultiSelect)}
                      className={`p-4 rounded-2xl border text-left transition-all relative flex flex-col justify-between gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-[#EBF0EA] border-[#8BA888] ring-2 ring-[#8BA888]/30 shadow-xs'
                          : 'bg-[#FDFBF7] border-[#E6E2D3] hover:border-[#8BA888]/60 hover:bg-[#F5F5F0]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl ${isSelected ? 'bg-[#8BA888] text-white' : 'bg-[#E6E2D3]/60 text-[#5A5A40]'}`}>
                            {renderQuizIcon(option.iconName)}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-[#5A5A40] flex items-center gap-2">
                              <span>{option.label}</span>
                              {option.badge && (
                                <span className="bg-[#E6A07D] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                  {option.badge}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-[#8BA888] border-[#8BA888] text-white' : 'border-[#C4C0B0]'
                        }`}>
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>

                      <p className="text-xs text-[#707060] leading-relaxed">
                        {option.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            /* Results Screen */
            <div className="space-y-6">
              <div className="bg-[#EBF0EA] border border-[#8BA888]/30 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#8BA888]">
                    <Sparkles className="w-4 h-4" />
                    <span>Your Personalized PC Matches</span>
                  </div>
                  <h3 className="font-serif-natural text-xl text-[#5A5A40]">
                    We found {recommendations.length} PC games tailored to your mood!
                  </h3>
                  <p className="text-xs text-[#707060]">
                    Ranked by compatibility with your preferred art style, pacing, and Steam / PC setup.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={handleReset}
                    className="px-3.5 py-2 rounded-xl bg-[#F5F5F0] hover:bg-[#E6E2D3] text-xs font-bold text-[#5A5A40] transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retake Quiz</span>
                  </button>

                  <button
                    onClick={handleSaveProfile}
                    disabled={savedToProfile}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                      savedToProfile
                        ? 'bg-[#8BA888] text-white'
                        : 'bg-[#5A5A40] text-white hover:bg-[#4A4A40]'
                    }`}
                  >
                    {savedToProfile ? <Check className="w-3.5 h-3.5" /> : <Heart className="w-3.5 h-3.5" />}
                    <span>{savedToProfile ? 'Saved to Profile!' : 'Save Taste to Profile'}</span>
                  </button>
                </div>
              </div>

              {/* Recommendations List */}
              <div className="space-y-4">
                {recommendations.slice(0, 4).map((rec, index) => {
                  const game = rec.game;
                  const isWish = isWishlisted(game.id);

                  return (
                    <div
                      key={game.id}
                      className="bg-[#FDFBF7] rounded-2xl border border-[#E6E2D3] hover:border-[#8BA888] p-4 sm:p-5 transition-all flex flex-col sm:flex-row gap-4 sm:items-center justify-between"
                    >
                      <div className="flex items-start gap-4 flex-1">
                        {/* Cover Image */}
                        <div 
                          className="relative w-20 h-24 sm:w-24 sm:h-28 rounded-xl overflow-hidden bg-[#F5F5F0] shrink-0 cursor-pointer shadow-xs"
                          onClick={() => {
                            onClose();
                            onSelectGame(game);
                          }}
                        >
                          <img
                            src={game.coverImage}
                            alt={game.title}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-1 left-1 bg-stone-900/80 text-white font-bold text-[9px] px-1.5 py-0.5 rounded-md">
                            #{index + 1}
                          </div>
                        </div>

                        {/* Details */}
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="bg-[#8BA888] text-white font-bold text-xs px-2.5 py-0.5 rounded-full">
                              {rec.matchScore}% Match
                            </span>

                            {game.isOnSale && (
                              <span className="bg-[#E6A07D] text-white font-bold text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                                <TrendingDown className="w-3 h-3" />
                                -{game.discountPercent}% Sale
                              </span>
                            )}

                            {game.steamDeckStatus === 'Verified' && (
                              <span className="bg-[#EBF0EA] text-[#5A5A40] font-bold text-[10px] px-2 py-0.5 rounded-full border border-[#8BA888]">
                                Deck Verified
                              </span>
                            )}
                          </div>

                          <h4 
                            onClick={() => {
                              onClose();
                              onSelectGame(game);
                            }}
                            className="font-serif-natural text-lg font-normal text-[#5A5A40] hover:text-[#8BA888] transition-colors cursor-pointer"
                          >
                            {game.title}
                          </h4>

                          <p className="text-xs text-[#707060] line-clamp-2">
                            {rec.vibeRationale}
                          </p>

                          {/* Match tags highlights */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {rec.matchHighlights.map((hl, i) => (
                              <span key={i} className="text-[10px] bg-[#F5F5F0] text-[#5A5A40] px-2 py-0.5 rounded-md border border-[#E6E2D3]">
                                ✓ {hl}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Price & Action Buttons */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-[#E6E2D3]">
                        <div className="text-left sm:text-right">
                          <div className="text-base font-bold text-[#5A5A40]">
                            {game.salePrice || game.price}
                          </div>
                          {game.originalPrice && game.originalPrice !== game.price && (
                            <div className="text-[10px] text-[#A0A090] line-through">
                              {game.originalPrice}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onToggleWishlist(game.id)}
                            className={`p-2 rounded-xl transition-all cursor-pointer ${
                              isWish
                                ? 'bg-[#E6A07D] text-white shadow-xs'
                                : 'bg-[#F5F5F0] text-[#707060] hover:text-[#E6A07D]'
                            }`}
                            title={isWish ? 'Wishlisted' : 'Add to Wishlist & Enable Sale Alerts'}
                          >
                            <Heart className={`w-4 h-4 ${isWish ? 'fill-current' : ''}`} />
                          </button>

                          <a
                            href={game.steamStoreUrl || game.storeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-2 rounded-xl bg-[#8BA888] hover:bg-[#7A9977] text-white font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <span>Steam</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer Navigation */}
        {!isCompleted && (
          <div className="px-6 py-4 border-t border-[#E6E2D3] bg-[#F5F5F0]/70 flex items-center justify-between">
            <button
              onClick={handleBack}
              disabled={currentStep === 0}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer ${
                currentStep === 0
                  ? 'text-[#B0B0A0] cursor-not-allowed'
                  : 'text-[#5A5A40] hover:bg-[#E6E2D3]'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <button
              onClick={handleNext}
              className="px-5 py-2.5 rounded-xl bg-[#8BA888] hover:bg-[#7A9977] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <span>{currentStep === totalSteps - 1 ? 'Show My Recommendations' : 'Next Question'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
