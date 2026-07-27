# Logo Placement Guide — Bitlogic Client Hub

## 📍 Ubicaciones Exactas de Archivos

### 1️⃣ Logo Horizontal (para navbar y login)

```
Ruta: src/assets/brand/bitlogic-logo-horizontal.svg
Tipo de archivo: SVG (preferido) o PNG
Dimensiones: 300x80px (mínimo)
Referenciado por: BRAND.assets.logoHorizontal = "/assets/brand/bitlogic-logo-horizontal.svg"
```

**Dónde aparecerá:**
- ✅ Login page (lado izquierdo, cuando reemplace el Zap icon)
- ✅ Sidebar expandido (cuando reemplace el Zap icon)
- ✅ Emails y comunicaciones

**Pasos:**
1. Obtén el logo horizontal definitivo en SVG
2. Colócalo exactamente en: `src/assets/brand/bitlogic-logo-horizontal.svg`
3. Asegúrate que el nombre sea exacto (case-sensitive)

### 2️⃣ Logo Isotipo (para favicon e icono)

```
Ruta: src/assets/brand/bitlogic-logo-icon.svg
Tipo de archivo: SVG (preferido) o PNG con transparencia
Dimensiones: 128x128px (mínimo), CUADRADO
Referenciado por: BRAND.assets.logoIcon = "/assets/brand/bitlogic-logo-icon.svg"
```

**Dónde aparecerá:**
- ✅ Favicon del navegador (cuando esté convertido a .ico)
- ✅ Sidebar colapsado (cuando reemplace el Zap icon)
- ✅ Avatares y botones

**Pasos:**
1. Obtén el logo isotipo (icono cuadrado) definitivo
2. Colócalo exactamente en: `src/assets/brand/bitlogic-logo-icon.svg`
3. Asegúrate que sea cuadrado (128x128px mínimo)

### 3️⃣ Favicon

```
Ruta: public/favicon.ico
Tipo de archivo: ICO (32x32px)
Referenciado por: navegador automáticamente
```

**Dónde aparecerá:**
- ✅ Pestaña del navegador
- ✅ Bookmarks/Favoritos
- ✅ Barra de direcciones

**Pasos:**
1. Toma el logo isotipo (`bitlogic-logo-icon.svg`)
2. Convierte a PNG 32x32px (si no es SVG)
3. Convierte PNG a ICO usando herramienta online:
   - https://convertio.co/png-ico/
   - https://icoconvert.com/
4. Coloca el archivo en: `public/favicon.ico`
5. Renueva el navegador (Ctrl+Shift+R / Cmd+Shift+R)

---

## 🔧 Conversiones Recomendadas

### SVG → PNG (32x32 para favicon)
```bash
# Usando ImageMagick
convert -background transparent bitlogic-logo-icon.svg -density 300 -resize 32x32 icon-32.png

# O usando Inkscape
inkscape -w 32 -h 32 bitlogic-logo-icon.svg -o icon-32.png
```

### PNG → ICO
```bash
# Usando ImageMagick
convert icon-32.png favicon.ico

# O herramientas online:
# - https://convertio.co/png-ico/
# - https://icoconvert.com/
```

### SVG Optimization
```bash
# Instalar svgo
npm install -g svgo

# Optimizar archivos
svgo bitlogic-logo-horizontal.svg
svgo bitlogic-logo-icon.svg
```

---

## 📋 Verificación Paso a Paso

### ✅ Después de colocar el logo horizontal:

1. Coloca el archivo en `src/assets/brand/bitlogic-logo-horizontal.svg`
2. Ejecuta: `npm run dev`
3. Abre navegador en `http://localhost:8080/login`
4. Deberías ver el logo en el panel izquierdo

**Si no aparece:**
- [ ] Verificar nombre del archivo (exacto, minúsculas)
- [ ] Verificar ruta (debe ser `src/assets/brand/`)
- [ ] Verificar formato (SVG válido, no corrupto)
- [ ] Limpiar caché: `npm run clean && npm run dev`

