/**
 * Bitlogic Branding Constants
 * ============================================================
 * Centralized branding configuration
 * Used across the application for consistent messaging
 */

export const BRAND = {
  // === Company & Product ===
  appName: "Bitlogic Client Hub",
  companyName: "Bitlogic",
  slogan: "Gestión integral de hosting y dominios",

  // === Contact & Web ===
  supportEmail: "soporte@bitlogic.com.ar",
  supportPhone: "+54 9 11 XXXX-XXXX",
  website: "https://bitlogic.com.ar",

  // === URLs ===
  urls: {
    dashboard: "/admin",
    login: "/login",
    portal: "/portal",
    support: "https://bitlogic.com.ar/soporte",
    docs: "https://docs.bitlogic.com.ar",
  },

  // === Messaging ===
  messages: {
    welcome: "Bienvenido a Bitlogic Client Hub",
    tagline: "Tu portal para gestionar hosting y dominios",
    copyright: `© ${new Date().getFullYear()} Bitlogic. Todos los derechos reservados.`,
  },

  // === Brand Assets (relative paths) ===
  assets: {
    logoHorizontal: "/assets/brand/bitlogic-logo-horizontal.svg",
    logoIcon: "/assets/brand/bitlogic-logo-icon.svg",
    favicon: "/favicon.ico",
  },

  // === Colors (Tailwind utilities) ===
  colors: {
    primary: "blue",      // Primary actions: blue-600
    success: "green",     // Success states: green-600
    warning: "amber",     // Warnings: amber-600
    danger: "red",        // Errors: red-600
    muted: "gray",        // Disabled/muted: gray-600
  },

  // === Feature Flags ===
  features: {
    paymentIntegration: false,  // MercadoPago/PayPal (future)
    automationAdvanced: false,   // Advanced automations (future)
    hestiaFullSync: false,       // Full Hestia integration (future)
    backupS3: false,             // AWS S3 backups (future)
  },

  // === Version ===
  version: "1.0.0",
  releaseDate: "2026-06-17",
};

// === Helper functions ===
export function getAppName(): string {
  return BRAND.appName;
}

export function getLogoUrl(type: "horizontal" | "icon" = "horizontal"): string {
  return type === "icon" ? BRAND.assets.logoIcon : BRAND.assets.logoHorizontal;
}

export function getCopyright(): string {
  return BRAND.messages.copyright;
}
