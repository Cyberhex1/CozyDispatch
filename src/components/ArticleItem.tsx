/** News presentations. Articles link out to the original publisher. */
import { ExternalLink } from 'lucide-react';
import { timeAgo } from '../lib/format';
import type { Article } from '../shared/content';
import { BookmarkButton } from './ui';

function SourceLine({ article }: { article: Article }) {
  return (
    <p className="text-[12px] text-ink-faint">
      <span className={`font-semibold ${article.kind === 'update' ? 'text-ink-soft' : 'text-ink-soft'}`}>{article.source}</span>
      {article.kind === 'update' && <span> · Developer update</span>}
      <span> · </span>
      <time dateTime={article.publishedAt}>{timeAgo(article.publishedAt)}</time>
    </p>
  );
}

/** Headline-only item for dense lists ("The wire"). */
export function WireItem({ article }: { article: Article }) {
  return (
    <article className="border-b border-rule py-3 last:border-b-0">
      <h3 className="font-display text-[16px] leading-snug">
        <a href={article.url} target="_blank" rel="noopener noreferrer" className="hover:underline decoration-1 underline-offset-2">
          {article.title}
        </a>
      </h3>
      <div className="mt-1">
        <SourceLine article={article} />
      </div>
    </article>
  );
}

/** Full list item: headline, standfirst, source, optional thumbnail. */
export function ArticleRow({ article }: { article: Article }) {
  return (
    <article className="flex gap-4 border-b border-rule py-5">
      <div className="min-w-0 flex-1">
        <SourceLine article={article} />
        <h3 className="headline mt-1 text-[19px] leading-snug sm:text-xl">
          <a href={article.url} target="_blank" rel="noopener noreferrer" className="group hover:underline decoration-1 underline-offset-2">
            {article.title}
            <ExternalLink className="ml-1.5 inline h-3.5 w-3.5 align-baseline text-ink-faint opacity-0 transition group-hover:opacity-100" aria-label="(opens the original site)" />
          </a>
        </h3>
        {article.summary && <p className="mt-1.5 line-clamp-3 max-w-[62ch] text-[15px] leading-relaxed text-ink-soft">{article.summary}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        {article.imageUrl && (
          <img
            src={article.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="hidden h-[84px] w-[150px] rounded-sm object-cover sm:block"
            onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
          />
        )}
        <BookmarkButton id={article.id} title={article.title} />
      </div>
    </article>
  );
}
