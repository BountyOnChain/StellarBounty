"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import {
  fallbackLocale,
  getLocaleDirection,
  normalizeLocale,
  type Locale,
} from "./i18n-utils";

export { getLocaleDirection, normalizeLocale, type Locale } from "./i18n-utils";

type TranslationValues = Record<string, string | number>;
type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, values?: TranslationValues) => string;
  formatDate: (value: string | Date) => string;
};

const LOCALE_STORAGE_KEY = "stellar-bounty-locale";
export const localeOptions: Array<{ value: Locale; label: string }> = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
];

const dictionaries: Record<Locale, Record<string, string>> = {
  en: {
    "nav.bounties": "Bounties",
    "nav.dashboard": "Dashboard",
    "nav.language": "Language",
    "nav.mainNavigation": "Main navigation",
    "nav.mobileNavigation": "Mobile navigation",
    "nav.openMenu": "Open menu",
    "nav.closeMenu": "Close menu",
    "wallet.connect": "Connect wallet",
    "wallet.connecting": "Connecting...",
    "wallet.disconnect": "Disconnect",
    "wallet.installFreighter": "Install Freighter",
    "wallet.freighterMissing": "Freighter is not installed.",
    "wallet.freighterConnectFailed": "Unable to connect to Freighter.",
    "wallet.freighterNoPublicKey": "Freighter did not return a public key.",
    "wallet.wrongNetwork": "Freighter is on {activeNetwork}. This app is configured for {targetNetwork}.",
    "toast.dismiss": "Dismiss notification",
    "home.eyebrow": "StellarBounty",
    "home.title": "Open bounties ready for builders",
    "home.subtitle": "Browse funded work, compare rewards and deadlines, then jump into a task that matches your skills.",
    "home.createBounty": "Create Bounty",
    "home.searchTitle": "Search title",
    "home.searchPlaceholder": "Search bounty titles",
    "home.untitledBounty": "Untitled bounty",
    "home.status": "Status",
    "home.sortBy": "Sort by",
    "home.apply": "Apply",
    "home.reset": "Reset",
    "home.showing": "Showing {visible} of {total} bounties",
    "home.filtersShareable": "Filters are saved in the URL so you can share this exact view.",
    "home.emptyTitle": "No bounties available yet.",
    "home.emptyBody": "Create the first bounty and bring new work onto Stellar.",
    "home.postBounty": "Post a bounty",
    "filters.allStatuses": "All statuses",
    "filters.open": "Open",
    "filters.inProgress": "In progress",
    "filters.completed": "Completed",
    "sort.newest": "Newest",
    "sort.highestReward": "Highest reward",
    "sort.closestDeadline": "Closest deadline",
    "card.reward": "Reward",
    "card.deadline": "Deadline",
    "card.rewardTbd": "Reward TBD",
    "card.noDeadline": "No deadline",
    "status.pending": "pending",
    "status.approved": "approved",
    "status.rejected": "rejected",
    "status.open": "open",
    "status.in_progress": "in progress",
    "status.completed": "completed",
    "status.cancelled": "cancelled",
    "detail.reward": "Reward: {reward}",
    "detail.deadline": "Deadline: {deadline}",
    "detail.owner": "Owner",
    "detail.status": "Status",
    "detail.submitWork": "Submit work",
    "detail.submitIntro": "Share a PR, demo, or document link with implementation notes.",
    "detail.workLink": "Work link",
    "detail.notes": "Notes",
    "detail.notesPlaceholder": "Summarize the work and verification steps.",
    "detail.closed": "Submissions are closed for this bounty.",
    "detail.connectRequired": "Connect your wallet to submit work.",
    "detail.disabled": "Submission is disabled.",
    "detail.submitFailed": "Submission failed. Please try again.",
    "detail.submitSuccess": "Work submitted successfully.",
    "detail.submitting": "Submitting...",
    "detail.submit": "Submit work",
    "detail.unavailableTitle": "Bounty unavailable",
    "detail.unavailableBody": "The bounty could not be loaded from the API. Please try again once the backend is available.",
    "create.title": "Create a New Bounty",
    "create.fieldTitle": "Title",
    "create.titlePlaceholder": "e.g. Build a bounty listing page",
    "create.reward": "Reward (XLM)",
    "create.rewardPlaceholder": "e.g. 500",
    "create.deadline": "Deadline",
    "create.description": "Description (supports Markdown)",
    "create.write": "Write",
    "create.preview": "Preview",
    "create.descriptionPlaceholder": "Write your bounty requirements in markdown...",
    "create.emptyPreview": "Nothing to preview yet...",
    "create.creating": "Creating...",
    "create.submit": "Create Bounty",
    "create.success": "Bounty created successfully.",
    "create.error": "Unable to create bounty.",
    "create.validationTitle": "Title is required.",
    "create.validationDescription": "Description is required.",
    "create.validationRewardRequired": "Reward amount is required.",
    "create.validationRewardWhole": "Reward must be a whole number.",
    "create.validationRewardPositive": "Reward must be greater than 0.",
    "create.validationRewardMax": "Reward must be {max} XLM or less.",
    "create.validationDeadline": "Deadline is required.",
    "dashboard.connectPrompt": "Connect your wallet to view your dashboard.",
    "dashboard.title": "Dashboard",
    "dashboard.submissionsTab": "My Submissions",
    "dashboard.bountiesTab": "My Bounties",
    "dashboard.loadError": "Failed to load dashboard data.",
    "dashboard.emptySubmissions": "You haven't submitted to any bounties yet.",
    "dashboard.emptyBounties": "You haven't created any bounties yet.",
    "dashboard.bounty": "Bounty",
    "dashboard.submitted": "Submitted",
    "dashboard.titleColumn": "Title",
    "dashboard.submissions": "Submissions",
    "error.title": "Something went wrong",
    "error.body": "An unexpected error occurred. Please try again.",
    "error.id": "Error ID: {digest}",
    "error.tryAgain": "Try again",
    "error.goHome": "Go home",
    "notFound.title": "Page not found",
    "notFound.body": "The page you are looking for doesn't exist or has been moved.",
    "notFound.backHome": "Back to home",
    "demo.backHome": "Back to home",
    "demo.title": "Build a bounty listing page",
    "demo.descriptionHeading": "Description (rendered from Markdown)",
    "demo.claimBounty": "Claim Bounty",
    "demo.createNew": "Create New",
  },
  es: {
    "nav.bounties": "Recompensas",
    "nav.dashboard": "Panel",
    "nav.language": "Idioma",
    "nav.mainNavigation": "Navegación principal",
    "nav.mobileNavigation": "Navegación móvil",
    "nav.openMenu": "Abrir menú",
    "nav.closeMenu": "Cerrar menú",
    "wallet.connect": "Conectar billetera",
    "wallet.connecting": "Conectando...",
    "wallet.disconnect": "Desconectar",
    "wallet.installFreighter": "Instalar Freighter",
    "wallet.freighterMissing": "Freighter no está instalado.",
    "wallet.freighterConnectFailed": "No se pudo conectar a Freighter.",
    "wallet.freighterNoPublicKey": "Freighter no devolvió una clave pública.",
    "wallet.wrongNetwork": "Freighter está en {activeNetwork}. Esta app está configurada para {targetNetwork}.",
    "toast.dismiss": "Descartar notificación",
    "home.eyebrow": "StellarBounty",
    "home.title": "Recompensas abiertas para builders",
    "home.subtitle": "Explora trabajo financiado, compara pagos y fechas límite, y entra en una tarea que encaje con tus habilidades.",
    "home.createBounty": "Crear recompensa",
    "home.searchTitle": "Buscar título",
    "home.searchPlaceholder": "Buscar títulos de recompensas",
    "home.untitledBounty": "Recompensa sin título",
    "home.status": "Estado",
    "home.sortBy": "Ordenar por",
    "home.apply": "Aplicar",
    "home.reset": "Restablecer",
    "home.showing": "Mostrando {visible} de {total} recompensas",
    "home.filtersShareable": "Los filtros se guardan en la URL para compartir esta vista exacta.",
    "home.emptyTitle": "Todavía no hay recompensas disponibles.",
    "home.emptyBody": "Crea la primera recompensa y trae nuevo trabajo a Stellar.",
    "home.postBounty": "Publicar recompensa",
    "filters.allStatuses": "Todos los estados",
    "filters.open": "Abierta",
    "filters.inProgress": "En progreso",
    "filters.completed": "Completada",
    "sort.newest": "Más recientes",
    "sort.highestReward": "Mayor recompensa",
    "sort.closestDeadline": "Fecha límite cercana",
    "card.reward": "Recompensa",
    "card.deadline": "Fecha límite",
    "card.rewardTbd": "Recompensa por definir",
    "card.noDeadline": "Sin fecha límite",
    "status.pending": "pendiente",
    "status.approved": "aprobada",
    "status.rejected": "rechazada",
    "status.open": "abierta",
    "status.in_progress": "en progreso",
    "status.completed": "completada",
    "status.cancelled": "cancelada",
    "detail.reward": "Recompensa: {reward}",
    "detail.deadline": "Fecha límite: {deadline}",
    "detail.owner": "Propietario",
    "detail.status": "Estado",
    "detail.submitWork": "Enviar trabajo",
    "detail.submitIntro": "Comparte un PR, demo o documento con notas de implementación.",
    "detail.workLink": "Enlace del trabajo",
    "detail.notes": "Notas",
    "detail.notesPlaceholder": "Resume el trabajo y los pasos de verificación.",
    "detail.closed": "Las entregas están cerradas para esta recompensa.",
    "detail.connectRequired": "Conecta tu billetera para enviar trabajo.",
    "detail.disabled": "El envío está deshabilitado.",
    "detail.submitFailed": "No se pudo enviar. Inténtalo de nuevo.",
    "detail.submitSuccess": "Trabajo enviado correctamente.",
    "detail.submitting": "Enviando...",
    "detail.submit": "Enviar trabajo",
    "detail.unavailableTitle": "Recompensa no disponible",
    "detail.unavailableBody": "No se pudo cargar la recompensa desde la API. Inténtalo de nuevo cuando el backend esté disponible.",
    "create.title": "Crear una nueva recompensa",
    "create.fieldTitle": "Título",
    "create.titlePlaceholder": "p. ej. Crear una página de listado de recompensas",
    "create.reward": "Recompensa (XLM)",
    "create.rewardPlaceholder": "p. ej. 500",
    "create.deadline": "Fecha límite",
    "create.description": "Descripción (soporta Markdown)",
    "create.write": "Escribir",
    "create.preview": "Vista previa",
    "create.descriptionPlaceholder": "Escribe los requisitos de la recompensa en markdown...",
    "create.emptyPreview": "Nada para previsualizar todavía...",
    "create.creating": "Creando...",
    "create.submit": "Crear recompensa",
    "create.success": "Recompensa creada correctamente.",
    "create.error": "No se pudo crear la recompensa.",
    "create.validationTitle": "El título es obligatorio.",
    "create.validationDescription": "La descripción es obligatoria.",
    "create.validationRewardRequired": "La recompensa es obligatoria.",
    "create.validationRewardWhole": "La recompensa debe ser un número entero.",
    "create.validationRewardPositive": "La recompensa debe ser mayor que 0.",
    "create.validationRewardMax": "La recompensa debe ser {max} XLM o menos.",
    "create.validationDeadline": "La fecha límite es obligatoria.",
    "dashboard.connectPrompt": "Conecta tu billetera para ver el panel.",
    "dashboard.title": "Panel",
    "dashboard.submissionsTab": "Mis entregas",
    "dashboard.bountiesTab": "Mis recompensas",
    "dashboard.loadError": "No se pudieron cargar los datos del panel.",
    "dashboard.emptySubmissions": "Aún no has enviado trabajo a ninguna recompensa.",
    "dashboard.emptyBounties": "Aún no has creado recompensas.",
    "dashboard.bounty": "Recompensa",
    "dashboard.submitted": "Enviado",
    "dashboard.titleColumn": "Título",
    "dashboard.submissions": "Entregas",
    "error.title": "Algo salió mal",
    "error.body": "Ocurrió un error inesperado. Inténtalo de nuevo.",
    "error.id": "ID de error: {digest}",
    "error.tryAgain": "Intentar de nuevo",
    "error.goHome": "Ir al inicio",
    "notFound.title": "Página no encontrada",
    "notFound.body": "La página que buscas no existe o fue movida.",
    "notFound.backHome": "Volver al inicio",
    "demo.backHome": "Volver al inicio",
    "demo.title": "Crear una página de listado de recompensas",
    "demo.descriptionHeading": "Descripción (renderizada desde Markdown)",
    "demo.claimBounty": "Reclamar recompensa",
    "demo.createNew": "Crear nueva",
  },
};

