'use client';

import { useState } from 'react';

interface SubmitWorkFormProps {
  bountyId: string;
  isAuthenticated: boolean;
  bountyStatus: string;
  onSuccess?: () => void;
}

export default function SubmitWorkForm({ bountyId, isAuthenticated, bountyStatus, onSuccess }: SubmitWorkFormProps) {
  const [link, setLink] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isDisabled = !isAuthenticated || bountyStatus !== 'open';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!link.trim()) return;

    setSubmitting(true);
    setToast(null);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/bounties/${bountyId}/submissions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ link: link.trim(), notes: notes.trim() }),
        }
      );

      if (res.ok) {
        setToast({ type: 'success', message: 'Submission successful!' });
        setLink('');
        setNotes('');
        onSuccess?.();
      } else {
        const data = await res.json().catch(() => ({}));
        setToast({ type: 'error', message: data.message || 'Submission failed. Please try again.' });
      }
    } catch {
      setToast({ type: 'error', message: 'Network error. Please check your connection.' });
    } finally {
      setSubmitting(false);
      setTimeout(() => setToast(null), 5000);
    }
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Submit Your Work</h3>

      {!isAuthenticated ? (
        <div className="bg-slate-700/30 rounded-lg p-4 text-center">
          <p className="text-slate-400 text-sm">Please connect your wallet to submit work.</p>
        </div>
      ) : bountyStatus !== 'open' ? (
        <div className="bg-slate-700/30 rounded-lg p-4 text-center">
          <p className="text-slate-400 text-sm">This bounty is no longer accepting submissions.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="link" className="block text-sm font-medium text-slate-300 mb-1.5">
              Link to your work *
            </label>
            <input
              id="link"
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://github.com/..."
              required
              className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all"
            />
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-slate-300 mb-1.5">
              Notes (optional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Briefly describe what you built..."
              rows={3}
              className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !link.trim()}
            className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-slate-950 font-semibold px-5 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Submitting...
              </>
            ) : (
              'Submit Work'
            )}
          </button>
        </form>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-5 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
            toast.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
          role="alert"
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
