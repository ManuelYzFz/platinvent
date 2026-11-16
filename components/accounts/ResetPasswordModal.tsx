'use client';

import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';
import AccountModalShell from './AccountModalShell';
import { INPUT_CLASS, LABEL_CLASS, type AccountItem } from './account-helpers';

interface ResetPasswordModalProps {
  account: AccountItem;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (password: string) => void;
}

export default function ResetPasswordModal({ account, submitting, onClose, onSubmit }: ResetPasswordModalProps) {
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    onSubmit(password);
  };

  return (
    <AccountModalShell
      title="Restablecer Contraseña"
      description={
        <>
          Nueva contraseña para <strong>{account.username}</strong>
        </>
      }
      icon={<KeyRound className="w-6 h-6" />}
      iconClassName="bg-amber-500/10 text-amber-600"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Cambiar Contraseña"
      submitting={submitting}
      submitClassName="bg-amber-500 hover:bg-amber-600"
    >
      <div>
        <label className={LABEL_CLASS}>Nueva Contraseña *</label>
        <input
          type="password"
          required
          minLength={4}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 4 caracteres"
          className={INPUT_CLASS}
        />
      </div>
    </AccountModalShell>
  );
}
