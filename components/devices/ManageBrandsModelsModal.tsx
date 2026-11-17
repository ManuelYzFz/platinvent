'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Plus,
  Edit2,
  Trash2,
  Check,
  Tag,
  Layers,
  Cpu,
  Search,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { useDeviceOptions } from './useDeviceOptions';

interface ManageBrandsModelsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ManageBrandsModelsModal({ isOpen, onClose }: ManageBrandsModelsModalProps) {
  const { rawOptions, reloadOptions, loading } = useDeviceOptions(isOpen);

  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [searchBrand, setSearchBrand] = useState<string>('');
  const [newBrandName, setNewBrandName] = useState<string>('');
  const [newModelName, setNewModelName] = useState<string>('');

  // Inline editing state for Brand
  const [editingBrand, setEditingBrand] = useState<string | null>(null);
  const [editingBrandValue, setEditingBrandValue] = useState<string>('');

  // Inline editing state for Model
  const [editingModel, setEditingModel] = useState<string | null>(null);
  const [editingModelValue, setEditingModelValue] = useState<string>('');

  // Feedback states
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Clean brands list
  const cleanBrands = useMemo(() => {
    return rawOptions.brands.filter((b) => b && b.trim().toLowerCase() !== 'sin asignar');
  }, [rawOptions.brands]);

  // Set default selected brand
  const activeBrand = useMemo(() => {
    if (selectedBrand && cleanBrands.some((b) => b.toLowerCase() === selectedBrand.toLowerCase())) {
      return selectedBrand;
    }
    return cleanBrands[0] || '';
  }, [selectedBrand, cleanBrands]);

  // Models for active brand
  const modelsForActiveBrand = useMemo(() => {
    if (!activeBrand) return [];
    return rawOptions.models
      .filter((m) => m.brand.toLowerCase() === activeBrand.toLowerCase() && m.model && m.model.trim())
      .map((m) => m.model);
  }, [activeBrand, rawOptions.models]);

  // Filtered brands by search
  const filteredBrands = useMemo(() => {
    if (!searchBrand.trim()) return cleanBrands;
    return cleanBrands.filter((b) => b.toLowerCase().includes(searchBrand.trim().toLowerCase()));
  }, [cleanBrands, searchBrand]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    if (type === 'success') {
      setSuccessMsg(message);
      setErrorMsg('');
      setTimeout(() => setSuccessMsg(''), 4000);
    } else {
      setErrorMsg(message);
      setSuccessMsg('');
      setTimeout(() => setErrorMsg(''), 5000);
    }
  };

  const notifyChange = () => {
    window.dispatchEvent(new Event('device-options-updated'));
  };

  // 1. Agregar Nueva Marca
  const handleAddBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    const brandTrim = newBrandName.trim();
    if (!brandTrim) return;

