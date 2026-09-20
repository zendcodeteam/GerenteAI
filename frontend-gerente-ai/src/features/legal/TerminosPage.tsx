import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { Link } from 'react-router';

import { CoworkingNavbar } from '@/features/landing-page/components/CoworkingNavbar';

const EFFECTIVE_DATE = '16 de septiembre de 2026';
const VERSION = '1.0';

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-300px] h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-emerald-500/[0.07] blur-[140px]" />

        <div className="absolute bottom-[-250px] right-[-150px] h-[500px] w-[500px] rounded-full bg-emerald-400/[0.04] blur-[130px]" />
      </div>

      <CoworkingNavbar />

      {/* Main */}
      <main className="relative mx-auto max-w-5xl px-5 pb-20 pt-36 sm:px-8 sm:pt-40">
        {/* Hero */}
        <section className="mb-12">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.07] px-3.5 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-300">
            <ShieldCheck size={14} />
            Documento legal · Versión {VERSION}
          </div>

          <h1 className="max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl lg:text-6xl">
            Términos de servicio
          </h1>

          <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            Estos términos establecen las condiciones de acceso y uso de
            Luka, la plataforma de gestión empresarial desarrollada por
            Zendcode S.A.S.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <div className="rounded-xl border border-border/60 bg-card/60 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Versión
              </p>

              <p className="mt-1 text-sm font-medium text-foreground">
                {VERSION}
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-card/60 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Fecha de vigencia
              </p>

              <p className="mt-1 text-sm font-medium text-foreground">
                {EFFECTIVE_DATE}
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-card/60 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Responsable
              </p>

              <p className="mt-1 text-sm font-medium text-foreground">
                Zendcode S.A.S.
              </p>
            </div>
          </div>
        </section>

        {/* Document */}
        <article className="overflow-hidden rounded-3xl border border-border/60 bg-card/40 shadow-2xl shadow-black/10 dark:shadow-black/20">
          <div className="space-y-12 p-6 sm:p-10 lg:p-14">
            {/* 1 */}
            <LegalSection
              number="01"
              title="Objeto y aceptación"
            >
              <p>
                Los presentes Términos de servicio regulan el acceso y uso
                de Luka, una plataforma tecnológica de gestión empresarial
                operada por <strong>Zendcode S.A.S.</strong>, identificada
                con NIT <strong>902099074</strong>, con domicilio en Cali,
                Valle del Cauca, Colombia.
              </p>

              <p>
                Al crear una cuenta, acceder o utilizar Luka, el usuario
                manifiesta que ha leído, comprendido y aceptado estos
                Términos de servicio. Si el usuario no está de acuerdo con
                alguno de sus términos, deberá abstenerse de utilizar la
                plataforma.
              </p>

              <p>
                Cuando el usuario actúe en nombre de un negocio, declara que
                cuenta con las facultades necesarias para vincular dicho
                negocio a Luka y aceptar estos términos en su nombre.
              </p>
            </LegalSection>

            {/* 2 */}
            <LegalSection
              number="02"
              title="¿Qué es Luka?"
            >
              <p>
                Luka es una herramienta tecnológica diseñada para ayudar a
                micro y pequeños negocios en la organización, consulta y
                gestión de información relacionada con su operación.
              </p>

              <p>
                Dependiendo del plan contratado y de las funcionalidades
                disponibles, Luka puede permitir gestionar información como
                productos, inventario, ventas, compras, clientes,
                proveedores, gastos, ingresos, conversaciones, documentos,
                imágenes, audios y otra información suministrada por el
                usuario.
              </p>

              <p>
                Algunas funcionalidades utilizan tecnologías de inteligencia
                artificial para interpretar información, responder
                solicitudes, generar contenidos o facilitar tareas de
                gestión.
              </p>
            </LegalSection>

            {/* 3 */}
            <LegalSection
              number="03"
              title="Creación y seguridad de la cuenta"
            >
              <p>
                Para utilizar determinadas funcionalidades de Luka, el
                usuario deberá crear una cuenta proporcionando información
                veraz, completa y actualizada.
              </p>

              <p>
                El usuario es responsable de mantener la confidencialidad de
                sus credenciales y de las actividades realizadas desde su
                cuenta. Si sospecha de un acceso no autorizado, deberá
                comunicarlo a Zendcode S.A.S. tan pronto como sea posible.
              </p>

              <p>
                El usuario no deberá compartir sus credenciales, permitir el
                acceso no autorizado a su cuenta ni utilizar mecanismos
                destinados a evadir las medidas de seguridad de la
                plataforma.
              </p>
            </LegalSection>

            {/* 4 */}
            <LegalSection
              number="04"
              title="Uso permitido de la plataforma"
            >
              <p>
                Luka deberá utilizarse exclusivamente para fines lícitos y
                relacionados con la gestión del negocio del usuario.
              </p>

              <p>El usuario se compromete a no:</p>

              <ul>
                <LegalListItem>
                  utilizar Luka para actividades contrarias a la legislación
                  colombiana o a las normas aplicables;
                </LegalListItem>

                <LegalListItem>
                  introducir información deliberadamente falsa, maliciosa o
                  fraudulenta;
                </LegalListItem>

                <LegalListItem>
                  intentar acceder a cuentas, sistemas, datos o
                  funcionalidades para los cuales no tenga autorización;
                </LegalListItem>

                <LegalListItem>
                  interferir con el funcionamiento normal de la plataforma o
                  intentar comprometer su seguridad;
                </LegalListItem>

                <LegalListItem>
                  realizar ingeniería inversa, descompilar o intentar obtener
                  el código fuente de Luka, salvo cuando la legislación
                  aplicable permita expresamente dicha conducta;
                </LegalListItem>

                <LegalListItem>
                  utilizar Luka para almacenar, distribuir o procesar
                  contenido cuya utilización sea ilícita;
                </LegalListItem>

                <LegalListItem>
                  utilizar sistemas automatizados para sobrecargar,
                  extraer masivamente o afectar la infraestructura del
                  servicio sin autorización.
                </LegalListItem>
              </ul>
            </LegalSection>

            {/* 5 */}
            <LegalSection
              number="05"
              title="Información introducida por el usuario"
            >
              <p>
                El usuario conserva la responsabilidad sobre la información
                que introduce, carga, transmite o procesa mediante Luka.
              </p>

              <p>
                Esto incluye, entre otros, los datos de su negocio y la
                información relacionada con sus clientes, proveedores,
                empleados, productos, ventas, compras, inventario, gastos,
                documentos, mensajes, audios, imágenes y demás contenido que
                decida utilizar dentro de la plataforma.
              </p>

              <div className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.04] p-5">
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-300">
                  Responsabilidad sobre datos de terceros
                </p>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Cuando el usuario introduzca en Luka información personal
                  perteneciente a sus clientes, proveedores u otras personas,
                  deberá contar con la autorización o base jurídica que
                  corresponda para realizar dicho tratamiento y garantizar
                  que el uso de la información mediante Luka sea legítimo.
                </p>
              </div>
            </LegalSection>

            {/* 6 */}
            <LegalSection
              number="06"
              title="Inteligencia artificial y resultados generados"
            >
              <p>
                Algunas funcionalidades de Luka utilizan sistemas de
                inteligencia artificial para procesar solicitudes y generar
                respuestas, recomendaciones, resúmenes, clasificaciones u
                otros resultados.
              </p>

              <p>
                Los resultados generados por sistemas de inteligencia
                artificial pueden contener errores, omisiones o
                interpretaciones incorrectas. Por esta razón, el usuario
                deberá verificar la información antes de utilizarla para
                tomar decisiones comerciales, financieras, contables,
                tributarias, legales o de cualquier otra naturaleza
                relevante.
              </p>

              <p>
                Luka es una herramienta de apoyo y no sustituye, por sí sola,
                el criterio profesional de un contador, abogado, asesor
                financiero u otro profesional cuando dicho asesoramiento sea
                necesario.
              </p>
            </LegalSection>

            {/* 7 */}
            <LegalSection
              number="07"
              title="Integraciones y servicios de terceros"
            >
              <p>
                Luka puede integrarse con servicios tecnológicos de terceros
                para ofrecer determinadas funcionalidades, incluyendo
                servicios relacionados con inteligencia artificial,
                comunicaciones, procesamiento de pagos, alojamiento y
                almacenamiento.
              </p>

              <p>
                El funcionamiento de determinadas integraciones puede estar
                sujeto a los términos, políticas, disponibilidad y
                condiciones de los respectivos proveedores.
              </p>

              <p>
                Entre los servicios tecnológicos utilizados por Luka pueden
                encontrarse Google/Gemini, WhatsApp/Meta, Wompi y Hostinger.
                La información sobre el tratamiento de datos personales por
                estos y otros proveedores se encuentra desarrollada en la
                <Link
                  to="/privacidad"
                  className="mx-1 text-emerald-600 underline decoration-emerald-600/30 underline-offset-4 transition-colors hover:text-emerald-500 dark:text-emerald-400 dark:decoration-emerald-400/30 dark:hover:text-emerald-300"
                >
                  Política de privacidad
                </Link>
                de Luka.
              </p>
            </LegalSection>

            {/* 8 */}
            <LegalSection
              number="08"
              title="Planes, pagos y suscripciones"
            >
              <p>
                Algunas funcionalidades de Luka pueden estar disponibles
                únicamente mediante planes de pago o suscripciones.
              </p>

              <p>
                Cuando el usuario contrate un servicio de pago, se le
                informará previamente el precio, las condiciones aplicables
                y, cuando corresponda, las características del plan
                seleccionado.
              </p>

              <p>
                Los pagos podrán ser procesados mediante proveedores
                externos autorizados, como Wompi. La disponibilidad de los
                medios de pago dependerá del proveedor correspondiente.
              </p>

              <p>
                Zendcode S.A.S. podrá modificar los precios o características
                de sus planes para el futuro. Los cambios que afecten una
                suscripción vigente se comunicarán conforme a las
                condiciones aplicables.
              </p>
            </LegalSection>

            {/* 9 */}
            <LegalSection
              number="09"
              title="Propiedad intelectual"
            >
              <p>
                Luka, incluyendo su software, código, arquitectura,
                interfaces, diseño, marca, logotipos, textos, elementos
                gráficos, funcionalidades y demás componentes desarrollados
                por Zendcode S.A.S., son propiedad de Zendcode S.A.S. o se
                utilizan bajo las autorizaciones correspondientes.
              </p>

              <p>
                El acceso a Luka no transfiere al usuario derechos de
                propiedad sobre la plataforma ni sobre sus componentes. El
                usuario recibe únicamente una autorización limitada para
                utilizar el servicio conforme a estos Términos.
              </p>

              <p>
                El contenido y la información que pertenezcan al usuario
                continúan siendo del usuario, sin perjuicio de los permisos
                necesarios para que Zendcode S.A.S. pueda prestar y operar
                técnicamente el servicio.
              </p>
            </LegalSection>

            {/* 10 */}
            <LegalSection
              number="10"
              title="Disponibilidad del servicio"
            >
              <p>
                Zendcode S.A.S. procurará mantener Luka disponible y
                funcionando correctamente. Sin embargo, el servicio puede
                experimentar interrupciones ocasionadas por mantenimiento,
                actualizaciones, fallas técnicas, problemas de conectividad,
                servicios de terceros, circunstancias de fuerza mayor u
                otros eventos fuera del control razonable de Zendcode S.A.S.
              </p>

              <p>
                La disponibilidad de una funcionalidad concreta puede
                cambiar a medida que Luka evolucione.
              </p>
            </LegalSection>

            {/* 11 */}
            <LegalSection
              number="11"
              title="Limitación de responsabilidad"
            >
              <p>
                Luka se proporciona como una herramienta tecnológica de
                apoyo para la gestión empresarial. El usuario es responsable
                de las decisiones que tome utilizando la información,
                cálculos, recomendaciones o resultados obtenidos mediante la
                plataforma.
              </p>

              <p>
                Zendcode S.A.S. no garantiza que los resultados generados por
                funcionalidades automatizadas o de inteligencia artificial
                sean siempre exactos, completos, oportunos o adecuados para
                una situación particular.
              </p>

              <p>
                El usuario deberá mantener sus propios controles,
                verificaciones y respaldos cuando la naturaleza de su
                operación lo requiera.
              </p>

              <p>
                Nada de estos Términos pretende excluir o limitar derechos o
                responsabilidades que legalmente no puedan ser excluidos o
                limitados conforme a la legislación aplicable.
              </p>
            </LegalSection>

            {/* 12 */}
            <LegalSection
              number="12"
              title="Suspensión o terminación"
            >
              <p>
                Zendcode S.A.S. podrá suspender o limitar temporalmente el
                acceso a una cuenta cuando sea necesario para proteger la
                seguridad de Luka, prevenir fraude, investigar un uso
                contrario a estos Términos, atender obligaciones legales o
                preservar el funcionamiento de la plataforma.
              </p>

              <p>
                Cuando corresponda, el usuario podrá solicitar la
                terminación de su cuenta mediante los canales habilitados
                por Zendcode S.A.S.
              </p>

              <p>
                La terminación de una cuenta no elimina automáticamente las
                obligaciones que por su naturaleza deban continuar vigentes,
                incluyendo aquellas relacionadas con propiedad intelectual,
                confidencialidad, pagos pendientes y responsabilidades
                anteriores a la terminación.
              </p>
            </LegalSection>

            {/* 13 */}
            <LegalSection
              number="13"
              title="Privacidad y protección de datos personales"
            >
              <p>
                El tratamiento de datos personales realizado en relación con
                Luka se encuentra regulado por la legislación colombiana
                aplicable y por la
                <Link
                  to="/privacidad"
                  className="mx-1 text-emerald-600 underline decoration-emerald-600/30 underline-offset-4 transition-colors hover:text-emerald-500 dark:text-emerald-400 dark:decoration-emerald-400/30 dark:hover:text-emerald-300"
                >
                  Política de privacidad
                </Link>
                de Zendcode S.A.S.
              </p>

              <p>
                La Política de privacidad contiene información sobre las
                finalidades del tratamiento, categorías de información,
                derechos de los titulares, mecanismos de atención y
                proveedores o terceros que pueden intervenir en el
                tratamiento.
              </p>
            </LegalSection>

            {/* 14 */}
            <LegalSection
              number="14"
              title="Modificaciones de estos términos"
            >
              <p>
                Zendcode S.A.S. podrá actualizar estos Términos cuando sea
                necesario debido a cambios en Luka, nuevos servicios,
                modificaciones legales, cambios operativos o razones de
                seguridad.
              </p>

              <p>
                Cuando una modificación sea relevante, se procurará
                informar al usuario mediante los canales disponibles o a
                través de la plataforma.
              </p>

              <p>
                La versión publicada en esta página será la versión vigente
                para los usuarios en cada momento, indicando su fecha de
                vigencia y número de versión.
              </p>
            </LegalSection>

            {/* 15 */}
            <LegalSection
              number="15"
              title="Legislación aplicable"
            >
              <p>
                Estos Términos se regirán e interpretarán de conformidad con
                las leyes de la República de Colombia, sin perjuicio de las
                normas imperativas que resulten aplicables.
              </p>

              <p>
                Cualquier controversia relacionada con la utilización de
                Luka será atendida inicialmente mediante comunicación
                directa con Zendcode S.A.S., procurando una solución
                razonable conforme a la legislación aplicable.
              </p>
            </LegalSection>

            {/* 16 */}
            <LegalSection
              number="16"
              title="Contacto"
            >
              <p>
                Para preguntas, solicitudes o comunicaciones relacionadas
                con estos Términos de servicio, puedes contactar a Zendcode
                S.A.S. mediante los siguientes canales:
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <ContactCard
                  label="Empresa"
                  value="Zendcode S.A.S."
                />

                <ContactCard
                  label="NIT"
                  value="902099074"
                />

                <ContactCard
                  label="Correo"
                  value="zendcodeco@gmail.com"
                />

                <ContactCard
                  label="Teléfono"
                  value="3043904488"
                />

                <ContactCard
                  label="Domicilio"
                  value="Cali, Valle del Cauca, Colombia"
                />

                <ContactCard
                  label="Dirección"
                  value="Carrera 17B No. 18-68"
                />
              </div>
            </LegalSection>

            {/* Acceptance */}
            <section className="border-t border-border/60 pt-10">
              <div className="flex gap-4 rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.04] p-5 sm:p-6">
                <div className="mt-0.5 shrink-0">
                  <CheckCircle2
                    size={21}
                    className="text-emerald-500 dark:text-emerald-400"
                  />
                </div>

                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Versión vigente
                  </p>

                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                    Estos Términos de servicio corresponden a la versión{' '}
                    <span className="font-medium text-foreground/80">
                      {VERSION}
                    </span>{' '}
                    y se encuentran vigentes desde el{' '}
                    <span className="font-medium text-foreground/80">
                      {EFFECTIVE_DATE}
                    </span>
                    .
                  </p>
                </div>
              </div>
            </section>
          </div>
        </article>

        {/* Footer navigation */}
        <div className="mt-8 flex flex-col items-center justify-between gap-4 text-sm sm:flex-row">
          <Link
            to="/home"
            className="inline-flex items-center gap-2 rounded-full border border-border/70 px-4 py-2.5 font-semibold text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            <ArrowLeft size={16} />
            Volver a Luka
          </Link>

          <Link
            to="/privacidad"
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600"
          >
            Ver Política de privacidad
            <ArrowRight size={16} />
          </Link>
        </div>

        {/* Legal footer */}
        <footer className="mt-12 border-t border-border/50 pt-8 text-center">
          <p className="text-xs text-muted-foreground/70">
            © {new Date().getFullYear()} Zendcode S.A.S. Todos los derechos
            reservados.
          </p>

          <p className="mt-2 text-xs text-muted-foreground/50">
            Luka · Gestión inteligente para tu negocio
          </p>
        </footer>
      </main>
    </div>
  );
}

/* ============================================================
   COMPONENTES AUXILIARES
   ============================================================ */

interface LegalSectionProps {
  number: string;
  title: string;
  children: React.ReactNode;
}

function LegalSection({
  number,
  title,
  children,
}: LegalSectionProps) {
  return (
    <section>
      <div className="mb-5 flex items-start gap-4">
        <span className="mt-1 shrink-0 font-mono text-xs font-medium tracking-wider text-emerald-500/80 dark:text-emerald-400/70">
          {number}
        </span>

        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h2>
      </div>

      <div className="space-y-4 pl-0 text-sm leading-7 text-muted-foreground sm:pl-9 sm:text-[15px]">
        {children}
      </div>
    </section>
  );
}

function LegalListItem({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <li className="relative pl-5">
      <span className="absolute left-0 top-[0.72rem] h-1.5 w-1.5 rounded-full bg-emerald-500/70 dark:bg-emerald-400/70" />
      {children}
    </li>
  );
}

function ContactCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/50 p-4">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>

      <p className="mt-1.5 break-words text-sm text-foreground/80">
        {value}
      </p>
    </div>
  );
}