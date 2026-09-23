import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  User,
  Mail,
  Phone,
  MessageCircle,
  Lock,
} from "lucide-react";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
} from "motion/react";
import { GoogleLogin } from "@react-oauth/google";

import { Button } from "@/app/components/ui/button";
import { useAuth } from "../hooks/useAuth";
import { AuthErrorAlert } from "./AuthErrorAlert";

const ease = [0.22, 1, 0.36, 1] as const;

export function RegisterForm() {
  const {
    register,
    googleRegister,
    isLoading,
    error,
    clearError,
  } = useAuth();

  const shouldReduceMotion = useReducedMotion();

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    businessName: "",
    phone: "",
    whatsappUsername: "",
    password: "",
    confirmPassword: "",
    termsAccepted: false,
    privacyAccepted: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successCountdown, setSuccessCountdown] = useState(5);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleCredential, setGoogleCredential] = useState<string | null>(null);

  const isGoogleOnboarding = Boolean(googleCredential);

  const googleButtonContainerRef = useRef<HTMLDivElement>(null);
  const [googleButtonWidth, setGoogleButtonWidth] = useState(0);

  /* ================================================================
     GOOGLE BUTTON WIDTH
  ================================================================ */

  useEffect(() => {
    if (isGoogleOnboarding) {
      return;
    }

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

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);

    return () => observer.disconnect();
  }, [isGoogleOnboarding]);

  /* ================================================================
     CLEAR ERRORS
  ================================================================ */

  useEffect(() => {
    clearError();
    setLocalError(null);

    return () => {
      clearError();
    };
  }, [clearError]);

  /* ================================================================
     SUCCESS REDIRECT COUNTDOWN
  ================================================================ */

  useEffect(() => {
    if (!isSuccess) {
      return;
    }

    setSuccessCountdown(5);

    const interval = window.setInterval(() => {
      setSuccessCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isSuccess]);

  /* ================================================================
     INPUT HANDLER
  ================================================================ */

  const updateField = (
    field: keyof typeof formData,
    value: string | boolean,
  ) => {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));

    if (localError) {
      setLocalError(null);
    }

    if (error) {
      clearError();
    }
  };

  /* ================================================================
     NORMALIZE WHATSAPP
  ================================================================ */

  const normalizeWhatsappUsername = (value: string) =>
    value.trim().replace(/^@+/, "");

  /* ================================================================
     VALIDATION — NORMAL REGISTER
  ================================================================ */

  const validateForm = () => {
    const fullName = formData.fullName.trim();
    const email = formData.email.trim().toLowerCase();
    const businessName = formData.businessName.trim();
    const phone = formData.phone.trim();

    if (!fullName) {
      return "Por favor ingresa tu nombre completo.";
    }

    if (fullName.length < 3) {
      return "El nombre completo debe tener al menos 3 caracteres.";
    }

    if (!email) {
      return "Por favor ingresa tu correo electrónico.";
    }

    if (!businessName) {
      return "Por favor ingresa el nombre de tu negocio.";
    }

    if (!phone) {
      return "Por favor ingresa tu número de celular.";
    }

    if (!formData.password) {
      return "Por favor crea una contraseña.";
    }

    if (formData.password.length < 8) {
      return "La contraseña debe tener al menos 8 caracteres.";
    }

    if (formData.password !== formData.confirmPassword) {
      return "Las contraseñas no coinciden.";
    }

    if (!formData.termsAccepted) {
      return "Debes aceptar los Términos de servicio.";
    }

    if (!formData.privacyAccepted) {
      return "Debes aceptar la Política de privacidad.";
    }

    return null;
  };

  /* ================================================================
     VALIDATION — GOOGLE REGISTER
  ================================================================ */

  const validateGoogleRegister = () => {
    const businessName = formData.businessName.trim();
    const phone = formData.phone.trim();
    const normalizedPhone = phone.replace(/[\s-]/g, "");

    if (!googleCredential) {
      return "La autenticación con Google no está disponible. Inténtalo nuevamente.";
    }

    if (!businessName) {
      return "Por favor ingresa el nombre de tu negocio.";
    }

    if (businessName.length < 2) {
      return "El nombre del negocio debe tener al menos 2 caracteres.";
    }

    if (!phone) {
      return "Por favor ingresa tu número de celular.";
    }

    if (!/^(?:\+?57)?3\d{9}$/.test(normalizedPhone)) {
      return "Ingresa un número celular colombiano válido, por ejemplo +57 300 123 4567.";
    }

    if (!formData.termsAccepted) {
      return "Debes aceptar los Términos de servicio.";
    }

    if (!formData.privacyAccepted) {
      return "Debes aceptar la Política de privacidad.";
    }

    return null;
  };

  /* ================================================================
     SUBMIT
  ================================================================ */

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (googleCredential) {
      const validationError = validateGoogleRegister();

      if (validationError) {
        setLocalError(validationError);
        return;
      }

      setLocalError(null);
      clearError();
      setIsGoogleLoading(true);

      try {
        await googleRegister(
        googleCredential,
        formData.phone.trim(),
        formData.businessName.trim(),
        normalizeWhatsappUsername(formData.whatsappUsername) || undefined,
        {
          termsAccepted: formData.termsAccepted,
          privacyAccepted: formData.privacyAccepted,
        },
      );

        window.location.href = "/";
      } catch (err) {
        console.error(
          "❌ [RegisterForm] Error en registro con Google:",
          err,
        );
      } finally {
        setIsGoogleLoading(false);
      }

      return;
    }

    const validationError = validateForm();

    if (validationError) {
      setLocalError(validationError);
      return;
    }

    setLocalError(null);
    clearError();

    try {
      await register({
        nombre: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        telefono: formData.phone.trim(),
        password: formData.password,
        nombreNegocio: formData.businessName.trim(),
        whatsappUsername: normalizeWhatsappUsername(
          formData.whatsappUsername,
        ),
        termsAccepted: formData.termsAccepted,
        privacyAccepted: formData.privacyAccepted,
      });

      setIsSuccess(true);
    } catch (err) {
      console.error("❌ [RegisterForm] Error en registro:", err);
    }
  };

  /* ================================================================
     GOOGLE SUCCESS
     
     IMPORTANTE:
     Google NO crea la cuenta aquí.
     Solo obtenemos el credential y pasamos al segundo paso.
  ================================================================ */

  const handleGoogleSuccess = (credential: string) => {
    if (!credential) {
      setLocalError(
        "Google no pudo completar la autenticación. Inténtalo nuevamente.",
      );
      return;
    }

    setLocalError(null);
    clearError();
    setIsGoogleLoading(false);

    // El credential queda únicamente en memoria hasta completar el segundo paso.
    setGoogleCredential(credential);
  };

  /* ================================================================
     GOOGLE ERROR
  ================================================================ */

  const handleGoogleError = () => {
    setIsGoogleLoading(false);
    setGoogleCredential(null);
    setLocalError(
      "No fue posible iniciar el registro con Google. Inténtalo nuevamente.",
    );
    clearError();
  };

  /* ================================================================
     BACK TO NORMAL REGISTER
  ================================================================ */

  const handleBackFromGoogle = () => {
    setGoogleCredential(null);
    setIsGoogleLoading(false);
    setLocalError(null);
    clearError();

    setFormData((current) => ({
      ...current,
      businessName: "",
      phone: "",
      whatsappUsername: "",
    }));
  };

  const displayError = localError || error;
  const formDisabled = isLoading || isGoogleLoading;

  /* ================================================================
     SUCCESS SCREEN — NORMAL REGISTER
  ================================================================ */

  if (isSuccess) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-transparent">
        <motion.div
          initial={
            shouldReduceMotion
              ? { opacity: 1, y: 0 }
              : { opacity: 0, y: 18 }
          }
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.7,
            ease,
          }}
          className="flex w-full max-w-[560px] flex-col items-center justify-center px-6 text-center sm:px-10 lg:px-12"
        >
          <motion.div
            initial={
              shouldReduceMotion
                ? { opacity: 1, scale: 1 }
                : { opacity: 0, scale: 0.85 }
            }
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.55,
              ease,
            }}
            className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.07]"
          >
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </motion.div>

          <h1 className="mt-6 bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 bg-clip-text text-[2rem] font-bold leading-tight tracking-[-0.04em] text-transparent sm:text-[2.35rem]">
            Cuenta creada.
          </h1>

          <p className="mt-3 max-w-[430px] text-[13px] leading-6 text-muted-foreground sm:text-[14px]">
            Hemos enviado un correo de verificación a tu dirección de correo
            electrónico. Verifica tu cuenta para comenzar a usar Luka.
          </p>

          <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/45">
            Serás enviado al inicio de sesión en {successCountdown}s
          </p>

          <Link
            to="/login"
            className="mt-5 text-[12px] font-semibold text-primary transition-opacity hover:opacity-70"
          >
            Ir al inicio de sesión
          </Link>
        </motion.div>
      </div>
    );
  }

  /* ================================================================
     MAIN SHELL
  ================================================================ */

  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-transparent">
      <div className="flex h-full min-h-0 w-full max-w-[560px] flex-col px-6 py-5 sm:px-10 sm:py-6 lg:px-12 lg:py-6">
        <motion.div
          key={isGoogleOnboarding ? "google-onboarding" : "normal-register"}
          initial={
            shouldReduceMotion
              ? { opacity: 1, y: 0 }
              : { opacity: 0, y: 12 }
          }
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.55,
            ease,
          }}
          className="flex min-h-0 flex-1 flex-col justify-center"
        >
          {/* ========================================================
              GOOGLE SECOND STEP
          ======================================================== */}

          {isGoogleOnboarding ? (
            <>
              <motion.button
                type="button"
                onClick={handleBackFromGoogle}
                disabled={formDisabled}
                className="mb-5 flex w-fit items-center gap-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Volver
              </motion.button>

              <div className="mb-3">
                <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60 sm:text-[10px]">
                  Casi listo
                </span>
              </div>

              <h1 className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 bg-clip-text text-[2rem] font-bold leading-[1.02] tracking-[-0.045em] text-transparent sm:text-[2.3rem]">
                Completa tu cuenta.
              </h1>

              <p className="mt-2 max-w-[500px] text-[12px] leading-5 text-muted-foreground sm:mt-3 sm:text-[13px] sm:leading-6">
                Tu cuenta de Google ya está verificada. Solo necesitamos unos
                datos para poner Luka en marcha para tu negocio.
              </p>

              <AnimatePresence>
                {displayError && (
                  <motion.div
                    initial={
                      shouldReduceMotion
                        ? { opacity: 1 }
                        : { opacity: 0, y: -6 }
                    }
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{
                      duration: shouldReduceMotion ? 0 : 0.3,
                      ease,
                    }}
                    className="mt-4"
                  >
                    <AuthErrorAlert error={displayError} />
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.form
                noValidate
                onSubmit={handleSubmit}
                className="mt-5 space-y-3 sm:mt-6 sm:space-y-3.5"
              >
                {/* PHONE */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="google-register-phone"
                    className="block text-[9px] font-semibold uppercase tracking-[0.15em] text-foreground/60"
                  >
                    Número de celular
                  </label>

                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/35" />

                    <input
                      id="google-register-phone"
                      type="tel"
                      inputMode="tel"
                      placeholder="+57 300 000 0000"
                      required
                      disabled={formDisabled}
                      autoComplete="tel"
                      value={formData.phone}
                      onChange={(event) =>
                        updateField("phone", event.target.value)
                      }
                      className="h-[50px] w-full rounded-[14px] border border-border/80 bg-background pl-10 pr-4 text-[13px] font-medium text-foreground outline-none transition-all duration-300 placeholder:text-muted-foreground/35 focus:border-primary/50 focus:ring-4 focus:ring-primary/8 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>

                  <p className="text-[8px] leading-4 text-muted-foreground/55">
                    Obligatorio. Incluye el código de país +57.
                  </p>
                </div>

                {/* WHATSAPP */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="google-register-whatsapp"
                    className="block text-[9px] font-semibold uppercase tracking-[0.15em] text-foreground/60"
                  >
                    Usuario de WhatsApp
                    <span className="ml-1.5 normal-case tracking-normal text-muted-foreground/45">
                      (opcional)
                    </span>
                  </label>

                  <div className="relative">
                    <MessageCircle className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/35" />

                    <input
                      id="google-register-whatsapp"
                      type="text"
                      placeholder="@usuario"
                      disabled={formDisabled}
                      autoComplete="off"
                      value={formData.whatsappUsername}
                      onChange={(event) =>
                        updateField(
                          "whatsappUsername",
                          event.target.value,
                        )
                      }
                      className="h-[50px] w-full rounded-[14px] border border-border/80 bg-background pl-10 pr-4 text-[13px] font-medium text-foreground outline-none transition-all duration-300 placeholder:text-muted-foreground/35 focus:border-primary/50 focus:ring-4 focus:ring-primary/8 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>

                  <p className="text-[8px] leading-4 text-muted-foreground/55">
                    Opcional. Puedes escribirlo con o sin @.
                  </p>
                </div>

                {/* BUSINESS */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="google-register-business"
                    className="block text-[9px] font-semibold uppercase tracking-[0.15em] text-foreground/60"
                  >
                    Nombre de tu negocio
                  </label>

                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/35" />

                    <input
                      id="google-register-business"
                      type="text"
                      placeholder="Mi negocio"
                      required
                      disabled={formDisabled}
                      autoComplete="organization"
                      value={formData.businessName}
                      onChange={(event) =>
                        updateField(
                          "businessName",
                          event.target.value,
                        )
                      }
                      className="h-[50px] w-full rounded-[14px] border border-border/80 bg-background pl-10 pr-4 text-[13px] font-medium text-foreground outline-none transition-all duration-300 placeholder:text-muted-foreground/35 focus:border-primary/50 focus:ring-4 focus:ring-primary/8 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>
                </div>

                {/* TERMS */}
                <label className="flex cursor-pointer items-start gap-2.5 pt-0.5">
                  <input
                    type="checkbox"
                    checked={formData.termsAccepted}
                    disabled={formDisabled}
                    onChange={(event) =>
                      updateField(
                        "termsAccepted",
                        event.target.checked,
                      )
                    }
                    className="mt-[2px] h-3.5 w-3.5 shrink-0 cursor-pointer accent-primary"
                  />

                  <span className="text-[9px] leading-4 text-muted-foreground/65 sm:text-[10px]">
                    Acepto los{" "}
                    <Link
                      to="/terminos"
                      className="font-semibold text-primary hover:opacity-70"
                    >
                      Términos de servicio
                    </Link>{" "}
                    de Luka AI.
                  </span>
                </label>

                {/* PRIVACY */}
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={formData.privacyAccepted}
                    disabled={formDisabled}
                    onChange={(event) =>
                      updateField(
                        "privacyAccepted",
                        event.target.checked,
                      )
                    }
                    className="mt-[2px] h-3.5 w-3.5 shrink-0 cursor-pointer accent-primary"
                  />

                  <span className="text-[9px] leading-4 text-muted-foreground/65 sm:text-[10px]">
                    Autorizo el tratamiento de mis datos personales de acuerdo
                    con la{" "}
                    <Link
                      to="/privacidad"
                      className="font-semibold text-primary hover:opacity-70"
                    >
                      Política de privacidad
                    </Link>{" "}
                    de Luka AI.
                  </span>
                </label>

                {/* CTA */}
                <motion.div
                  whileHover={
                    shouldReduceMotion || formDisabled
                      ? undefined
                      : { y: -1 }
                  }
                  whileTap={
                    shouldReduceMotion || formDisabled
                      ? undefined
                      : { scale: 0.995 }
                  }
                  className="pt-0.5"
                >
                  <Button
                    type="submit"
                    disabled={formDisabled}
                    className="group relative h-[50px] w-full overflow-hidden rounded-[14px] bg-primary px-5 text-[13px] font-bold text-primary-foreground shadow-none transition-all duration-300 hover:shadow-lg hover:shadow-primary/15 disabled:cursor-not-allowed disabled:opacity-60 sm:h-[54px] sm:text-[14px]"
                  >
                    <span className="relative flex items-center justify-center gap-2">
                      {isGoogleLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Creando tu cuenta...
                        </>
                      ) : (
                        <>
                          Crear cuenta y comenzar gratis
                          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                        </>
                      )}
                    </span>
                  </Button>
                </motion.div>

                <p className="pt-1 text-center text-[8px] leading-4 text-muted-foreground/45 sm:text-[9px]">
                  Al continuar, Google se utiliza como método de autenticación
                  de tu cuenta. No necesitas crear una contraseña.
                </p>
              </motion.form>
            </>
          ) : (
            /* ========================================================
               NORMAL REGISTER
            ======================================================== */
            <>
              <div className="mb-3 sm:mb-4">
                <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60 sm:text-[10px]">
                  Crear cuenta
                </span>
              </div>

              <h1 className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 bg-clip-text text-[2rem] font-bold leading-[1.02] tracking-[-0.045em] text-transparent sm:text-[2.3rem]">
                Empieza con Luka.
              </h1>

              <p className="mt-2 max-w-[500px] text-[12px] leading-5 text-muted-foreground sm:mt-3 sm:text-[13px] sm:leading-6">
                Crea tu cuenta y empieza a gestionar tu negocio con Inteligencia
                Artificial.
              </p>

              <AnimatePresence>
                {displayError && (
                  <motion.div
                    initial={
                      shouldReduceMotion
                        ? { opacity: 1 }
                        : { opacity: 0, y: -6 }
                    }
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{
                      duration: shouldReduceMotion ? 0 : 0.3,
                      ease,
                    }}
                    className="mt-4"
                  >
                    <AuthErrorAlert error={displayError} />
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.form
                noValidate
                onSubmit={handleSubmit}
                className="mt-5 space-y-3 sm:mt-6 sm:space-y-3.5"
              >
                {/* NAME + EMAIL */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="register-name"
                      className="block text-[9px] font-semibold uppercase tracking-[0.15em] text-foreground/60"
                    >
                      Nombre completo
                    </label>

                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/35" />

                      <input
                        id="register-name"
                        type="text"
                        placeholder="María Rodríguez"
                        required
                        disabled={formDisabled}
                        autoComplete="name"
                        value={formData.fullName}
                        onChange={(event) =>
                          updateField(
                            "fullName",
                            event.target.value,
                          )
                        }
                        className="h-[50px] w-full rounded-[14px] border border-border/80 bg-background pl-10 pr-4 text-[13px] font-medium text-foreground outline-none transition-all duration-300 placeholder:text-muted-foreground/35 focus:border-primary/50 focus:ring-4 focus:ring-primary/8 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="register-email"
                      className="block text-[9px] font-semibold uppercase tracking-[0.15em] text-foreground/60"
                    >
                      Correo electrónico
                    </label>

                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/35" />

                      <input
                        id="register-email"
                        type="email"
                        placeholder="tu@empresa.com"
                        required
                        disabled={formDisabled}
                        autoComplete="email"
                        value={formData.email}
                        onChange={(event) =>
                          updateField(
                            "email",
                            event.target.value,
                          )
                        }
                        className="h-[50px] w-full rounded-[14px] border border-border/80 bg-background pl-10 pr-4 text-[13px] font-medium text-foreground outline-none transition-all duration-300 placeholder:text-muted-foreground/35 focus:border-primary/50 focus:ring-4 focus:ring-primary/8 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </div>
                  </div>
                </div>

                {/* PHONE + WHATSAPP */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="register-phone"
                      className="block text-[9px] font-semibold uppercase tracking-[0.15em] text-foreground/60"
                    >
                      Celular
                    </label>

                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/35" />

                      <input
                        id="register-phone"
                        type="tel"
                        placeholder="+57 300 000 0000"
                        required
                        disabled={formDisabled}
                        autoComplete="tel"
                        value={formData.phone}
                        onChange={(event) =>
                          updateField(
                            "phone",
                            event.target.value,
                          )
                        }
                        className="h-[50px] w-full rounded-[14px] border border-border/80 bg-background pl-10 pr-4 text-[13px] font-medium text-foreground outline-none transition-all duration-300 placeholder:text-muted-foreground/35 focus:border-primary/50 focus:ring-4 focus:ring-primary/8 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </div>

                    <p className="text-[8px] leading-4 text-muted-foreground/55">
                      Incluye el código de país +57.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="register-whatsapp"
                      className="block text-[9px] font-semibold uppercase tracking-[0.15em] text-foreground/60"
                    >
                      WhatsApp
                    </label>

                    <div className="relative">
                      <MessageCircle className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/35" />

                      <input
                        id="register-whatsapp"
                        type="text"
                        placeholder="@usuario"
                        disabled={formDisabled}
                        autoComplete="off"
                        value={formData.whatsappUsername}
                        onChange={(event) =>
                          updateField(
                            "whatsappUsername",
                            event.target.value,
                          )
                        }
                        className="h-[50px] w-full rounded-[14px] border border-border/80 bg-background pl-10 pr-4 text-[13px] font-medium text-foreground outline-none transition-all duration-300 placeholder:text-muted-foreground/35 focus:border-primary/50 focus:ring-4 focus:ring-primary/8 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </div>

                    <p className="text-[8px] leading-4 text-muted-foreground/55">
                      Sin el @. Ejemplo: mariarodriguez.
                    </p>
                  </div>
                </div>

                {/* BUSINESS */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="register-business"
                    className="block text-[9px] font-semibold uppercase tracking-[0.15em] text-foreground/60"
                  >
                    Nombre del negocio
                  </label>

                  <input
                    id="register-business"
                    type="text"
                    placeholder="Mi negocio"
                    required
                    disabled={formDisabled}
                    autoComplete="organization"
                    value={formData.businessName}
                    onChange={(event) =>
                      updateField(
                        "businessName",
                        event.target.value,
                      )
                    }
                    className="h-[50px] w-full rounded-[14px] border border-border/80 bg-background px-4 text-[13px] font-medium text-foreground outline-none transition-all duration-300 placeholder:text-muted-foreground/35 focus:border-primary/50 focus:ring-4 focus:ring-primary/8 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                {/* PASSWORD ROW */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="register-password"
                      className="block text-[9px] font-semibold uppercase tracking-[0.15em] text-foreground/60"
                    >
                      Contraseña
                    </label>

                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/35" />

                      <input
                        id="register-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Mín. 8 caracteres"
                        required
                        disabled={formDisabled}
                        autoComplete="new-password"
                        value={formData.password}
                        onChange={(event) =>
                          updateField(
                            "password",
                            event.target.value,
                          )
                        }
                        className="h-[50px] w-full rounded-[14px] border border-border/80 bg-background pl-10 pr-12 text-[13px] font-medium tracking-[0.04em] text-foreground outline-none transition-all duration-300 placeholder:text-muted-foreground/35 focus:border-primary/50 focus:ring-4 focus:ring-primary/8 disabled:cursor-not-allowed disabled:opacity-60"
                      />

                      <button
                        type="button"
                        disabled={formDisabled}
                        onClick={() =>
                          setShowPassword((value) => !value)
                        }
                        aria-label={
                          showPassword
                            ? "Ocultar contraseña"
                            : "Mostrar contraseña"
                        }
                        className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground/45 transition-all hover:bg-muted hover:text-foreground"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="register-confirm-password"
                      className="block text-[9px] font-semibold uppercase tracking-[0.15em] text-foreground/60"
                    >
                      Confirmar contraseña
                    </label>

                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/35" />

                      <input
                        id="register-confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Repite la contraseña"
                        required
                        disabled={formDisabled}
                        autoComplete="new-password"
                        value={formData.confirmPassword}
                        onChange={(event) =>
                          updateField(
                            "confirmPassword",
                            event.target.value,
                          )
                        }
                        className="h-[50px] w-full rounded-[14px] border border-border/80 bg-background pl-10 pr-12 text-[13px] font-medium tracking-[0.04em] text-foreground outline-none transition-all duration-300 placeholder:text-muted-foreground/35 focus:border-primary/50 focus:ring-4 focus:ring-primary/8 disabled:cursor-not-allowed disabled:opacity-60"
                      />

                      <button
                        type="button"
                        disabled={formDisabled}
                        onClick={() =>
                          setShowConfirmPassword((value) => !value)
                        }
                        aria-label={
                          showConfirmPassword
                            ? "Ocultar contraseña"
                            : "Mostrar contraseña"
                        }
                        className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground/45 transition-all hover:bg-muted hover:text-foreground"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* TERMS */}
                <label className="flex cursor-pointer items-start gap-2.5 pt-0.5">
                  <input
                    type="checkbox"
                    checked={formData.termsAccepted}
                    disabled={formDisabled}
                    onChange={(event) =>
                      updateField(
                        "termsAccepted",
                        event.target.checked,
                      )
                    }
                    className="mt-[2px] h-3.5 w-3.5 shrink-0 cursor-pointer accent-primary"
                  />

                  <span className="text-[9px] leading-4 text-muted-foreground/65 sm:text-[10px]">
                    Acepto los{" "}
                    <Link
                      to="/terminos"
                      className="font-semibold text-primary hover:opacity-70"
                    >
                      Términos de servicio
                    </Link>{" "}
                    de Luka AI.
                  </span>
                </label>

                {/* PRIVACY */}
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={formData.privacyAccepted}
                    disabled={formDisabled}
                    onChange={(event) =>
                      updateField(
                        "privacyAccepted",
                        event.target.checked,
                      )
                    }
                    className="mt-[2px] h-3.5 w-3.5 shrink-0 cursor-pointer accent-primary"
                  />

                  <span className="text-[9px] leading-4 text-muted-foreground/65 sm:text-[10px]">
                    Autorizo el tratamiento de mis datos personales de acuerdo
                    con la{" "}
                    <Link
                      to="/privacidad"
                      className="font-semibold text-primary hover:opacity-70"
                    >
                      Política de privacidad
                    </Link>{" "}
                    de Luka AI.
                  </span>
                </label>

                {/* GOOGLE */}
                <div className="space-y-3 sm:space-y-3.5">
                  <div className="relative flex items-center">
                    <div className="h-px flex-1 bg-border/70" />

                    <span className="shrink-0 px-3 text-[8px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/40 sm:text-[9px]">
                      o continúa con
                    </span>

                    <div className="h-px flex-1 bg-border/70" />
                  </div>

                  <div
                    ref={googleButtonContainerRef}
                    aria-hidden="true"
                    className="absolute left-[-10000px] top-0 h-[54px] w-full overflow-hidden opacity-0"
                  >
                    {googleButtonWidth > 0 && (
                      <GoogleLogin
                        onSuccess={(credentialResponse) => {
                          if (credentialResponse.credential) {
                            handleGoogleSuccess(
                              credentialResponse.credential,
                            );
                          } else {
                            handleGoogleError();
                          }
                        }}
                        onError={handleGoogleError}
                        useOneTap={false}
                        theme="outline"
                        size="large"
                        text="continue_with"
                        shape="pill"
                        width={googleButtonWidth}
                      />
                    )}
                  </div>

                  <motion.button
                    type="button"
                    disabled={formDisabled}
                    onClick={() => {
                      const googleButton =
                        googleButtonContainerRef.current?.querySelector(
                          'div[role="button"]',
                        ) as HTMLElement | null;

                      if (!googleButton) {
                        setLocalError(
                          "Google todavía no está listo. Inténtalo nuevamente.",
                        );
                        return;
                      }

                      setIsGoogleLoading(true);
                      googleButton.click();
                    }}
                    whileHover={
                      shouldReduceMotion || formDisabled
                        ? undefined
                        : { y: -1 }
                    }
                    whileTap={
                      shouldReduceMotion || formDisabled
                        ? undefined
                        : { scale: 0.995 }
                    }
                    className="group relative flex h-[50px] w-full items-center justify-center overflow-hidden rounded-[14px] border border-gray-200 bg-white px-5 text-[13px] font-bold text-gray-800 shadow-none transition-all duration-300 hover:border-gray-300 hover:bg-white hover:shadow-lg hover:shadow-black/5 focus:outline-none focus:ring-4 focus:ring-primary/8 disabled:cursor-not-allowed disabled:opacity-60 sm:h-[54px] sm:text-[14px]"
                  >
                    <span className="relative flex items-center justify-center gap-2.5">
                      {isGoogleLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-gray-500" />

                          <span className="text-gray-700">
                            Conectando con Google...
                          </span>
                        </>
                      ) : (
                        <>
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            className="h-[18px] w-[18px] shrink-0 sm:h-[19px] sm:w-[19px]"
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

                          <span>Continuar con Google</span>
                        </>
                      )}
                    </span>
                  </motion.button>
                </div>

                {/* CTA */}
                <motion.div
                  whileHover={
                    shouldReduceMotion || formDisabled
                      ? undefined
                      : { y: -1 }
                  }
                  whileTap={
                    shouldReduceMotion || formDisabled
                      ? undefined
                      : { scale: 0.995 }
                  }
                  className="pt-0.5"
                >
                  <Button
                    type="submit"
                    disabled={formDisabled}
                    className="group relative h-[50px] w-full overflow-hidden rounded-[14px] bg-primary px-5 text-[13px] font-bold text-primary-foreground shadow-none transition-all duration-300 hover:shadow-lg hover:shadow-primary/15 disabled:cursor-not-allowed disabled:opacity-60 sm:h-[54px] sm:text-[14px]"
                  >
                    <span className="relative flex items-center justify-center gap-2">
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Creando cuenta...
                        </>
                      ) : (
                        <>
                          Crear cuenta y comenzar gratis
                          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                        </>
                      )}
                    </span>
                  </Button>
                </motion.div>
              </motion.form>
            </>
          )}
        </motion.div>

        {/* LOGIN */}
        <motion.div
          initial={
            shouldReduceMotion
              ? { opacity: 1, y: 0 }
              : { opacity: 0, y: 7 }
          }
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.5,
            delay: shouldReduceMotion ? 0 : 0.25,
            ease,
          }}
          className="mt-4 text-center sm:mt-5"
        >
          <p className="text-[10px] text-muted-foreground sm:text-[11px]">
            ¿Ya tienes una cuenta?{" "}
            <Link
              to="/login"
              onClick={() => {
                clearError();
                setLocalError(null);
              }}
              className="font-semibold text-primary transition-opacity hover:opacity-70"
            >
              Inicia sesión
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}