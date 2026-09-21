export interface Negocio {
  id: string;
  nombre: string;
  telefono: string;
  telefonoSecundario?: string | null;
  contexto?: string | null;
  createdAt?: string;
  updatedAt?: string;
  role?: string; // Role of current user in this business (e.g. 'ADMIN', 'OPERADOR')
  active?: boolean;
}

export interface CreateNegocioDto {
  nombre: string;
  telefonoContacto?: string;
  telefono?: string;
  telefonoSecundario?: string;
  contexto?: string;
}

export interface UpdateNegocioDto {
  nombre?: string;
  telefono?: string;
  telefonoSecundario?: string;
  contexto?: string;
}

export interface UpdateUsuarioDto {
  nombre?: string;
  telefono?: string;
}

export interface UserProfileResponse {
  id: string;
  nombre: string;
  email: string;
  telefono?: string | null;
  emailVerificado: boolean;
  rolGlobal: 'MASTER' | 'CLIENTE';
  plan?: number;
  createdAt?: string;
  negocios?: Array<{
    negocio: {
      id: string;
      nombre: string;
      telefono?: string;
      telefonoSecundario?: string;
      contexto?: string;
    };
  }>;
  sedes?: Array<{
    sede: {
      id: string;
      nombre: string;
      negocioId: string;
      telefono?: string;
      whatsappUsername?: string;
      direccion?: string;
    };
  }>;
}

export interface CambiarEmailDto {
  password: string;
  nuevoEmail: string;
}

export interface Sede {
  id: string;
  nombre: string;
  negocioId: string;
  telefono?: string | null;
  whatsappUsername?: string | null;
  whatsappUserId?: string | null;
  direccion?: string | null;
  contexto?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateSedeDto {
  nombre: string;
  negocioId: string;
  telefono?: string;
  whatsappUsername?: string;
  direccion?: string;
  contexto?: string;
}

export interface UpdateSedeDto {
  nombre?: string;
  telefono?: string;
  whatsappUsername?: string;
  direccion?: string;
  contexto?: string;
}

export interface CreateNegocioConSedeDto {
  // Datos Empresa Matriz
  nombre: string;
  telefonoContacto?: string;
  telefonoSecundario?: string;
  contexto?: string;
  // Datos Primera Sede
  nombreSede: string;
  direccionSede?: string;
  whatsappPhone?: string;
  whatsappUsername?: string;
}
