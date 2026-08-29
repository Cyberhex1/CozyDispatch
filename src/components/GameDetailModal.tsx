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
  CheckCheck,
  Calendar
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-6 animate-in fade-in duration-200">
      <div className="relative bg-base text-text-main rounded-3xl border border-border shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden my-2 sm:my-8">
        {/* Banner image */}
        <div className="relative h-40 sm:h-64 bg-surface shrink-0">
          <img
            src={game.bannerImage || game.coverImage}
            alt={game.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-base via-base/40 to-transparent" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 rounded-full bg-base/90 hover:bg-base text-text-muted hover:text-text-main transition-colors cursor-pointer border border-border shadow-xs z-10"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Floating Badges */}
          <div className="absolute bottom-2.5 sm:bottom-4 left-3 sm:left-6 flex flex-wrap items-center gap-1.5 sm:gap-2">
            <div className="bg-inverse/90 backdrop-blur-xs text-text-on-inverse text-[10px] sm:text-xs font-bold px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-xs flex items-center gap-1.5">
              <Star className="w-3 sm:w-3.5 h-3 sm:h-3.5 fill-[#E6A07D] text-accent" />
              <span>Cozy: {game.cozyScore} / 10</span>
            </div>

            {game.steamDeckStatus === 'Verified' && (
              <div className="bg-surface-brand border border-brand/40 text-text-heading text-[10px] sm:text-xs font-bold px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-xs flex items-center gap-1.5">
                <Tv className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-brand" />
                <span>Deck Verified</span>
              </div>
            )}

            {game.isOnSale && (
              <div className="bg-accent text-white text-[10px] sm:text-xs font-bold px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-xs flex items-center gap-1">
                <TrendingDown className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                <span>-{game.discountPercent}%</span>
              </div>
            )}

            {game.isHistoricalLow && (
              <div className="bg-inverse text-text-on-inverse text-[10px] sm:text-xs font-bold px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-xs">
                ★ Historical Low
              </div>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-8 space-y-4 sm:space-y-6 overflow-y-auto">
          {/* Title & Price Bar */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 border-b border-border pb-4 sm:pb-5">
            <div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                <h2 className="font-serif-natural text-xl sm:text-3xl font-normal text-text-heading leading-tight">
                  {game.title}
                </h2>
                <span className="text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full bg-surface-brand text-text-heading border border-brand/30">
                  {game.category.toUpperCase()}
                </span>
                <span className="text-[10px] sm:text-xs font-medium px-2 py-0.5 rounded-md bg-surface text-text-muted border border-border">
                  {game.storePlatform === 'Both' ? 'Steam & Epic' : game.storePlatform || 'Steam PC'}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-1">
                Developed by <strong className="text-text-heading">{game.developer}</strong> • Published by {game.publisher}
              </p>
            </div>

            <div className="flex items-baseline gap-2 self-start sm:self-auto">
              <span className="text-xl sm:text-2xl font-bold text-text-heading">
                {game.salePrice || game.price}
              </span>
              {game.originalPrice && game.originalPrice !== game.price && (
                <span className="text-xs sm:text-sm text-text-faint line-through">
                  {game.originalPrice}
                </span>
              )}
              {game.demoAvailable && (
                <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded bg-surface-brand text-brand border border-brand/30">
                  Free Demo
                </span>
              )}
            </div>
          </div>

          {/* Steam Reviews & Playtime Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="bg-surface p-2.5 sm:p-3 rounded-2xl border border-border">
              <div className="text-[10px] uppercase font-bold text-text-muted">Steam Rating</div>
              <div className="text-xs sm:text-sm font-bold text-brand mt-0.5 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                {formatRating(game.ratingScore, ' Positive')}
              </div>
              <div className="text-[10px] text-text-faint">{game.totalReviews} Steam reviews</div>
            </div>

            <div className="bg-surface p-2.5 sm:p-3 rounded-2xl border border-border">
              <div className="text-[10px] uppercase font-bold text-text-muted">Avg Playtime</div>
              <div className="text-xs sm:text-sm font-bold text-text-heading mt-0.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-text-muted" />
                {game.averagePlaytimeHours} Hours
              </div>
              <div className="text-[10px] text-text-faint">{game.pacing} pace</div>
            </div>

            <div className="bg-surface p-2.5 sm:p-3 rounded-2xl border border-border">
              <div className="text-[10px] uppercase font-bold text-text-muted">Release Date</div>
              <div className="text-xs sm:text-sm font-bold text-text-heading mt-0.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-brand" />
                <span>{game.releaseDate}</span>
              </div>
              <div className="text-[10px] text-text-faint">PC Edition</div>
            </div>

            <div className="bg-surface p-2.5 sm:p-3 rounded-2xl border border-border">
              <div className="text-[10px] uppercase font-bold text-text-muted">Deck Target</div>
              <div className="text-xs sm:text-sm font-bold text-brand mt-0.5 flex items-center gap-1">
                <Tv className="w-3.5 h-3.5" />
                <span>{game.steamDeckStatus}</span>
              </div>
              <div className="text-[10px] text-text-faint truncate">{game.steamDeckNotes || 'Verified'}</div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Curator Dispatch & Overview
            </h4>
            <p className="text-xs sm:text-sm text-text-main leading-relaxed">
              {game.shortDescription}
            </p>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Tags & Cozy Elements
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {game.vibes.map((vibe) => (
                <span
                  key={vibe}
                  className="text-[11px] sm:text-xs px-2.5 sm:px-3 py-1 rounded-xl bg-surface-brand text-text-heading font-medium border border-brand/30"
                >
                  🌿 {vibe}
                </span>
              ))}
              {game.tags.map((t) => (
                <span
                  key={t}
                  className="text-[11px] sm:text-xs px-2.5 sm:px-3 py-1 rounded-xl bg-surface text-text-muted border border-border"
                >
                  #{t}
                </span>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 sm:pt-4 border-t border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onToggleWishlist(game.id)}
                className={`flex-1 sm:flex-none justify-center px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-xs ${
                  isWishlisted
                    ? 'bg-accent text-white'
                    : 'bg-surface hover:bg-border text-text-muted border border-border'
                }`}
              >
                <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-white' : ''}`} />
                <span>{isWishlisted ? 'Saved (Alerts Active)' : 'Add to Wishlist & Alerts'}</span>
              </button>

              <button
                onClick={handleShare}
                className="p-2.5 rounded-xl bg-surface hover:bg-border text-text-muted transition-colors border border-border cursor-pointer shrink-0"
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
                  className="flex-1 sm:flex-none justify-center px-3.5 py-2.5 rounded-xl bg-surface hover:bg-border text-text-heading font-bold text-xs transition-colors flex items-center gap-1.5 border border-border"
                >
                  <span>Epic Games</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}

              <a
                href={game.steamStoreUrl || game.storeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-none justify-center px-4 sm:px-5 py-2.5 rounded-xl bg-[#171a21] hover:bg-[#2a475e] text-white font-bold text-xs sm:text-sm transition-all shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <span>Steam Store</span>
                <ExternalLink className="w-4 h-4 text-white/70" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
