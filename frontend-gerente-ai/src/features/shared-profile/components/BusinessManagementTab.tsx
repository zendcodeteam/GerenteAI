import { useState } from 'react';
import { 
  Building2, 
  Plus, 
  Phone, 
  Trash2, 
  Edit3, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  MapPin, 
  MessageSquare, 
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/app/components/ui/button';
import { InlineCreateBusinessCard } from './InlineCreateBusinessCard';
import { InlineCreateBranchCard } from './InlineCreateBranchCard';
import { EditBusinessModal } from './EditBusinessModal';
import { EditBranchModal } from './EditBranchModal';
import { DeleteConfirmationModal } from '@/shared/components/modals/DeleteConfirmationModal';
import { PlanLimitPaywallModal } from '@/shared/components/modals/PlanLimitPaywallModal';
import { usePlanPermissions } from '@/shared/hooks/usePlanPermissions';
import { 
  CreateNegocioDto, 
  CreateSedeDto, 
  Negocio, 
  Sede, 
  UpdateNegocioDto, 
  UpdateSedeDto 
} from '../types';

interface BusinessManagementTabProps {
  negocios: Negocio[];
  sedesByNegocio: Record<string, Sede[]>;
  isLoading: boolean;
  actionError: string | null;
  actionSuccess: string | null;
  onCreateNegocio: (dto: CreateNegocioDto) => Promise<any>;
  onUpdateNegocio: (id: string, dto: UpdateNegocioDto) => Promise<any>;
  onDeleteNegocio: (id: string) => Promise<any>;
  onCreateSede: (negocioId: string, dto: Omit<CreateSedeDto, 'negocioId'>) => Promise<any>;
  onUpdateSede: (sedeId: string, negocioId: string, dto: UpdateSedeDto) => Promise<any>;
  onDeleteSede: (sedeId: string, negocioId: string) => Promise<any>;
  onClearFeedback: () => void;
}

export function BusinessManagementTab({
  negocios,
  sedesByNegocio,
  isLoading,
  actionError,
  actionSuccess,
  onCreateNegocio,
  onUpdateNegocio,
  onDeleteNegocio,
  onCreateSede,
  onUpdateSede,
  onDeleteSede,
}: BusinessManagementTabProps) {
  const [isCreateBusinessOpen, setIsCreateBusinessOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<Negocio | null>(null);
  
  const [createBranchTarget, setCreateBranchTarget] = useState<Negocio | null>(null);
  const [editingBranch, setEditingBranch] = useState<{ sede: Sede; negocioId: string } | null>(null);

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

  const promptDeleteBusiness = (negocio: Negocio) => {
    const sedesCount = (sedesByNegocio[negocio.id] || []).length;
    setDeleteConfig({
      isOpen: true,
      title: '¿Eliminar Negocio?',
      itemName: negocio.nombre,
      description: `Esta acción eliminará el negocio "${negocio.nombre}" y sus ${sedesCount} sede(s) asociada(s). Esta operación no se puede deshacer.`,
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

  const promptDeleteBranch = (sede: Sede, negocio: Negocio) => {
    setDeleteConfig({
      isOpen: true,
      title: '¿Eliminar Sede / Sucursal?',
      itemName: sede.nombre,
      description: `Esta acción desvinculará la sede "${sede.nombre}" de "${negocio.nombre}". Su número de WhatsApp y métricas asociadas quedarán deshabilitados.`,
      onConfirm: async () => {
        setDeleteConfig((prev) => ({ ...prev, isLoading: true }));
        try {
          await onDeleteSede(sede.id, negocio.id);
          setDeleteConfig((prev) => ({ ...prev, isOpen: false }));
        } finally {
          setDeleteConfig((prev) => ({ ...prev, isLoading: false }));
        }
      },
    });
  };

  const handleOpenCreateBranch = (negocio: Negocio) => {
    const sedesActuales = (sedesByNegocio[negocio.id] || []).length;
    verificarCreacionSede(sedesActuales, () => {
      setCreateBranchTarget(negocio);
    });
  };

  return (
    <div className="space-y-6">
      {/* Alertas de Feedback */}
      <AnimatePresence>
        {actionSuccess && (
          <motion.div
            key="success-feedback"
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-800 dark:text-emerald-300 text-sm font-semibold flex items-center gap-3 shadow-sm"
          >
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{actionSuccess}</span>
          </motion.div>
        )}

        {actionError && (
          <motion.div
            key="error-feedback"
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-semibold flex items-center gap-3 shadow-sm"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{actionError}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Principal */}
      <div className="p-6 sm:p-8 rounded-3xl bg-card border border-border/80 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-500" />
              Negocios y sedes administrados ({negocios.length})
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Crea, edita y organiza tus negocios con sus respectivas sucursales y canales de WhatsApp.
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
            className="rounded-xl px-4 py-2.5 font-bold text-xs shadow-md inline-flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            {isCreateBusinessOpen ? 'Ocultar Formulario' : 'Añadir Negocio'}
          </Button>
        </div>

        {/* 🚀 FORMULARIO IN-PAGE DE CREACIÓN DE NEGOCIO */}
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

        {/* Lista de Negocios y Sedes */}
        {isLoading ? (
          <div className="py-16 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
            <p className="text-sm font-medium text-muted-foreground">Cargando tus negocios y sedes...</p>
          </div>
        ) : negocios.length === 0 ? (
          /* Estado Vacío */
          <div className="py-12 px-6 rounded-2xl border border-dashed border-border text-center space-y-4 bg-muted/10">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
              <Building2 className="w-7 h-7" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="text-base font-bold text-foreground">No tienes negocios registrados</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Registra tu primer negocio con su sede principal para comenzar a recibir métricas y automatizar la atención.
              </p>
            </div>
            <Button
              onClick={() => verificarCreacionNegocio(() => setIsCreateBusinessOpen(true))}
              className="rounded-xl px-5 py-3 text-xs font-bold shadow-md cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Crear mi primer negocio
            </Button>
          </div>
        ) : (
          /* Listado Jerárquico de Negocios y Sedes */
          <div className="space-y-6">
            {negocios.map((negocio) => {
              const sedes = sedesByNegocio[negocio.id] || [];
              const isAddingBranchHere = createBranchTarget?.id === negocio.id;

              return (
                <motion.div
                  key={negocio.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-3xl border border-border/80 bg-card/60 backdrop-blur-sm p-5 sm:p-6 shadow-sm space-y-5 hover:border-emerald-500/30 transition-all"
                >
                  {/* Fila Negocio Principal */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-border/50 pb-4">
                    <div className="flex items-start gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/15 to-teal-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-black text-lg shadow-sm shrink-0">
                        {negocio.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base sm:text-lg font-black text-foreground tracking-tight">
                            {negocio.nombre}
                          </h3>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                            Negocio Principal
                          </span>
                        </div>

                        {/* Teléfonos y Contexto */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-medium">
                          {negocio.telefono && (
                            <span className="flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-emerald-500" />
                              {negocio.telefono}
                              {negocio.telefonoSecundario && ` / ${negocio.telefonoSecundario}`}
                            </span>
                          )}
                          <span className="text-[11px] font-mono text-muted-foreground/80">
                            ID: {negocio.id.slice(0, 8)}
                          </span>
                        </div>

                        {negocio.contexto && (
                          <p className="text-xs text-muted-foreground/90 line-clamp-2 pt-0.5">
                            {negocio.contexto}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Botones de Acción Negocio */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setEditingBusiness(negocio)}
                        className="px-3 py-1.5 rounded-xl border border-border bg-background hover:bg-muted text-xs font-bold text-foreground transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                        title="Editar Negocio"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Editar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => promptDeleteBusiness(negocio)}
                        className="p-2 rounded-xl border border-border bg-background hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer shadow-xs"
                        title="Eliminar Negocio"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Sección de Sedes / Sucursales */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-emerald-500" />
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                          Sedes Habilitadas ({sedes.length})
                        </h4>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenCreateBranch(negocio)}
                        className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 inline-flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isAddingBranchHere ? 'Cerrar' : `Añadir Sede a ${negocio.nombre}`}</span>
                      </button>
                    </div>

                    {/* 🚀 FORMULARIO IN-PAGE DE REGISTRO DE SEDE */}
                    <AnimatePresence>
                      {isAddingBranchHere && (
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

                    {sedes.length === 0 ? (
                      <div className="p-4 rounded-2xl border border-dashed border-border text-center text-xs text-muted-foreground bg-muted/10">
                        No hay sucursales registradas. Puedes agregar una con el botón superior.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {sedes.map((sede) => (
                          <div
                            key={sede.id}
                            className="p-3.5 rounded-2xl border border-border/70 bg-background/50 hover:bg-background/80 transition-all flex flex-col justify-between space-y-2.5 shadow-xs"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <Building2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                  <h5 className="text-xs sm:text-sm font-bold text-foreground line-clamp-1">
                                    {sede.nombre}
                                  </h5>
                                </div>

                                {sede.direccion && (
                                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 line-clamp-1">
                                    <MapPin className="w-3 h-3 shrink-0" />
                                    {sede.direccion}
                                  </p>
                                )}
                              </div>

                              {/* Acciones de Sede */}
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setEditingBranch({ sede, negocioId: negocio.id })}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                  title="Editar Sede"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => promptDeleteBranch(sede, negocio)}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                                  title="Eliminar Sede"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Canal WhatsApp de la Sede */}
                            <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px]">
                              <span className="text-muted-foreground flex items-center gap-1">
                                <MessageSquare className="w-3 h-3 text-emerald-500" />
                                {sede.telefono || 'Sin número asignado'}
                              </span>

                              {sede.whatsappUsername && (
                                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold text-[10px]">
                                  @{sede.whatsappUsername}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Editar Negocio */}
      {editingBusiness && (
        <EditBusinessModal
          isOpen={!!editingBusiness}
          onClose={() => setEditingBusiness(null)}
          negocio={editingBusiness}
          onSubmit={onUpdateNegocio}
        />
      )}

      {/* Modal Editar Sede */}
      {editingBranch && (
        <EditBranchModal
          isOpen={!!editingBranch}
          onClose={() => setEditingBranch(null)}
          sede={editingBranch.sede}
          negocioId={editingBranch.negocioId}
          onSubmit={onUpdateSede}
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
