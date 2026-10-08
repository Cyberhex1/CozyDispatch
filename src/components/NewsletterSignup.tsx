/** Newsletter signup with honest states: confirmation sent, or saved while email is offline. */
import { useState, type FormEvent } from 'react';
import { subscribeToNewsletter, ApiError } from '../services/newsletterApi';

export function NewsletterSignup({ source = 'footer' }: { source?: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<{ kind: 'idle' | 'busy' | 'done' | 'error'; message?: string }>({ kind: 'idle' });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState({ kind: 'busy' });
    try {
      const res = await subscribeToNewsletter(email.trim(), source);
      setState({ kind: 'done', message: res.message });
    } catch (err) {
      setState({ kind: 'error', message: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' });
    }
  };

  return (
    <div>
      <h2 className="headline text-xl">The weekly dispatch</h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
        One email a week: the best new cozy and indie releases, standout deals, and what’s coming next.
      </p>
      {state.kind === 'done' ? (
        <p role="status" className="mt-3 rounded-md bg-cozy-wash px-3 py-2.5 text-sm text-ink">
          {state.message}
        </p>
      ) : (
        <form onSubmit={submit} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor={`nl-${source}`}>
            Email address
          </label>
          <input
            id={`nl-${source}`}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            inputMode="email"
            className="field flex-1"
          />
          <button type="submit" className="btn-primary" disabled={state.kind === 'busy'}>
            {state.kind === 'busy' ? 'Signing up…' : 'Sign up'}
          </button>
        </form>
      )}
      {state.kind === 'error' && (
        <p role="alert" className="mt-2 text-[13px] text-deal">
          {state.message}
        </p>
      )}
      <p className="mt-2 text-[12px] text-ink-faint">We’ll ask you to confirm by email. Unsubscribe any time.</p>
    </div>
  );
}
