import React, { useState } from 'react';
import { Game, CatalogShowcase } from '../types';
import { CATALOG_SHOWCASES } from '../data/catalogsData';
import { formatRating } from '../utils/format';
import { 
  Sparkles, 
  ExternalLink, 
  Star, 
  Tv, 
  Calendar, 
  ShoppingBag, 
  Heart, 
  Tag, 
  Globe, 
  CheckCircle2, 
  Bookmark, 
  Layers, 
  Compass, 
  ArrowRight
} from 'lucide-react';

interface CatalogShowcasesSectionProps {
  games: Game[];
  onSelectGame: (game: Game) => void;
  onToggleWishlist: (gameId: string) => void;
  isWishlisted: (gameId: string) => boolean;
}

export const CatalogShowcasesSection: React.FC<CatalogShowcasesSectionProps> = ({
  games,
  onSelectGame,
  onToggleWishlist,
  isWishlisted
}) => {
  const [activeCatalogId, setActiveCatalogId] = useState<string>('wholesome-direct');

  const activeCatalog = CATALOG_SHOWCASES.find((c) => c.id === activeCatalogId) || CATALOG_SHOWCASES[0];

  // Get games matching active catalog
  const catalogGames = games.filter((g) => {
    if (activeCatalog.highlightGameIds.includes(g.id)) return true;
    if (g.publisherCatalog && g.publisherCatalog.toLowerCase().includes(activeCatalog.name.toLowerCase())) return true;
    if (g.publisher && g.publisher.toLowerCase().includes(activeCatalog.name.toLowerCase())) return true;
    return false;
  });

  return (
    <section className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-10">
      {/* Page Title & Intro */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-border shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-brand/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface text-text-muted text-xs font-semibold uppercase tracking-wider border border-border">
            <Compass className="w-3.5 h-3.5 text-brand" />
            <span>Curated Showcases & Publishers</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#2C2C24] tracking-tight font-serif">
            Indie Catalogs & Publisher Features
          </h1>
          <p className="text-[#505045] text-sm sm:text-base leading-relaxed">
            Explore curated collections from world-renowned showcases and independent publishers including Fellow Traveller, Wholesome Direct, Annapurna Interactive, Raw Fury, Devolver Digital, Team17, Chucklefish, and Hooded Horse.
          </p>
        </div>
      </div>

      {/* Showcase Selection Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-border scrollbar-none">
        {CATALOG_SHOWCASES.map((catalog) => {
          const isActive = catalog.id === activeCatalogId;
          return (
            <button
              key={catalog.id}
              onClick={() => setActiveCatalogId(catalog.id)}
              className={`shrink-0 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer border ${
                isActive
                  ? 'bg-inverse text-white border-[#2C2C24] shadow-xs'
                  : 'bg-white text-text-muted hover:text-[#2C2C24] border-border hover:border-brand'
              }`}
            >
              <span>{catalog.logoBadge || catalog.name}</span>
            </button>
          );
        })}
      </div>

      {/* Featured Active Showcase Header Card */}
      <div className="bg-gradient-to-br from-stone-900 to-stone-800 text-white rounded-3xl overflow-hidden shadow-md border border-stone-700/60 relative">
        <div className="absolute inset-0 opacity-25">
          <img 
            src={activeCatalog.bannerImage} 
            alt={activeCatalog.name} 
            className="w-full h-full object-cover blur-sm"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-900/80 to-transparent" />

        <div className="relative z-10 p-6 sm:p-10 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="px-3 py-1 rounded-full bg-brand/20 text-[#A3C2A0] text-xs font-bold border border-brand/30">
                Est. {activeCatalog.establishedYear} • {activeCatalog.catalogCount}+ Featured Titles
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold font-serif text-white pt-2">
                {activeCatalog.name}
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <a
                href={activeCatalog.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/20 flex items-center gap-2 backdrop-blur-xs"
              >
                <Globe className="w-4 h-4 text-brand" />
                <span>Official Site</span>
                <ExternalLink className="w-3.5 h-3.5 text-white/70" />
              </a>

              <a
                href={activeCatalog.steamPublisherUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-[#171a21] hover:bg-[#2a475e] text-white text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer border border-white/10"
              >
                <ShoppingBag className="w-4 h-4 text-[#66c0f4]" />
                <span>Steam Publisher Page</span>
                <ExternalLink className="w-3.5 h-3.5 text-white/70" />
              </a>
            </div>
          </div>

          <p className="text-stone-300 text-sm sm:text-base leading-relaxed max-w-3xl">
            {activeCatalog.description}
          </p>

          <div className="bg-stone-900/80 p-4 rounded-2xl border border-stone-700/80 text-xs sm:text-sm text-stone-200 italic flex items-start gap-3">
            <span className="text-amber-400 font-serif text-2xl leading-none">“</span>
            <span>{activeCatalog.curatorQuote}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-xs text-stone-400 font-semibold mr-2">Featured Tags:</span>
            {activeCatalog.featuredTags.map((tag) => (
              <span 
                key={tag}
                className="px-2.5 py-1 rounded-lg bg-stone-800/90 text-stone-300 text-xs font-medium border border-stone-700"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Catalog Game Grid */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold text-[#2C2C24] font-serif">
            {activeCatalog.name} Titles on Steam
          </h3>
          <span className="text-xs font-bold text-text-muted bg-white px-3 py-1.5 rounded-xl border border-border">
            {catalogGames.length} Games Shown
          </span>
        </div>

        {catalogGames.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-border space-y-3">
            <p className="text-[#505045] font-medium">No titles matched for this showcase in current filter view.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {catalogGames.map((game) => {
              const isWish = isWishlisted(game.id);

              return (
                <div
                  key={game.id}
                  className="group bg-white rounded-2xl overflow-hidden border border-border hover:border-brand shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    {/* Cover Header Image */}
                    <div className="relative aspect-video overflow-hidden bg-stone-900">
                      <img 
                        src={game.coverImage} 
                        alt={game.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      />

                      {/* Wishlist Button Overlay */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleWishlist(game.id);
                        }}
                        className={`absolute top-3 right-3 p-2 rounded-full transition-all cursor-pointer ${
                          isWish 
                            ? 'bg-rose-500 text-white shadow-md scale-110' 
                            : 'bg-black/60 hover:bg-black/80 text-white/90 backdrop-blur-xs'
                        }`}
                        title={isWish ? 'Remove from Wishlist' : 'Add to Wishlist'}
                      >
                        <Heart className={`w-4 h-4 ${isWish ? 'fill-current' : ''}`} />
                      </button>

                      {/* Release Status & Category Badges */}
                      <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-stone-900/85 text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-xs border border-white/20">
                          {game.category}
                        </span>
                      </div>

                      {/* Bottom Right: Release Date */}
                      <div className="absolute bottom-3 right-3 bg-black/85 backdrop-blur-xs text-inverse text-xs font-bold px-2.5 py-1 rounded-lg shadow-xs flex items-center gap-1.5 border border-white/20">
                        <Calendar className="w-3.5 h-3.5 text-brand" />
                        <span>{game.releaseDate}</span>
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 
                            onClick={() => onSelectGame(game)}
                            className="text-lg font-bold text-[#2C2C24] group-hover:text-[#4A6B47] transition-colors font-serif cursor-pointer"
                          >
                            {game.title}
                          </h4>
                          <p className="text-xs text-text-muted">
                            by <span className="font-semibold text-[#505045]">{game.developer}</span>
                          </p>
                        </div>

                        {/* Rating % */}
                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface border border-border">
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          <span className="text-xs font-bold text-[#2C2C24]">{formatRating(game.ratingScore)}</span>
                        </div>
                      </div>

                      <p className="text-xs text-[#505045] line-clamp-2 leading-relaxed">
                        {game.shortDescription}
                      </p>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {game.tags.slice(0, 3).map((tag) => (
                          <span 
                            key={tag}
                            className="px-2 py-0.5 rounded-md bg-surface text-text-muted text-[10px] font-medium border border-border"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="px-5 py-4 bg-[#FAF9F5] border-t border-border flex items-center justify-between">
                    <div>
                      <span className="text-xs font-extrabold text-[#2C2C24] block">
                        {game.price}
                      </span>
                      {game.steamDeckStatus === 'Verified' && (
                        <span className="text-[10px] font-bold text-[#4A6B47] flex items-center gap-1 mt-0.5">
                          <Tv className="w-3 h-3" />
                          <span>Deck Verified</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onSelectGame(game)}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-surface text-[#2C2C24] text-xs font-bold transition-all border border-border cursor-pointer"
                      >
                        Details
                      </button>

                      <a
                        href={game.steamStoreUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-[#171a21] hover:bg-[#2a475e] text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <ShoppingBag className="w-3.5 h-3.5 text-[#66c0f4]" />
                        <span>Steam</span>
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
