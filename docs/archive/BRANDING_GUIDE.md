# Guía de Branding — Bitlogic Client Hub

## Estado Actual

✅ **Sistema de branding centralizado creado:**
- `src/lib/brand.ts` contiene todas las constantes
- Sidebar y login usando `BRAND.companyName` y `BRAND.appName`
- Rutas y mensajes usando constantes centralizadas

❌ **Logos aún pendientes:**
- Necesitan archivos definitivos de logo

## Dónde colocar los archivos

### 1. Logo Horizontal (para navbar/sidebar expandido)
**Ruta:** `src/assets/brand/bitlogic-logo-horizontal.svg`
- Tamaño: 300x80px (mínimo)
- Uso: Sidebar expandido, login (lado izquierdo), emails
- Se referencia en: `BRAND.assets.logoHorizontal`

### 2. Logo Isotipo (para favicon/icon/collapsed sidebar)
**Ruta:** `src/assets/brand/bitlogic-logo-icon.svg`
- Tamaño: 128x128px (mínimo), cuadrado
- Uso: Favicon, sidebar colapsado, avatares
- Se referencia en: `BRAND.assets.logoIcon`

### 3. Favicon
**Ruta:** `public/favicon.ico`
- Tamaño: 32x32px
- Genera automáticamente el navegador busca `favicon.ico` en `public/`

## Cómo usar los logos en el código

### Implementación actual (placeholder)
```tsx
// En login.tsx y app-sidebar.tsx se usa un icono Zap como placeholder:
<Zap className="h-5 w-5" />

// Cuando los logos estén listos, cambiar a:
<img src={getLogoUrl("icon")} alt={BRAND.companyName} className="h-5 w-5" />
```

### Implementación futura (con logos)

**Para navbar expandido:**
```tsx
import { getLogoUrl } from "@/lib/brand";

<img 
  src={getLogoUrl("horizontal")} 
  alt={BRAND.companyName}
  className="h-10" 
/>
```

**Para isotipo:**
```tsx
<img 
  src={getLogoUrl("icon")} 
  alt={BRAND.companyName}
  className="h-8 w-8 rounded-lg" 
/>
```

## Archivo logo-placeholder.tsx (para cuando tengas los archivos)

```tsx
import { getLogoUrl, BRAND } from "@/lib/brand";

export function LogoHorizontal({ className = "h-10" }: { className?: string }) {
  return (
    <img
      src={getLogoUrl("horizontal")}
      alt={BRAND.companyName}
      className={className}
      loading="eager"
    />
  );
}

export function LogoIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <img
      src={getLogoUrl("icon")}
      alt={BRAND.companyName}
      className={`${className} rounded-lg`}
      loading="eager"
    />
  );
}
```

## Checklist para integración de logos

- [ ] **Obtener archivos definitivos** de logo (SVG preferido)
- [ ] **Colocar logo horizontal** en `src/assets/brand/bitlogic-logo-horizontal.svg`
- [ ] **Colocar logo isotipo** en `src/assets/brand/bitlogic-logo-icon.svg`
- [ ] **Generar favicon** desde isotipo y colocar en `public/favicon.ico`
- [ ] **Crear componentes** LogoHorizontal y LogoIcon en `src/components/logo.tsx`
- [ ] **Reemplazar Zap icon** en:
  - `src/routes/login.tsx` (línea ~55, ~98)
  - `src/components/app-sidebar.tsx` (línea ~110)
- [ ] **Test en navegador:**
  - [ ] Login vuelve a mostrar logo
  - [ ] Sidebar vuelve a mostrar logo
  - [ ] Favicon aparece en pestaña
  - [ ] Logo se ve bien en dispositivos móviles
- [ ] **Build final:** `npm run build`

## Constantes de branding actualizadas

Archivo: `src/lib/brand.ts`

```typescript
export const BRAND = {
  appName: "Bitlogic Client Hub",              // ✅ Usado en títulos
  companyName: "Bitlogic",                     // ✅ Usado en sidebar/login
  slogan: "Gestión integral de hosting y dominios",  // ✅ Login
  
  messages: {
    welcome: "Bienvenido a Bitlogic Client Hub",     // ✅ Toast al login
    copyright: "© 2026 Bitlogic. Todos los derechos reservados.",  // ✅ Footer
  },
  
  assets: {
    logoHorizontal: "/assets/brand/bitlogic-logo-horizontal.svg",
    logoIcon: "/assets/brand/bitlogic-logo-icon.svg",
    favicon: "/favicon.ico",
  },
};
```

## Ubicaciones donde se usa branding

| Página | Elemento | Uso Actual |
|--------|----------|-----------|
| Login | Logo | Zap icon (placeholder) |
| Login | Título | `BRAND.appName` ✅ |
| Login | Subtítulo | `BRAND.slogan` ✅ |
| Login | Copyright | `BRAND.messages.copyright` ✅ |
| Sidebar | Logo | Zap icon (placeholder) |
| Sidebar | Company name | `BRAND.companyName` ✅ |
| Root | Title tag | `BRAND.appName` ✅ |
| Favicon | Icon | public/favicon.ico (vacío) |

## Próximos pasos

1. **Obtén los archivos de logo** definitivos en formato SVG
2. **Coloca los archivos** en las carpetas indicadas
3. **Reemplaza los placeholders** (Zap icons) con los logos reales
4. **Genera el favicon** a partir del isotipo
5. **Test en navegador** en desktop y móvil
6. **Ejecuta build final** para producción

## Soporte

- **Preguntas sobre branding:** Ver `src/lib/brand.ts`
- **Ubicaciones de assets:** `src/assets/brand/` y `public/favicon.ico`
- **Constantes:** Siempre usar `BRAND.*` en lugar de hardcoding valores

---

**Status:** 🟡 Pendiente logos definitivos
**Última actualización:** 2026-06-17