### ✅ Después de colocar el logo isotipo:

1. Coloca el archivo en `src/assets/brand/bitlogic-logo-icon.svg`
2. Ejecuta: `npm run dev`
3. Abre navegador en `http://localhost:8080`
4. Si reemplazaste el Zap icon, deberías verlo en el sidebar

**Si no aparece:**
- [ ] Verificar nombre del archivo
- [ ] Verificar que sea cuadrado (128x128px)
- [ ] Verificar transparencia de fondo
- [ ] Limpiar caché del navegador (Ctrl+Shift+Del)

### ✅ Después de colocar el favicon:

1. Coloca el archivo en `public/favicon.ico`
2. Ejecuta: `npm run dev`
3. Abre navegador en `http://localhost:8080`
4. Fuerza refresh (Ctrl+Shift+R / Cmd+Shift+R)
5. Deberías ver el icono en la pestaña

**Si no aparece:**
- [ ] Verificar nombre exacto: `favicon.ico`
- [ ] Verificar ubicación: debe estar en `public/` (no en `public/favicon/`)
- [ ] Limpiar caché del navegador completamente
- [ ] Intentar en navegador diferente (Chrome, Firefox, Safari)

---

## 📐 Especificaciones Técnicas

### Logo Horizontal
```
Formato: SVG (recomendado) | PNG
Dimensiones: 300x80px mínimo
Relación: 3.75:1
Fondo: Transparente
Uso: Legible a 160-200px de ancho
Colores: Sin restricción, pero debe ser legible en ambos temas (claro/oscuro)
```

### Logo Isotipo
```
Formato: SVG (recomendado) | PNG
Dimensiones: 128x128px mínimo
Relación: 1:1 (cuadrado)
Fondo: Transparente
Uso: Legible a 32-48px
Colores: Sin restricción, pero debe ser legible a pequeño tamaño
```

### Favicon
```
Formato: ICO
Dimensiones: 32x32px
Colores: RGB o RGBA
Nota: Algunos navegadores también soportan PNG, pero ICO es universal
```

---

## 🎨 Temas (Claro/Oscuro)

Los logos aparecerán en:
- **Tema claro:** Fondo blanco/gris claro
- **Tema oscuro:** Fondo negro/gris oscuro

**Recomendación:** Los logos deben verse bien en ambos temas. Si usas colores específicos, considerar:
- Logo monocromático (blanco/negro)
- Logo con bordes para definición
- Logo con sombra sutil

---

## 🚀 Comandos para Después de Colocar Logos

```bash
# Desarrollo
npm run dev

# Build final
npm run build

# Limpiar caché
npm run clean

# Verificar que está todo correcto
npm run build && npm run preview
```

---

## ✨ Ejemplo de Estructura Final

```
bitlogic-client-hub-main/
├── src/
│   └── assets/
│       └── brand/
│           ├── bitlogic-logo-horizontal.svg    ← Coloca aquí
│           ├── bitlogic-logo-icon.svg          ← Coloca aquí
│           └── README.md
├── public/
│   └── favicon.ico                             ← Coloca aquí
└── ... (otros archivos)
```

---

## 🔗 Recursos Útiles

- **Conversor SVG a PNG:** https://online-convert.com/convert-to-png
- **Conversor PNG a ICO:** https://convertio.co/png-ico/
- **Optimizador SVG:** https://svgo.dev/
- **Generador Favicon:** https://favicon-generator.org/

---

## 📞 Troubleshooting

| Problema | Solución |
|----------|----------|
| Logo no aparece | Verificar nombre y ruta exactos |
| Logo se ve pixelado | Aumentar dimensiones originales |
| Logo se ve oscuro/claro | Verificar contraste en ambos temas |
| Favicon no cambia | Limpiar caché del navegador |
| Error al convertir | Verificar que SVG sea válido |
| Build falla | Verificar que SVG no tenga caracteres especiales |

---

**Estado:** 🟡 Esperando archivos definitivos  
**Última actualización:** 2026-06-17  
**Versión:** 1.0.0
