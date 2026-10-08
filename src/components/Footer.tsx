import { Link } from '../lib/router';
import { GENRES } from '../shared/genres';
import { NewsletterSignup } from './NewsletterSignup';

export function Footer() {
  const cozyGenres = GENRES.filter((g) => ['farming', 'life-sim', 'cooking', 'building', 'creatures'].includes(g.id));
  const indieGenres = GENRES.filter((g) => ['roguelike', 'cards', 'platformer', 'story', 'horror'].includes(g.id));
  return (
    <footer className="mt-20 border-t-2 border-rule-strong">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <NewsletterSignup />
        <nav aria-label="Cozy genres">
          <p className="kicker mb-3 text-cozy">Cozy</p>
          <ul className="space-y-2 text-sm">
            {cozyGenres.map((g) => (
              <li key={g.id}>
                <Link href={`/cozy?genre=${g.id}`} className="text-ink-soft hover:text-ink">
                  {g.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Indie genres">
          <p className="kicker mb-3 text-indie">Indie</p>
          <ul className="space-y-2 text-sm">
            {indieGenres.map((g) => (
              <li key={g.id}>
                <Link href={`/indie?genre=${g.id}`} className="text-ink-soft hover:text-ink">
                  {g.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-rule">
        <p className="mx-auto max-w-6xl px-4 py-5 text-[12px] leading-relaxed text-ink-faint sm:px-6">
          Game data, prices (US store), reviews and Steam Deck status come from Steam and refresh several times a day. News links go to the original
          publishers. Cozy Dispatch is an independent fan site, not affiliated with Valve.
        </p>
      </div>
    </footer>
  );
}
