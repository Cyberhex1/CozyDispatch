import React, { useState } from 'react';
import { NewsArticle } from '../types';
import { 
  X, 
  ExternalLink, 
  Bookmark, 
  Check, 
  Sparkles, 
  Clock, 
  Share2, 
  Calendar, 
  Tag, 
  BookOpen,
  ArrowUpRight
} from 'lucide-react';

interface ArticleDetailModalProps {
  article: NewsArticle | null;
  onClose: () => void;
  onBookmark: (articleId: string) => void;
  isBookmarked: boolean;
}

export const ArticleDetailModal: React.FC<ArticleDetailModalProps> = ({
  article,
  onClose,
  onBookmark,
  isBookmarked
}) => {
  const [copied, setCopied] = useState(false);

  if (!article) return null;

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="relative bg-white text-text-main rounded-3xl border border-border shadow-xl max-w-3xl w-full overflow-hidden my-8">
        {/* Header Image */}
        <div className="relative h-52 sm:h-64 bg-surface">
          <img
            src={article.imageUrl}
            alt={article.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/40 to-transparent" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/80 hover:bg-white text-text-muted hover:text-text-main transition-colors cursor-pointer border border-border shadow-xs"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Outlet Badge & Read Time */}
          <div className="absolute bottom-4 left-6 flex items-center gap-2">
            <span className="bg-brand text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-md shadow-xs">
              {article.source} Coverage
            </span>
            <span className="bg-[#5A5A40]/80 backdrop-blur-xs text-inverse text-xs font-medium px-2.5 py-1 rounded-md flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-inverse" />
              <span>{article.readTimeMinutes} min read</span>
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 space-y-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-text-muted mb-2">
              <Calendar className="w-3.5 h-3.5" />
              <span>Published {article.publishedAt}</span>
              <span>•</span>
              <span>By {article.author}</span>
            </div>

            <h2 className="font-serif-natural text-2xl sm:text-3xl font-normal text-text-heading leading-tight">
              {article.title}
            </h2>
          </div>

          {/* 30-Second Takeaways */}
          <div className="bg-base border border-border rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-text-heading uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-brand" />
              <span>Cozy Dispatch Quick Takeaways</span>
            </div>
            <ul className="space-y-2 text-xs sm:text-sm text-text-muted">
              {article.takeaways.map((t, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-brand font-bold mt-0.5">•</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Full Article Content */}
          <div className="space-y-4 text-sm sm:text-base text-text-muted leading-relaxed border-t border-border pt-5">
            <p className="font-medium text-text-main text-base sm:text-lg">
              {article.summary}
            </p>
            <p>
              {article.content}
            </p>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 pt-2">
            {article.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2.5 py-1 rounded-lg bg-surface text-text-muted border border-border"
              >
                #{tag}
              </span>
            ))}
          </div>

          {/* Actions & Attribution */}
          <div className="pt-5 border-t border-border flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onBookmark(article.id)}
                className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
                  isBookmarked
                    ? 'bg-accent/20 text-text-heading border border-[#E6A07D]/50'
                    : 'bg-surface hover:bg-border text-text-muted border border-border'
                }`}
              >
                <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-[#E6A07D] text-accent' : ''}`} />
                <span>{isBookmarked ? 'Article Saved' : 'Save Article'}</span>
              </button>

              <button
                onClick={handleShare}
                className="p-2 rounded-xl bg-surface hover:bg-border text-text-muted hover:text-text-main transition-colors cursor-pointer border border-border"
                title="Share Article"
              >
                {copied ? <Check className="w-4 h-4 text-brand" /> : <Share2 className="w-4 h-4" />}
              </button>
            </div>

            <a
              href={article.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <span>Read Original on {article.source}</span>
              <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
