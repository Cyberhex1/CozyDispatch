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
      <div className="relative bg-white text-[#4A4A40] rounded-3xl border border-[#E6E2D3] shadow-xl max-w-3xl w-full overflow-hidden my-8">
        {/* Header Image */}
        <div className="relative h-52 sm:h-64 bg-[#F5F5F0]">
          <img
            src={article.imageUrl}
            alt={article.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/40 to-transparent" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/80 hover:bg-white text-[#707060] hover:text-[#4A4A40] transition-colors cursor-pointer border border-[#E6E2D3] shadow-xs"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Outlet Badge & Read Time */}
          <div className="absolute bottom-4 left-6 flex items-center gap-2">
            <span className="bg-[#8BA888] text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-md shadow-xs">
              {article.source} Coverage
            </span>
            <span className="bg-[#5A5A40]/80 backdrop-blur-xs text-[#FDFBF7] text-xs font-medium px-2.5 py-1 rounded-md flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#FDFBF7]" />
              <span>{article.readTimeMinutes} min read</span>
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 space-y-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#707060] mb-2">
              <Calendar className="w-3.5 h-3.5" />
              <span>Published {article.publishedAt}</span>
              <span>•</span>
              <span>By {article.author}</span>
            </div>

            <h2 className="font-serif-natural text-2xl sm:text-3xl font-normal text-[#5A5A40] leading-tight">
              {article.title}
            </h2>
          </div>

          {/* 30-Second Takeaways */}
          <div className="bg-[#FDFBF7] border border-[#E6E2D3] rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#5A5A40] uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-[#8BA888]" />
              <span>Cozy Dispatch Quick Takeaways</span>
            </div>
            <ul className="space-y-2 text-xs sm:text-sm text-[#707060]">
              {article.takeaways.map((t, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-[#8BA888] font-bold mt-0.5">•</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Full Article Content */}
          <div className="space-y-4 text-sm sm:text-base text-[#707060] leading-relaxed border-t border-[#E6E2D3] pt-5">
            <p className="font-medium text-[#4A4A40] text-base sm:text-lg">
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
                className="text-xs px-2.5 py-1 rounded-lg bg-[#F5F5F0] text-[#707060] border border-[#E6E2D3]"
              >
                #{tag}
              </span>
            ))}
          </div>

          {/* Actions & Attribution */}
          <div className="pt-5 border-t border-[#E6E2D3] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onBookmark(article.id)}
                className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
                  isBookmarked
                    ? 'bg-[#E6A07D]/20 text-[#5A5A40] border border-[#E6A07D]/50'
                    : 'bg-[#F5F5F0] hover:bg-[#E6E2D3] text-[#707060] border border-[#E6E2D3]'
                }`}
              >
                <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-[#E6A07D] text-[#E6A07D]' : ''}`} />
                <span>{isBookmarked ? 'Article Saved' : 'Save Article'}</span>
              </button>

              <button
                onClick={handleShare}
                className="p-2 rounded-xl bg-[#F5F5F0] hover:bg-[#E6E2D3] text-[#707060] hover:text-[#4A4A40] transition-colors cursor-pointer border border-[#E6E2D3]"
                title="Share Article"
              >
                {copied ? <Check className="w-4 h-4 text-[#8BA888]" /> : <Share2 className="w-4 h-4" />}
              </button>
            </div>

            <a
              href={article.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-xl bg-[#8BA888] hover:bg-[#7A9977] text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-colors shadow-xs"
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
