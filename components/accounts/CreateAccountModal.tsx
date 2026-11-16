'use client';

import React, { useState } from 'react';
import { UserPlus } from 'lucide-react';
import type { UserRole } from '@/lib/utils/storage';
import AccountModalShell from './AccountModalShell';
import { ROLE_OPTIONS, INPUT_CLASS, LABEL_CLASS } from './account-helpers';

interface CreateAccountModalProps {
  submitting: boolean;
  onClose: () => void;
  onSubmit: (data: { username: string; password: string; role: UserRole }) => void;
}

export default function CreateAccountModal({ submitting, onClose, onSubmit }: CreateAccountModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('solo_lectura');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    onSubmit({ username: username.trim(), password, role });
  };

  return (
    <AccountModalShell
      title="Nueva Cuenta"
      description="Ingresa los datos para registrar un nuevo usuario."
      icon={<UserPlus className="w-6 h-6" />}
      iconClassName="bg-[#00acee]/10 text-[#00acee]"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Crear Cuenta"
      submitting={submitting}
    >
      <div>
        <label className={LABEL_CLASS}>Nombre de Usuario *</label>
        <input
          type="text"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="ej. operador1, soporte..."
          className={INPUT_CLASS}
        />
      </div>

      <div>
        <label className={LABEL_CLASS}>Contraseña Inicial *</label>
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

      <div>
        <label className={LABEL_CLASS}>Rol de Usuario</label>
        <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={INPUT_CLASS}>
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </AccountModalShell>
  );
}
