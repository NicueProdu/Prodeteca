# Patch · Logo del nav + puntos en Partidos + arreglos mobile

## Archivos

    cp _patch/css/main.css        css/main.css
    cp _patch/css/components.css  css/components.css
    cp _patch/css/responsive.css  css/responsive.css
    cp _patch/js/matches.js       js/matches.js

## Lo que arregla

### 1. El wordmark del nav ahora es igual al del login
El logo de adentro de la página (solapas Predicciones / Ranking / Partidos)
no coincidía con el del login:

- **Faltaba un punto** — el login muestra `PRODE·TECA·` (punto azul después
  de PRODE *y* después de TECA). El nav solo ponía el punto después de PRODE
  (la regla usaba `:not(.alt)`). Ahora pone el punto en ambas palabras.
- **Espaciado** — el nav usaba `letter-spacing: 0.01em` y margen del punto
  `0.04em`; el login usa `0.005em` y `0.05em`. Se igualaron al login.

(`css/main.css`)

### 2. Puntos en el desplegable de Partidos con el formato del Perfil
En la solapa **Partidos**, al abrir un partido, los puntos se mostraban con
emojis (`✅ 3 pts` / `🟡 1 pt` / `❌ 0 pts`). Ahora usan las mismas **pills**
que el historial del Perfil:

- `+3 pts` — verde (exacto)
- `+1 pt` — amarillo (parcial)
- `0 pts` — rojo (sin acierto)
- `Pendiente` — gris (partido aún sin resultado)

(`js/matches.js` + estilos en `css/components.css` bajo `.match-accordion .status-pill`)

### 3. Arreglos de mobile (`css/responsive.css`)

El diseño ya tenía una versión mobile (barra de pestañas inferior + grids que
colapsan), pero **la barra superior estaba descuadrada**:

- **Avatar flotando en el medio** — al ocultarse las pestañas del centro
  desaparecía el `flex:1` que empujaba el avatar a la derecha, así que el
  avatar quedaba pegado al logo, en el medio. Por eso "había que buscar" el
  perfil. Ahora la barra usa `space-between`: **logo a la izquierda, puntos +
  avatar pegados a la derecha** (donde se espera tocar para el perfil).
- **Los puntos volvieron a verse en mobile** — antes se ocultaban del todo;
  ahora se muestran compactos al lado del avatar.
- **Barra de filtros** — se alineó al margen de 16px de la página para que no
  asome fuera de pantalla en celulares chicos.

> Sí, mobile y desktop ya tienen diseños distintos: en **desktop** las
> pestañas van en una píldora centrada arriba; en **mobile** (≤768px) van en
> una **barra inferior fija** (Predicciones · Ranking · Partidos · Perfil) y
> la barra de arriba queda solo con el logo y el avatar.
