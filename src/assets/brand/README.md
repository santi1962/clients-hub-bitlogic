# Bitlogic Brand Assets

## Archivos esperados

### 1. Logo Horizontal
**Archivo:** `bitlogic-logo-horizontal.svg`
- **Dimensiones:** 300x80px (mínimo)
- **Formato:** SVG (preferido) o PNG con transparencia
- **Uso:** 
  - Sidebar/navbar (tamaño: 160-200px ancho)
  - Login page (tamaño: 200-250px ancho)
  - Emails (tamaño: 150-200px ancho)
- **Propiedades:**
  - Transparencia de fondo
  - Legible a cualquier tamaño
  - Espacio en blanco consistente

### 2. Logo Isotipo (Icon)
**Archivo:** `bitlogic-logo-icon.svg`
- **Dimensiones:** 128x128px (mínimo)
- **Formato:** SVG (preferido) o PNG con transparencia
- **Uso:**
  - Favicon (convertir a 32x32 .ico)
  - Sidebar cuando está colapsado
  - Avatar predeterminado
  - Badges y notificaciones
- **Propiedades:**
  - Cuadrado o círculo
  - Legible a 32x32px
  - Margen interno consistente

### 3. Favicon
**Archivo:** `favicon.ico`
- **Dimensiones:** 32x32px (mínimo)
- **Formato:** ICO o PNG
- **Ubicación:** `public/favicon.ico`
- **Uso:**
  - Pestaña del navegador
  - Bookmarks
  - URL bar

## Instrucciones de carga

1. Descarga los archivos del logo definitivo de Bitlogic
2. Convierte a SVG si es necesario (recomendado)
3. Optimiza para web:
   - Elimina metadata innecesaria
   - Minifica SVG
   - Reduce tamaño de PNG
4. Coloca en esta carpeta
5. Verifica que aparecen correctamente en:
   - Sidebar
   - Login
   - Dashboard
   - Portal cliente
   - Favicon

## Soporte de navegadores

- SVG: Soportado en todos los navegadores modernos
- PNG: Fallback para navegadores antiguos
- ICO: Requerido para favicon en algunos navegadores

## Conversiones útiles

### SVG a PNG
```bash
# Usando ImageMagick
convert -background transparent bitlogic-logo-icon.svg -density 300 -define png:color-type=6 bitlogic-logo-icon.png
```

### PNG a ICO
```bash
# Usando ImageMagick
convert bitlogic-logo-icon.png -define icon:auto-resize=256,128,96,64,48,32,16 favicon.ico
```

### SVG Minification
```bash
# Usando svgo
npm install -g svgo
svgo bitlogic-logo-horizontal.svg
```

---

**Estado:** 📋 Esperando archivos definitivos de logo
**Prioridad:** 🔴 Bloqueante para deploy
