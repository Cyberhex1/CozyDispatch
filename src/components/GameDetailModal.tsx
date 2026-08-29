import React, { useState } from 'react';
import { Game } from '../types';
import { formatRating } from '../utils/format';
import { 
  X, 
  Tv, 
  Star, 
  Heart, 
  ExternalLink, 
  Tag, 
  ShieldCheck, 
  Sparkles, 
  Check, 
  Share2,
  Clock,
  TrendingDown,
  Percent,
  Bell,
  CheckCheck
} from 'lucide-react';

interface GameDetailModalProps {
  game: Game | null;
  onClose: () => void;
  onToggleWishlist: (gameId: string) => void;
  isWishlisted: boolean;
}

export const GameDetailModal: React.FC<GameDetailModalProps> = ({
  game,
  onClose,
  onToggleWishlist,
  isWishlisted
}) => {
  const [copied, setCopied] = useState(false);

  if (!game) return null;

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="relative bg-[#FDFBF7] text-[#4A4A40] rounded-3xl border border-[#E6E2D3] shadow-2xl max-w-3xl w-full overflow-hidden my-8">
        {/* Banner image */}
        <div className="relative h-48 sm:h-64 bg-[#F5F5F0]">
          <img
            src={game.bannerImage || game.coverImage}
            alt={game.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#FDFBF7] via-[#FDFBF7]/40 to-transparent" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/90 hover:bg-white text-[#707060] hover:text-[#4A4A40] transition-colors cursor-pointer border border-[#E6E2D3] shadow-xs"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Floating Badges */}
          <div className="absolute bottom-4 left-6 flex flex-wrap items-center gap-2">
            <div className="bg-[#5A5A40]/90 backdrop-blur-xs text-[#FDFBF7] text-xs font-bold px-3 py-1 rounded-full shadow-xs flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 fill-[#E6A07D] text-[#E6A07D]" />
              <span>Cozy Score: {game.cozyScore} / 10</span>
            </div>

            {game.steamDeckStatus === 'Verified' && (
              <div className="bg-[#EBF0EA] border border-[#8BA888]/40 text-[#5A5A40] text-xs font-bold px-3 py-1 rounded-full shadow-xs flex items-center gap-1.5">
                <Tv className="w-3.5 h-3.5 text-[#8BA888]" />
                <span>Deck: Verified 60 FPS</span>
              </div>
            )}

            {game.isOnSale && (
              <div className="bg-[#E6A07D] text-white text-xs font-bold px-3 py-1 rounded-full shadow-xs flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5" />
                <span>-{game.discountPercent}% Off</span>
              </div>
            )}

            {game.isHistoricalLow && (
              <div className="bg-[#5A5A40] text-white text-xs font-bold px-3 py-1 rounded-full shadow-xs">
                ★ Historical Low
              </div>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Title & Price Bar */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#E6E2D3] pb-5">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="font-serif-natural text-2xl sm:text-3xl font-normal text-[#5A5A40]">
                  {game.title}
                </h2>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#EBF0EA] text-[#5A5A40] border border-[#8BA888]/30">
                  {game.category.toUpperCase()}
                </span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-[#F5F5F0] text-[#707060] border border-[#E6E2D3]">
                  {game.storePlatform === 'Both' ? 'Steam & Epic' : game.storePlatform || 'Steam PC'}
                </span>
              </div>
              <p className="text-xs text-[#707060] mt-1">
                Developed by <strong className="text-[#5A5A40]">{game.developer}</strong> • Published by {game.publisher}
              </p>
            </div>

            <div className="flex items-baseline gap-2 self-start">
              <span className="text-2xl font-bold text-[#5A5A40]">
                {game.salePrice || game.price}
              </span>
              {game.originalPrice && game.originalPrice !== game.price && (
                <span className="text-sm text-[#A0A090] line-through">
                  {game.originalPrice}
                </span>
              )}
              {game.demoAvailable && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[#EBF0EA] text-[#8BA888] border border-[#8BA888]/30">
                  Free PC Demo
                </span>
              )}
            </div>
          </div>

          {/* Steam Reviews & Playtime Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#F5F5F0] p-3 rounded-2xl border border-[#E6E2D3]">
              <div className="text-[10px] uppercase font-bold text-[#707060]">Steam Rating</div>
              <div className="text-sm font-bold text-[#8BA888] mt-0.5 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                {formatRating(game.ratingScore, ' Positive')}
              </div>
              <div className="text-[10px] text-[#A0A090]">{game.totalReviews} Steam reviews</div>
            </div>

            <div className="bg-[#F5F5F0] p-3 rounded-2xl border border-[#E6E2D3]">
              <div className="text-[10px] uppercase font-bold text-[#707060]">PC Release Date</div>
              <div className="text-xs font-bold text-[#5A5A40] mt-0.5 truncate">{game.releaseDate}</div>
              <div className="text-[10px] text-[#A0A090] capitalize">{game.releaseStatus.replace('_', ' ')}</div>
            </div>

            <div className="bg-[#F5F5F0] p-3 rounded-2xl border border-[#E6E2D3]">
              <div className="text-[10px] uppercase font-bold text-[#707060]">Average Playtime</div>
              <div className="text-xs font-bold text-[#8BA888] mt-0.5">{game.averagePlaytimeHours || '20+ hrs'}</div>
              <div className="text-[10px] text-[#A0A090]">Unrushed pacing</div>
            </div>

            <div className="bg-[#F5F5F0] p-3 rounded-2xl border border-[#E6E2D3]">
              <div className="text-[10px] uppercase font-bold text-[#707060]">PC Compatibility</div>
              <div className="text-xs font-bold text-[#5A5A40] mt-0.5 truncate">
                {game.steamDeckStatus === 'Verified' ? 'Desktop & Deck OLED' : 'Desktop PC & Laptop'}
              </div>
              <div className="text-[10px] text-[#A0A090]">Cloud saves enabled</div>
            </div>
          </div>

          {/* Full Description */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#8BA888]">
              Dispatch Overview
            </h3>
            <p className="text-sm text-[#707060] leading-relaxed">
              {game.fullDescription}
            </p>
          </div>

          {/* Steam Deck Notes */}
          <div className="bg-[#F5F5F0] p-4 rounded-2xl border border-[#E6E2D3] space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#8BA888] uppercase tracking-wider">
              <Tv className="w-4 h-4 text-[#8BA888]" />
              <span>Steam Deck Optimization & Controller Experience</span>
            </div>
            <p className="text-xs text-[#707060] leading-relaxed">
              {game.steamDeckNotes}
            </p>
          </div>

          {/* Cozy Vibes Tags */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#707060]">
              Cozy Characteristics & Aesthetics
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {game.vibes.map((v) => (
                <span
                  key={v}
                  className="text-xs px-3 py-1 rounded-xl bg-[#EBF0EA] text-[#5A5A40] border border-[#8BA888]/30 font-medium flex items-center gap-1.5"
                >
                  <Sparkles className="w-3 h-3 text-[#8BA888]" />
                  {v}
                </span>
              ))}
              {game.tags.map((t) => (
                <span
                  key={t}
                  className="text-xs px-3 py-1 rounded-xl bg-[#F5F5F0] text-[#707060] border border-[#E6E2D3]"
                >
                  #{t}
                </span>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-[#E6E2D3] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onToggleWishlist(game.id)}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-xs ${
                  isWishlisted
                    ? 'bg-[#E6A07D] text-white'
                    : 'bg-[#F5F5F0] hover:bg-[#E6E2D3] text-[#707060] border border-[#E6E2D3]'
                }`}
              >
                <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-white' : ''}`} />
                <span>{isWishlisted ? 'Saved to Wishlist (Alerts Active)' : 'Add to Wishlist & Price Alerts'}</span>
              </button>

              <button
                onClick={handleShare}
                className="p-2.5 rounded-xl bg-[#F5F5F0] hover:bg-[#E6E2D3] text-[#707060] transition-colors border border-[#E6E2D3] cursor-pointer"
                title="Share Game"
              >
                {copied ? <Check className="w-4 h-4 text-[#8BA888]" /> : <Share2 className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center gap-2">
              {game.epicStoreUrl && (
                <a
                  href={game.epicStoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-[#F5F5F0] hover:bg-[#E6E2D3] text-[#5A5A40] font-bold text-xs transition-colors flex items-center gap-1.5 border border-[#E6E2D3]"
                >
                  <span>Epic Games</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}

              <a
                href={game.steamStoreUrl || game.storeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-xl bg-[#171a21] hover:bg-[#2a475e] text-white font-bold text-xs sm:text-sm transition-all shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <span>View on Steam Store</span>
                <ExternalLink className="w-4 h-4 text-white/70" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
