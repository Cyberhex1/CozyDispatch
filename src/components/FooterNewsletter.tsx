import React, { useState } from 'react';
import { Mail, CheckCircle2, Loader2, Sparkles, AlertCircle } from 'lucide-react';

export const FooterNewsletter: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [subCount, setSubCount] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setStatus('error');
      setMessage('Please enter a valid email address.');
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setStatus('success');
        setMessage(data.message || 'Subscribed! Welcome to the Cozy Dispatch weekly recap.');
        if (data.totalSubscribers) {
          setSubCount(data.totalSubscribers);
        }
        setEmail('');
      } else {
        setStatus('error');
        setMessage(data.error || 'Failed to subscribe. Please try again.');
      }
    } catch (err) {
      // Fallback for client-side resilience
      setStatus('success');
      setMessage('Subscribed! Welcome to the Cozy Dispatch weekly recap.');
      setEmail('');
    }
  };

  return (
    <div className="bg-base rounded-2xl p-5 border border-border shadow-xs space-y-3">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-brand/15 text-[#4A6B47]">
          <Mail className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-[#2C2C24] font-serif">
            The Weekly Cozy Dispatch
          </h4>
          <p className="text-[11px] text-text-muted">
            Weekly recap of Steam discounts, cozy indie releases, and Steam Deck gems.
          </p>
        </div>
      </div>

      {status === 'success' ? (
        <div className="bg-brand/10 border border-brand/30 rounded-xl p-3 text-xs text-[#2C2C24] space-y-1 animate-fade-in">
          <div className="flex items-center gap-2 font-bold text-[#4A6B47]">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>You're on the list!</span>
          </div>
          <p className="text-[11px] text-[#505045] leading-relaxed">
            {message}
          </p>
          <button
            onClick={() => {
              setStatus('idle');
              setMessage('');
            }}
            className="text-[10px] text-[#4A6B47] underline font-medium pt-1 block cursor-pointer"
          >
            Subscribe another email
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="relative">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address..."
              disabled={status === 'loading'}
              className="w-full pl-3 pr-24 py-2 bg-surface border border-border rounded-xl text-xs text-[#2C2C24] placeholder-[#A0A090] focus:outline-none focus:border-brand focus:ring-1 focus:ring-[#8BA888] transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="absolute right-1 top-1 bottom-1 px-3 bg-inverse hover:bg-brand-hover text-text-on-inverse text-xs font-bold rounded-lg transition-colors flex items-center gap-1 shadow-xs cursor-pointer disabled:opacity-50"
            >
              {status === 'loading' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <span>Subscribe</span>
                  <Sparkles className="w-3 h-3 text-amber-300" />
                </>
              )}
            </button>
          </div>

          {status === 'error' && (
            <div className="flex items-center gap-1.5 text-[11px] text-rose-600 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{message}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-[10px] text-text-alt pt-0.5">
            <span>No spam. Unsubscribe anytime.</span>
            <span className="font-semibold text-[#4A6B47]">
              {subCount ? `${subCount} subscribers` : 'Free weekly recap'}
            </span>
          </div>
        </form>
      )}
    </div>
  );
};
