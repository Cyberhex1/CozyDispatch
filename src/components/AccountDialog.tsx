/** Sign in / create account, and profile management once signed in. */
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { AVATARS, BIO_MAX, PASSWORD_MIN, type Avatar } from '../shared/account';
import { ApiError, changePassword, deleteAccount, login, signup, updateProfile } from '../services/accountApi';
import { useSaved } from '../lib/saved';
import { Link } from '../lib/router';
import { Dialog } from './Dialog';

export const AVATAR_EMOJI: Record<Avatar, string> = {
  sprout: '🌱',
  mushroom: '🍄',
  teapot: '🫖',
  cat: '🐈',
  frog: '🐸',
  moon: '🌙',
  leaf: '🍃',
  lantern: '🏮'
};

function message(err: unknown) {
  return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="block">
        <span className="mb-1 block text-[13px] font-semibold text-ink">{label}</span>
        {children}
      </label>
      {hint && <p className="mt-1 text-[12px] text-ink-faint">{hint}</p>}
    </div>
  );
}

function FormError({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="rounded-md bg-deal-wash px-3 py-2 text-[13px] text-deal">
      {error}
    </p>
  ) : null;
}

function SignedOut({ onDone }: { onDone: () => void }) {
  const { onSignedIn, wishlist, bookmarks } = useSaved();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const localCount = wishlist.length + bookmarks.length;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const state = mode === 'signin' ? await login({ email, password }) : await signup({ email, password, displayName });
      await onSignedIn(state);
      onDone();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div role="tablist" className="mb-5 grid grid-cols-2 border-b border-rule">
        {(['signin', 'signup'] as const).map((m) => (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`-mb-px border-b-2 py-2.5 text-sm font-semibold ${mode === m ? 'border-ink text-ink' : 'border-transparent text-ink-faint hover:text-ink'}`}
          >
            {m === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>
      <p className="mb-4 text-sm leading-relaxed text-ink-soft">
        An account keeps your shelf of saved games and bookmarks in sync across devices.
        {localCount > 0 && <> The {localCount} item{localCount === 1 ? '' : 's'} saved on this device will move into your account.</>}
      </p>
      <form onSubmit={submit} className="space-y-4">
        {mode === 'signup' && (
          <Field label="Display name">
            <input className="field" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required minLength={2} maxLength={40} autoComplete="nickname" />
          </Field>
        )}
        <Field label="Email">
          <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" inputMode="email" />
        </Field>
        <Field label="Password" hint={mode === 'signup' ? `At least ${PASSWORD_MIN} characters.` : undefined}>
          <input
            className="field"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === 'signup' ? PASSWORD_MIN : 1}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
        </Field>
        <FormError error={error} />
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
        {mode === 'signin' && (
          <p className="text-[12px] text-ink-faint">
            Forgotten passwords can’t be reset by email yet, because email isn’t switched on for this site.
          </p>
        )}
      </form>
    </div>
  );
}

function SignedIn({ onDone }: { onDone: () => void }) {
  const { account, setAccount, signOut, wishlist, bookmarks } = useSaved();
  const user = account!.user;
  const [avatar, setAvatar] = useState<Avatar>(user.avatar);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [panel, setPanel] = useState<'none' | 'password' | 'delete'>('none');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [panelMsg, setPanelMsg] = useState<string | null>(null);

  const dirty = avatar !== user.avatar || displayName !== user.displayName || bio !== user.bio;

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setAccount(await updateProfile({ avatar, displayName, bio }));
      setSaved(true);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  const submitPanel = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setPanelMsg(null);
    try {
      if (panel === 'password') {
        await changePassword({ currentPassword, newPassword });
        setPanelMsg('Password changed. Other devices have been signed out.');
        setCurrentPassword('');
        setNewPassword('');
      } else if (panel === 'delete') {
        await deleteAccount(currentPassword);
        await signOut().catch(() => {});
        onDone();
      }
    } catch (err) {
      setPanelMsg(message(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-soft">
        Signed in as <strong className="text-ink">{user.email}</strong>. Your shelf has {wishlist.length} game{wishlist.length === 1 ? '' : 's'} and{' '}
        {bookmarks.length} bookmark{bookmarks.length === 1 ? '' : 's'}.{' '}
        <Link href="/shelf" onClick={onDone} className="font-semibold text-ink link-underline">
          Open shelf
        </Link>
      </p>

      <form onSubmit={saveProfile} className="space-y-4">
        <fieldset>
          <legend className="mb-2 text-[13px] font-semibold">Avatar</legend>
          <div className="flex flex-wrap gap-2">
            {AVATARS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => {
                  setAvatar(a);
                  setSaved(false);
                }}
                aria-pressed={avatar === a}
                aria-label={a}
                className={`grid h-11 w-11 place-items-center rounded-full border text-xl transition ${avatar === a ? 'border-ink bg-surface' : 'border-rule hover:border-ink-faint'}`}
              >
                {AVATAR_EMOJI[a]}
              </button>
            ))}
          </div>
        </fieldset>
        <Field label="Display name">
          <input className="field" value={displayName} onChange={(e) => { setDisplayName(e.target.value); setSaved(false); }} minLength={2} maxLength={40} required />
        </Field>
        <Field label="About you" hint={`${bio.length}/${BIO_MAX}`}>
          <textarea
            className="field min-h-20 py-2"
            value={bio}
            maxLength={BIO_MAX}
            onChange={(e) => { setBio(e.target.value); setSaved(false); }}
            placeholder="What are you playing lately?"
          />
        </Field>
        <FormError error={error} />
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={busy || !dirty}>
            Save profile
          </button>
          {saved && !dirty && <span className="text-[13px] text-cozy">Saved.</span>}
        </div>
      </form>

      <div className="border-t border-rule pt-4">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-quiet" onClick={() => signOut().then(onDone)}>
            Sign out
          </button>
          <button type="button" className="btn-quiet" onClick={() => { setPanel(panel === 'password' ? 'none' : 'password'); setPanelMsg(null); }}>
            Change password
          </button>
          <button type="button" className="btn-quiet text-deal" onClick={() => { setPanel(panel === 'delete' ? 'none' : 'delete'); setPanelMsg(null); }}>
            Delete account
          </button>
        </div>
        {panel !== 'none' && (
          <form onSubmit={submitPanel} className="mt-4 space-y-3 rounded-md border border-rule bg-surface p-4">
            {panel === 'delete' && (
              <p className="text-[13px] text-ink-soft">This permanently deletes your account and shelf. Enter your password to confirm.</p>
            )}
            <Field label={panel === 'delete' ? 'Password' : 'Current password'}>
              <input className="field" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" />
            </Field>
            {panel === 'password' && (
              <Field label="New password" hint={`At least ${PASSWORD_MIN} characters.`}>
                <input className="field" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={PASSWORD_MIN} autoComplete="new-password" />
              </Field>
            )}
            {panelMsg && <p role="status" className="text-[13px] text-ink-soft">{panelMsg}</p>}
            <button type="submit" className={panel === 'delete' ? 'btn bg-deal text-on-accent' : 'btn-primary'} disabled={busy}>
              {panel === 'delete' ? 'Delete my account' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export function AccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { account } = useSaved();
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (open) setKey((k) => k + 1);
  }, [open]);
  return (
    <Dialog open={open} onClose={onClose} title={account ? `Hi, ${account.user.displayName}` : 'Your account'}>
      {account === undefined ? (
        <p className="text-sm text-ink-soft">Checking your session…</p>
      ) : account ? (
        <SignedIn key={key} onDone={onClose} />
      ) : (
        <SignedOut key={key} onDone={onClose} />
      )}
    </Dialog>
  );
}
