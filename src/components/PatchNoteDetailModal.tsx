import React from 'react';
import { PatchNote } from '../types';
import { 
  X, 
  Wrench, 
  Tv, 
  CheckCircle2, 
  Calendar, 
  ExternalLink, 
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';

interface PatchNoteDetailModalProps {
  patch: PatchNote | null;
  onClose: () => void;
  onViewGame?: (gameId: string) => void;
}

export const PatchNoteDetailModal: React.FC<PatchNoteDetailModalProps> = ({
  patch,
  onClose,
  onViewGame
}) => {
  if (!patch) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="relative bg-white text-text-main rounded-3xl border border-border shadow-xl max-w-2xl w-full overflow-hidden my-8">
        {/* Header */}
        <div className="p-6 bg-base border-b border-border flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={patch.gameCover}
              alt={patch.gameTitle}
              className="w-16 h-16 rounded-2xl object-cover border border-border shadow-xs"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-surface-brand text-text-heading border border-brand/30">
                  {patch.version}
                </span>
                <span className="text-xs text-text-muted">
                  {patch.releaseDate}
                </span>
              </div>
              <h2 className="font-serif-natural text-2xl font-normal text-text-heading mt-1">
                {patch.gameTitle}
              </h2>
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
        <div className="p-6 sm:p-8 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Summary */}
          <div className="text-sm text-text-muted leading-relaxed bg-base p-4 rounded-2xl border border-border">
            <strong className="text-text-heading block mb-1">Update Overview:</strong>
            {patch.summary}
          </div>

          {/* Steam Deck Notes */}
          {patch.deckImprovements && (
            <div className="bg-surface-brand border border-brand/40 rounded-2xl p-4 text-xs text-text-heading flex items-start gap-2.5">
              <Tv className="w-4 h-4 text-brand shrink-0 mt-0.5" />
              <div>
                <strong className="text-text-heading font-bold block mb-0.5">Steam Deck Performance Polish:</strong>
                {patch.deckImprovements}
              </div>
            </div>
          )}

          {/* Key Feature Highlights */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              <span>Major Feature Highlights</span>
            </h3>
            <div className="space-y-2.5">
              {patch.highlights.map((h, idx) => (
                <div
                  key={idx}
                  className="bg-base p-3.5 rounded-xl border border-border space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-text-heading">{h.title}</span>
                    {h.badge && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-brand text-text-heading">
                        {h.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">
                    {h.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed Changelog */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Detailed Fixes & Balance Notes
            </h3>
            <ul className="space-y-2 text-xs text-text-muted">
              {patch.detailedNotes.map((note, idx) => (
                <li key={idx} className="flex items-start gap-2 bg-surface p-2.5 rounded-xl border border-border">
                  <CheckCircle2 className="w-4 h-4 text-brand shrink-0 mt-0.5" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 bg-base border-t border-border flex items-center justify-between">
          <a
            href={patch.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-text-muted hover:text-text-main flex items-center gap-1 font-medium"
          >
            <span>Official Developer Post</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
          >
            Done Reading
          </button>
        </div>
      </div>
    </div>
  );
};
