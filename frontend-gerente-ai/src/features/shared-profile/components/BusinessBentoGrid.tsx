import { useState, useEffect } from 'react';
import { 
  Building2, 
  Plus, 
  Phone, 
  Trash2, 
  Edit3, 
  Layers, 
  MapPin, 
  MessageSquare 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/app/components/ui/button';
import { InlineCreateBusinessCard } from './InlineCreateBusinessCard';
import { InlineCreateBranchCard } from './InlineCreateBranchCard';
import { EditBusinessModal } from './EditBusinessModal';
import { DeleteConfirmationModal } from '@/shared/components/modals/DeleteConfirmationModal';
import { PlanLimitPaywallModal } from '@/shared/components/modals/PlanLimitPaywallModal';
import { usePlanPermissions } from '@/shared/hooks/usePlanPermissions';
import { BusinessBentoSkeleton } from './skeletons/ProfileSkeletons';
import { 
  CreateNegocioDto, 
  CreateSedeDto, 
  Negocio, 
  Sede, 
  UpdateNegocioDto, 
  UpdateSedeDto 
} from '../types';

interface BusinessBentoGridProps {
  negocios: Negocio[];
  sedesByNegocio?: Record<string, Sede[]>;
  isLoading: boolean;
  initialAction?: string | null;
  targetBusinessId?: string | null;
  onClearAction?: () => void;
  onCreateNegocio: (dto: CreateNegocioDto) => Promise<any>;
  onUpdateNegocio?: (id: string, dto: UpdateNegocioDto) => Promise<any>;
  onDeleteNegocio: (id: string) => Promise<any>;
  onCreateSede?: (negocioId: string, dto: Omit<CreateSedeDto, 'negocioId'>) => Promise<any>;
  onUpdateSede?: (sedeId: string, negocioId: string, dto: UpdateSedeDto) => Promise<any>;
  onDeleteSede?: (sedeId: string, negocioId: string) => Promise<any>;
}

export function BusinessBentoGrid({
  negocios,
  sedesByNegocio = {},
  isLoading,
  initialAction,
  targetBusinessId,
  onClearAction,
  onCreateNegocio,
  onUpdateNegocio,
  onDeleteNegocio,
  onCreateSede,
  onUpdateSede,
  onDeleteSede,
}: BusinessBentoGridProps) {
  const [isCreateBusinessOpen, setIsCreateBusinessOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<Negocio | null>(null);
  
  // Estados para despliegue IN-PAGE de creación y edición de sedes
  const [createBranchTarget, setCreateBranchTarget] = useState<Negocio | null>(null);
  const [editingBranchTarget, setEditingBranchTarget] = useState<{ sede: Sede; negocio: Negocio } | null>(null);

  const [deleteConfig, setDeleteConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    itemName?: string;
    onConfirm: () => Promise<void>;
    isLoading?: boolean;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: async () => {},
  });

  const {
    isPaywallOpen,
    paywallMotivo,
    paywallPlanRecomendadoId,
    catalogo,
    cerrarPaywall,
    verificarCreacionNegocio,
    verificarCreacionSede,
    planUsuarioId,
  } = usePlanPermissions();

  // Responder a deep link action desde URL
  useEffect(() => {
    if (initialAction === 'new-business') {
      verificarCreacionNegocio(() => {
        setIsCreateBusinessOpen(true);
      });
      if (onClearAction) onClearAction();
    } else if (initialAction === 'new-branch' && targetBusinessId) {
      const match = negocios.find((n) => n.id === targetBusinessId);
      if (match) {
        handleOpenCreateBranch(match);
      }
      if (onClearAction) onClearAction();
    }
  }, [initialAction, targetBusinessId, negocios]);

  const promptDeleteBusiness = (negocio: Negocio) => {
    const sedesCount = (sedesByNegocio[negocio.id] || []).length;
    setDeleteConfig({
      isOpen: true,
      title: '¿Eliminar Negocio?',
      itemName: negocio.nombre,
      description: `Se eliminará permanentemente "${negocio.nombre}" y sus ${sedesCount} sede(s).`,
      onConfirm: async () => {
        setDeleteConfig((prev) => ({ ...prev, isLoading: true }));
        try {
          await onDeleteNegocio(negocio.id);
          setDeleteConfig((prev) => ({ ...prev, isOpen: false }));
        } finally {
          setDeleteConfig((prev) => ({ ...prev, isLoading: false }));
        }
      },
    });
  };

  const promptDeleteBranch = (sede: Sede, negocioId: string) => {
    if (!onDeleteSede) return;
    setDeleteConfig({
      isOpen: true,
      title: '¿Eliminar Sede / Sucursal?',
      itemName: sede.nombre,
      description: `Estás a punto de desvincular y eliminar la sede "${sede.nombre}".`,
      onConfirm: async () => {
        setDeleteConfig((prev) => ({ ...prev, isLoading: true }));
        try {
          await onDeleteSede(sede.id, negocioId);
          setDeleteConfig((prev) => ({ ...prev, isOpen: false }));
        } finally {
          setDeleteConfig((prev) => ({ ...prev, isLoading: false }));
        }
      },
    });
  };

  const handleOpenCreateBranch = (negocio: Negocio) => {
    setEditingBranchTarget(null);
    const sedesActuales = (sedesByNegocio[negocio.id] || []).length;
    verificarCreacionSede(sedesActuales, () => {
      setCreateBranchTarget(negocio);
    });
  };

  const handleOpenEditBranch = (sede: Sede, negocio: Negocio) => {
    setCreateBranchTarget(null);
    setEditingBranchTarget({ sede, negocio });
  };

  if (isLoading) {
    return <BusinessBentoSkeleton />;
  }

  return (
    <div className="rounded-3xl bg-slate-50/95 dark:bg-card/70 backdrop-blur-xl border border-slate-200/90 dark:border-border/80 p-6 sm:p-7 shadow-sm space-y-5">
      {/* Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-border/60 pb-4">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-500" />
            Negocios y sedes administrados ({negocios.length})
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tus organizaciones conectadas con el agente autónomo Luka AI.
          </p>
        </div>

        <Button
          onClick={() => {
            if (isCreateBusinessOpen) {
              setIsCreateBusinessOpen(false);
            } else {
              verificarCreacionNegocio(() => setIsCreateBusinessOpen(true));
            }
          }}
          className="rounded-xl px-4 py-2.5 font-bold text-xs shadow-md inline-flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          {isCreateBusinessOpen ? 'Ocultar Formulario' : 'Registrar negocio'}
        </Button>
      </div>

      {/* 🚀 FORMULARIO IN-PAGE DE REGISTRO DE NEGOCIO */}
      <AnimatePresence>
        {isCreateBusinessOpen && (
          <InlineCreateBusinessCard
            isOpen={isCreateBusinessOpen}
            onClose={() => setIsCreateBusinessOpen(false)}
            onSubmit={async (dto) => {
              await onCreateNegocio(dto);
              setIsCreateBusinessOpen(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Grid Content */}
      {negocios.length === 0 ? (
        /* Empty State */
        <div className="py-10 px-6 rounded-2xl border border-dashed border-slate-300 dark:border-border/80 text-center space-y-3 bg-white dark:bg-muted/20 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
            <Building2 className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h4 className="text-sm font-bold text-foreground">No tienes negocios registrados</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Registra tu primer negocio con su sede para activar el monitoreo en tiempo real y la atención inteligente de WhatsApp.
            </p>
          </div>
          <Button
            onClick={() => verificarCreacionNegocio(() => setIsCreateBusinessOpen(true))}
            className="rounded-xl px-4 py-2.5 text-xs font-bold shadow-sm cursor-pointer inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Crear Negocio
          </Button>
        </div>
      ) : (
        /* Businesses List */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {negocios.map((negocio) => {
            const sedes = sedesByNegocio[negocio.id] || [];
            const isAddingBranchHere = createBranchTarget?.id === negocio.id;
            const isEditingBranchHere = editingBranchTarget?.negocio.id === negocio.id;

            return (
              <motion.div
                key={negocio.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-2xl border border-slate-200/90 dark:border-border/70 bg-white dark:bg-background/50 hover:bg-slate-50/80 dark:hover:bg-background/80 hover:border-emerald-500/30 transition-all shadow-xs flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
                  {/* Cabecera del Negocio */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-border/40 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/15 to-teal-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-black text-sm shadow-xs">
                        {negocio.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground tracking-tight line-clamp-1 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                          {negocio.nombre}
                        </h4>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 rounded-md inline-block">
                          {sedes.length > 0 ? `${sedes.length} Sede(s)` : 'Matriz'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {onUpdateNegocio && (
                        <button
                          type="button"
                          onClick={() => setEditingBusiness(negocio)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-muted transition-colors cursor-pointer"
                          title="Editar Negocio"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => promptDeleteBusiness(negocio)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                        title="Eliminar Negocio"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Teléfono Administrativo */}
                  {negocio.telefono && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>{negocio.telefono}</span>
                      {negocio.telefonoSecundario && <span>• {negocio.telefonoSecundario}</span>}
                    </div>
                  )}

                  {/* Descripción */}
                  {negocio.contexto && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {negocio.contexto}
                    </p>
                  )}

                  {/* Lista de Sedes Embebida */}
                  <div className="pt-2 border-t border-slate-200/80 dark:border-border/50 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-muted-foreground flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                        <Layers className="w-3 h-3 text-emerald-500" /> Sedes ({sedes.length})
                      </span>

                      {onCreateSede && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isAddingBranchHere) {
                              setCreateBranchTarget(null);
                            } else {
                              handleOpenCreateBranch(negocio);
                            }
                          }}
                          className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>{isAddingBranchHere ? 'Cerrar' : 'Añadir Sede'}</span>
                        </button>
                      )}
                    </div>

                    {/* 🚀 FORMULARIO IN-PAGE DE REGISTRO DE SEDE */}
                    <AnimatePresence>
                      {isAddingBranchHere && onCreateSede && (
                        <InlineCreateBranchCard
                          negocio={negocio}
                          isOpen={isAddingBranchHere}
                          onClose={() => setCreateBranchTarget(null)}
                          onSubmit={async (negocioId, dto) => {
                            await onCreateSede(negocioId, dto);
                            setCreateBranchTarget(null);
                          }}
                        />
                      )}
                    </AnimatePresence>

                    {/* 🚀 FORMULARIO IN-PAGE DE EDICIÓN DE SEDE */}
                    <AnimatePresence>
                      {isEditingBranchHere && onUpdateSede && editingBranchTarget && (
                        <InlineCreateBranchCard
                          negocio={negocio}
                          isOpen={isEditingBranchHere}
                          sedeToEdit={editingBranchTarget.sede}
                          onClose={() => setEditingBranchTarget(null)}
                          onSubmit={async () => {}}
                          onUpdate={async (sedeId, negocioId, dto) => {
                            await onUpdateSede(sedeId, negocioId, dto);
                            setEditingBranchTarget(null);
                          }}
                        />
                      )}
                    </AnimatePresence>

                    {sedes.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground italic py-1">
                        Sin sedes registradas. Añade una para conectar WhatsApp.
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {sedes.map((sede) => (
                          <div
                            key={sede.id}
                            className="p-2.5 rounded-xl bg-slate-50 dark:bg-background/60 border border-slate-200/80 dark:border-border/60 flex items-center justify-between text-xs shadow-2xs hover:border-slate-300 dark:hover:border-border transition-colors"
                          >
                            <div className="space-y-0.5 min-w-0 pr-2">
                              <div className="font-bold text-foreground truncate flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                                <span className="truncate">{sede.nombre}</span>
                              </div>
                              {sede.direccion && (
                                <p className="text-[10px] text-muted-foreground truncate pl-4">
                                  {sede.direccion}
                                </p>
                              )}
                              {sede.telefono && (
                                <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono pl-4 flex items-center gap-1">
                                  <MessageSquare className="w-2.5 h-2.5" />
                                  {sede.telefono}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {onUpdateSede && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditBranch(sede, negocio)}
                                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-slate-200/70 dark:hover:bg-muted transition-colors cursor-pointer"
                                  title="Editar Sede"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                              )}
                              {onDeleteSede && (
                                <button
                                  type="button"
                                  onClick={() => promptDeleteBranch(sede, negocio.id)}
                                  className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                                  title="Eliminar Sede"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal Editar Negocio */}
      {editingBusiness && onUpdateNegocio && (
        <EditBusinessModal
          isOpen={!!editingBusiness}
          onClose={() => setEditingBusiness(null)}
          negocio={editingBusiness}
          onSubmit={onUpdateNegocio}
        />
      )}

      {/* Modal Confirmación de Eliminación */}
      <DeleteConfirmationModal
        isOpen={deleteConfig.isOpen}
        onClose={() => setDeleteConfig((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={deleteConfig.onConfirm}
        title={deleteConfig.title}
        description={deleteConfig.description}
        itemName={deleteConfig.itemName}
        isLoading={deleteConfig.isLoading}
        requireStrictConfirmation={true}
      />

      {/* Modal Paywall */}
      <PlanLimitPaywallModal
        isOpen={isPaywallOpen}
        onClose={cerrarPaywall}
        motivo={paywallMotivo}
        planActualId={planUsuarioId}
        planRecomendadoId={paywallPlanRecomendadoId}
        catalogo={catalogo}
      />
    </div>
  );
}
