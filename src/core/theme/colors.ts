/**
 * Colores oficiales extraídos de com.telemetria.app.ui.theme.Color.kt
 * Lenguaje de diseño Cockpit OLED / MyChron 5
 */
export const CockpitColors = {
  // Fondos y superficies
  bgBlack: '#090C0E',         // CockpitBlack
  surfaceDark: '#13181E',     // CockpitDarkSurface
  cardBg: '#1A222B',          // CockpitCardBg
  border: '#2C3947',          // CockpitBorder
  borderLight: '#3D4F63',

  // Acentos neón
  neonGreen: '#00E676',       // NeonGreen (A400)
  neonCyan: '#00E5FF',        // NeonCyan (A400)
  neonRed: '#FF1744',         // NeonRed (A400)
  neonAmber: '#FFB300',       // NeonAmber (A700)
  neonBlue: '#2979FF',        // NeonBlue (A400)

  // Tipografía
  textPrimary: '#F0F4F8',     // TextPrimary
  textSecondary: '#8B9CB0',   // TextSecondary
  textMuted: '#4A5568',       // TextMuted (Valores N/D)

  // Estados
  statusActive: '#00E676',
  statusWarning: '#FFB300',
  statusError: '#FF1744',
  statusOff: '#1F2937',
} as const;

export type CockpitColorKey = keyof typeof CockpitColors;
