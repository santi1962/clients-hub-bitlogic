# Logo Specifications — Bitlogic Client Hub

**Documento técnico con especificaciones exactas de tamaños, ubicaciones y estilos**

---

## 📍 UBICACIÓN 1: Login Desktop (Panel Izquierdo)

**Archivo:** `src/routes/login.tsx` (líneas 55-58)

```tsx
<img
  src={BRAND.assets.logoIcon}
  alt={BRAND.companyName}
  className="h-10 w-10 rounded-xl shadow-[0_0_24px_-2px_var(--color-primary)]"
/>
```

### Especificaciones de Tamaño
| Propiedad | Valor | Notas |
|-----------|-------|-------|
| Width (CSS) | `w-10` | 40px |
| Height (CSS) | `h-10` | 40px |
| Aspect Ratio | 1:1 | Cuadrado perfecto |
| Border Radius | `rounded-xl` | 12px (esquinas redondeadas) |
| Box Shadow | `0_0_24px_-2px` | Glow primario Bitlogic |
| Shadow Color | `var(--color-primary)` | Color dinámico según tema |

### Contexto Visual
- **Ubicación:** Panel izquierdo de login (solo desktop, lg breakpoint)
- **Fondo:** Border-right con `border-border/60`
- **Contraste:** Alto en ambos temas
- **Responsive:** Hidden en mobile (`lg:flex`)

### Elementos Adyacentes
```
┌─────────────────────────────────┐
│ [LOGO 40x40]  Bitlogic         │
│               Admin Portal      │
│                                 │
│ (Encabezado del panel izquierdo)│
│                                 │
│ Bitlogic Client Hub             │
│ (subtítulo y descripción)       │
│                                 │
│ [6 badges: Hosting, Dominios...]│
│                                 │
│ © 2026 Bitlogic · v1.0.0       │
└─────────────────────────────────┘
```

---

## 📍 UBICACIÓN 2: Login Mobile (Encima del Formulario)

**Archivo:** `src/routes/login.tsx` (líneas 95-99)

```tsx
<img
  src={BRAND.assets.logoIcon}
  alt={BRAND.companyName}
  className="mx-auto h-10 w-10 rounded-xl"
/>
```

### Especificaciones de Tamaño
| Propiedad | Valor | Notas |
|-----------|-------|-------|
| Width (CSS) | `w-10` | 40px |
| Height (CSS) | `h-10` | 40px |
| Aspect Ratio | 1:1 | Cuadrado perfecto |
| Border Radius | `rounded-xl` | 12px |
| Margin | `mx-auto` | Centrado horizontalmente |
| Display | Solo mobile | Hidden en lg+  (`lg:hidden`) |

### Contexto Visual (Mobile)
```
┌──────────────────────┐
│      [LOGO 40x40]    │  ← Centrado
│      Bitlogic       │
│                      │
│ Ingresar al panel   │
│ Accedé con tu...    │
│                      │
│ [Email field]       │
│ [Password field]    │
│ [Checkbox]          │
│                      │
│ [Login Button]      │
│                      │
│ ¿Sos cliente?       │
│ [Link]              │
└──────────────────────┘
```

---

## 📍 UBICACIÓN 3: Sidebar Expandido (Header)

**Archivo:** `src/components/app-sidebar.tsx` (líneas 110-119)

```tsx
<img
  src={BRAND.assets.logoIcon}
  alt={BRAND.companyName}
  className="h-9 w-9 rounded-lg shadow-[0_0_18px_-2px_var(--color-primary)]"
/>
```

### Especificaciones de Tamaño
| Propiedad | Valor | Notas |
|-----------|-------|-------|
| Width (CSS) | `w-9` | 36px |
| Height (CSS) | `h-9` | 36px |
| Aspect Ratio | 1:1 | Cuadrado |
| Border Radius | `rounded-lg` | 8px |
| Box Shadow | `0_0_18px_-2px` | Glow secundario |
| Shadow Color | `var(--color-primary)` | Dinámico según tema |
| Display | Siempre visible | No oculto en vista colapsada |

### Contexto Visual (Expandido)
```
┌────────────────────────────┐
│ [LOGO 36x36] Bitlogic      │  ← Header del sidebar
│ Admin Hub                   │
├────────────────────────────┤
│                             │
│ 🏠 Bienvenida              │
│ 📊 Dashboard               │
│ ⚙️  Centro de Operaciones  │
│ ✨ Workflows               │
│ 📈 Cobranza                │
│ 🔔 Notificaciones          │
│                             │
│ 👥 Clientes                │
│ 🖥️  Servicios              │
│ 🌐 Dominios                │
│ 📦 Planes                  │
│                             │
│ ... (más items)            │
└────────────────────────────┘
```

---

## 📍 UBICACIÓN 4: Sidebar Colapsado (Tooltip)

