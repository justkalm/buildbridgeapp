// src/app/contact/page.tsx

'use client';

import { useState } from 'react';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

const CONTACTS = [
  { name: 'Moiz Patrawala', phone: '+91 77384 86780' },
  { name: 'Hassan Birya', phone: '+91 70451 94451' },
  { name: 'Anas Maklai', phone: '+91 98202 45024' },
];

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong');
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      setName('');
      setEmail('');
      setMessage('');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Nav />

      <header className="pt-28 pb-16 text-center">
        <div className="max-w-[680px] mx-auto px-5 sm:px-8">
          <h1 className="font-display font-light text-[clamp(32px,4vw,46px)] leading-[1.15] text-ink mb-4">
            Get in touch.
          </h1>
          <p className="text-[17px] leading-relaxed text-stone">
            Questions, feedback, or just want to talk, reach us directly.
          </p>
        </div>
      </header>

      <section className="pb-24 border-t border-line pt-16">
        <div className="max-w-[880px] mx-auto px-5 sm:px-8 grid grid-cols-1 md:grid-cols-2 gap-16">
          {/* Contact details */}
          <div>
            <h2 className="font-display text-xl text-ink mb-6">Reach out directly</h2>

            <div className="flex flex-col gap-4 mb-8">
              {CONTACTS.map((c) => (
                <div key={c.name}>
                  <p className="text-sm font-medium text-ink">{c.name}</p>
                  <a href={`tel:${c.phone.replace(/\s/g, '')}`} className="text-sm text-stone hover:text-ink transition-colors">
                    {c.phone}
                  </a>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 mb-8">
              <p className="text-xs text-stone uppercase tracking-wide mb-1">Email</p>
              <a href="mailto:justkalm26@gmail.com" className="text-sm text-ink hover:text-stone transition-colors">
                justkalm26@gmail.com
              </a>
            </div>

            <div className="flex gap-4">
              <a
                href="https://www.instagram.com/justkalm_?igsi=NnI5cnJ4bGc3bjN0&utm_source=qr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm px-4 py-2 rounded-full border border-line text-ink hover:border-ink transition-colors"
              >
                Instagram
              </a>
              <a
                href="https://www.linkedin.com/company/justkalm"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm px-4 py-2 rounded-full border border-line text-ink hover:border-ink transition-colors"
              >
                LinkedIn
              </a>
            </div>
          </div>

          {/* Contact form */}
          <div>
            {success ? (
              <div>
                <h2 className="font-display text-xl text-ink mb-2">Message sent</h2>
                <p className="text-sm text-stone">Thanks for reaching out. We&apos;ll get back to you soon.</p>
              </div>
            ) : (
              <>
                <h2 className="font-display text-xl text-ink mb-6">Send a message</h2>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-line rounded-[4px] text-sm bg-paper focus:outline-none focus:ring-2 focus:ring-ink"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-line rounded-[4px] text-sm bg-paper focus:outline-none focus:ring-2 focus:ring-ink"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Message</label>
                    <textarea
                      required
                      rows={5}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-line rounded-[4px] text-sm bg-paper focus:outline-none focus:ring-2 focus:ring-ink resize-none"
                    />
                  </div>
                  {error && <p className="text-sm text-danger">{error}</p>}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="mt-2 bg-ink text-paper font-medium text-sm py-3 rounded-full hover:bg-stone transition-colors disabled:opacity-60"
                  >
                    {submitting ? 'Sending…' : 'Send message'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
