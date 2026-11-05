import { PROVIDER_PRESETS } from './provider.catalog';
import type { ProviderPreset } from './provider.catalog';

/**
 * Configuracion de IA leida del entorno.
 *
 * Cambiar de proveedor es cambiar `AI_PROVIDER` (y su llave). Nada mas.
 */

export interface ProviderRuntimeConfig {
  preset: ProviderPreset;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface AiConfig {
  primary: ProviderRuntimeConfig;
  /** Proveedor de respaldo. Se usa si el principal falla de forma reintentable. */
  fallback?: ProviderRuntimeConfig;
  timeoutMs: number;
  /**
   * Tope para las llamadas con alguien esperando del otro lado (WhatsApp, el
   * chat de la landing).
   *
   * Mas corto que el general a proposito: en un informe que corre de noche dar
   * 45 segundos es razonable, pero quien escribio por WhatsApp ya se fue a
   * otra cosa. Y con reintentos encima, el tope general se multiplica.
   */
  interactiveTimeoutMs: number;
  maxRetries: number;
  maxOutputTokens: number;
  temperature: number;
  /** Registra prompts completos en los logs. Apagado por defecto: son datos del negocio. */
  logPrompts: boolean;
  /** Anthropic: enruta a un modelo de respaldo si los clasificadores rechazan la peticion. */
  anthropicServerFallback: boolean;
}

export class AiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiConfigError';
  }
}

type Env = Record<string, string | undefined>;

export function loadAiConfig(env: Env = process.env): AiConfig {
  // `required: true` garantiza que nunca devuelve undefined (lanza AiConfigError).
  const primary = resolveProvider(env, {
    providerKey: 'AI_PROVIDER',
    modelKey: 'AI_MODEL',
    apiKeyKey: 'AI_API_KEY',
    baseUrlKey: 'AI_BASE_URL',
    defaultProvider: 'echo',
    required: true,
  })!;

  const fallback = resolveProvider(env, {
    providerKey: 'AI_FALLBACK_PROVIDER',
    modelKey: 'AI_FALLBACK_MODEL',
    apiKeyKey: 'AI_FALLBACK_API_KEY',
    baseUrlKey: 'AI_FALLBACK_BASE_URL',
    required: false,
  });

  return {
    primary,
    fallback,
    timeoutMs: readInt(env, 'AI_TIMEOUT_MS', 45_000, 1_000, 600_000),
    interactiveTimeoutMs: readInt(
      env,
      'AI_TIMEOUT_INTERACTIVE_MS',
      20_000,
      1_000,
      600_000,
    ),
    maxRetries: readInt(env, 'AI_MAX_RETRIES', 3, 1, 10),
    maxOutputTokens: readInt(env, 'AI_MAX_OUTPUT_TOKENS', 2_048, 128, 128_000),
    temperature: readFloat(env, 'AI_TEMPERATURE', 0.2, 0, 2),
    logPrompts: readBool(env, 'AI_LOG_PROMPTS', false),
    anthropicServerFallback: readBool(env, 'ANTHROPIC_SERVER_FALLBACK', true),
  };
}

interface ResolveOptions {
  providerKey: string;
  modelKey: string;
  apiKeyKey: string;
  baseUrlKey: string;
  defaultProvider?: string;
  required: boolean;
}

function resolveProvider(
  env: Env,
  options: ResolveOptions,
): ProviderRuntimeConfig | undefined {
  const providerId = (env[options.providerKey] ?? options.defaultProvider ?? '')
    .trim()
    .toLowerCase();

  if (!providerId) {
    if (options.required) {
      throw new AiConfigError(
        `Falta ${options.providerKey}. Opciones validas: ${Object.keys(PROVIDER_PRESETS).join(', ')}.`,
      );
    }
    return undefined;
  }

  const preset = PROVIDER_PRESETS[providerId];
  if (!preset) {
    throw new AiConfigError(
      `${options.providerKey}="${providerId}" no existe. Opciones validas: ${Object.keys(PROVIDER_PRESETS).join(', ')}.`,
    );
  }

  const apiKey =
    env[options.apiKeyKey]?.trim() ||
    (preset.apiKeyEnv ? env[preset.apiKeyEnv]?.trim() : undefined) ||
    undefined;

  if (!apiKey && !preset.apiKeyOptional) {
    throw new AiConfigError(
      `El proveedor "${preset.id}" requiere una llave. Define ${options.apiKeyKey} o ${preset.apiKeyEnv}.`,
    );
  }

  const config: ProviderRuntimeConfig = {
    preset,
    model: env[options.modelKey]?.trim() || preset.defaultModel,
    apiKey,
    baseUrl: env[options.baseUrlKey]?.trim() || preset.baseUrl,
  };

  return config;
}

function readInt(
  env: Env,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = env[key];
  if (raw === undefined || raw.trim() === '') return fallback;

  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) {
    throw new AiConfigError(`${key}="${raw}" no es un numero entero valido.`);
  }
  if (value < min || value > max) {
    throw new AiConfigError(
      `${key}=${value} esta fuera del rango [${min}, ${max}].`,
    );
  }
  return value;
}

function readFloat(
  env: Env,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = env[key];
  if (raw === undefined || raw.trim() === '') return fallback;

  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) {
    throw new AiConfigError(`${key}="${raw}" no es un numero valido.`);
  }
  if (value < min || value > max) {
    throw new AiConfigError(
      `${key}=${value} esta fuera del rango [${min}, ${max}].`,
    );
  }
  return value;
}

function readBool(env: Env, key: string, fallback: boolean): boolean {
  const raw = env[key]?.trim().toLowerCase();
  if (raw === undefined || raw === '') return fallback;
  if (['1', 'true', 'yes', 'si'].includes(raw)) return true;
  if (['0', 'false', 'no'].includes(raw)) return false;
  throw new AiConfigError(`${key}="${raw}" debe ser true o false.`);
}

/** Token de inyeccion de la configuracion ya validada. */
export const AI_CONFIG = Symbol('AI_CONFIG');