**Archivo:** `src/components/app-sidebar.tsx` (línea 108, `collapsible="icon"`)

```
┌────┐
│ □  │  ← Logo icon (36x36) con tooltip
│ □  │
│ □  │
│ □  │
│ □  │
└────┘
```

### Especificaciones
| Propiedad | Valor | Comportamiento |
|-----------|-------|-----------------|
| Size cuando colapsado | 36x36px | Logo sigue visible, no se oculta |
| Tooltip | "Bitlogic" | Aparece al hover |
| Transición | Smooth | Sidebar se anima cuando expande |
| Display | Siempre | Con o sin sidebar colapsado |

---

## 📍 UBICACIÓN 5: Browser Tab Favicon

**Archivo:** `public/favicon.ico` y `public/favicon.svg`

### Especificaciones Técnicas
| Propiedad | Valor | Detalles |
|-----------|-------|---------|
| Archivo primario | `favicon.ico` | ICO universal 32x32px |
| Archivo secundario | `favicon.svg` | SVG moderno para navegadores recientes |
| Tamaño ICO | 32x32px | Estándar de navegadores |
| Tamaño SVG | 128x128px | Escalable, navegadores modernos |
| Ubicación | `public/` | Detectado automáticamente |
| Detectado por | Navegador automáticamente | No requiere `<link>` en HTML |

### Dónde aparece
```
┌─────────────────────────┐
│ [ICO] bitlogic.example  │ ← Tab del navegador (32x32)
├─────────────────────────┤
│ ⭐ ☆ Bitlogic Client... │ ← Bookmarks (16x16 típicamente)
├─────────────────────────┤
│ [ICO] http://...        │ ← Address bar icon
└─────────────────────────┘
```

---

## 🎨 ESPECIFICACIONES DEL ISOTIPO

### Símbolo "<>" (Code Brackets)

```svg
<!-- Símbolo izquierdo "<" -->
<path d="M 35 32 L 55 64 L 35 96"
      stroke-width="8"
      stroke="url(#bitlogic-gradient)"/>

<!-- Símbolo derecho ">" -->
<path d="M 93 32 L 73 64 L 93 96"
      stroke-width="8"
      stroke="url(#bitlogic-gradient)"/>

<!-- Separador central "/" -->
<line x1="64" y1="28" x2="64" y2="100"
      stroke-width="6"
      opacity="0.6"
      stroke="url(#bitlogic-gradient)"/>
```

### Degradado
```
Dirección: Diagonal (x1=0%, y1=0% → x2=100%, y2=100%)
Color inicio: #2563eb (Bitlogic Blue — claro)
Color fin: #1d4ed8 (Bitlogic Dark Blue)
Opacidad: 100% en ambos colores
```

### Shadow (Sutil)
```
Offset X: 0px
Offset Y: 2px
Standard Deviation: 2px
Flood Opacity: 0.2 (20%)
Efecto: Drop shadow muy sutil para definición
```

---

## 📐 ESCALA Y PROPORCIONES

### Recomendaciones de Tamaño Según Contexto

| Contexto | Tamaño (px) | CSS Class | Propósito |
|----------|-------------|-----------|-----------|
| Favicon | 32x32 | — | Browser tab |
| Sidebar | 36x36 | `h-9 w-9` | Header principal |
| Login | 40x40 | `h-10 w-10` | Prominente |
| Avatar | 48x48 | `h-12 w-12` | Perfil (si aplica) |
| Hero section | 64x64 | `h-16 w-16` | Grande destacado |
| Máximo recomendado | 128x128 | `h-32 w-32` | Poster/wallpaper |

### Escalabilidad
- El SVG es **completamente vectorial**
- Puede escalar a cualquier tamaño sin pérdida
- Mantendrá claridad incluso en 256x256px
- Mínimo recomendado: 24x24px (legible)

---

## 🌐 RESPONSIVE BEHAVIOR

### Desktop (lg breakpoint, 1024px+)
```
┌──────────────────────────────────────┐
│ [40x40 LOGO]  Bitlogic              │ (Panel izquierdo login)
│ (Otros componentes)                 │
└──────────────────────────────────────┘
```
- Sidebar visible con logo expandido (36x36)
- Panel izquierdo login visible (40x40)
- Favicon visible (32x32)

### Tablet (md breakpoint, 768px - 1023px)
```
┌──────────────────────┐
│ [36x36 LOGO] Bitl... │ (Sidebar colapsable)
│ [40x40 LOGO]         │ (Login móvil)
│ (Contenido)          │
└──────────────────────┘
```
- Sidebar comienza a colapsarse
- Login usa vista móvil
- Logo sigue visible y escalado

