import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Database,
  FileText,
  LockKeyhole,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Link } from 'react-router';

import { CoworkingNavbar } from '@/features/landing-page/components/CoworkingNavbar';

const EFFECTIVE_DATE = '16 de septiembre de 2026';
const VERSION = '1.0';

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      {/* ============================================================
          BACKGROUND
          ============================================================ */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-300px] h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-emerald-500/[0.07] blur-[140px]" />

        <div className="absolute bottom-[-250px] right-[-150px] h-[500px] w-[500px] rounded-full bg-emerald-400/[0.04] blur-[130px]" />
      </div>

      <CoworkingNavbar />

      {/* ============================================================
          MAIN
          ============================================================ */}
      <main className="relative mx-auto max-w-5xl px-5 pb-20 pt-36 sm:px-8 sm:pt-40">
        {/* ============================================================
            HERO
            ============================================================ */}
        <section className="mb-12">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.07] px-3.5 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-300">
            <LockKeyhole size={14} />
            Protección de datos · Versión {VERSION}
          </div>

          <h1 className="max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl lg:text-6xl">
            Política de privacidad
          </h1>

          <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            Política de tratamiento de datos personales y aviso de
            privacidad aplicables al uso de Luka y a los servicios
            tecnológicos proporcionados por Zendcode S.A.S.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <InfoBadge
              label="Versión"
              value={VERSION}
            />

            <InfoBadge
              label="Fecha de vigencia"
              value={EFFECTIVE_DATE}
            />

            <InfoBadge
              label="Responsable"
              value="Zendcode S.A.S."
            />
          </div>
        </section>

        {/* ============================================================
            DOCUMENT
            ============================================================ */}
        <article className="overflow-hidden rounded-3xl border border-border/60 bg-card/40 shadow-2xl shadow-black/10 dark:shadow-black/20">
          <div className="space-y-12 p-6 sm:p-10 lg:p-14">
            {/* ======================================================
                AVISO DE PRIVACIDAD
                ====================================================== */}
            <section
              id="aviso-de-privacidad"
              className="scroll-mt-28"
            >
              <div className="rounded-3xl border border-emerald-400/15 bg-emerald-400/[0.045] p-6 sm:p-8">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10">
                    <ShieldCheck
                      size={21}
                      className="text-emerald-500 dark:text-emerald-400"
                    />
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400">
                      Aviso de privacidad
                    </p>

                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                      Información esencial sobre el tratamiento
                    </h2>
                  </div>
                </div>

                <div className="mt-6 space-y-4 text-sm leading-7 text-muted-foreground sm:text-[15px]">
                  <p>
                    <strong className="text-foreground/85">
                      Zendcode S.A.S.
                    </strong>
                    , identificada con NIT{' '}
                    <strong className="text-foreground/85">
                      902099074
                    </strong>
                    , con domicilio en Cali, Valle del Cauca, Colombia, es
                    responsable del tratamiento de los datos personales que
                    recolecta directamente para la prestación y gestión de
                    sus servicios.
                  </p>

                  <p>
                    Los datos personales podrán ser tratados para crear y
                    administrar cuentas, prestar y mejorar Luka, gestionar
                    la relación con los usuarios, atender solicitudes,
                    mantener la seguridad, gestionar pagos y suscripciones,
                    enviar comunicaciones relacionadas con el servicio y
                    cumplir obligaciones legales.
                  </p>

                  <p>
                    La información podrá ser procesada mediante
                    proveedores tecnológicos que actúen como encargados o
                    terceros que intervengan legítimamente en la prestación
                    de determinados servicios, conforme a lo descrito en
                    esta Política.
                  </p>

                  <p>
                    El titular puede conocer, actualizar, rectificar y
                    solicitar la supresión de sus datos personales cuando
                    legalmente corresponda, así como ejercer los demás
                    derechos reconocidos por la normativa aplicable.
                  </p>

                  <p>
                    Para conocer esta Política completa, sus actualizaciones
                    y los mecanismos para ejercer los derechos del titular,
                    puede consultar permanentemente esta página:
                    <Link
                      to="/privacidad"
                      className="mx-1 text-emerald-600 underline decoration-emerald-600/30 underline-offset-4 transition-colors hover:text-emerald-500 dark:text-emerald-400 dark:decoration-emerald-400/30 dark:hover:text-emerald-300"
                    >
                      Política de privacidad
                    </Link>
                    .
                  </p>
                </div>
              </div>
            </section>

            {/* 01 */}
            <LegalSection
              number="01"
              title="Identificación del responsable"
              icon={<Database size={18} />}
            >
              <p>
                El responsable del tratamiento de los datos personales
                tratados directamente por Zendcode S.A.S. es:
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <ContactCard
                  label="Razón social"
                  value="Zendcode S.A.S."
                />

                <ContactCard
                  label="NIT"
                  value="902099074"
                />

                <ContactCard
                  label="Domicilio"
                  value="Cali, Valle del Cauca, Colombia"
                />

                <ContactCard
                  label="Dirección"
                  value="Carrera 17B No. 18-68"
                />

                <ContactCard
                  label="Correo electrónico"
                  value="zendcodeco@gmail.com"
                />

                <ContactCard
                  label="Teléfono"
                  value="3043904488"
                />
              </div>
            </LegalSection>

            {/* 02 */}
            <LegalSection
              number="02"
              title="Alcance de esta Política"
              icon={<FileText size={18} />}
            >
              <p>
                Esta Política aplica al tratamiento de datos personales que
                Zendcode S.A.S. realiza en relación con Luka, sus sitios web,
                aplicaciones, formularios, canales de atención,
                comunicaciones y demás servicios asociados.
              </p>

              <p>
                También describe las condiciones aplicables cuando un
                usuario utiliza Luka para almacenar o gestionar información
                personal relacionada con terceros, como sus clientes o
                proveedores.
              </p>

              <p>
                Esta Política podrá complementarse con avisos, formularios,
                autorizaciones o información específica presentada al titular
                en el momento de la recolección de determinados datos.
              </p>
            </LegalSection>

            {/* 03 */}
            <LegalSection
              number="03"
              title="Definiciones"
              icon={<Users size={18} />}
            >
              <Definition
                term="Dato personal"
                description="Cualquier información vinculada o que pueda asociarse a una persona natural determinada o determinable."
              />

              <Definition
                term="Titular"
                description="La persona natural cuyos datos personales son objeto de tratamiento."
              />

              <Definition
                term="Tratamiento"
                description="Cualquier operación o conjunto de operaciones realizadas sobre datos personales, como recolección, almacenamiento, uso, consulta, circulación o supresión."
              />

              <Definition
                term="Responsable del tratamiento"
                description="La persona natural o jurídica que decide sobre la base de datos y/o el tratamiento de los datos personales."
              />

              <Definition
                term="Encargado del tratamiento"
                description="La persona natural o jurídica que realiza el tratamiento de datos personales por cuenta del responsable."
              />

              <Definition
                term="Autorización"
                description="Consentimiento previo, expreso e informado del titular para llevar a cabo el tratamiento de sus datos personales, cuando sea requerido."
              />
            </LegalSection>

            {/* 04 */}
            <LegalSection
              number="04"
              title="Datos personales que podemos tratar"
              icon={<Database size={18} />}
            >
              <p>
                Dependiendo de la relación con el titular, las funcionalidades
                utilizadas y la información suministrada, Luka puede tratar
                las siguientes categorías de información:
              </p>

              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <DataPill>Nombre</DataPill>
                <DataPill>Teléfono</DataPill>
                <DataPill>Correo electrónico</DataPill>
                <DataPill>Información del negocio</DataPill>
                <DataPill>Información de clientes</DataPill>
                <DataPill>Información de proveedores</DataPill>
                <DataPill>Ventas</DataPill>
                <DataPill>Compras</DataPill>
                <DataPill>Gastos</DataPill>
                <DataPill>Inventario</DataPill>
                <DataPill>Mensajes</DataPill>
                <DataPill>Información enviada por WhatsApp</DataPill>
                <DataPill>Documentos e imágenes</DataPill>
                <DataPill>Audios</DataPill>
                <DataPill>Información financiera del negocio</DataPill>
              </div>

              <p className="mt-5">
                La información efectivamente tratada dependerá de las
                funcionalidades que el usuario utilice y de la información
                que decida suministrar a Luka.
              </p>
            </LegalSection>

            {/* 05 */}
            <LegalSection
              number="05"
              title="Finalidades del tratamiento"
              icon={<CheckCircle2 size={18} />}
            >
              <p>
                Zendcode S.A.S. podrá tratar datos personales para las
                siguientes finalidades, de acuerdo con la relación existente
                con el titular y la información efectivamente recolectada:
              </p>

              <ul>
                <LegalListItem>
                  Crear, administrar y mantener la cuenta del usuario.
                </LegalListItem>

                <LegalListItem>
                  Prestar las funcionalidades y servicios ofrecidos por
                  Luka.
                </LegalListItem>

                <LegalListItem>
                  Procesar y organizar información relacionada con la
                  operación del negocio.
                </LegalListItem>

                <LegalListItem>
                  Permitir consultas, reportes, análisis y funcionalidades
                  automatizadas.
                </LegalListItem>

                <LegalListItem>
                  Procesar información mediante funcionalidades de
                  inteligencia artificial cuando estas sean utilizadas.
                </LegalListItem>

                <LegalListItem>
                  Gestionar comunicaciones relacionadas con la cuenta, el
                  servicio, soporte, seguridad y operación de Luka.
                </LegalListItem>

                <LegalListItem>
                  Gestionar pagos, suscripciones, facturación y procesos
                  relacionados.
                </LegalListItem>

                <LegalListItem>
                  Detectar, prevenir y atender incidentes de seguridad,
                  fraude, abuso o usos no autorizados.
                </LegalListItem>

                <LegalListItem>
                  Realizar mantenimiento, soporte técnico y mejoras del
                  servicio.
                </LegalListItem>

                <LegalListItem>
                  Cumplir obligaciones legales, regulatorias o requerimientos
                  de autoridades competentes.
                </LegalListItem>

                <LegalListItem>
                  Atender peticiones, consultas, quejas y reclamos de los
                  titulares.
                </LegalListItem>
              </ul>
            </LegalSection>

            {/* 06 */}
            <LegalSection
              number="06"
              title="Datos de clientes y proveedores introducidos por el usuario"
              icon={<Users size={18} />}
            >
              <p>
                Luka permite que los usuarios registren y gestionen
                información relacionada con las personas con quienes
                mantienen relaciones comerciales, incluyendo clientes y
                proveedores.
              </p>

              <div className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.04] p-5">
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-300">
                  Importante para los usuarios de Luka
                </p>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Cuando un usuario introduce en Luka datos personales de
                  sus clientes, proveedores u otras personas, el usuario
                  debe contar con la autorización, base jurídica o
                  legitimación que corresponda para realizar ese tratamiento
                  y utilizar a Luka para su gestión.
                </p>
              </div>

              <p>
                En estos casos, dependiendo de las instrucciones recibidas y
                de las decisiones relacionadas con el tratamiento, Zendcode
                S.A.S. podrá actuar como encargado del tratamiento respecto
                de información que el usuario incorpora a la plataforma por
                cuenta de su negocio.
              </p>

              <p>
                El usuario deberá garantizar que la información suministrada
                a Luka sea obtenida y utilizada de manera legítima y que los
                titulares de dicha información hayan recibido la información
                y autorizaciones que correspondan.
              </p>

              <p>
                Zendcode S.A.S. podrá procesar dicha información únicamente
                en la medida necesaria para prestar las funcionalidades
                contratadas, cumplir obligaciones legales, mantener la
                seguridad de la plataforma y atender las instrucciones
                legítimas del usuario.
              </p>
            </LegalSection>

            {/* 07 */}
            <LegalSection
              number="07"
              title="Información procesada mediante WhatsApp"
              icon={<ShieldCheck size={18} />}
            >
              <p>
                Luka puede permitir la interacción con el usuario mediante
                WhatsApp y recibir información enviada a través de dicho
                canal.
              </p>

              <p>
                Esta información puede incluir mensajes, textos, archivos,
                imágenes, audios, documentos y otra información que el
                usuario decida enviar mediante el canal habilitado.
              </p>

              <p>
                La información recibida podrá ser procesada por Luka para
                prestar las funcionalidades solicitadas por el usuario,
                organizar información del negocio y generar respuestas o
                acciones automatizadas.
              </p>

              <p>
                El funcionamiento de WhatsApp se encuentra además sujeto a
                las condiciones y políticas aplicables de Meta y WhatsApp.
              </p>
            </LegalSection>

            {/* 08 */}
            <LegalSection
              number="08"
              title="Inteligencia artificial"
              icon={<Database size={18} />}
            >
              <p>
                Algunas funcionalidades de Luka utilizan servicios de
                inteligencia artificial para interpretar solicitudes,
                organizar información, generar respuestas, elaborar
                resúmenes y facilitar determinadas tareas del negocio.
              </p>

              <p>
                Para prestar estas funcionalidades, determinados datos
                pueden ser enviados a proveedores tecnológicos que prestan
                servicios de inteligencia artificial a Zendcode S.A.S.,
                conforme a las condiciones aplicables y a las medidas
                contractuales y técnicas correspondientes.
              </p>

              <p>
                Zendcode S.A.S. procurará limitar la información compartida
                con estos proveedores a aquella necesaria para prestar la
                funcionalidad correspondiente.
              </p>

              <p>
                Los resultados generados por inteligencia artificial pueden
                contener errores u omisiones y no constituyen por sí mismos
                asesoramiento profesional legal, contable, financiero,
                tributario o médico.
              </p>
            </LegalSection>

            {/* 09 */}
            <LegalSection
              number="09"
              title="Terceros y proveedores tecnológicos"
              icon={<Users size={18} />}
            >
              <p>
                Para operar Luka y prestar determinadas funcionalidades,
                Zendcode S.A.S. utiliza proveedores tecnológicos y servicios
                de terceros. Estos proveedores pueden tratar información
                personal en la medida necesaria para prestar sus servicios.
              </p>

              <div className="space-y-3">
                <ThirdPartyCard
                  name="Google / Gemini"
                  purpose="Servicios de inteligencia artificial y procesamiento de solicitudes relacionadas con determinadas funcionalidades de Luka."
                />

                <ThirdPartyCard
                  name="WhatsApp / Meta"
                  purpose="Canal de comunicación e intercambio de información entre los usuarios y Luka."
                />

                <ThirdPartyCard
                  name="Wompi"
                  purpose="Procesamiento de pagos y operaciones relacionadas con suscripciones o servicios de pago."
                />

                <ThirdPartyCard
                  name="Hostinger"
                  purpose="Servicios de alojamiento e infraestructura tecnológica utilizados para operar componentes de Luka."
                />
              </div>

              <p>
                La participación de un proveedor no implica necesariamente
                que todos los proveedores tengan acceso a toda la información
                tratada por Luka. El acceso dependerá de la función concreta
                que cada proveedor desempeñe.
              </p>

              <p>
                Cuando corresponda, Zendcode S.A.S. adoptará medidas
                contractuales, técnicas y organizativas razonables para
                establecer las condiciones bajo las cuales dichos terceros
                podrán acceder o tratar información.
              </p>
            </LegalSection>

            {/* 10 */}
            <LegalSection
              number="10"
              title="Transferencias y transmisiones de información"
              icon={<Database size={18} />}
            >
              <p>
                Debido a la naturaleza de los servicios tecnológicos
                utilizados por Luka, determinados datos personales pueden
                ser alojados, procesados o transmitidos mediante
                infraestructura ubicada dentro o fuera de Colombia.
              </p>

              <p>
                Cuando resulte aplicable, Zendcode S.A.S. procurará cumplir
                los requisitos legales correspondientes para las
                transmisiones o transferencias internacionales de datos
                personales.
              </p>

              <p>
                El usuario reconoce que algunos servicios tecnológicos
                utilizados para operar Luka pueden contar con infraestructura
                distribuida internacionalmente.
              </p>
            </LegalSection>

            {/* 11 */}
            <LegalSection
              number="11"
              title="Datos sensibles"
              icon={<LockKeyhole size={18} />}
            >
              <p>
                Luka no requiere, como regla general, datos personales
                sensibles para la creación y operación básica de una cuenta.
              </p>

              <p>
                El usuario deberá evitar introducir datos personales
                sensibles que no sean necesarios para la prestación de una
                funcionalidad.
              </p>

              <p>
                Si una funcionalidad específica llegara a requerir o
                involucrar información considerada sensible, Zendcode S.A.S.
                aplicará las condiciones y garantías previstas por la
                legislación aplicable, incluyendo las relacionadas con la
                autorización cuando corresponda.
              </p>
            </LegalSection>

            {/* 12 */}
            <LegalSection
              number="12"
              title="Seguridad de la información"
              icon={<LockKeyhole size={18} />}
            >
              <p>
                Zendcode S.A.S. implementará medidas técnicas, humanas y
                organizativas razonables destinadas a proteger los datos
                personales contra pérdida, destrucción, acceso no autorizado,
                alteración o divulgación indebida.
              </p>

              <p>
                Las medidas de seguridad podrán incluir controles de acceso,
                autenticación, gestión de credenciales, protección de la
                infraestructura, monitoreo técnico y otras medidas
                apropiadas según la naturaleza de la información y los
                riesgos identificados.
              </p>

              <p>
                Ningún sistema conectado a Internet puede garantizar
                seguridad absoluta. Por ello, los usuarios también deberán
                proteger sus credenciales y utilizar la plataforma de manera
                segura.
              </p>
            </LegalSection>

            {/* 13 */}
            <LegalSection
              number="13"
              title="Conservación de los datos"
              icon={<Database size={18} />}
            >
              <p>
                Los datos personales serán conservados durante el tiempo
                necesario para cumplir las finalidades para las cuales fueron
                recolectados, mantener la relación con el usuario, prestar
                los servicios contratados, cumplir obligaciones legales y
                atender posibles responsabilidades.
              </p>

              <p>
                Cuando los datos ya no sean necesarios y no exista una
                obligación legal o causa legítima para conservarlos, podrán
                ser eliminados, anonimizados o tratados conforme a los
                procedimientos internos aplicables.
              </p>

              <p>
                La supresión de información puede estar sujeta a obligaciones
                legales, respaldos técnicos, procesos de seguridad o
                requerimientos necesarios para acreditar determinadas
                operaciones.
              </p>
            </LegalSection>

            {/* 14 */}
            <LegalSection
              number="14"
              title="Derechos de los titulares"
              icon={<CheckCircle2 size={18} />}
            >
              <p>
                De acuerdo con la legislación colombiana aplicable, el
                titular podrá ejercer los derechos que correspondan,
                incluyendo:
              </p>

              <ul>
                <LegalListItem>
                  Conocer los datos personales que sean objeto de tratamiento.
                </LegalListItem>

                <LegalListItem>
                  Solicitar la actualización y rectificación de información
                  cuando sea incorrecta, incompleta o desactualizada.
                </LegalListItem>

                <LegalListItem>
                  Solicitar prueba de la autorización otorgada cuando esta
                  sea requerida.
                </LegalListItem>

                <LegalListItem>
                  Solicitar información sobre el uso dado a sus datos
                  personales.
                </LegalListItem>

                <LegalListItem>
                  Presentar quejas ante la autoridad competente cuando
                  considere que se han vulnerado las normas aplicables.
                </LegalListItem>

                <LegalListItem>
                  Solicitar la supresión de los datos o revocar la
                  autorización cuando legalmente proceda.
                </LegalListItem>

                <LegalListItem>
                  Acceder gratuitamente a sus datos personales en los casos
                  previstos por la legislación aplicable.
                </LegalListItem>
              </ul>

              <p>
                El ejercicio de estos derechos estará sujeto a las
                condiciones, excepciones y limitaciones establecidas en la
                legislación colombiana aplicable.
              </p>
            </LegalSection>

            {/* 15 */}
            <LegalSection
              number="15"
              title="Procedimiento para consultas y reclamos"
              icon={<FileText size={18} />}
            >
              <p>
                El titular podrá presentar consultas, solicitudes,
                peticiones, quejas o reclamos relacionados con sus datos
                personales a través del correo:
              </p>

              <div className="my-5 rounded-2xl border border-border/60 bg-card/60 p-5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Canal de atención
                </p>

                <a
                  href="mailto:zendcodeco@gmail.com"
                  className="mt-2 block text-lg font-medium text-emerald-600 transition-colors hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  zendcodeco@gmail.com
                </a>

                <p className="mt-2 text-sm text-muted-foreground">
                  Teléfono: 3043904488
                </p>
              </div>

              <p>
                La solicitud deberá permitir identificar al titular y
                describir de manera clara la petición, consulta o reclamo.
                Cuando actúe un representante, podrán solicitarse los
                documentos que acrediten dicha representación.
              </p>

              <p>
                Zendcode S.A.S. atenderá las solicitudes dentro de los
                términos establecidos por la legislación aplicable.
              </p>

              <p>
                Cuando una solicitud deba ser dirigida al responsable que
                determine las finalidades del tratamiento de información
                introducida por un usuario respecto de sus propios clientes o
                proveedores, Zendcode S.A.S. podrá orientar al titular hacia
                el responsable correspondiente o gestionar la solicitud
                conforme a las instrucciones y obligaciones aplicables.
              </p>
            </LegalSection>

            {/* 16 */}
            <LegalSection
              number="16"
              title="Cookies y tecnologías similares"
              icon={<Database size={18} />}
            >
              <p>
                Luka y sus servicios asociados pueden utilizar tecnologías
                necesarias para mantener sesiones, recordar determinadas
                preferencias, proteger la plataforma y obtener información
                técnica relacionada con el funcionamiento del servicio.
              </p>

              <p>
                Cuando se utilicen tecnologías que requieran información o
                autorización adicional conforme a la legislación aplicable,
                se proporcionará la información correspondiente mediante los
                mecanismos habilitados.
              </p>
            </LegalSection>

            {/* 17 */}
            <LegalSection
              number="17"
              title="Menores de edad"
              icon={<ShieldCheck size={18} />}
            >
              <p>
                Luka está orientado a negocios y usuarios que cuentan con
                capacidad legal para contratar y utilizar sus servicios.
              </p>

              <p>
                Zendcode S.A.S. no busca recolectar deliberadamente datos
                personales de menores de edad sin que se cumplan las
                condiciones y garantías establecidas por la legislación
                aplicable.
              </p>
            </LegalSection>

            {/* 18 */}
            <LegalSection
              number="18"
              title="Modificaciones de esta Política"
              icon={<FileText size={18} />}
            >
              <p>
                Zendcode S.A.S. podrá modificar esta Política cuando sea
                necesario debido a cambios legales, regulatorios,
                tecnológicos, operativos o en las funcionalidades de Luka.
              </p>

              <p>
                Las modificaciones sustanciales serán comunicadas por los
                medios que resulten apropiados y, cuando sea necesario,
                antes de su implementación.
              </p>

              <p>
                La versión publicada en esta página indicará la fecha de
                vigencia y el número de versión correspondiente.
              </p>
            </LegalSection>

            {/* 19 */}
            <LegalSection
              number="19"
              title="Vigencia"
              icon={<CheckCircle2 size={18} />}
            >
              <p>
                La presente Política de privacidad y tratamiento de datos
                personales corresponde a la versión{' '}
                <strong className="text-foreground/85">
                  {VERSION}
                </strong>{' '}
                y entra en vigencia el{' '}
                <strong className="text-foreground/85">
                  {EFFECTIVE_DATE}
                </strong>
                .
              </p>

              <p>
                La Política permanecerá disponible para consulta de los
                titulares a través de los canales habilitados por Zendcode
                S.A.S.
              </p>
            </LegalSection>

            {/* 20 */}
            <LegalSection
              number="20"
              title="Contacto"
              icon={<ShieldCheck size={18} />}
            >
              <p>
                Para cualquier consulta relacionada con esta Política, el
                tratamiento de datos personales o el ejercicio de los
                derechos del titular, puedes contactar a Zendcode S.A.S.:
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

            {/* FINAL NOTICE */}
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
                    Documento vigente
                  </p>

                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                    Política de privacidad y aviso de privacidad · Versión{' '}
                    <span className="font-medium text-foreground/80">
                      {VERSION}
                    </span>{' '}
                    · Vigente desde{' '}
                    <span className="font-medium text-foreground/80">
                      {EFFECTIVE_DATE}
                    </span>
                  </p>
                </div>
              </div>
            </section>
          </div>
        </article>

        {/* ============================================================
            FOOTER NAVIGATION
            ============================================================ */}
        <div className="mt-8 flex flex-col items-center justify-between gap-4 text-sm sm:flex-row">
          <Link
            to="/home"
            className="inline-flex items-center gap-2 rounded-full border border-border/70 px-4 py-2.5 font-semibold text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            <ArrowLeft size={16} />
            Volver a Luka
          </Link>

          <Link
            to="/terminos"
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600"
          >
            Ver Términos de servicio
            <ArrowRight size={16} />
          </Link>
        </div>

        {/* ============================================================
            FOOTER
            ============================================================ */}
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