const I18nContext = createContext<I18nContextValue | null>(null);

function detectLocale(): Locale {
  if (typeof window === "undefined") return fallbackLocale;

  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored) return normalizeLocale(stored);

  const browserLocales = window.navigator.languages?.length
    ? window.navigator.languages
    : [window.navigator.language];
  return normalizeLocale(browserLocales.find(Boolean));
}

function interpolate(message: string, values?: TranslationValues) {
  if (!values) return message;
  return Object.entries(values).reduce(
    (nextMessage, [key, value]) => nextMessage.replaceAll(`{${key}}`, String(value)),
    message,
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(fallbackLocale);

  useEffect(() => {
    setLocaleState(detectLocale());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = getLocaleDirection(locale);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => {
    const dictionary = dictionaries[locale] ?? dictionaries[fallbackLocale];
    const fallbackDictionary = dictionaries[fallbackLocale];

    return {
      locale,
      setLocale: (nextLocale) => setLocaleState(nextLocale),
      t: (key, values) => interpolate(dictionary[key] ?? fallbackDictionary[key] ?? key, values),
      formatDate: (valueToFormat) =>
        new Intl.DateTimeFormat(locale, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }).format(new Date(valueToFormat)),
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used within I18nProvider");
  return value;
}

export function I18nText({ id, values }: { id: string; values?: TranslationValues }) {
  const { t } = useI18n();
  return <>{t(id, values)}</>;
}