    if (cleanBrands.some((b) => b.toLowerCase() === brandTrim.toLowerCase())) {
      showNotification('error', `La marca "${brandTrim}" ya existe en el catálogo.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/local-device-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: brandTrim, model: '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al agregar marca');

      setNewBrandName('');
      setSelectedBrand(brandTrim);
      await reloadOptions();
      notifyChange();
      showNotification('success', `Marca "${brandTrim}" agregada exitosamente.`);
    } catch (err) {
      showNotification('error', (err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Renombrar Marca
  const handleUpdateBrand = async (oldBrand: string) => {
    const newName = editingBrandValue.trim();
    if (!newName || newName.toLowerCase() === oldBrand.toLowerCase()) {
      setEditingBrand(null);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/local-device-options', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateBrand', oldBrand, newBrand: newName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al renombrar marca');

      setEditingBrand(null);
      setSelectedBrand(newName);
      await reloadOptions();
      notifyChange();
      showNotification('success', `Marca renombrada a "${newName}" y dispositivos actualizados.`);
    } catch (err) {
      showNotification('error', (err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Eliminar Marca
  const handleDeleteBrand = async (brandToDelete: string) => {
    const confirmDelete = window.confirm(
      `¿Estás seguro de eliminar la marca "${brandToDelete}" y todos sus modelos del catálogo?`
    );
    if (!confirmDelete) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/local-device-options', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteBrand', brand: brandToDelete }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar marca');

      if (selectedBrand.toLowerCase() === brandToDelete.toLowerCase()) {
        setSelectedBrand('');
      }
      await reloadOptions();
      notifyChange();
      showNotification('success', `Marca "${brandToDelete}" eliminada del catálogo.`);
    } catch (err) {
      showNotification('error', (err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Agregar Nuevo Modelo a la Marca Activa
  const handleAddModel = async (e: React.FormEvent) => {
    e.preventDefault();
    const modelTrim = newModelName.trim();
    if (!modelTrim || !activeBrand) return;

    if (modelsForActiveBrand.some((m) => m.toLowerCase() === modelTrim.toLowerCase())) {
      showNotification('error', `El modelo "${modelTrim}" ya existe para la marca "${activeBrand}".`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/local-device-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: activeBrand, model: modelTrim }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al agregar modelo');

      setNewModelName('');
      await reloadOptions();
      notifyChange();
      showNotification('success', `Modelo "${modelTrim}" agregado a "${activeBrand}".`);
    } catch (err) {
      showNotification('error', (err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. Renombrar Modelo
  const handleUpdateModel = async (oldModel: string) => {
    const newName = editingModelValue.trim();
    if (!newName || newName.toLowerCase() === oldModel.toLowerCase()) {
      setEditingModel(null);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/local-device-options', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateModel', brand: activeBrand, oldModel, newModel: newName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al renombrar modelo');

      setEditingModel(null);
      await reloadOptions();
      notifyChange();
      showNotification('success', `Modelo actualizado a "${newName}" en dispositivos asociados.`);
    } catch (err) {
      showNotification('error', (err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 6. Eliminar Modelo
  const handleDeleteModel = async (modelToDelete: string) => {
    const confirmDelete = window.confirm(
      `¿Deseas eliminar el modelo "${modelToDelete}" de la marca "${activeBrand}"?`
    );
    if (!confirmDelete) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/local-device-options', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteModel', brand: activeBrand, model: modelToDelete }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar modelo');

      await reloadOptions();
      notifyChange();
      showNotification('success', `Modelo "${modelToDelete}" eliminado del catálogo.`);
    } catch (err) {
      showNotification('error', (err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#161B22] border border-[#e8e9ed] dark:border-[#30363d] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Cabecera del Modal */}
        <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-[#e8e9ed] dark:border-[#30363d] flex items-center justify-between bg-gray-50/50 dark:bg-[#0d1117]/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00acee]/10 text-[#00acee] flex items-center justify-center font-bold">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#3a435d] dark:text-white tracking-tight">
                Gestión de Marcas y Modelos
              </h2>
              <p className="text-xs text-[#5c647b] dark:text-gray-400">
                Catálogo maestro de hardware telemático y dispositivos de inventario
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#21262d] transition-colors cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notificaciones */}
        {errorMsg && (
          <div className="mx-5 sm:mx-6 mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-5 sm:mx-6 mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Cuerpo del Modal con Dos Columnas */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden divide-y md:divide-y-0 md:divide-x divide-[#e8e9ed] dark:divide-[#30363d]">
          
          {/* COLUMNA IZQUIERDA: MARCAS (5 columnas) */}
          <div className="md:col-span-5 p-4 sm:p-5 flex flex-col overflow-hidden bg-gray-50/30 dark:bg-[#0d1117]/20">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#3a435d] dark:text-gray-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#00acee]" />
                Marcas ({cleanBrands.length})
              </span>
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00acee]" />}
            </div>

            {/* Input para agregar nueva marca */}
            <form onSubmit={handleAddBrand} className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="Nueva marca..."
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                maxLength={40}
                className="flex-1 px-3 py-2 bg-white dark:bg-[#161B22] border border-[#e8e9ed] dark:border-[#30363d] rounded-xl text-xs sm:text-sm text-[#3a435d] dark:text-white placeholder-gray-400 focus:outline-none focus:border-[#00acee] transition-all"
              />
              <button
                type="submit"
                disabled={isSubmitting || !newBrandName.trim()}
                className="px-3 py-2 bg-[#00acee] hover:bg-[#0099d4] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                title="Agregar marca"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Agregar</span>
              </button>
            </form>

            {/* Buscador de Marcas */}
            {cleanBrands.length > 5 && (
              <div className="relative mb-3">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar marca..."
                  value={searchBrand}
                  onChange={(e) => setSearchBrand(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-[#161B22] border border-[#e8e9ed] dark:border-[#30363d] rounded-lg text-xs text-[#3a435d] dark:text-white placeholder-gray-400 focus:outline-none focus:border-[#00acee]"
                />
              </div>
            )}

            {/* Lista de Marcas con scroll */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
              {filteredBrands.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-400">
                  No se encontraron marcas registradas.
                </div>
              ) : (
                filteredBrands.map((b) => {
                  const isSelected = activeBrand.toLowerCase() === b.toLowerCase();
                  const isEditing = editingBrand?.toLowerCase() === b.toLowerCase();
                  const modelsCount = rawOptions.models.filter(
                    (m) => m.brand.toLowerCase() === b.toLowerCase() && m.model
                  ).length;

                  if (isEditing) {
                    return (
                      <div
                        key={b}
                        className="flex items-center gap-1.5 p-1.5 bg-white dark:bg-[#161B22] border border-[#00acee] rounded-xl"
                      >
                        <input
                          type="text"
                          value={editingBrandValue}
                          onChange={(e) => setEditingBrandValue(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs sm:text-sm font-bold bg-transparent text-[#3a435d] dark:text-white focus:outline-none"
                          autoFocus
                          maxLength={40}
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateBrand(b)}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg cursor-pointer"
                          title="Guardar nombre"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingBrand(null)}
                          className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg cursor-pointer"
                          title="Cancelar"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={b}
                      onClick={() => setSelectedBrand(b)}
                      className={`group flex items-center justify-between p-2.5 sm:p-3 rounded-xl cursor-pointer transition-all border ${
                        isSelected
                          ? 'bg-[#00acee]/10 dark:bg-[#00acee]/20 border-[#00acee]/40 text-[#00acee] font-extrabold shadow-2xs'
                          : 'bg-white dark:bg-[#161B22] border-[#e8e9ed] dark:border-[#30363d] text-[#3a435d] dark:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600 font-semibold'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-xs sm:text-sm truncate">{b}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-bold shrink-0">
                          {modelsCount}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingBrand(b);
                            setEditingBrandValue(b);
                          }}
                          className="p-1 text-gray-400 hover:text-[#00acee] hover:bg-white dark:hover:bg-[#21262d] rounded-md transition-colors cursor-pointer"
                          title="Renombrar marca"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBrand(b);
                          }}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-white dark:hover:bg-[#21262d] rounded-md transition-colors cursor-pointer"
                          title="Eliminar marca"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <ChevronRight className={`w-4 h-4 shrink-0 ${isSelected ? 'text-[#00acee]' : 'text-gray-300 dark:text-gray-600'}`} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* COLUMNA DERECHA: MODELOS DE LA MARCA (7 columnas) */}
          <div className="md:col-span-7 p-4 sm:p-5 flex flex-col overflow-hidden bg-white dark:bg-[#161B22]">
            {activeBrand ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#3a435d] dark:text-gray-300 flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-[#00acee]" />
                      Modelos de <span className="text-[#00acee] font-extrabold">{activeBrand}</span>
                    </span>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {modelsForActiveBrand.length} {modelsForActiveBrand.length === 1 ? 'modelo registrado' : 'modelos registrados'}
                    </p>
                  </div>
                </div>

                {/* Input para agregar nuevo modelo a la marca activa */}
                <form onSubmit={handleAddModel} className="flex gap-2 mb-4">
                  <input
                    type="text"
                    placeholder={`Nuevo modelo para ${activeBrand}...`}
                    value={newModelName}
                    onChange={(e) => setNewModelName(e.target.value)}
                    maxLength={40}
                    className="flex-1 px-3 py-2 bg-gray-50/50 dark:bg-[#0d1117] border border-[#e8e9ed] dark:border-[#30363d] rounded-xl text-xs sm:text-sm text-[#3a435d] dark:text-white placeholder-gray-400 focus:outline-none focus:border-[#00acee] transition-all"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting || !newModelName.trim()}
                    className="px-4 py-2 bg-[#00acee] hover:bg-[#0099d4] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar Modelo</span>
                  </button>
                </form>

                {/* Lista de Modelos */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                  {modelsForActiveBrand.length === 0 ? (
                    <div className="text-center py-12 px-4 border border-dashed border-[#e8e9ed] dark:border-[#30363d] rounded-2xl">
                      <Cpu className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                        No hay modelos registrados para {activeBrand}.
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        Escribe un nombre arriba para agregarlo al catálogo.
                      </p>
                    </div>
                  ) : (
                    modelsForActiveBrand.map((m) => {
                      const isEditing = editingModel?.toLowerCase() === m.toLowerCase();

                      if (isEditing) {
                        return (
                          <div
                            key={m}
                            className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-[#0d1117] border border-[#00acee] rounded-xl"
                          >
                            <input
                              type="text"
                              value={editingModelValue}
                              onChange={(e) => setEditingModelValue(e.target.value)}
                              className="flex-1 px-2 py-1 text-xs sm:text-sm font-bold bg-transparent text-[#3a435d] dark:text-white focus:outline-none"
                              autoFocus
                              maxLength={40}
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateModel(m)}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg cursor-pointer"
                              title="Guardar nombre"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingModel(null)}
                              className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg cursor-pointer"
                              title="Cancelar"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={m}
                          className="group flex items-center justify-between p-3 rounded-xl border border-[#e8e9ed] dark:border-[#30363d] bg-gray-50/50 dark:bg-[#0d1117]/50 hover:bg-white dark:hover:bg-[#161B22] hover:border-[#00acee]/40 transition-all shadow-2xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-2 h-2 rounded-full bg-[#00acee]" />
                            <span className="text-xs sm:text-sm font-bold text-[#3a435d] dark:text-white">
                              {m}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingModel(m);
                                setEditingModelValue(m);
                              }}
                              className="p-1.5 text-gray-400 hover:text-[#00acee] hover:bg-gray-100 dark:hover:bg-[#21262d] rounded-lg transition-colors cursor-pointer"
                              title="Editar / Renombrar modelo"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteModel(m)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                              title="Eliminar modelo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-gray-400">
                <Layers className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-2" />
                <p className="text-xs font-semibold">Selecciona o agrega una marca a la izquierda</p>
                <p className="text-[11px] text-gray-400 mt-1">para ver y administrar sus modelos asociados.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer del Modal */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-[#e8e9ed] dark:border-[#30363d] flex items-center justify-between bg-gray-50/50 dark:bg-[#0d1117]/50 shrink-0">
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            Los cambios se sincronizan en tiempo real con la base de datos y los formularios de dispositivos.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-[#21262d] dark:hover:bg-[#30363d] text-[#3a435d] dark:text-gray-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Listo / Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