/* ================================================================
   COMPONENTES AUXILIARES
   ================================================================ */

interface LegalSectionProps {
  number: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function LegalSection({
  number,
  title,
  icon,
  children,
}: LegalSectionProps) {
  return (
    <section>
      <div className="mb-5 flex items-start gap-4">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-400/10 bg-emerald-400/[0.05] text-emerald-600/80 dark:text-emerald-400/80">
          {icon}
        </div>

        <div className="flex-1">
          <div className="mb-1 font-mono text-[10px] font-medium tracking-[0.16em] text-emerald-600/60 dark:text-emerald-400/60">
            {number}
          </div>

          <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {title}
          </h2>
        </div>
      </div>

      <div className="space-y-4 text-sm leading-7 text-muted-foreground sm:pl-12 sm:text-[15px]">
        {children}
      </div>
    </section>
  );
}

function InfoBadge({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 text-sm font-medium text-foreground">
        {value}
      </p>
    </div>
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

function DataPill({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/50 px-4 py-3 text-sm text-muted-foreground">
      <span className="mr-2 text-emerald-500 dark:text-emerald-400">
        •
      </span>

      {children}
    </div>
  );
}

function Definition({
  term,
  description,
}: {
  term: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/50 p-4">
      <p className="text-sm font-semibold text-foreground/85">
        {term}
      </p>

      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function ThirdPartyCard({
  name,
  purpose,
}: {
  name: string;
  purpose: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/50 p-5">
      <p className="text-sm font-semibold text-foreground/85">
        {name}
      </p>

      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {purpose}
      </p>
    </div>
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