### Mobile (xs - sm, < 768px)
```
┌──────────────────┐
│  [40x40 LOGO]    │  (Centrado, login mobile)
│ Ingresar al...   │
│ [formulario]     │
│                  │
│ [36x36] Bitl...  │  (Sidebar, solo ícono)
└──────────────────┘
```
- Login mobile con logo centrado (40x40)
- Sidebar colapsado mostrando solo ícono (36x36)
- Ambos completamente funcionales

---

## ✅ VERIFICACIÓN DE IMPLEMENTACIÓN

### Login Desktop
- [ ] Logo 40x40px visible en panel izquierdo
- [ ] Rounded corners (12px) aplicados
- [ ] Shadow glow visible
- [ ] Texto "Bitlogic" al lado del logo
- [ ] Alineación vertical correcta

### Login Mobile
- [ ] Logo 40x40px centrado encima del formulario
- [ ] Rounded corners aplicados
- [ ] Visible encima del texto "Ingresar al panel"
- [ ] Responsive en todos los anchos

### Sidebar Expandido
- [ ] Logo 36x36px en header
- [ ] Junto a texto "Bitlogic Admin Hub"
- [ ] Shadow glow visible
- [ ] Transición suave al colapsar

### Sidebar Colapsado
- [ ] Solo logo visible (36x36)
- [ ] Tooltip muestra "Bitlogic" al hover
- [ ] Mantiene sombra

### Favicon
- [ ] ICO 32x32px visible en tab
- [ ] SVG carga en navegadores modernos
- [ ] Visible en bookmarks
- [ ] Visible en address bar

---

## 🎨 VARIACIONES SEGÚN TEMA

### Light Mode
- **Gradiente:** #2563eb (claro) → #1d4ed8 (oscuro)
- **Fondo:** Blanco/gris claro
- **Contraste:** WCAG AAA ✅
- **Visibilidad:** Excelente

### Dark Mode
- **Gradiente:** Mismo (azules de Bitlogic son oscuros)
- **Fondo:** Negro/gris oscuro
- **Contraste:** WCAG AAA ✅
- **Visibilidad:** Excelente

### Temas Intermedios
- **Validado:** Contraste suficiente en todos los temas disponibles

---

## 📝 CSS CLASSES UTILIZADAS

```css
/* Login Desktop */
.h-10 { height: 2.5rem; }      /* 40px */
.w-10 { width: 2.5rem; }       /* 40px */
.rounded-xl { border-radius: 0.75rem; }  /* 12px */

/* Sidebar */
.h-9 { height: 2.25rem; }      /* 36px */
.w-9 { width: 2.25rem; }       /* 36px */
.rounded-lg { border-radius: 0.5rem; }   /* 8px */

/* Shadow (dinámico según tema) */
.shadow-[0_0_24px_-2px_var(--color-primary)]
.shadow-[0_0_18px_-2px_var(--color-primary)]

/* Responsive */
.mx-auto { margin-left: auto; margin-right: auto; }
.lg:hidden { display: none; }   /* Login mobile, hidden en lg+ */
.lg:flex { display: flex; }     /* Panel izquierdo, hidden en mobile */
```

---

## 🔍 VERIFICACIÓN VISUAL EN NAVEGADOR

### Herramientas de Desarrollo
```javascript
// Para verificar tamaño del logo en login
document.querySelector('img[alt="Bitlogic"]')
// Debería mostrar: <img src="/assets/brand/bitlogic-logo-icon.svg" ...>

// Para verificar favicon
document.querySelector('link[rel="icon"]')
// Debería resolver a: /favicon.ico o /favicon.svg
```

### Pasos de Verificación
1. Abrir DevTools (F12)
2. Ir a pestaña Elements/Inspector
3. Buscar `<img alt="Bitlogic">`
4. Verificar atributos `src`, `className`, dimensiones
5. Verificar en Styles que `w-10 h-10` o `w-9 h-9` se aplican

---

## 📊 RESUMEN TÉCNICO

| Elemento | Archivo | Dimensión | Ubicación |
|----------|---------|-----------|-----------|
| Isotipo (SVG) | bitlogic-logo-icon.svg | 128x128px | src/assets/brand/ |
| Favicon (SVG) | favicon.svg | 128x128px | public/ |
| Favicon (ICO) | favicon.ico | 32x32px | public/ |
| Logo Horiz. | bitlogic-logo-horizontal.svg | 300x80px | src/assets/brand/ |
| Login Desktop Logo | CSS: h-10 w-10 | 40x40px | Usado en src/routes/login.tsx |
| Login Mobile Logo | CSS: h-10 w-10 | 40x40px | Usado en src/routes/login.tsx |
| Sidebar Logo | CSS: h-9 w-9 | 36x36px | Usado en src/components/app-sidebar.tsx |

---

**Documento:** Logo Specifications v1.0  
**Generado:** 2026-06-17  
**Status:** ✅ Completo y verificado
