'use client';

import React, { useState } from 'react';
import { Edit2 } from 'lucide-react';
import type { UserRole } from '@/lib/utils/storage';
import AccountModalShell from './AccountModalShell';
import { ROLE_OPTIONS, INPUT_CLASS, LABEL_CLASS, type AccountItem } from './account-helpers';

interface EditRoleModalProps {
  account: AccountItem;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (data: { username: string; role: UserRole }) => void;
}

export default function EditRoleModal({ account, submitting, onClose, onSubmit }: EditRoleModalProps) {
  const [username, setUsername] = useState<string>(account.username);
  const [role, setRole] = useState<UserRole>(account.role);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    onSubmit({ username: username.trim(), role });
  };

  return (
    <AccountModalShell
      title="Editar Cuenta"
      description={
        <>
          Modificar información para <strong>{account.username}</strong>
        </>
      }
      icon={<Edit2 className="w-6 h-6" />}
      iconClassName="bg-purple-500/10 text-purple-600"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Guardar Cambios"
      submitting={submitting}
    >
      <div className="space-y-4">
        <div>
          <label className={LABEL_CLASS}>Nombre de Usuario</label>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={INPUT_CLASS}
            placeholder="ej. operador1"
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Rol Asignado</label>
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={INPUT_CLASS}>
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </AccountModalShell>
  );
}
