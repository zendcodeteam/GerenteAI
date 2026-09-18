import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';

import {
  useNavigate,
} from 'react-router';

import {
  useAuth,
} from '../context/AuthContext';

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/app/components/ui/input-otp";

export function MfaPage() {
  const navigate = useNavigate();

  const {
    mfa,
    user,
    isLoading,
    error,
    activateMfa,
    verifyMfaActivation,
    verifyMfa,
    clearMfa,
    clearError,
  } = useAuth();

  const [secret, setSecret] =
    useState<string>('');

  const [otpauthUrl, setOtpauthUrl] =
    useState<string>('');

  const [codigo, setCodigo] =
    useState<string>('');

  const [copied, setCopied] =
    useState<boolean>(false);

  const [activationStarted, setActivationStarted] =
    useState<boolean>(false);

  /**
   * Si no existe un flujo MFA pendiente,
   * esta página no puede utilizarse directamente.
   */
  useEffect(() => {
    if (!mfa) {
      navigate('/login', {
        replace: true,
      });
    }
  }, [mfa, navigate]);

  /**
   * Inicia la configuración inicial de MFA.
   *
   * El backend genera:
   * - secreto TOTP
   * - otpauthUrl
   *
   * El token temporal nunca se expone
   * directamente desde esta pantalla.
   */
  const startActivation = useCallback(
    async () => {
      if (!mfa) return;

      if (mfa.action !== 'setup') {
        return;
      }

      if (activationStarted) {
        return;
      }

      setActivationStarted(true);
      clearError();

      try {
        const response =
          await activateMfa();

        setSecret(response.secret);
        setOtpauthUrl(
          response.otpauthUrl,
        );
      } catch {
        setActivationStarted(false);
      }
    },
    [
      mfa,
      activationStarted,
      activateMfa,
      clearError,
    ],
  );

  /**
   * Cuando la acción es "setup", iniciamos
   * automáticamente la generación del secreto.
   */
  useEffect(() => {
    if (
      mfa?.action === 'setup' &&
      !activationStarted
    ) {
      void startActivation();
    }
  }, [
    mfa?.action,
    activationStarted,
    startActivation,
  ]);

  /**
   * Copiar el secreto manualmente.
   */
  const handleCopySecret = async () => {
    if (!secret) return;

    try {
      await navigator.clipboard.writeText(
        secret,
      );

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // Si el navegador no permite clipboard,
      // no interrumpimos el flujo MFA.
    }
  };

  /**
   * Después de completar MFA correctamente,
   * el backend ya creó el access_token definitivo.
   *
   * Como el usuario es MASTER, entramos directamente
   * al panel administrativo.
   */
  const handleSuccessfulAuthentication = (
    authenticatedUser: typeof user,
  ) => {
    clearMfa();

    if (
      authenticatedUser?.rolGlobal ===
      'MASTER'
    ) {
      navigate('/admin', {
        replace: true,
      });

      return;
    }

    navigate('/', {
      replace: true,
    });
  };

  /**
   * Verificación del código de activación inicial.
   */
  const handleVerifyActivation =
    async () => {
      if (codigo.length !== 6) {
        return;
      }

      clearError();

      try {
        const authenticatedUser =
          await verifyMfaActivation(
            codigo,
          );

        handleSuccessfulAuthentication(
          authenticatedUser,
        );
      } catch {
        setCodigo('');
      }
    };

  /**
   * Verificación MFA durante un login normal
   * de un MASTER que ya tiene MFA configurado.
   */
  const handleVerifyMfa =
    async () => {
      if (codigo.length !== 6) {
        return;
      }

      clearError();

      try {
        const authenticatedUser =
          await verifyMfa(codigo);

        handleSuccessfulAuthentication(
          authenticatedUser,
        );
      } catch {
        setCodigo('');
      }
    };

  /**
   * Permite cancelar el flujo MFA.
   *
   * Esto elimina el estado temporal y vuelve
   * al login sin crear una sesión.
   */
  const handleBackToLogin = () => {
    clearMfa();
    navigate('/login', {
      replace: true,
    });
  };

  if (!mfa) {
    return null;
  }

  const isSetup =
    mfa.action === 'setup';

  const isActivationVerification =
    mfa.action ===
    'verify-activation';

  const isLoginVerification =
    mfa.action === 'verify';

  const isVerifying =
    isActivationVerification ||
    isLoginVerification;

  const title = isSetup
    ? 'Protege tu cuenta'
    : 'Verificación en dos pasos';

  const description = isSetup
    ? 'Configura una aplicación de autenticación para proteger el acceso a tu cuenta de administrador.'
    : 'Ingresa el código de 6 dígitos generado por tu aplicación de autenticación.';

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Encabezado */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            {isSetup ? (
              <ShieldCheck className="h-7 w-7 text-primary" />
            ) : (
              <LockKeyhole className="h-7 w-7 text-primary" />
            )}
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">
            {title}
          </h1>

          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {description}
          </p>

          {user?.email && (
            <p className="mt-3 text-sm font-medium">
              {user.email}
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

            <div>
              <p className="font-medium">
                No pudimos completar la verificación
              </p>

              <p className="mt-1 opacity-90">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* Configuración inicial */}
        {isSetup && (
          <section className="rounded-2xl border bg-card p-6 shadow-sm">
            <div className="mb-6 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>

              <div>
                <h2 className="font-semibold">
                  Configura tu autenticador
                </h2>

                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  Usa Google Authenticator,
                  Microsoft Authenticator,
                  Authy u otra aplicación
                  compatible con TOTP.
                </p>
              </div>
            </div>

            {/* Estado de generación */}
            {!secret && (
              <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed">
                <div className="flex flex-col items-center gap-3 text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />

                  <p className="text-sm text-muted-foreground">
                    Preparando la configuración
                    segura...
                  </p>
                </div>
              </div>
            )}

            {secret && (
              <>
                {/* URL OTPAuth */}
                <div className="mb-5 rounded-xl border bg-muted/30 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-primary" />

                    <p className="text-sm font-medium">
                      Configuración del autenticador
                    </p>
                  </div>

                  <p className="mb-3 text-xs leading-5 text-muted-foreground">
                    Si tu aplicación permite importar
                    una configuración mediante URI,
                    puedes utilizar la siguiente.
                  </p>

                  <div className="break-all rounded-lg bg-background p-3 font-mono text-[11px] leading-5 text-muted-foreground">
                    {otpauthUrl}
                  </div>
                </div>

                {/* Secreto manual */}
                <div className="mb-6">
                  <label
                    htmlFor="mfa-secret"
                    className="mb-2 block text-sm font-medium"
                  >
                    Clave de configuración
                  </label>

                  <div className="flex gap-2">
                    <div
                      id="mfa-secret"
                      className="flex min-h-11 flex-1 items-center overflow-hidden rounded-xl border bg-muted/30 px-3 font-mono text-sm tracking-wider"
                    >
                      <span className="truncate">
                        {secret}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={
                        handleCopySecret
                      }
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors hover:bg-muted"
                      aria-label="Copiar clave de configuración"
                    >
                      {copied ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Guarda esta clave en un lugar
                    seguro. Es una alternativa si
                    no puedes importar la configuración
                    automáticamente.
                  </p>
                </div>

                {/* Código inicial */}
                <div>
                  <div className="mb-3 text-center">
                    <p className="text-sm font-medium">
                      Confirma la configuración
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Introduce el código que aparece
                      en tu aplicación.
                    </p>
                  </div>

                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={codigo}
                      onChange={setCodigo}
                      disabled={isLoading}
                      autoFocus
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  <button
                    type="button"
                    onClick={
                      handleVerifyActivation
                    }
                    disabled={
                      codigo.length !== 6 ||
                      isLoading
                    }
                    className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Verificando...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4" />
                        Activar MFA y continuar
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {/* Verificación MFA */}
        {isVerifying && (
          <section className="rounded-2xl border bg-card p-6 shadow-sm">
            <div className="mb-6 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>

              <div>
                <h2 className="font-semibold">
                  Abre tu aplicación
                </h2>

                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  Busca la cuenta de Luka AI y
                  escribe el código temporal de
                  6 dígitos que aparece en pantalla.
                </p>
              </div>
            </div>

            <div className="rounded-xl border bg-muted/30 p-5">
              <div className="mb-4 text-center">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Código de autenticación
                </p>
              </div>

              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={codigo}
                  onChange={setCodigo}
                  disabled={isLoading}
                  autoFocus
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>

            <button
              type="button"
              onClick={
                handleVerifyMfa
              }
              disabled={
                codigo.length !== 6 ||
                isLoading
              }
              className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <LockKeyhole className="h-4 w-4" />
                  Verificar código
                </>
              )}
            </button>
          </section>
        )}

        {/* Volver al login */}
        <button
          type="button"
          onClick={handleBackToLogin}
          disabled={isLoading}
          className="mx-auto mt-6 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al inicio de sesión
        </button>

        {/* Indicador de seguridad */}
        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <LockKeyhole className="h-3.5 w-3.5" />
          <span>
            Tu acceso está protegido con
            autenticación multifactor
          </span>
        </div>
      </div>
    </main>
  );
}