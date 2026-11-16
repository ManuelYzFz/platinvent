'use client';

import { useState } from 'react';

const ADD_NEW = '__ADD_NEW_OPTION__';

interface CreatableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  addLabel: string;
  inputPlaceholder: string;
  cancelLabel: string;
  disabled?: boolean;
}

const selectClass =
  'w-full rounded-xl border border-[#e8e9ed] dark:border-[#30363d] bg-white dark:bg-[#0d1117] py-3 px-4 text-sm sm:text-base text-[#3a435d] dark:text-white font-semibold outline-none focus:border-[#00acee] focus:ring-2 focus:ring-[#00acee]/20 transition-all cursor-pointer shadow-2xs disabled:opacity-60 disabled:cursor-not-allowed';

const inputClass =
  'w-full rounded-xl border border-[#00acee] bg-white dark:bg-[#0d1117] py-2.5 px-3.5 text-sm text-[#3a435d] dark:text-white font-semibold outline-none focus:ring-2 focus:ring-[#00acee]/20 transition-all';

/**
 * Combobox con opción "+ Agregar nuevo...": lista los valores existentes y permite
 * escribir uno nuevo. Si no hay opciones, muestra directamente el campo de texto.
 */
export default function CreatableSelect({
  value,
  onChange,
  options,
  placeholder,
  addLabel,
  inputPlaceholder,
  cancelLabel,
  disabled = false,
}: CreatableSelectProps) {
  const [isAdding, setIsAdding] = useState(false);

  // Mantener visible un valor actual que no esté en la lista (p. ej. al editar)
  const valueInOptions = options.some((o) => o.toLowerCase() === value.trim().toLowerCase());
  const selectOptions = value && !valueInOptions && !isAdding ? [...options, value] : options;

  if (options.length === 0 || isAdding) {
    return (
      <div className="space-y-1.5 animate-in fade-in duration-150">
        <input
          type="text"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder={inputPlaceholder}
          className={inputClass}
          autoFocus={isAdding}
          maxLength={50}
        />
        {options.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setIsAdding(false);
              onChange('');
            }}
            className="text-xs font-semibold text-[#5c647b] dark:text-gray-400 hover:text-[#00acee] cursor-pointer"
          >
            {cancelLabel}
          </button>
        )}
      </div>
    );
  }

  return (
    <select
      value={valueInOptions ? options.find((o) => o.toLowerCase() === value.trim().toLowerCase()) : value}
      disabled={disabled}
      onChange={(e) => {
        if (e.target.value === ADD_NEW) {
          setIsAdding(true);
          onChange('');
        } else {
          onChange(e.target.value);
        }
      }}
      className={selectClass}
    >
      <option value="">{placeholder}</option>
      {selectOptions.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
      <option value={ADD_NEW}>{addLabel}</option>
    </select>
  );
}
