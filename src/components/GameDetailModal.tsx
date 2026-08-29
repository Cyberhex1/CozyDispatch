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
      <div className="relative bg-base text-text-main rounded-3xl border border-border shadow-2xl max-w-3xl w-full overflow-hidden my-8">
        {/* Banner image */}
        <div className="relative h-48 sm:h-64 bg-surface">
          <img
            src={game.bannerImage || game.coverImage}
            alt={game.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#FDFBF7] via-[#FDFBF7]/40 to-transparent" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-base/90 hover:bg-base text-text-muted hover:text-text-main transition-colors cursor-pointer border border-border shadow-xs"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Floating Badges */}
          <div className="absolute bottom-4 left-6 flex flex-wrap items-center gap-2">
            <div className="bg-inverse/90 backdrop-blur-xs text-inverse text-xs font-bold px-3 py-1 rounded-full shadow-xs flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 fill-[#E6A07D] text-accent" />
              <span>Cozy Score: {game.cozyScore} / 10</span>
            </div>

            {game.steamDeckStatus === 'Verified' && (
              <div className="bg-surface-brand border border-brand/40 text-text-heading text-xs font-bold px-3 py-1 rounded-full shadow-xs flex items-center gap-1.5">
                <Tv className="w-3.5 h-3.5 text-brand" />
                <span>Deck: Verified 60 FPS</span>
              </div>
            )}

            {game.isOnSale && (
              <div className="bg-accent text-white text-xs font-bold px-3 py-1 rounded-full shadow-xs flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5" />
                <span>-{game.discountPercent}% Off</span>
              </div>
            )}

            {game.isHistoricalLow && (
              <div className="bg-inverse text-white text-xs font-bold px-3 py-1 rounded-full shadow-xs">
                ★ Historical Low
              </div>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Title & Price Bar */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-border pb-5">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="font-serif-natural text-2xl sm:text-3xl font-normal text-text-heading">
                  {game.title}
                </h2>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-surface-brand text-text-heading border border-brand/30">
                  {game.category.toUpperCase()}
                </span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-surface text-text-muted border border-border">
                  {game.storePlatform === 'Both' ? 'Steam & Epic' : game.storePlatform || 'Steam PC'}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-1">
                Developed by <strong className="text-text-heading">{game.developer}</strong> • Published by {game.publisher}
              </p>
            </div>

            <div className="flex items-baseline gap-2 self-start">
              <span className="text-2xl font-bold text-text-heading">
                {game.salePrice || game.price}
              </span>
              {game.originalPrice && game.originalPrice !== game.price && (
                <span className="text-sm text-text-faint line-through">
                  {game.originalPrice}
                </span>
              )}
              {game.demoAvailable && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-surface-brand text-brand border border-brand/30">
                  Free PC Demo
                </span>
              )}
            </div>
          </div>

          {/* Steam Reviews & Playtime Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-surface p-3 rounded-2xl border border-border">
              <div className="text-[10px] uppercase font-bold text-text-muted">Steam Rating</div>
              <div className="text-sm font-bold text-brand mt-0.5 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                {formatRating(game.ratingScore, ' Positive')}
              </div>
              <div className="text-[10px] text-text-faint">{game.totalReviews} Steam reviews</div>
            </div>

            <div className="bg-surface p-3 rounded-2xl border border-border">
              <div className="text-[10px] uppercase font-bold text-text-muted">PC Release Date</div>
              <div className="text-xs font-bold text-text-heading mt-0.5 truncate">{game.releaseDate}</div>
              <div className="text-[10px] text-text-faint capitalize">{game.releaseStatus.replace('_', ' ')}</div>
            </div>

            <div className="bg-surface p-3 rounded-2xl border border-border">
              <div className="text-[10px] uppercase font-bold text-text-muted">Average Playtime</div>
              <div className="text-xs font-bold text-brand mt-0.5">{game.averagePlaytimeHours || '20+ hrs'}</div>
              <div className="text-[10px] text-text-faint">Unrushed pacing</div>
            </div>

            <div className="bg-surface p-3 rounded-2xl border border-border">
              <div className="text-[10px] uppercase font-bold text-text-muted">PC Compatibility</div>
              <div className="text-xs font-bold text-text-heading mt-0.5 truncate">
                {game.steamDeckStatus === 'Verified' ? 'Desktop & Deck OLED' : 'Desktop PC & Laptop'}
              </div>
              <div className="text-[10px] text-text-faint">Cloud saves enabled</div>
            </div>
          </div>

          {/* Full Description */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand">
              Dispatch Overview
            </h3>
            <p className="text-sm text-text-muted leading-relaxed">
              {game.fullDescription}
            </p>
          </div>

          {/* Steam Deck Notes */}
          <div className="bg-surface p-4 rounded-2xl border border-border space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-brand uppercase tracking-wider">
              <Tv className="w-4 h-4 text-brand" />
              <span>Steam Deck Optimization & Controller Experience</span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              {game.steamDeckNotes}
            </p>
          </div>

          {/* Cozy Vibes Tags */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Cozy Characteristics & Aesthetics
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {game.vibes.map((v) => (
                <span
                  key={v}
                  className="text-xs px-3 py-1 rounded-xl bg-surface-brand text-text-heading border border-brand/30 font-medium flex items-center gap-1.5"
                >
                  <Sparkles className="w-3 h-3 text-brand" />
                  {v}
                </span>
              ))}
              {game.tags.map((t) => (
                <span
                  key={t}
                  className="text-xs px-3 py-1 rounded-xl bg-surface text-text-muted border border-border"
                >
                  #{t}
                </span>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onToggleWishlist(game.id)}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-xs ${
                  isWishlisted
                    ? 'bg-accent text-white'
                    : 'bg-surface hover:bg-border text-text-muted border border-border'
                }`}
              >
                <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-white' : ''}`} />
                <span>{isWishlisted ? 'Saved to Wishlist (Alerts Active)' : 'Add to Wishlist & Price Alerts'}</span>
              </button>

              <button
                onClick={handleShare}
                className="p-2.5 rounded-xl bg-surface hover:bg-border text-text-muted transition-colors border border-border cursor-pointer"
                title="Share Game"
              >
                {copied ? <Check className="w-4 h-4 text-brand" /> : <Share2 className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center gap-2">
              {game.epicStoreUrl && (
                <a
                  href={game.epicStoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-surface hover:bg-border text-text-heading font-bold text-xs transition-colors flex items-center gap-1.5 border border-border"
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
