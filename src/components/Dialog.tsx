/** Accessible modal on top of the native <dialog> (focus trap + Esc for free). Bottom sheet on phones. */
import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

export function Dialog({
  open,
  onClose,
  title,
  children,
  wide = false
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      document.body.style.overflow = 'hidden';
    } else if (!open && el.open) {
      el.close();
    }
    if (!open) document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-label={title}
      className={`m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-xl border border-rule bg-paper p-0 text-ink backdrop:bg-black/45 sm:m-auto sm:max-h-[85vh] sm:rounded-lg ${
        wide ? 'sm:max-w-2xl' : 'sm:max-w-md'
      }`}
    >
      {open && (
        <div className="px-5 pb-6 pt-4 sm:px-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="headline text-2xl">{title}</h2>
            <button type="button" onClick={onClose} className="-mr-2 grid h-10 w-10 place-items-center rounded-full text-ink-soft hover:bg-rule/50 hover:text-ink" aria-label="Close">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
