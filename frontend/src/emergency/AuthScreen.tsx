import React, { useState } from 'react';
import { emergencyApi, apiError } from './api';
import { BigButton, ErrorNote, InfoNote, input } from './ui';

export function AuthScreen({ onSignIn }: { onSignIn: (email: string, password: string) => Promise<void> }) {
  const [mode, setMode] = useState<'signin' | 'register'>('register');
  const [f, setF] = useState({ full_name: '', phone: '', email: '', password: '', contact_name: '', contact_phone: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (mode === 'register') {
        await emergencyApi.register({ email: f.email.trim(), password: f.password, full_name: f.full_name.trim(), phone: f.phone.trim() });
      }
      await onSignIn(f.email.trim(), f.password);
      if (mode === 'register' && (f.contact_name || f.contact_phone)) {
        await emergencyApi.profile({ emergency_contact_name: f.contact_name.trim() || undefined, emergency_contact_phone: f.contact_phone.trim() || undefined }).catch(() => undefined);
      }
    } catch (x: any) {
      setErr(x?.response?.status === 401 ? 'Incorrect e-mail or password.' : apiError(x, mode === 'register' ? 'Registration failed.' : 'Sign-in failed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-200/70 p-1">
        {(['register', 'signin'] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-xl py-2.5 text-[13px] font-bold ${mode === m ? 'bg-white shadow text-[#0d2b59]' : 'text-slate-600'}`}>
            {m === 'register' ? 'Register' : 'Sign in'}
          </button>
        ))}
      </div>
      {mode === 'register' && (
        <>
          <input className={input} required minLength={2} placeholder="Full name" autoComplete="name" value={f.full_name} onChange={set('full_name')} />
          <input className={input} required type="tel" pattern="^\+?[0-9 \-]{7,20}$" placeholder="Mobile number (e.g. +91 98xxxxxxxx)" autoComplete="tel" value={f.phone} onChange={set('phone')} />
        </>
      )}
      <input className={input} required type="email" placeholder="E-mail" autoComplete="username" value={f.email} onChange={set('email')} />
      <input className={input} required type="password" minLength={8} placeholder={mode === 'register' ? 'Create password (min 8 characters)' : 'Password'}
        autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={f.password} onChange={set('password')} />
      {mode === 'register' && (
        <>
          <div className="pt-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">Emergency contact (optional)</div>
          <input className={input} placeholder="Contact name" value={f.contact_name} onChange={set('contact_name')} />
          <input className={input} type="tel" pattern="^\+?[0-9 \-]{7,20}$" placeholder="Contact phone" value={f.contact_phone} onChange={set('contact_phone')} />
        </>
      )}
      <ErrorNote>{err}</ErrorNote>
      <BigButton type="submit" busy={busy}>{mode === 'register' ? 'CREATE ACCOUNT' : 'SIGN IN'}</BigButton>
      <InfoNote>
        Your phone number and location are only visible to authorised FloodGuard responders, and only after you share them.
        Location is never tracked in the background. In a life-threatening emergency call <b>112</b>.
      </InfoNote>
    </form>
  );
}
