import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
} from "motion/react";
import { GoogleLogin } from "@react-oauth/google";

import { Button } from "@/app/components/ui/button";
import { useAuth } from "../hooks/useAuth";
import { authApi } from "../api/authApi";
import { AuthErrorAlert } from "./AuthErrorAlert";

const ease = [0.22, 1, 0.36, 1] as const;

export function LoginForm() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    login,
    googleLogin,
    isLoading,
    error,
    clearError,
  } = useAuth();

  const shouldReduceMotion = useReducedMotion();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [localError, setLocalError] = useState<string | null>(
    null,
  );

  const [isResending, setIsResending] = useState(false);

  const [resendMsg, setResendMsg] = useState<string | null>(
    null,
  );

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  /**
   * Contenedor del botón real de Google.
   *
   * GoogleLogin necesita un ancho numérico.
   * Medimos el contenedor visual para que el botón
   * real de Google ocupe exactamente el mismo ancho.
   */
  const googleButtonContainerRef =
    useRef<HTMLDivElement>(null);

  const [googleButtonWidth, setGoogleButtonWidth] =
    useState(0);

  useEffect(() => {
    const element = googleButtonContainerRef.current;

    if (!element) {
      return;
    }

    const updateWidth = () => {
      const width = Math.floor(element.clientWidth);

      if (width > 0) {
        setGoogleButtonWidth(width);
      }
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    clearError();
    setLocalError(null);
    setResendMsg(null);

    return () => {
      clearError();
    };
  }, [clearError]);

  /**
   * Determina hacia dónde enviar al usuario después
   * de una autenticación completamente exitosa.
   */
  const navigateAfterLogin = (loggedUser: {
    rolGlobal?: string;
  }) => {
    const from = (
      location.state as {
        from?: {
          pathname?: string;
        };
      }
    )?.from?.pathname;

    if (from && from !== "/login") {
      navigate(from, {
        replace: true,
      });

      return;
    }

    if (loggedUser.rolGlobal === "MASTER") {
      navigate("/admin", {
        replace: true,
      });

      return;
    }

    navigate("/", {
      replace: true,
    });
  };

  /**
   * Cuando el backend solicita MFA:
   *
   * - AuthContext conserva el flujo MFA en memoria.
   * - Todavía NO existe access_token definitivo.
   * - Navegamos a /mfa.
   *
   * El estado `from` se conserva para no perder la ruta
   * original que el usuario intentaba visitar.
   */
  const navigateToMfa = () => {
    const from = (
      location.state as {
        from?: {
          pathname?: string;
          search?: string;
          hash?: string;
        };
      }
    )?.from;

    navigate("/mfa", {
      replace: true,
      state: {
        from,
      },
    });
  };

  /**
   * Login tradicional.
   */
  const handleSubmit = async (
    e: React.FormEvent,
  ) => {
    e.preventDefault();

    const cleanEmail = email
      .trim()
      .toLowerCase();

    if (!cleanEmail || !password) {
      setLocalError(
        "Por favor ingresa tu correo y contraseña.",
      );

      return;
    }

    setLocalError(null);
    setResendMsg(null);
    clearError();

    try {
      const result = await login({
        email: cleanEmail,
        password,
      });

      /**
       * MASTER:
       * todavía no tiene sesión definitiva.
       * Debe completar MFA antes de entrar.
       */
      if (result.status === "mfa-required") {
        navigateToMfa();

        return;
      }

      /**
       * CLIENTE o MASTER después de una autenticación
       * completamente exitosa.
       */
      navigateAfterLogin(result.user);
    } catch (err) {
      console.error(
        "❌ [LoginForm] Error en handleSubmit:",
        err,
      );
    }
  };

  /**
   * Login mediante Google.
   *
   * Google entrega un ID Token en `credential`.
   * Ese token se envía al backend, donde se valida
   * mediante google-auth-library.
   */
  const handleGoogleSuccess = async (
    credential: string,
  ) => {
    if (!credential) {
      setIsGoogleLoading(false);

      setLocalError(
        "Google no pudo completar la autenticación. Inténtalo nuevamente.",
      );

      return;
    }

    setLocalError(null);
    setResendMsg(null);
    clearError();
    setIsGoogleLoading(true);

    try {
      const result =
        await googleLogin(credential);

      /**
       * Si el usuario es MASTER y requiere MFA,
       * todavía no existe una sesión definitiva.
       */
      if (result.status === "mfa-required") {
        navigateToMfa();

        return;
      }

      navigateAfterLogin(result.user);
    } catch (err) {
      console.error(
        "❌ [LoginForm] Error en Google Login:",
        err,
      );

      setLocalError(
        err instanceof Error &&
          err.message
          ? err.message
          : "No fue posible iniciar sesión con Google. Inténtalo nuevamente.",
      );
    } finally {
      setIsGoogleLoading(false);
    }
  };

  /**
   * Error producido por Google Identity Services.
   */
  const handleGoogleError = () => {
    setIsGoogleLoading(false);

    setLocalError(
      "No fue posible iniciar sesión con Google. Inténtalo nuevamente.",
    );

    clearError();
  };

  /**
   * Reenvío rápido del correo de verificación.
   */
  const handleQuickResend = async () => {
    const cleanEmail = email
      .trim()
      .toLowerCase();

    if (!cleanEmail) {
      setLocalError(
        "Por favor ingresa tu correo electrónico para reenviarte el enlace de activación.",
      );

      return;
    }

    setIsResending(true);

    try {
      const res =
        await authApi.reenviarVerificacion(
          cleanEmail,
        );

      setResendMsg(
        res.mensaje ||
          "Correo de verificación reenviado con éxito. Revisa tu bandeja de entrada.",
      );

      setLocalError(null);
      clearError();
    } catch (err: any) {
      setLocalError(
        err?.message ||
          "No se pudo reenviar el correo. Verifica que el email sea el correcto.",
      );
    } finally {
      setIsResending(false);
    }
  };

  const displayError =
    localError || error;

  const loginDisabled =
    isLoading || isGoogleLoading;

  return (
    <div
      className="
        flex
        h-full
        min-h-0
        w-full
        items-center
        justify-center
        overflow-hidden
        bg-background
      "
    >
      <div
        className="
          flex
          h-full
          min-h-0
          w-full
          max-w-[560px]
          flex-col
          justify-between
          px-6
          py-6
          sm:px-10
          sm:py-7
          lg:px-12
          lg:py-7
        "
      >
        {/* ============================================================
            MAIN CONTENT
        ============================================================ */}

        <motion.div
          initial={
            shouldReduceMotion
              ? {
                  opacity: 1,
                  y: 0,
                }
              : {
                  opacity: 0,
                  y: 16,
                }
          }
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: shouldReduceMotion
              ? 0
              : 0.7,
            ease,
          }}
          className="
            flex
            min-h-0
            flex-1
            flex-col
            justify-center
          "
        >
          {/* ==========================================================
              EYEBROW
          ========================================================== */}

          <motion.div
            initial={
              shouldReduceMotion
                ? {
                    opacity: 1,
                    y: 0,
                  }
                : {
                    opacity: 0,
                    y: 8,
                  }
            }
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: shouldReduceMotion
                ? 0
                : 0.5,
              delay: shouldReduceMotion
                ? 0
                : 0.08,
              ease,
            }}
            className="mb-4 sm:mb-5"
          >
            <span
              className="
                text-[9px]
                font-semibold
                uppercase
                tracking-[0.18em]
                text-muted-foreground/60
                sm:text-[10px]
              "
            >
              Iniciar sesión
            </span>
          </motion.div>

          {/* ==========================================================
              TITLE
          ========================================================== */}

          <motion.div
            initial={
              shouldReduceMotion
                ? {
                    opacity: 1,
                    y: 0,
                  }
                : {
                    opacity: 0,
                    y: 12,
                  }
            }
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: shouldReduceMotion
                ? 0
                : 0.6,
              delay: shouldReduceMotion
                ? 0
                : 0.14,
              ease,
            }}
          >
            <h1
              className="
                bg-gradient-to-r
                from-emerald-400
                via-cyan-400
                to-blue-500
                bg-clip-text
                text-[2.15rem]
                font-bold
                leading-[1.02]
                tracking-[-0.045em]
                text-transparent
                sm:text-[2.45rem]
              "
            >
              Bienvenido
              <br />
              de nuevo.
            </h1>

            <p
              className="
                mt-3
                max-w-[450px]
                text-[13px]
                leading-5
                text-muted-foreground
                sm:mt-4
                sm:text-[14px]
                sm:leading-6
              "
            >
              Ingresa a tu cuenta para continuar
              administrando tu negocio con Luka.
            </p>
          </motion.div>

          {/* ==========================================================
              SUCCESS
          ========================================================== */}

          <AnimatePresence mode="wait">
            {resendMsg && (
              <motion.div
                key="resend-success"
                initial={
                  shouldReduceMotion
                    ? {
                        opacity: 1,
                      }
                    : {
                        opacity: 0,
                        y: -6,
                        scale: 0.98,
                      }
                }
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                }}
                exit={{
                  opacity: 0,
                  y: -6,
                  scale: 0.98,
                }}
                transition={{
                  duration: shouldReduceMotion
                    ? 0
                    : 0.35,
                  ease,
                }}
                className="
                  mt-4
                  flex
                  items-start
                  gap-3
                  rounded-xl
                  border
                  border-emerald-500/15
                  bg-emerald-500/[0.06]
                  px-4
                  py-3
                  sm:mt-5
                "
              >
                <CheckCircle2
                  className="
                    mt-0.5
                    h-4
                    w-4
                    shrink-0
                    text-emerald-500
                  "
                />

                <span
                  className="
                    text-[11px]
                    font-medium
                    leading-5
                    text-emerald-700
                    dark:text-emerald-400
                    sm:text-[12px]
                  "
                >
                  {resendMsg}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ==========================================================
              ERROR
          ========================================================== */}

          <AnimatePresence>
            {displayError && (
              <motion.div
                initial={
                  shouldReduceMotion
                    ? {
                        opacity: 1,
                      }
                    : {
                        opacity: 0,
                        y: -6,
                      }
                }
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  y: -6,
                }}
                transition={{
                  duration: shouldReduceMotion
                    ? 0
                    : 0.3,
                  ease,
                }}
                className="mt-4 sm:mt-5"
              >
                <AuthErrorAlert
                  error={displayError}
                  onResendVerification={
                    handleQuickResend
                  }
                  isResending={isResending}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ==========================================================
              FORM
          ========================================================== */}

          <motion.form
            onSubmit={handleSubmit}
            initial={
              shouldReduceMotion
                ? {
                    opacity: 1,
                    y: 0,
                  }
                : {
                    opacity: 0,
                    y: 12,
                  }
            }
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: shouldReduceMotion
                ? 0
                : 0.6,
              delay: shouldReduceMotion
                ? 0
                : 0.2,
              ease,
            }}
            className="
              mt-6
              space-y-4
              sm:mt-7
              sm:space-y-5
            "
          >
            {/* ========================================================
                EMAIL
            ======================================================== */}

            <div className="space-y-2">
              <label
                htmlFor="login-email"
                className="
                  block
                  text-[9px]
                  font-semibold
                  uppercase
                  tracking-[0.15em]
                  text-foreground/60
                  sm:text-[10px]
                "
              >
                Correo electrónico
              </label>

              <input
                id="login-email"
                type="email"
                placeholder="tu@empresa.com"
                required
                disabled={loginDisabled}
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);

                  if (displayError) {
                    setLocalError(null);
                    clearError();
                  }
                }}
                className="
                  h-[50px]
                  w-full
                  rounded-[14px]
                  border
                  border-border/80
                  bg-background
                  px-4
                  text-[13px]
                  font-medium
                  text-foreground
                  outline-none
                  transition-all
                  duration-300
                  placeholder:text-muted-foreground/40
                  hover:border-border
                  focus:border-primary/50
                  focus:ring-4
                  focus:ring-primary/8
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                  sm:h-[54px]
                  sm:text-[14px]
                "
              />
            </div>

            {/* ========================================================
                PASSWORD
            ======================================================== */}

            <div className="space-y-2">
              <div
                className="
                  flex
                  items-center
                  justify-between
                  gap-4
                "
              >
                <label
                  htmlFor="login-password"
                  className="
                    text-[9px]
                    font-semibold
                    uppercase
                    tracking-[0.15em]
                    text-foreground/60
                    sm:text-[10px]
                  "
                >
                  Contraseña
                </label>

                <Link
                  to="/forgot-password"
                  onClick={() => clearError()}
                  className="
                    text-[10px]
                    font-semibold
                    text-primary
                    transition-opacity
                    hover:opacity-70
                    sm:text-[11px]
                  "
                >
                  ¿La olvidaste?
                </Link>
              </div>

              <div className="relative">
                <input
                  id="login-password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  placeholder="••••••••"
                  required
                  disabled={loginDisabled}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);

                    if (displayError) {
                      setLocalError(null);
                      clearError();
                    }
                  }}
                  className="
                    h-[50px]
                    w-full
                    rounded-[14px]
                    border
                    border-border/80
                    bg-background
                    px-4
                    pr-14
                    text-[13px]
                    font-medium
                    tracking-[0.08em]
                    text-foreground
                    outline-none
                    transition-all
                    duration-300
                    placeholder:text-muted-foreground/40
                    hover:border-border
                    focus:border-primary/50
                    focus:ring-4
                    focus:ring-primary/8
                    disabled:cursor-not-allowed
                    disabled:opacity-60
                    sm:h-[54px]
                    sm:text-[14px]
                  "
                />

                <button
                  type="button"
                  disabled={loginDisabled}
                  onClick={() =>
                    setShowPassword(
                      (value) => !value,
                    )
                  }
                  aria-label={
                    showPassword
                      ? "Ocultar contraseña"
                      : "Mostrar contraseña"
                  }
                  className="
                    absolute
                    right-2
                    top-1/2
                    flex
                    h-10
                    w-10
                    -translate-y-1/2
                    items-center
                    justify-center
                    rounded-xl
                    text-muted-foreground/50
                    transition-all
                    duration-200
                    hover:bg-muted
                    hover:text-foreground
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >
                  {showPassword ? (
                    <EyeOff
                      className="
                        h-[16px]
                        w-[16px]
                        sm:h-[17px]
                        sm:w-[17px]
                      "
                    />
                  ) : (
                    <Eye
                      className="
                        h-[16px]
                        w-[16px]
                        sm:h-[17px]
                        sm:w-[17px]
                      "
                    />
                  )}
                </button>
              </div>
            </div>

            {/* ========================================================
                GOOGLE
            ======================================================== */}

            <motion.div
              initial={
                shouldReduceMotion
                  ? {
                      opacity: 1,
                      y: 0,
                    }
                  : {
                      opacity: 0,
                      y: 8,
                    }
              }
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                duration: shouldReduceMotion
                  ? 0
                  : 0.5,
                delay: shouldReduceMotion
                  ? 0
                  : 0.27,
                ease,
              }}
              className="
                space-y-3
                sm:space-y-4
              "
            >
              {/* ======================================================
                  DIVIDER
              ====================================================== */}

              <div
                className="
                  relative
                  flex
                  items-center
                "
              >
                <div className="h-px flex-1 bg-border/70" />

                <span
                  className="
                    shrink-0
                    px-3
                    text-[8px]
                    font-semibold
                    uppercase
                    tracking-[0.14em]
                    text-muted-foreground/40
                    sm:text-[9px]
                  "
                >
                  o continúa con
                </span>

                <div className="h-px flex-1 bg-border/70" />
              </div>

              {/* ======================================================
                  GOOGLE BUTTON
              ====================================================== */}

              <div
                ref={googleButtonContainerRef}
                className="
                  relative
                  h-[50px]
                  w-full
                  sm:h-[54px]
                "
              >
                {/* ==================================================
                    BOTÓN VISUAL DE LUKA
                ================================================== */}

                <motion.div
                  whileHover={
                    shouldReduceMotion ||
                    loginDisabled
                      ? undefined
                      : {
                          y: -1,
                        }
                  }
                  whileTap={
                    shouldReduceMotion ||
                    loginDisabled
                      ? undefined
                      : {
                          scale: 0.995,
                        }
                  }
                  className="
                    pointer-events-none
                    absolute
                    inset-0
                    z-0
                    flex
                    h-full
                    w-full
                    items-center
                    justify-center
                    overflow-hidden
                    rounded-[14px]
                    border
                    border-gray-200
                    bg-white
                    px-5
                    text-[13px]
                    font-bold
                    text-gray-800
                    shadow-none
                    transition-all
                    duration-300
                    sm:text-[14px]
                  "
                >
                  <span
                    className="
                      relative
                      flex
                      items-center
                      justify-center
                      gap-2.5
                    "
                  >
                    {isGoogleLoading ? (
                      <>
                        <Loader2
                          className="
                            h-4
                            w-4
                            animate-spin
                            text-gray-500
                          "
                        />

                        <span className="text-gray-700">
                          Conectando con Google...
                        </span>
                      </>
                    ) : (
                      <>
                        {/* GOOGLE LOGO */}

                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="
                            h-[18px]
                            w-[18px]
                            shrink-0
                            sm:h-[19px]
                            sm:w-[19px]
                          "
                        >
                          <path
                            fill="#4285F4"
                            d="M21.35 12.27c0-.72-.06-1.42-.18-2.09H12v3.96h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.26Z"
                          />

                          <path
                            fill="#34A853"
                            d="M12 21.74c2.63 0 4.84-.87 6.46-2.35l-3.14-2.45c-.87.58-1.98.92-3.32.92-2.55 0-4.71-1.72-5.49-4.04H3.27v2.53A9.75 9.75 0 0 0 12 21.74Z"
                          />

                          <path
                            fill="#FBBC05"
                            d="M6.51 13.82A5.86 5.86 0 0 1 6.2 12c0-.63.11-1.25.31-1.82V7.65H3.27A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.05 1.02 4.35l3.24-2.53Z"
                          />

                          <path
                            fill="#EA4335"
                            d="M12 6.14c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.24 14.63 2.26 12 2.26a9.75 9.75 0 0 0-8.73 5.39l3.24 2.53C7.29 7.86 9.45 6.14 12 6.14Z"
                          />
                        </svg>

                        <span>
                          Continuar con Google
                        </span>
                      </>
                    )}
                  </span>
                </motion.div>

                {/* ==================================================
                    GOOGLE REAL / TRANSPARENTE
                ================================================== */}

                {googleButtonWidth > 0 && (
                  <div
                    className="
                      absolute
                      inset-0
                      z-10
                      flex
                      h-full
                      w-full
                      items-center
                      justify-center
                      overflow-hidden
                      rounded-[14px]
                      opacity-0
                    "
                  >
                    <GoogleLogin
                      onSuccess={(
                        credentialResponse,
                      ) => {
                        if (
                          credentialResponse.credential
                        ) {
                          void handleGoogleSuccess(
                            credentialResponse.credential,
                          );
                        } else {
                          handleGoogleError();
                        }
                      }}
                      onError={
                        handleGoogleError
                      }
                      useOneTap={false}
                      theme="outline"
                      size="large"
                      text="continue_with"
                      shape="pill"
                      width={
                        googleButtonWidth
                      }
                    />
                  </div>
                )}
              </div>
            </motion.div>

            {/* ========================================================
                CTA
            ======================================================== */}

            <motion.div
              whileHover={
                shouldReduceMotion ||
                loginDisabled
                  ? undefined
                  : {
                      y: -1,
                    }
              }
              whileTap={
                shouldReduceMotion ||
                loginDisabled
                  ? undefined
                  : {
                      scale: 0.995,
                    }
              }
              className="pt-0.5"
            >
              <Button
                type="submit"
                disabled={loginDisabled}
                className="
                  group
                  relative
                  h-[50px]
                  w-full
                  overflow-hidden
                  rounded-[14px]
                  bg-primary
                  px-5
                  text-[13px]
                  font-bold
                  text-primary-foreground
                  shadow-none
                  transition-all
                  duration-300
                  hover:shadow-lg
                  hover:shadow-primary/15
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                  sm:h-[54px]
                  sm:text-[14px]
                "
              >
                <span
                  className="
                    relative
                    flex
                    items-center
                    justify-center
                    gap-2
                  "
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Verificando
                      credenciales...
                    </>
                  ) : isGoogleLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Conectando con Google...
                    </>
                  ) : (
                    <>
                      Ingresar a la plataforma

                      <ArrowRight
                        className="
                          h-4
                          w-4
                          transition-transform
                          duration-300
                          group-hover:translate-x-1
                        "
                      />
                    </>
                  )}
                </span>
              </Button>
            </motion.div>
          </motion.form>

          {/* ==========================================================
              REGISTER
          ========================================================== */}

          <motion.div
            initial={
              shouldReduceMotion
                ? {
                    opacity: 1,
                    y: 0,
                  }
                : {
                    opacity: 0,
                    y: 7,
                  }
            }
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: shouldReduceMotion
                ? 0
                : 0.5,
              delay: shouldReduceMotion
                ? 0
                : 0.45,
              ease,
            }}
            className="
              mt-5
              text-center
              sm:mt-6
            "
          >
            <p
              className="
                text-[11px]
                text-muted-foreground
                sm:text-[12px]
              "
            >
              ¿No tienes una cuenta?{" "}
              <Link
                to="/register"
                onClick={() =>
                  clearError()
                }
                className="
                  font-semibold
                  text-primary
                  transition-opacity
                  hover:opacity-70
                "
              >
                Regístrate gratis
              </Link>
            </p>
          </motion.div>

          {/* ==========================================================
              SECURITY
          ========================================================== */}

          <motion.div
            initial={
              shouldReduceMotion
                ? {
                    opacity: 1,
                  }
                : {
                    opacity: 0,
                  }
            }
            animate={{
              opacity: 1,
            }}
            transition={{
              duration: shouldReduceMotion
                ? 0
                : 0.5,
              delay: shouldReduceMotion
                ? 0
                : 0.58,
              ease,
            }}
            className="
              mt-5
              flex
              items-center
              justify-center
              gap-2
              text-[8px]
              font-medium
              uppercase
              tracking-[0.13em]
              text-muted-foreground/35
              sm:mt-6
              sm:text-[9px]
            "
          >
            <span
              className="
                h-1
                w-1
                rounded-full
                bg-emerald-500/50
              "
            />

            Acceso seguro
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}