import {
  GEIST,
  INSTRUMENT_SERIF,
  NEWSREADER,
  type PageFont,
  type PageInlineStyleOverride,
  type PageTypographyRecipe,
} from "./pageTypography";

/* ═══════════════════════════════════════════════════════════════════════
   One recipe per packaged page.

   Each recipe restates the page's own typographic decisions as its defaults,
   so the override sheet is a no-op until something is actually moved. Where a
   page sizes its type with clamp(), the control drives the clamp's ceiling
   and the authored floor and preferred term are left alone — the page keeps
   responding to width exactly as written. Where a page scales off a design
   unit, the control is expressed in that unit. Sizes that ride along with the
   heading or body — a second heading scale, a tightened line-height, a
   narrow-screen step-down — are carried at their authored ratio rather than
   pinned, so the page's internal proportions survive being retuned.
   ═══════════════════════════════════════════════════════════════════════ */

/** Trim float noise from a ratio so the emitted CSS stays readable. */
const n = (value: number) => Number(value.toFixed(3));
const px = (value: number) => `${n(value)}px`;
/** An authored unit-scaled size, kept on the page's own --u. */
const unit = (value: number) => `calc(${n(value)} * var(--u))`;

function withAlpha(hex: string, alpha: number) {
  const [red, green, blue] = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

/* ── the authored faces ──────────────────────────────────────────────── */

const ONEST: PageFont = {
  value: "onest",
  label: "Onest",
  stack: "'Onest', system-ui, -apple-system, 'Helvetica Neue', sans-serif",
};

const LEXEND: PageFont = {
  value: "lexend",
  label: "Lexend",
  stack: "'Lexend', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const OUTFIT: PageFont = {
  value: "outfit",
  label: "Outfit",
  stack: "Outfit, 'Outfit Fallback', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
};

const SPACE_GROTESK: PageFont = {
  value: "space-grotesk",
  label: "Space Grotesk",
  stack: '"Space Grotesk", "Helvetica Neue", Helvetica, Arial, sans-serif',
};

const QUESTRIAL: PageFont = {
  value: "questrial",
  label: "Questrial",
  stack: '"Questrial", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const ANTHRA_DISPLAY: PageFont = {
  value: "avenir-next",
  label: "Avenir Next",
  stack: "'Avenir Next', 'Futura', 'Century Gothic', 'Helvetica Neue', Arial, sans-serif",
};

const ANTHRA_UI: PageFont = {
  value: "avenir-next",
  label: "Avenir Next",
  stack: "'Avenir Next', 'Helvetica Neue', Arial, sans-serif",
};

/** attune embeds both of its faces, so neither one needs fetching. */
const INSTRUMENT_EMBEDDED: PageFont = {
  value: "instrument-serif",
  label: "Instrument Serif",
  stack: "'InstrumentEmb', 'Instrument Serif', Georgia, serif",
};

const INTER_EMBEDDED: PageFont = {
  value: "inter",
  label: "Inter",
  stack: "'InterEmb', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const IOWAN_OLD_STYLE: PageFont = {
  value: "iowan-old-style",
  label: "Iowan Old Style",
  stack: '"Iowan Old Style", Baskerville, "Times New Roman", serif',
};

const INTER_LOADED: PageFont = {
  value: "inter",
  label: "Inter",
  stack: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
};

const GEIST_LOADED: PageFont = {
  value: "geist",
  label: "Geist",
  stack: "Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
};

const INSTRUMENT_SERIF_LOADED: PageFont = {
  value: "instrument-serif",
  label: "Instrument Serif",
  stack: '"Instrument Serif", Georgia, "Times New Roman", serif',
};

/** Sketchbook packages Newsreader as a local variable face. */
const NEWSREADER_LOADED: PageFont = {
  value: "newsreader",
  label: "Newsreader",
  stack: '"Newsreader", Georgia, "Times New Roman", serif',
};

const FIGTREE: PageFont = {
  value: "figtree",
  label: "Figtree",
  stack: 'Figtree, system-ui, -apple-system, "Segoe UI", sans-serif',
};

const HANKEN_GROTESK: PageFont = {
  value: "hanken-grotesk",
  label: "Hanken Grotesk",
  stack: '"Hanken Grotesk", system-ui, -apple-system, "Segoe UI", sans-serif',
};

const MULISH: PageFont = {
  value: "mulish",
  label: "Mulish",
  stack: "Mulish, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const DM_SANS: PageFont = {
  value: "dm-sans",
  label: "DM Sans",
  stack: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const ROBOTO_FLEX_LOADED: PageFont = {
  value: "roboto-flex",
  label: "Roboto Flex",
  stack: '"Roboto Flex", "Roboto Condensed", Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif',
};

/* ── Anima ────────────────────────────────────────────────────────────────
   The opening statement is the adjustable heading while the colossal Anima
   wordmark keeps its authored viewport scale and spacing. The same chosen
   face and weight still carry across both so the composition stays coherent.
   The accent retunes the interface marks and the point field follows through
   a canvas filter when the authored near-white is moved. */
export const ANIMA_TYPOGRAPHY: PageTypographyRecipe = {
  headingFonts: [GEIST_LOADED, INSTRUMENT_SERIF, NEWSREADER],
  bodyFonts: [GEIST_LOADED, NEWSREADER, INSTRUMENT_SERIF],
  headingWeights: ["400", "500", "600"],
  headingWeight: "400",
  bodyWeights: ["400", "500", "600"],
  bodyWeight: "400",
  primaryColor: "#ededf0",
  headingSize: [38, 62, 88],
  bodySize: [12, 15.6, 22],
  headingLetterSpacing: [-0.08, -0.022, 0.1],
  css: (type) => `
:root {
  --sans: ${type.body};
  --accent: ${type.primary};
  --accent-soft: ${type.retone("#9c9ca4")};
}
body { font-family: ${type.body}; font-weight: ${type.bodyWeight}; }
.lede, .wordmark {
  font-family: ${type.heading};
  font-weight: ${type.headingWeight};
}
.lede {
  font-size: ${px(type.headingSize)};
  line-height: ${px((type.headingSize * 70) / 62)};
  letter-spacing: ${type.headingLetterSpacing}em;
}
.sub { font-size: ${px(type.bodySize)}; font-weight: ${type.bodyWeight}; }
.brand .mark path { stroke: ${type.primary}; }
.brand .mark circle { fill: ${type.retone("#9c9ca4")}; }
#gl { filter: ${type.filter()}; }
@media (max-width: 1180px) {
  .lede { font-size: ${px((type.headingSize * 50) / 62)}; line-height: ${px((type.headingSize * 57) / 62)}; }
}
@media (max-width: 900px) {
  .lede { font-size: ${px((type.headingSize * 42) / 62)}; line-height: ${px((type.headingSize * 49) / 62)}; }
}
@media (max-width: 600px) {
  .lede {
    font-size: ${px((type.headingSize * 33) / 62)};
    line-height: ${px((type.headingSize * 40) / 62)};
    letter-spacing: ${n(type.headingLetterSpacing + 0.004)}em;
  }
  .sub { font-size: ${px((type.bodySize * 13.8) / 15.6)}; }
}
`,
};

/* ── Aster Halftone Bloom ─────────────────────────────────────────────────
   Aster's statement uses the ceiling of an authored clamp and the lede rides
   a second responsive custom property. Its signature colour lives entirely
   in the WebGL rose, so the primary control reaches the scene as a filter and
   leaves the neutral glass interface unchanged at the authored default. */
export const ASTER_HALFTONE_TYPOGRAPHY: PageTypographyRecipe = {
  headingFonts: [ROBOTO_FLEX_LOADED, INSTRUMENT_SERIF, NEWSREADER, GEIST],
  bodyFonts: [ROBOTO_FLEX_LOADED, GEIST, NEWSREADER, INSTRUMENT_SERIF],
  headingWeights: ["300", "400", "500", "600", "700"],
  headingWeight: "400",
  bodyWeights: ["300", "400", "500", "600"],
  bodyWeight: "400",
  primaryColor: "#ff570e",
  headingSize: [64, 140, 176],
  bodySize: [14, 21, 30],
  headingLetterSpacing: [-0.08, 0, 0.12],
  css: (type) => `
:root {
  --font: ${type.body};
  --body: clamp(16px, 1.17vw, ${px(type.bodySize)});
}
body { font-family: ${type.body}; font-weight: ${type.bodyWeight}; }
h1 {
  font-family: ${type.heading};
  font-size: clamp(38px, 7vw, ${px(type.headingSize)});
  font-weight: ${type.headingWeight};
  font-variation-settings: "wdth" 73, "wght" ${type.headingWeight}, "opsz" 30;
  letter-spacing: ${type.headingLetterSpacing}em;
}
.lede, .ghost { font-weight: ${type.bodyWeight}; }
#gl { filter: ${type.filter()}; }
@media (max-width: 780px) {
  h1 { font-size: clamp(34px, 9.4vw, ${px((type.headingSize * 66) / 140)}); }
}
`,
};

/* ── Skyfield ─────────────────────────────────────────────────────────────
   The opening headline and final descent statement share one responsive
   display scale. Mid-journey labels retain their compact authored sizing,
   while the lede follows the body control. The lime control carries through
   the HUD, scan rail, CTAs, and the terrain scene itself. */
export const SKYFIELD_TYPOGRAPHY: PageTypographyRecipe = {
  headingFonts: [GEIST_LOADED, INSTRUMENT_SERIF, NEWSREADER],
  bodyFonts: [GEIST_LOADED, NEWSREADER, INSTRUMENT_SERIF],
  headingWeights: ["400", "500", "600"],
  headingWeight: "500",
  bodyWeights: ["400", "500", "600"],
  bodyWeight: "400",
  primaryColor: "#c6f19d",
  headingSize: [42, 74, 104],
  bodySize: [12, 15.5, 22],
  headingLetterSpacing: [-0.08, -0.05, 0.08],
  css: (type) => `
:root {
  --sans: ${type.body};
  --lime: ${type.primary};
  --lime-hot: ${type.retone("#a8e063")};
}
body { font-family: ${type.body}; font-weight: ${type.bodyWeight}; }
h1, h1 .ln b, #outro h2 {
  font-family: ${type.heading};
  font-weight: ${type.headingWeight};
}
h1 {
  font-size: clamp(30px, 5.05vw, ${px(type.headingSize)});
  letter-spacing: ${type.headingLetterSpacing}em;
}
#outro h2 {
  font-size: clamp(28px, 4.3vw, ${px((type.headingSize * 62) / 74)});
  letter-spacing: ${n(type.headingLetterSpacing + 0.005)}em;
}
.lede { font-size: clamp(13px, 1.06vw, ${px(type.bodySize)}); font-weight: ${type.bodyWeight}; }
#gl { filter: ${type.filter()}; }
@media (max-width: 820px) {
  h1 {
    font-size: clamp(27px, 8.4vw, ${px((type.headingSize * 46) / 74)});
    letter-spacing: ${n(type.headingLetterSpacing + 0.008)}em;
  }
  #outro h2 { font-size: clamp(26px, 7.6vw, ${px((type.headingSize * 44) / 74)}); }
  .lede { font-size: ${px((type.bodySize * 13) / 15.5)}; }
}
`,
};

const INTER_TIGHT: PageFont = {
  value: "inter-tight",
  label: "Inter Tight",
  stack: "'Inter Tight', sans-serif",
};

const DM_MONO: PageFont = {
  value: "dm-mono",
  label: "DM Mono",
  stack: "'DM Mono', monospace",
};

const SYSTEM_UI: PageFont = {
  value: "system-ui",
  label: "System UI",
  stack: "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
};

const BIG_SHOULDERS_DISPLAY: PageFont = {
  value: "big-shoulders-display",
  label: "Big Shoulders Display",
  stack: "'Big Shoulders Display', sans-serif",
};

const BEBAS_NEUE: PageFont = {
  value: "bebas-neue",
  label: "Bebas Neue",
  stack: "'Bebas Neue', sans-serif",
};

const IMPACT: PageFont = {
  value: "impact",
  label: "Impact",
  stack: "Impact, 'Arial Narrow', sans-serif",
};

const ARCHIVO: PageFont = {
  value: "archivo",
  label: "Archivo",
  stack: "Archivo, 'Helvetica Neue', Helvetica, Arial, sans-serif",
};

const JETBRAINS_MONO: PageFont = {
  value: "jetbrains-mono",
  label: "JetBrains Mono",
  stack: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
};

const UNBOUNDED: PageFont = {
  value: "unbounded",
  label: "Unbounded",
  stack: "'Unbounded', sans-serif",
};

const MANROPE: PageFont = {
  value: "manrope",
  label: "Manrope",
  stack: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

/* ── Kage ────────────────────────────────────────────────────────────────
   Two display scales, .h-hero and .h-sec, both clamped. The control drives
   the hero ceiling and the section ceiling follows at its authored 60/46.
   Headings carrying .jp are left out: that class selects the Japanese face,
   and it would lose the cascade to a bare element selector. */
export const KAGE_TYPOGRAPHY: PageTypographyRecipe = {
  headingFonts: [ONEST, INSTRUMENT_SERIF, NEWSREADER, GEIST],
  bodyFonts: [ONEST, GEIST, NEWSREADER, INSTRUMENT_SERIF],
  headingWeights: ["400", "500", "600", "700"],
  headingWeight: "400",
  bodyWeights: ["300", "400", "500", "600"],
  bodyWeight: "300",
  primaryColor: "#e0231c",
  headingSize: [30, 46, 72],
  bodySize: [13, 17, 24],
  headingLetterSpacing: [-0.06, -0.012, 0.12],
  css: (type) => `
:root {
  --vermilion: ${type.primary};
  --ember: ${type.retone("#ff5a3c")};
}
body { font-family: ${type.body}; }
body, .body, .body-lg, .num { font-weight: ${type.bodyWeight}; }
h1:not(.jp), h2:not(.jp), h3:not(.jp), .display:not(.jp) {
  font-family: ${type.heading};
  font-weight: ${type.headingWeight};
}
.display { letter-spacing: ${type.headingLetterSpacing}em; }
.h-hero { font-size: clamp(26px, 3.05vw, ${px(type.headingSize)}); }
.h-sec { font-size: clamp(30px, 4vw, ${px((type.headingSize * 60) / 46)}); }
.body-lg { font-size: clamp(14px, 1.02vw, ${px(type.bodySize)}); }
.body { font-size: ${px(Math.max(11, type.bodySize - 3))}; }
`,
};

/* ── Sylva ───────────────────────────────────────────────────────────────
   The world behind the copy already has four authored dressings, so the
   colour control here is the ink rather than the scene: it moves the hero
   type and the two tints the page derives from it, and leaves the moss to
   the variants. Sizes ride the page's own --u design unit. */
export const SYLVA_TYPOGRAPHY: PageTypographyRecipe = {
  headingFonts: [LEXEND, INSTRUMENT_SERIF, NEWSREADER, GEIST],
  bodyFonts: [LEXEND, GEIST, NEWSREADER, INSTRUMENT_SERIF],
  headingWeights: ["200", "300", "400", "500", "600"],
  headingWeight: "300",
  bodyWeights: ["200", "300", "400", "500"],
  bodyWeight: "300",
  primaryColor: "#ffffff",
  headingSize: [40, 63, 92],
  bodySize: [12, 16.5, 24],
  headingLetterSpacing: [-0.06, -0.006, 0.12],
  css: (type) => `
:root {
  --ink: ${type.primary};
  --ink-soft: ${withAlpha(type.primary, 0.62)};
  --ink-faint: ${withAlpha(type.primary, 0.44)};
}
body { font-family: ${type.body}; font-weight: ${type.bodyWeight}; }
.headline, .ghost {
  font-family: ${type.heading};
}
.headline {
  font-weight: ${type.headingWeight};
  font-size: ${unit(type.headingSize)};
  line-height: ${unit((type.headingSize * 65) / 63)};
  letter-spacing: ${type.headingLetterSpacing}em;
}
.lede {
  font-weight: ${type.bodyWeight};
  font-size: ${unit(type.bodySize)};
  line-height: ${unit((type.bodySize * 22) / 16.5)};
}
@media (max-width: 900px) {
  .headline {
    font-size: ${unit((type.headingSize * 62) / 63)};
    line-height: ${unit((type.headingSize * 66) / 63)};
  }
  .lede {
    font-size: ${unit((type.bodySize * 19) / 16.5)};
    line-height: ${unit((type.bodySize * 27) / 16.5)};
  }
}
`,
};

/* ── Meng To Sketchbook ─────────────────────────────────────────────────
   The page's hierarchy is intentionally quiet: its display scale is the
   nameplate and plate titles, while the biography anchors the body scale.
   The recipe keeps those authored ratios together and leaves the paintings,
   paper wash, shadows, and page-curl lighting untouched. */
export const MENG_TO_SKETCHBOOK_TYPOGRAPHY: PageTypographyRecipe = {
  headingFonts: [INSTRUMENT_SERIF_LOADED, NEWSREADER_LOADED, GEIST],
  bodyFonts: [NEWSREADER_LOADED, GEIST, INSTRUMENT_SERIF_LOADED],
  headingWeights: ["300", "400", "500", "600"],
  headingWeight: "400",
  bodyWeights: ["200", "300", "400", "500", "600"],
  bodyWeight: "400",
  primaryColor: "#2b2721",
  headingSize: [20, 30, 48],
  bodySize: [14, 20, 30],
  headingLetterSpacing: [-0.06, 0.01, 0.12],
  css: (type) => `
:root {
  --ink: ${type.primary};
  --ink-soft: ${withAlpha(type.primary, 0.58)};
  --ink-faint: ${withAlpha(type.primary, 0.36)};
  --hairline: ${withAlpha(type.primary, 0.14)};
  --display: ${type.heading};
  --font: ${type.body};
}
body { font-family: ${type.body}; font-weight: ${type.bodyWeight}; }
.top .name, .plate .t { font-family: ${type.heading}; font-weight: ${type.headingWeight}; }
.top .name {
  font-size: clamp(${px((type.headingSize * 24) / 30)}, calc(${n(type.headingSize / 30)} * 2.4vw), ${px(type.headingSize)});
  letter-spacing: ${type.headingLetterSpacing}em;
}
.plate .t {
  font-size: clamp(${px((type.headingSize * 19) / 30)}, calc(${n(type.headingSize / 30)} * 2.1vw), ${px((type.headingSize * 26) / 30)});
  letter-spacing: ${n(type.headingLetterSpacing - 0.01)}em;
}
.top nav { font-size: ${px((type.bodySize * 15) / 20)}; font-weight: ${type.bodyWeight === "400" ? "300" : type.bodyWeight}; }
.hero-kicker { font-size: ${px((type.bodySize * 12) / 20)}; font-weight: ${type.bodyWeight}; }
.sb-caption { font-size: ${px((type.bodySize * 13) / 20)}; }
.sb-hint, .section-label, .zoom-read { font-size: ${px((type.bodySize * 11) / 20)}; }
.bio {
  font-size: clamp(${px((type.bodySize * 17) / 20)}, calc(${n(type.bodySize / 20)} * 1.7vw), ${px(type.bodySize)});
  font-weight: ${type.bodyWeight === "400" ? "300" : type.bodyWeight};
}
.plate .n { font-size: ${px((type.bodySize * 12) / 20)}; }
.plate .p { font-size: ${px((type.bodySize * 12.5) / 20)}; }
.foot { font-size: ${px((type.bodySize * 11.5) / 20)}; }
::selection { background: ${withAlpha(type.primary, 0.85)}; }
.bio-link { text-decoration-color: ${withAlpha(type.primary, 0.28)}; }
@media (max-width: 640px) {
  .top .name { font-size: ${px((type.headingSize * 20) / 30)}; }
  .top nav { font-size: ${px((type.bodySize * 13) / 20)}; }
  .hero-kicker { font-size: ${px((type.bodySize * 10.5) / 20)}; }
  .sb-hint { font-size: ${px((type.bodySize * 9.5) / 20)}; }
}
`,
};

/* ── Echo Vale ─────────────────────────────────────────────────────────
   Unbounded carries the page's display hierarchy while Manrope handles the
   long-form field notes. The heading control follows the 6.7rem hero cap and
   scales every other display size and responsive clamp at the authored ratio.
   Echo's ember is also the WebGL point colour, so the canvas receives the same
   colour shift as the CSS accents instead of leaving a red particle layer
   behind when the palette changes. */
export const ECHO_VALE_TYPOGRAPHY: PageTypographyRecipe = {
  headingFonts: [UNBOUNDED, INSTRUMENT_SERIF, NEWSREADER, GEIST],
  bodyFonts: [MANROPE, GEIST, NEWSREADER, INSTRUMENT_SERIF],
  headingWeights: ["300", "400", "500", "600"],
  headingWeight: "500",
  bodyWeights: ["300", "400", "500", "600"],
  bodyWeight: "400",
  primaryColor: "#e44b3c",
  headingSize: [56, 107.2, 144],
  bodySize: [12, 16, 24],
  headingLetterSpacing: [-0.1, -0.07, 0.06],
  css: (type) => `
:root { --ember: ${type.primary}; }
body {
  font-family: ${type.body};
  font-size: ${px(type.bodySize)};
  font-weight: ${type.bodyWeight};
}
.display,
.loader-count,
.hero-copy h1,
.hero-foot-item b,
.intro h2,
.section-head h2,
.feature-card h3,
.show-step h3,
.show-step .step-no,
.gallery-head h2,
.gallery-meta h3,
.timeline-item h3,
.price-card h3,
.price,
.quote:first-child blockquote,
.faq-title h2,
.faq-question span:first-child,
.cta h2,
.nav-links a {
  font-family: ${type.heading};
}
.hero-copy h1,
.intro h2,
.section-head h2,
.feature-card h3,
.show-step h3,
.show-step .step-no,
.gallery-head h2,
.gallery-meta h3,
.timeline-item h3,
.price-card h3,
.price,
.faq-title h2,
.faq-question span:first-child,
.cta h2 {
  font-weight: ${type.headingWeight};
}
.hero-copy h1 {
  font-size: clamp(${px((type.headingSize * 2.7) / 6.7)}, calc(${n(type.headingSize / 107.2)} * 5.75vw), ${px(type.headingSize)});
  letter-spacing: ${type.headingLetterSpacing}em;
}
.intro h2 {
  font-size: clamp(${px((type.headingSize * 3) / 6.7)}, calc(${n(type.headingSize / 107.2)} * 7.2vw), ${px((type.headingSize * 8) / 6.7)});
  letter-spacing: ${type.headingLetterSpacing}em;
}
.section-head h2 {
  font-size: clamp(${px((type.headingSize * 2.4) / 6.7)}, calc(${n(type.headingSize / 107.2)} * 5vw), ${px((type.headingSize * 5.7) / 6.7)});
  letter-spacing: ${n(type.headingLetterSpacing + 0.005)}em;
}
.show-step h3 {
  font-size: clamp(${px((type.headingSize * 2.1) / 6.7)}, calc(${n(type.headingSize / 107.2)} * 3.7vw), ${px((type.headingSize * 4.6) / 6.7)});
  letter-spacing: ${n(type.headingLetterSpacing + 0.01)}em;
}
.gallery-head h2 {
  font-size: clamp(${px((type.headingSize * 3) / 6.7)}, calc(${n(type.headingSize / 107.2)} * 6vw), ${px((type.headingSize * 7) / 6.7)});
  letter-spacing: ${type.headingLetterSpacing}em;
}
.price-card h3 {
  font-size: clamp(${px((type.headingSize * 2) / 6.7)}, calc(${n(type.headingSize / 107.2)} * 3vw), ${px((type.headingSize * 3.3) / 6.7)});
  letter-spacing: ${n(type.headingLetterSpacing + 0.01)}em;
}
.price {
  font-size: clamp(${px((type.headingSize * 3.8) / 6.7)}, calc(${n(type.headingSize / 107.2)} * 6vw), ${px((type.headingSize * 7.2) / 6.7)});
  letter-spacing: ${n(type.headingLetterSpacing - 0.01)}em;
}
.faq-title h2 {
  font-size: clamp(${px((type.headingSize * 3) / 6.7)}, calc(${n(type.headingSize / 107.2)} * 5vw), ${px((type.headingSize * 5.8) / 6.7)});
  letter-spacing: ${type.headingLetterSpacing}em;
}
.cta h2 {
  font-size: clamp(${px((type.headingSize * 3.1) / 6.7)}, calc(${n(type.headingSize / 107.2)} * 8.2vw), ${px((type.headingSize * 9.6) / 6.7)});
  letter-spacing: ${n(type.headingLetterSpacing - 0.01)}em;
}
.feature-card h3,
.gallery-meta h3 { letter-spacing: ${n(type.headingLetterSpacing + 0.03)}em; }
.timeline-item h3 { letter-spacing: ${n(type.headingLetterSpacing + 0.07)}em; }
.faq-question span:first-child { letter-spacing: ${n(type.headingLetterSpacing + 0.04)}em; }
.quote:first-child blockquote { letter-spacing: ${n(type.headingLetterSpacing + 0.015)}em; }
.hero-copy p {
  font-size: clamp(${px(type.bodySize * 0.8)}, calc(${n(type.bodySize / 16)} * 1vw), ${px(type.bodySize)});
}
.feature-card p { font-size: ${px(type.bodySize * 0.85)}; }
.timeline-item p, .footer-brand p { font-size: ${px(type.bodySize * 0.8)}; }
.price-list li { font-size: ${px(type.bodySize * 0.82)}; }
.footer-col a { font-size: ${px(type.bodySize * 0.79)}; }
.show-step .step-no { color: ${type.retone("#b53b31")}; }
#webgl { filter: ${type.filter()}; }
.feature-card:nth-child(2) .feature-symbol::after {
  box-shadow: 0 0 25px ${withAlpha(type.primary, 0.35)};
}
.timeline-item::before { box-shadow: 0 0 24px ${withAlpha(type.primary, 0.7)}; }
.hero-peek figure.active {
  box-shadow: 0 0 0 1px ${withAlpha(type.primary, 0.28)}, 0 16px 42px rgba(0, 0, 0, 0.32);
}
.hero-peek figure.active::before { box-shadow: 0 0 14px ${withAlpha(type.primary, 0.8)}; }
@media (max-width: 900px) {
  .hero-copy h1 {
    font-size: clamp(${px((type.headingSize * 2.55) / 6.7)}, calc(${n(type.headingSize / 107.2)} * 10vw), ${px((type.headingSize * 5.5) / 6.7)});
  }
}
`,
};

/* ── Anthra A-40 ─────────────────────────────────
   The display and UI stacks are both authored from Avenir Next, while the
   large cover mark and compact section headings use separate responsive
   scales. The colour control owns the brass interface accent only; the
   procedural titanium watch and its four material finishes stay authored. */
export const ANTHRA_A40_TYPOGRAPHY: PageTypographyRecipe = {
  headingFonts: [ANTHRA_DISPLAY, INSTRUMENT_SERIF, NEWSREADER, GEIST],
  bodyFonts: [ANTHRA_UI, GEIST, NEWSREADER, INSTRUMENT_SERIF],
  headingWeights: ["300", "400", "500", "600", "700"],
  headingWeight: "500",
  bodyWeights: ["300", "400", "500", "600"],
  bodyWeight: "400",
  primaryColor: "#c2a26a",
  headingSize: [34, 52, 76],
  bodySize: [13, 18, 24],
  headingLetterSpacing: [-0.08, -0.01, 0.08],
  css: (type) => `
:root {
  --display: ${type.heading};
  --ui: ${type.body};
  --brass: ${type.primary};
}
body { font-family: ${type.body}; font-weight: ${type.bodyWeight}; }
.plate h1, .plate h2 {
  font-family: ${type.heading};
  font-weight: ${type.headingWeight};
  letter-spacing: ${type.headingLetterSpacing}em;
}
.plate .mark {
  font-family: ${type.heading};
  font-weight: ${Math.min(900, Number(type.headingWeight) + 100)};
}
.plate h1.mark { font-size: calc(${n(type.headingSize / 52)} * 11vw); }
.plate h2:not(.mark) {
  font-size: clamp(30px, calc(${n(type.headingSize / 52)} * 3.1vw), ${px(type.headingSize)});
}
.lead {
  font-family: ${type.body};
  font-weight: ${type.bodyWeight};
  font-size: clamp(15px, calc(${n(type.bodySize / 18)} * 1vw), ${px(type.bodySize)});
}
@media (max-width: 900px) {
  .plate h1.mark { font-size: calc(${n(type.headingSize / 52)} * 22vw); }
  .plate h2:not(.mark) { font-size: calc(${n(type.headingSize / 52)} * 7.4vw); }
  .lead { font-size: ${px((type.bodySize * 15) / 18)}; }
}
`,
};

/* ── NOEMA N1 ───────────────────────────────────────────────────────────
   NOEMA's display face and compact body copy are authored in Inter Tight;
   DM Mono remains reserved for telemetry and labels. The heading slider
   carries the page's different responsive heading ceilings at their authored
   ratios, while the violet interface accent stays separate from the robot's
   WebGL materials. */
export const NOEMA_N1_TYPOGRAPHY: PageTypographyRecipe = {
  headingFonts: [INTER_TIGHT, INSTRUMENT_SERIF, NEWSREADER, GEIST],
  bodyFonts: [INTER_TIGHT, GEIST, NEWSREADER, INSTRUMENT_SERIF],
  headingWeights: ["300", "400", "500", "600", "700"],
  headingWeight: "400",
  bodyWeights: ["400", "500", "600", "700"],
  bodyWeight: "500",
  primaryColor: "#6c4cf1",
  headingSize: [34, 50, 76],
  bodySize: [12, 15, 22],
  headingLetterSpacing: [-0.07, -0.028, 0.08],
  css: (type) => `
:root {
  --disp: ${type.heading};
  --vio: ${type.primary};
  --vio-soft: ${withAlpha(type.primary, 0.14)};
}
body, button, input { font-family: ${type.body}; font-weight: ${type.bodyWeight}; }
h1, h2, h3 {
  font-family: ${type.heading};
  font-weight: ${type.headingWeight};
  letter-spacing: ${type.headingLetterSpacing}em;
}
.hero .line h1 { font-size: clamp(26px, 2.6vw, ${px((type.headingSize * 40) / 50)}); }
.beat h2, .knoll .cap h2 { font-size: clamp(26px, 3vw, ${px((type.headingSize * 44) / 50)}); }
.sheethead h2 { font-size: clamp(34px, 5vw, ${px((type.headingSize * 74) / 50)}); }
.inside .nm h2 { font-size: clamp(42px, 6.6vw, ${px((type.headingSize * 110) / 50)}); }
.grip h2 { font-size: clamp(28px, 3.4vw, ${px((type.headingSize * 48) / 50)}); }
.reelsec h2, .reserve h2 { font-size: clamp(28px, 3.6vw, ${px(type.headingSize)}); }
.beat p, .inside .nm p, .inside .stack p {
  font-size: ${px(type.bodySize)};
  font-weight: ${type.bodyWeight};
}
.grip p.lead, .reserve .price { font-size: ${px((type.bodySize * 15.5) / 15)}; }
`,
};

/* ── MK·78 Keyboard ─────────────────────────────────────────────────────
   The product story is authored entirely in the platform UI stack. Its
   oversized hero, chapter headings, and end card use distinct ceilings, so
   the heading control scales those ceilings together and leaves the keyboard
   legends and mono telemetry at their intentionally tiny sizes. */
export const MK78_KEYBOARD_TYPOGRAPHY: PageTypographyRecipe = {
  headingFonts: [SYSTEM_UI, INSTRUMENT_SERIF, NEWSREADER, GEIST],
  bodyFonts: [SYSTEM_UI, GEIST, NEWSREADER, INSTRUMENT_SERIF],
  headingWeights: ["400", "500", "600", "650", "700"],
  headingWeight: "650",
  bodyWeights: ["300", "400", "500", "600"],
  bodyWeight: "400",
  primaryColor: "#f4581c",
  headingSize: [40, 60, 88],
  bodySize: [13, 16.5, 23],
  headingLetterSpacing: [-0.07, -0.03, 0.06],
  css: (type) => `
:root { --acc: ${type.primary}; }
body, button { font-family: ${type.body}; font-weight: ${type.bodyWeight}; }
h1, h2, h3 {
  font-family: ${type.heading};
  font-weight: ${type.headingWeight};
  letter-spacing: ${type.headingLetterSpacing}em;
}
#hero h1 { font-size: clamp(58px, 11.5vw, ${px((type.headingSize * 178) / 60)}); }
#statement h2 { font-size: clamp(26px, 3.6vw, ${px((type.headingSize * 48) / 60)}); }
#craft .copy h2, #lineage .lcopy h2 { font-size: clamp(26px, 3vw, ${px((type.headingSize * 38) / 60)}); }
.fhead h2 { font-size: clamp(30px, 4.2vw, ${px((type.headingSize * 54) / 60)}); }
.vgrid h2 { font-size: clamp(30px, 3.6vw, ${px((type.headingSize * 50) / 60)}); }
#finish h2 { font-size: clamp(34px, 4.6vw, ${px(type.headingSize)}); }
#end > h2 { font-size: clamp(38px, 5.4vw, ${px((type.headingSize * 72) / 60)}); }
#hero .sub { font-size: clamp(15px, 1.6vw, ${px((type.bodySize * 19) / 16.5)}); }
#craft .copy p { font-size: ${px((type.bodySize * 16) / 16.5)}; }
#lineage .lcopy p { font-size: ${px((type.bodySize * 15.5) / 16.5)}; }
.fhead p, .vgrid p { font-size: ${px(type.bodySize)}; }
`,
};

/* ── Mara Voss ──────────────────────────────────────────────────────────
   The archive uses Big Shoulders Display for its condensed editorial voice
   and Inter for long reading. The 5.2rem chapter ceiling is the shared scale
   anchor; larger hero, silence, and footer moments follow at their authored
   ratios. Ember is the active signal colour, leaving violet and amber status
   semantics untouched. */
export const MARA_VOSS_TYPOGRAPHY: PageTypographyRecipe = {
  headingFonts: [BIG_SHOULDERS_DISPLAY, INSTRUMENT_SERIF, NEWSREADER, GEIST],
  bodyFonts: [INTER_LOADED, GEIST, NEWSREADER, INSTRUMENT_SERIF],
  headingWeights: ["400", "500", "600", "700", "800"],
  headingWeight: "600",
  bodyWeights: ["300", "400", "500", "600"],
  bodyWeight: "300",
  primaryColor: "#d4552b",
  headingSize: [56, 83.2, 124],
  bodySize: [14, 17.6, 24],
  headingLetterSpacing: [-0.04, 0.02, 0.1],
  css: (type) => `
:root {
  --font-display: ${type.heading};
  --font-body: ${type.body};
  --ember: ${type.primary};
}
body { font-family: ${type.body}; font-weight: ${type.bodyWeight}; }
.bio-title, .rec-statement, .method-title { font-weight: ${type.headingWeight}; }
.bio-title, .rec-statement, .method-title, .cat-title, .silence-title, .footer-title {
  letter-spacing: ${type.headingLetterSpacing}em;
}
.hero-title { font-size: clamp(5rem, 17vw, ${px((type.headingSize * 256) / 83.2)}); letter-spacing: ${n(type.headingLetterSpacing + 0.01)}em; }
.bio-title, .cat-title, .method-title { font-size: clamp(2.6rem, 5.5vw, ${px(type.headingSize)}); }
.rec-statement { font-size: clamp(2.4rem, 6vw, ${px((type.headingSize * 86.4) / 83.2)}); }
.beat-line { font-size: clamp(2.4rem, 5.5vw, ${px((type.headingSize * 80) / 83.2)}); }
.silence-title { font-size: clamp(2.8rem, 7vw, ${px((type.headingSize * 112) / 83.2)}); }
.footer-title { font-size: clamp(3.2rem, 10vw, ${px((type.headingSize * 152) / 83.2)}); }
.bio-text { font-size: clamp(1rem, 1.35vw, ${px((type.bodySize * 18.4) / 17.6)}); font-weight: ${type.bodyWeight}; }
.method-body { font-size: clamp(.98rem, 1.3vw, ${px(type.bodySize)}); font-weight: ${type.bodyWeight}; }
.idx-note { font-size: clamp(.78rem, .92vw, ${px((type.bodySize * 15.36) / 17.6)}); }
.log-text { font-size: clamp(.86rem, 1vw, ${px((type.bodySize * 16) / 17.6)}); }
`,
};

/* ── Aurello ────────────────────────────────────────────────────────────
   Bebas Neue supplies the tall campaign voice while DM Sans carries the
   utility copy. A 145px chapter heading anchors the many oversized scales;
   the slab-serif product name remains a deliberate brand contrast. The red,
   ink, and wine CSS tones move as one palette without filtering the 3D can. */
export const AURELLO_TYPOGRAPHY: PageTypographyRecipe = {
  headingFonts: [BEBAS_NEUE, INSTRUMENT_SERIF, NEWSREADER, GEIST],
  bodyFonts: [DM_SANS, GEIST, NEWSREADER, INSTRUMENT_SERIF],
  headingWeights: ["300", "400", "500", "600", "700"],
  headingWeight: "400",
  bodyWeights: ["300", "400", "500", "600"],
  bodyWeight: "400",
  primaryColor: "#f04a24",
  headingSize: [92, 145, 210],
  bodySize: [14, 18, 25],
  headingLetterSpacing: [-0.06, 0, 0.08],
  css: (type) => `
:root {
  --red: ${type.primary};
  --ink: ${type.retone("#c92f19")};
  --wine: ${type.retone("#731f17")};
}
body, button, input { font-family: ${type.body}; font-weight: ${type.bodyWeight}; }
.hero h1 span:first-child, .intro h2, .social h2, .gas h2, .eyebrow,
.products h2, .card h3, .contact h2, .ingredients h2, .faq h2,
.footer-cta, .intro-lens-reveal__copy h2, .visual-frame__copy h2,
.range-intro h2, .flavor-copy h3, .flavor-selector__heading h2,
.flavor-selector__detail h3, .can-collection__intro h2, .can-product-card h3 {
  font-family: ${type.heading};
  font-weight: ${type.headingWeight};
}
.intro h2 { font-size: clamp(62px, 9vw, ${px((type.headingSize * 150) / 145)}); }
.social h2 { font-size: clamp(38px, 4.5vw, ${px((type.headingSize * 76) / 145)}); }
.gas h2 { font-size: clamp(76px, 10vw, ${px((type.headingSize * 160) / 145)}); }
.products h2, .can-collection__intro h2 { font-size: clamp(76px, 11vw, ${px((type.headingSize * 175) / 145)}); }
.contact h2 { font-size: clamp(72px, 8vw, ${px((type.headingSize * 138) / 145)}); }
.faq h2, .footer-cta, .intro-lens-reveal__copy h2, .visual-frame__copy h2, .range-intro h2 {
  font-size: clamp(62px, 8.7vw, ${px(type.headingSize)});
  letter-spacing: ${type.headingLetterSpacing}em;
}
.flavor-selector__heading h2 { font-size: clamp(54px, 6vw, ${px((type.headingSize * 100) / 145)}); }
.flavor-selector__detail h3 { font-size: clamp(50px, 5.8vw, ${px((type.headingSize * 92) / 145)}); }
.intro p { font-size: clamp(17px, 1.4vw, ${px((type.bodySize * 24) / 18)}); }
.products-intro > p:last-child, .ingredients-head p, .faq-intro > p, .can-collection__intro p:last-child {
  font-size: ${px(type.bodySize)};
  font-weight: ${type.bodyWeight};
}
`,
};

/* ── RenderLab ──────────────────────────────────────────────────────────
   RenderLab is a preserved single-file export with most display typography
   authored directly in style attributes. The inline map below restates those
   exact values at the defaults, then gives the same controls as the stylesheet
   recipes without overpowering the authored cascade. The variable Roboto Flex pressure
   wordmark remains its own authored interaction. */
export const RENDERLAB_TYPOGRAPHY: PageTypographyRecipe = {
  headingFonts: [IMPACT, INSTRUMENT_SERIF, NEWSREADER, GEIST],
  bodyFonts: [INTER_LOADED, GEIST, NEWSREADER, INSTRUMENT_SERIF],
  headingWeights: ["300", "400", "500", "600", "700"],
  headingWeight: "500",
  bodyWeights: ["300", "400", "500", "600"],
  bodyWeight: "400",
  primaryColor: "#02ff6f",
  headingSize: [128, 192, 280],
  bodySize: [12, 14, 20],
  headingLetterSpacing: [-0.09, -0.05, 0.04],
  css: (type) => `
.renderlab-site-header nav > a { font-family: ${type.body}; font-weight: ${type.bodyWeight}; }
`,
  inlineStyles: (type): readonly PageInlineStyleOverride[] => [
    { selector: "body", styles: { "font-family": type.body, "font-size": px(type.bodySize), "font-weight": type.bodyWeight, "--acid": type.primary } },
    { selector: '[style*="font-family:Impact"]', styles: { "font-family": type.heading } },
    { selector: '[style*="font-family:Impact"][style*="font-weight:500"]', styles: { "font-weight": type.headingWeight } },
    { selector: '[style*="font-family:Impact"][style*="font-size:clamp(3.5rem,8vw,8rem)"]', styles: { "font-size": `clamp(3.5rem, 8vw, ${px((type.headingSize * 128) / 192)})` } },
    { selector: '[style*="font-family:Impact"][style*="font-size:clamp(8rem,20vw,12rem)"]', styles: { "font-size": `clamp(8rem, 20vw, ${px(type.headingSize)})` } },
    { selector: '[style*="font-family:Impact"][style*="font-size:clamp(6rem,13vw,13rem)"]', styles: { "font-size": `clamp(6rem, 13vw, ${px((type.headingSize * 208) / 192)})` } },
    { selector: '[style*="font-family:Impact"][style*="font-size:clamp(5rem,14vw,15rem)"]', styles: { "font-size": `clamp(5rem, 14vw, ${px((type.headingSize * 240) / 192)})` } },
    { selector: '[style*="font-family:Impact"][style*="font-size:clamp(4.8rem,11vw,12rem)"]', styles: { "font-size": `clamp(4.8rem, 11vw, ${px(type.headingSize)})` } },
    { selector: '[style*="font-family:Impact"][style*="font-size:clamp(8rem,22vw,24rem)"]', styles: { "font-size": `clamp(8rem, 22vw, ${px(type.headingSize * 2)})` } },
    { selector: '[style*="font-family:Impact"][style*="font-size:clamp(3rem,8vw,8rem)"]', styles: { "font-size": `clamp(3rem, 8vw, ${px((type.headingSize * 128) / 192)})` } },
    { selector: '[style*="font-family:Impact"][style*="letter-spacing:-.05em"]', styles: { "letter-spacing": `${type.headingLetterSpacing}em` } },
    { selector: '[style*="font-family:Impact"][style*="letter-spacing:-.055em"]', styles: { "letter-spacing": `${n(type.headingLetterSpacing - 0.005)}em` } },
    { selector: '[style*="font-family:Impact"][style*="letter-spacing:-.08em"]', styles: { "letter-spacing": `${n(type.headingLetterSpacing - 0.03)}em` } },
    { selector: '[style*="font-family:Impact"][style*="letter-spacing:-.035em"]', styles: { "letter-spacing": `${n(type.headingLetterSpacing + 0.015)}em` } },
    { selector: '[style*="font-family:Impact"][style*="letter-spacing:-.04em"]', styles: { "letter-spacing": `${n(type.headingLetterSpacing + 0.01)}em` } },
  ],
};

/* ── Volta Atelier ──────────────────────────────────────────────────────
   Volta already centralizes both families and its three signal colours in
   custom properties. The main scale follows the 184px hero ceiling; every
   named display and mono scale keeps its authored proportion beneath it. */
export const VOLTA_ATELIER_TYPOGRAPHY: PageTypographyRecipe = {
  headingFonts: [ARCHIVO, INSTRUMENT_SERIF, NEWSREADER, GEIST],
  bodyFonts: [JETBRAINS_MONO, GEIST, NEWSREADER, INSTRUMENT_SERIF],
  headingWeights: ["500", "600", "700", "800", "900"],
  headingWeight: "800",
  bodyWeights: ["300", "400", "500", "600", "700"],
  bodyWeight: "400",
  primaryColor: "#fb3732",
  headingSize: [120, 184, 260],
  bodySize: [10, 13, 20],
  headingLetterSpacing: [-0.09, -0.045, 0.04],
  css: (type) => `
:root {
  --font-display: ${type.heading};
  --font-mono: ${type.body};
  --signal: ${type.primary};
  --amber: ${type.retone("#ffa31a")};
  --volt: ${type.retone("#3b49e4")};
}
body { font-family: var(--font-mono); font-weight: ${type.bodyWeight}; }
h1, h2, h3, h4, .d-mega, .d-xl, .d-lg, .d-md, .d-sm { font-weight: ${type.headingWeight}; }
.d-mega {
  font-size: clamp(3.4rem, 13.2vw, ${px(type.headingSize)});
  letter-spacing: ${type.headingLetterSpacing}em;
}
.d-xl { font-size: clamp(2.4rem, 7.6vw, ${px((type.headingSize * 96) / 184)}); }
.d-lg { font-size: clamp(1.9rem, 4.4vw, ${px((type.headingSize * 54.4) / 184)}); }
.d-md { font-size: clamp(1.35rem, 2.3vw, ${px((type.headingSize * 30.4) / 184)}); }
.d-sm { font-size: clamp(1.05rem, 1.5vw, ${px((type.headingSize * 20) / 184)}); }
.mono-xs { font-size: clamp(9.5px, .72vw, ${px((type.bodySize * 11) / 13)}); font-weight: ${type.bodyWeight}; }
.mono-sm { font-size: clamp(11px, .86vw, ${px(type.bodySize)}); font-weight: ${type.bodyWeight}; }
.mono-md { font-size: clamp(13px, 1.12vw, ${px((type.bodySize * 16) / 13)}); font-weight: ${type.bodyWeight}; }
`,
};

/* ── Kairo ──────────────────────────────────────────────────────────────
   Kairo uses one Manrope family for its display, body, and compact labels,
   keeping Noto Sans JP for Japanese glyphs. The hero is the 192px reference
   scale; the chapter and finale sizes retain their authored proportions. */
export const KAIRO_TYPOGRAPHY: PageTypographyRecipe = {
  headingFonts: [MANROPE, INSTRUMENT_SERIF, NEWSREADER, GEIST],
  bodyFonts: [MANROPE, GEIST, NEWSREADER, INSTRUMENT_SERIF],
  headingWeights: ["500", "600", "700", "800"],
  headingWeight: "800",
  bodyWeights: ["300", "400", "500", "600"],
  bodyWeight: "400",
  primaryColor: "#b4261a",
  headingSize: [112, 192, 280],
  bodySize: [12, 16, 24],
  headingLetterSpacing: [-0.1, -0.06, 0.02],
  css: (type) => `
:root {
  --red: ${type.primary};
  --bright: ${type.retone("#c8392a")};
  --sans: ${type.body};
  --serif: ${type.heading};
  --mono: ${type.bodyWeight} ${px(type.bodySize * 0.72)}/1.5 ${type.body};
}
body { font-family: ${type.body}; font-size: ${px(type.bodySize)}; font-weight: ${type.bodyWeight}; }
.hero__title {
  font-family: ${type.heading};
  font-weight: ${type.headingWeight};
  font-size: clamp(5.4rem, 12vw, ${px(type.headingSize)});
  letter-spacing: ${type.headingLetterSpacing}em;
}
h2.split {
  font-family: ${type.heading};
  font-weight: ${Math.max(300, Number(type.headingWeight) - 100)};
  font-size: clamp(3.4rem, 6.6vw, ${px(type.headingSize * 0.6)});
  letter-spacing: ${n(type.headingLetterSpacing + 0.015)}em;
}
.ingredients h2.split { font-size: clamp(3rem, 5.8vw, ${px((type.headingSize * 102.4) / 192)}); }
.recipes h2.split { font-size: clamp(3rem, 5.6vw, ${px((type.headingSize * 99.2) / 192)}); }
.finale h2.split {
  font-size: clamp(4.2rem, 9.5vw, ${px((type.headingSize * 160) / 192)});
  letter-spacing: ${type.headingLetterSpacing}em;
}
h2 em, h3 em, .serif { font-family: ${type.heading}; font-weight: ${Math.max(300, Number(type.headingWeight) - 500)}; }
.body-copy { font-size: clamp(1.02rem, 1.2vw, ${px(type.bodySize * 1.2)}); }
.flame-layer, .ascii-layer, .gallery__layer { filter: ${type.filter()}; }
`,
};

/* ── Inkbound River Story ───────────────────────────────────────────────
   Inkbound's English narrative is Iowan Old Style while its navigation and
   Japanese calligraphy keep their authored faces. The display control follows
   the 166px opening title and carries the later chapter scales with it. */
export const INKBOUND_TYPOGRAPHY: PageTypographyRecipe = {
  headingFonts: [IOWAN_OLD_STYLE, INSTRUMENT_SERIF, NEWSREADER, GEIST],
  bodyFonts: [IOWAN_OLD_STYLE, GEIST, NEWSREADER, INSTRUMENT_SERIF],
  headingWeights: ["300", "400", "500", "600", "700"],
  headingWeight: "400",
  bodyWeights: ["300", "400", "500", "600"],
  bodyWeight: "400",
  primaryColor: "#b34f3e",
  headingSize: [96, 166, 240],
  bodySize: [14, 21, 30],
  headingLetterSpacing: [-0.1, -0.062, 0.02],
  css: (type) => `
:root {
  --display: ${type.heading};
  --seal: ${type.primary};
  --seal-dark: ${type.retone("#8d372c")};
}
body { font-family: ${type.body}; font-weight: ${type.bodyWeight}; }
.red-moon { background-color: ${type.retone("#ad4a3b")}; }
.hero-title, .chapter-title, .epilogue-title {
  font-family: ${type.heading};
  font-weight: ${type.headingWeight};
}
.hero-title {
  font-size: clamp(64px, 11vw, ${px(type.headingSize)});
  letter-spacing: ${type.headingLetterSpacing}em;
}
.chapter-title {
  font-size: clamp(40px, 4.8vw, ${px((type.headingSize * 76) / 166)});
  letter-spacing: ${n(type.headingLetterSpacing + 0.016)}em;
}
.epilogue-title {
  font-size: clamp(58px, 9vw, ${px((type.headingSize * 138) / 166)});
  letter-spacing: ${n(type.headingLetterSpacing + 0.002)}em;
}
.hero-deck, .chapter-body, .epilogue-body { font-family: ${type.body}; font-weight: ${type.bodyWeight}; }
.hero-deck { font-size: clamp(15px, 1.35vw, ${px(type.bodySize)}); }
.chapter-body { font-size: clamp(14px, 1.08vw, ${px((type.bodySize * 18) / 21)}); }
.epilogue-body { font-size: clamp(14px, 1.2vw, ${px((type.bodySize * 19) / 21)}); }
@media (max-width: 760px) {
  .hero-title { font-size: clamp(56px, 19vw, ${px((type.headingSize * 82) / 166)}); }
  .hero-deck { font-size: ${px((type.bodySize * 15) / 21)}; }
  .chapter-title { font-size: clamp(38px, 12vw, ${px((type.headingSize * 58) / 166)}); }
  .epilogue-title { font-size: clamp(54px, 18vw, ${px((type.headingSize * 78) / 166)}); }
}
@media (max-height: 650px) and (min-width: 761px) {
  .hero-title { font-size: clamp(64px, 10vw, ${px((type.headingSize * 112) / 166)}); }
}
`,
};

/* ── Halvorsen ────────────────────────────────────────────────────────
   Outfit is embedded as the page's single variable face, with the display
   hierarchy distinguished by scale rather than a second family. The colour
   control retints the bone-white interface ramp while leaving the marble and
   planting in the Three.js hands untouched. Desktop and narrow-screen sizes
   continue to follow the authored 96px display scale and its vw breakpoints. */
export const HALVORSEN_TYPOGRAPHY: PageTypographyRecipe = {
  headingFonts: [OUTFIT, INSTRUMENT_SERIF, NEWSREADER, GEIST],
  bodyFonts: [OUTFIT, GEIST, NEWSREADER, INSTRUMENT_SERIF],
  headingWeights: ["200", "300", "400", "500", "600"],
  headingWeight: "400",
  bodyWeights: ["200", "300", "400", "500", "600"],
  bodyWeight: "400",
  primaryColor: "#ecebe7",
  headingSize: [56, 96, 136],
  bodySize: [12, 17, 24],
  headingLetterSpacing: [-0.08, -0.031, 0.08],
  css: (type) => `
:root {
  --ink: ${type.primary};
  --ink-soft: ${type.retone("#c3c1bb")};
  --muted: ${type.retone("#85837d")};
  --muted-dim: ${type.retone("#6a6964")};
  --pill-ink: ${type.retone("#c6c3bc")};
  --font: ${type.body};
}
body { font-family: ${type.body}; font-weight: ${type.bodyWeight}; }
h1, h2, h3, .foot-mark {
  font-family: ${type.heading};
  font-weight: ${type.headingWeight};
}
h1 {
  font-size: ${px(type.headingSize)};
  letter-spacing: ${type.headingLetterSpacing}em;
}
h2 {
  font-size: ${px((type.headingSize * 63) / 96)};
  letter-spacing: ${n(type.headingLetterSpacing + 0.003)}em;
}
.foot-mark {
  font-size: ${px((type.headingSize * 64) / 96)};
  letter-spacing: ${n(type.headingLetterSpacing + 0.001)}em;
}
.card h3 {
  font-size: ${px((type.headingSize * 24) / 96)};
  letter-spacing: ${n(type.headingLetterSpacing + 0.011)}em;
}
.acc h3, .stat h3, .tcard h3 {
  font-size: ${px((type.headingSize * 22) / 96)};
  letter-spacing: ${n(type.headingLetterSpacing + 0.011)}em;
}
.hero-side p, .pill, .btn { font-size: ${px(type.bodySize)}; }
.nav ul a { font-size: ${px((type.bodySize * 18) / 17)}; }
.btn-ghost, .link-quiet, .btn-wide { font-size: ${px((type.bodySize * 16) / 17)}; }
.card p, .btn-out, .tcard .more, .foot-cols a, .foot-cols span {
  font-size: ${px((type.bodySize * 14) / 17)};
}
.acc p, .stories .sub p, .tcard p { font-size: ${px((type.bodySize * 13.5) / 17)}; }
.eyebrow, .acc-num, .foot-bottom { font-size: ${px((type.bodySize * 13) / 17)}; }
@media (max-width: 1280px) {
  h1 { font-size: calc(${n(type.headingSize / 96)} * 7.2vw); }
  h2, .foot-mark { font-size: calc(${n(type.headingSize / 96)} * 4.9vw); }
}
@media (max-width: 1024px) {
  h1 { font-size: calc(${n(type.headingSize / 96)} * 8.4vw); }
}
@media (max-width: 640px) {
  h1 { font-size: calc(${n(type.headingSize / 96)} * 10.4vw); }
  h2, .foot-mark { font-size: calc(${n(type.headingSize / 96)} * 8.4vw); }
}
`,
};

/* ── Betawise Hero ───────────────────────────────────────────────────────
   Fixed pixel type with three narrow-screen steps, all carried at their
   authored ratio. The signature blue lives in the point cloud rather than in
   any CSS variable, so the colour control reaches it through the canvas. */
export const BETAWISE_HERO_TYPOGRAPHY: PageTypographyRecipe = {
  headingFonts: [OUTFIT, INSTRUMENT_SERIF, NEWSREADER, GEIST],
  bodyFonts: [OUTFIT, GEIST, NEWSREADER, INSTRUMENT_SERIF],
  headingWeights: ["400", "500", "600", "700"],
  headingWeight: "500",
  bodyWeights: ["300", "400", "500", "600"],
  bodyWeight: "400",
  primaryColor: "#1278ff",
  headingSize: [32, 48.8, 76],
  bodySize: [12, 15.9, 24],
  headingLetterSpacing: [-0.06, 0.006, 0.12],
  css: (type) => `
body { font-family: ${type.body}; }
h1 {
  font-family: ${type.heading};
  font-weight: ${type.headingWeight};
  font-size: ${px(type.headingSize)};
  line-height: ${px((type.headingSize * 53) / 48.8)};
  letter-spacing: ${type.headingLetterSpacing}em;
}
.sub {
  font-family: ${type.body};
  font-weight: ${type.bodyWeight};
  font-size: ${px(type.bodySize)};
}
#gl { filter: ${type.filter()}; }
@media (max-width: 1180px) {
  h1 {
    font-size: ${px((type.headingSize * 42) / 48.8)};
    line-height: ${px((type.headingSize * 46) / 48.8)};
  }
}
@media (max-width: 900px) {
  h1 {
    font-size: ${px((type.headingSize * 34) / 48.8)};
    line-height: ${px((type.headingSize * 38) / 48.8)};
  }
  .sub { font-size: ${px((type.bodySize * 14) / 15.9)}; }
}
@media (max-width: 520px) {
  h1 {
    font-size: ${px((type.headingSize * 27) / 48.8)};
    line-height: ${px((type.headingSize * 31) / 48.8)};
    letter-spacing: ${n(type.headingLetterSpacing - 0.021)}em;
  }
  .sub { font-size: ${px((type.bodySize * 12.6) / 15.9)}; }
}
`,
};

/* ── Axonis ──────────────────────────────────────────────────────────────
   The hero is the wordmark, sized in vw so the composition holds at any
   width, so the heading control drives --wm in vw and the tracking rides it
   as a fraction of that size — which is what keeps the page's own optical
   centring, computed from --ls, correct at every setting. The authored 320
   weight is kept as an option because Space Grotesk is a variable face and
   the composition is drawn at it. */
export const AXONIS_TYPOGRAPHY: PageTypographyRecipe = {
  headingFonts: [SPACE_GROTESK, INSTRUMENT_SERIF, NEWSREADER, GEIST],
  bodyFonts: [SPACE_GROTESK, GEIST, NEWSREADER, INSTRUMENT_SERIF],
  headingWeights: ["320", "400", "500", "600", "700"],
  headingWeight: "320",
  bodyWeights: ["400", "500", "600", "700"],
  bodyWeight: "400",
  primaryColor: "#ff6427",
  headingSize: [14, 25, 34],
  bodySize: [15, 22, 30],
  headingLetterSpacing: [-0.02, 0.112, 0.2],
  css: (type) => `
:root {
  --orange: ${type.primary};
  --orange-soft: ${type.retone("#ffad78")};
  --font: ${type.body};
  --wm: ${n(type.headingSize)}vw;
  --wmw: ${type.headingWeight};
  --ls: calc(${n(type.headingLetterSpacing)} * var(--wm));
}
body { font-weight: ${type.bodyWeight}; }
.wordmark { font-family: ${type.heading}; }
.wordmark span {
  background: linear-gradient(180deg,
    ${type.retoneRgba("rgba(255,100,39,0)")} 4%,
    ${type.retoneRgba("rgba(255,100,39,.22)")} 34%,
    ${type.retone("#ff6b2d")} 84%);
  -webkit-background-clip: text;
  background-clip: text;
}
.lede {
  font-size: ${px(type.bodySize)};
  line-height: ${px((type.bodySize * 36) / 22)};
  background: linear-gradient(90deg, #fff7f0 4%, ${type.retoneRgba("rgba(255,173,120,.68)")} 98%);
  -webkit-background-clip: text;
  background-clip: text;
}
.sub {
  font-size: ${px((type.bodySize * 15.7) / 22)};
  line-height: ${px((type.bodySize * 24) / 22)};
}
#scene { filter: ${type.filter()}; }
@media (max-width: 1180px) {
  .lede {
    font-size: ${px((type.bodySize * 21) / 22)};
    line-height: ${px((type.bodySize * 33) / 22)};
  }
}
@media (max-width: 900px) {
  .lede {
    font-size: ${px((type.bodySize * 19) / 22)};
    line-height: ${px((type.bodySize * 30) / 22)};
  }
}
`,
};

/* ── attune ──────────────────────────────────────────────────────────────
   Both faces are embedded in the document, so the authored pair costs no
   request and Instrument Serif is already the heading default. The ghost
   wordmark follows the h1 at its authored 320/66 scale and its own tighter
   tracking. The colour control moves the whole warm palette the page derives
   from --accent; the planet is the subject rather than the brand, so it is
   left alone. */
export const ATTUNE_TYPOGRAPHY: PageTypographyRecipe = {
  headingFonts: [INSTRUMENT_EMBEDDED, NEWSREADER, GEIST],
  bodyFonts: [INTER_EMBEDDED, GEIST, NEWSREADER, INSTRUMENT_SERIF],
  headingWeights: ["400", "500", "600", "700"],
  headingWeight: "400",
  bodyWeights: ["300", "400", "500", "600", "700"],
  bodyWeight: "400",
  primaryColor: "#ff7a14",
  headingSize: [40, 66, 96],
  bodySize: [12, 16, 22],
  headingLetterSpacing: [-0.06, -0.02, 0.12],
  css: (type) => `
:root {
  --accent: ${type.primary};
  --accent-hi: ${type.retone("#ffa347")};
  --accent-lo: ${type.retone("#f2610a")};
  --hair-warm: ${type.retoneRgba("rgba(255,138,40,.34)")};
}
body { font-family: ${type.body}; font-weight: ${type.bodyWeight}; }
h1, #bigword {
  font-family: ${type.heading};
  font-weight: ${type.headingWeight};
}
h1 {
  font-size: clamp(35px, 4.4vw, ${px(type.headingSize)});
  letter-spacing: ${type.headingLetterSpacing}em;
}
#bigword {
  font-size: clamp(104px, 19vw, ${px((type.headingSize * 320) / 66)});
  letter-spacing: ${n(type.headingLetterSpacing - 0.015)}em;
}
.sub {
  font-weight: ${type.bodyWeight};
  font-size: clamp(13px, 1.08vw, ${px(type.bodySize)});
}
`,
};

/* ── Betawise ────────────────────────────────────────────────────────────
   Sized on the page's own --u, which is already a viewport clamp, so the
   control moves the design-unit count and the responsive behaviour is
   untouched. As with the hero, the signature blue is in the globe rather
   than in CSS, so the colour control reaches it through the canvas. */
export const BETAWISE_TYPOGRAPHY: PageTypographyRecipe = {
  headingFonts: [QUESTRIAL, INSTRUMENT_SERIF, NEWSREADER, GEIST],
  bodyFonts: [QUESTRIAL, GEIST, NEWSREADER, INSTRUMENT_SERIF],
  headingWeights: ["400", "500", "600", "700"],
  headingWeight: "400",
  bodyWeights: ["400", "500", "600", "700"],
  bodyWeight: "400",
  primaryColor: "#1a4dff",
  headingSize: [26, 40.4, 60],
  bodySize: [9, 12.66, 20],
  headingLetterSpacing: [-0.06, -0.01, 0.12],
  css: (type) => `
body { font-family: ${type.body}; font-weight: ${type.bodyWeight}; }
h1 {
  font-family: ${type.heading};
  font-weight: ${type.headingWeight};
  font-size: ${unit(type.headingSize)};
  line-height: ${unit((type.headingSize * 42.5) / 40.4)};
  letter-spacing: ${type.headingLetterSpacing}em;
}
.sub {
  font-weight: ${type.bodyWeight};
  font-size: ${unit(type.bodySize)};
}
#gl { filter: ${type.filter()}; }
@media (max-width: 760px) {
  h1 {
    font-size: clamp(25px, 6.9vw, ${px((type.headingSize * 35) / 40.4)});
    line-height: 1.1;
    letter-spacing: ${n(type.headingLetterSpacing - 0.002)}em;
  }
  .sub { font-size: clamp(13px, 3.4vw, ${px((type.bodySize * 16) / 12.66)}); }
}
`,
};

/* ── Complete Shelf ─────────────────────────────────────────────────────
   The visible shelf title is the selected volume, not the oversized vestigial
   word behind the scene. Detail type follows it at the authored 107.2 / 60
   ratio while the compact editorial labels stay on the page's mono face. */
export const COMPLETE_SHELF_TYPOGRAPHY: PageTypographyRecipe = {
  headingFonts: [IOWAN_OLD_STYLE, INSTRUMENT_SERIF, NEWSREADER, GEIST],
  bodyFonts: [INTER_LOADED, GEIST, NEWSREADER, INSTRUMENT_SERIF],
  headingWeights: ["400", "500", "600"],
  headingWeight: "400",
  bodyWeights: ["400", "500", "600"],
  bodyWeight: "400",
  primaryColor: "#c87046",
  headingSize: [32, 60, 88],
  bodySize: [10, 12, 18],
  headingLetterSpacing: [-0.1, -0.055, 0.08],
  css: (type) => `
:root { --accent: ${type.primary}; }
body { font-family: ${type.body}; font-weight: ${type.bodyWeight}; }
.selection__title, .detail-title, .editorial-identity strong, .page-status strong {
  font-family: ${type.heading};
  font-weight: ${type.headingWeight};
}
.selection__title {
  font-size: clamp(32px, 3.4vw, ${px(type.headingSize)});
  letter-spacing: ${type.headingLetterSpacing}em;
}
.detail-title {
  font-size: clamp(56px, 6.3vw, ${px((type.headingSize * 107.2) / 60)});
  letter-spacing: ${n(type.headingLetterSpacing - 0.01)}em;
}
.selection__note { font-size: ${px(type.bodySize)}; font-weight: ${type.bodyWeight}; }
.detail-deck { font-family: ${type.body}; font-weight: ${type.bodyWeight}; }
@media (max-width: 880px) {
  .selection__title { font-size: clamp(32px, 9vw, ${px((type.headingSize * 56) / 60)}); }
  .detail-title { font-size: clamp(48px, 14vw, ${px((type.headingSize * 80) / 60)}); }
}
@media (max-width: 560px) {
  .selection__title { font-size: ${px((type.headingSize * 32) / 60)}; }
}
`,
};

/* ── Bestsellers ───────────────────────────────────────────────────────────
   The giant italic collection word is the composition's heading. The detail
   title and its mobile ceiling retain their authored proportions. */
export const BESTSELLERS_TYPOGRAPHY: PageTypographyRecipe = {
  headingFonts: [IOWAN_OLD_STYLE, INSTRUMENT_SERIF, NEWSREADER, GEIST],
  bodyFonts: [IOWAN_OLD_STYLE, GEIST, NEWSREADER, INSTRUMENT_SERIF],
  headingWeights: ["400", "500", "600", "700"],
  headingWeight: "500",
  bodyWeights: ["400", "500", "600", "700"],
  bodyWeight: "400",
  primaryColor: "#c3a47b",
  headingSize: [184, 325, 420],
  bodySize: [12, 17, 24],
  headingLetterSpacing: [-0.12, -0.085, 0.08],
  css: (type) => `
:root {
  --pink: ${type.primary};
  --pink-bright: ${type.retone("#dbc39c")};
  --periwinkle: ${type.retone("#b7976c")};
}
body { font-family: ${type.body}; font-weight: ${type.bodyWeight}; }
.brand, .hero-word, .detail-title, .cover-title {
  font-family: ${type.heading};
  font-weight: ${type.headingWeight};
}
.hero-word {
  font-size: clamp(184px, 22vw, ${px(type.headingSize)});
  letter-spacing: ${type.headingLetterSpacing}em;
}
.detail-title {
  font-size: clamp(52px, 5.7vw, ${px((type.headingSize * 82) / 325)});
  letter-spacing: ${n(type.headingLetterSpacing + 0.03)}em;
}
.detail-description { font-size: clamp(12px, 1.28vw, ${px(type.bodySize)}); font-weight: ${type.bodyWeight}; }
@media (max-width: 900px) {
  .hero-word { font-size: clamp(128px, 28vw, ${px((type.headingSize * 230) / 325)}); }
  .detail-title { font-size: clamp(48px, 10vw, ${px((type.headingSize * 70) / 325)}); }
}
@media (max-width: 560px) {
  .hero-word { font-size: calc(${n(type.headingSize / 325)} * 38vw); }
}
`,
};

/* ── Cortexa ───────────────────────────────────────────────────────────────
   The two corner display blocks share a scale at desktop and diverge at the
   authored breakpoints. Their ratios are repeated so moving the control does
   not flatten the layout into one fixed size. */
export const CORTEXA_TYPOGRAPHY: PageTypographyRecipe = {
  headingFonts: [INSTRUMENT_SERIF_LOADED, NEWSREADER, GEIST_LOADED],
  bodyFonts: [GEIST_LOADED, NEWSREADER, INSTRUMENT_SERIF_LOADED],
  headingWeights: ["300", "400", "500", "600"],
  headingWeight: "400",
  bodyWeights: ["300", "400", "500", "600"],
  bodyWeight: "400",
  primaryColor: "#7f97ba",
  headingSize: [36, 60, 88],
  bodySize: [12, 15, 21],
  headingLetterSpacing: [-0.08, -0.004, 0.1],
  css: (type) => `
:root { --dim: ${type.primary}; --dim-2: ${type.retone("#6d86a8")}; }
body { font-family: ${type.body}; font-weight: ${type.bodyWeight}; }
h1, .bigtag, .brand span { font-family: ${type.heading}; font-weight: ${type.headingWeight}; }
h1, .bigtag {
  font-size: ${px(type.headingSize)};
  line-height: ${px((type.headingSize * 63) / 60)};
  letter-spacing: ${type.headingLetterSpacing}em;
}
.lede, .facts { font-size: ${px(type.bodySize)}; font-weight: ${type.bodyWeight}; }
#gl { filter: ${type.filter()}; }
@media (max-width: 1280px) {
  h1, .bigtag { font-size: ${px((type.headingSize * 50) / 60)}; line-height: ${px((type.headingSize * 53) / 60)}; }
}
@media (max-width: 1120px) {
  h1 { font-size: ${px((type.headingSize * 44) / 60)}; line-height: ${px((type.headingSize * 47) / 60)}; }
  .bigtag { font-size: ${px((type.headingSize * 40) / 60)}; line-height: ${px((type.headingSize * 43) / 60)}; }
}
@media (max-width: 820px) {
  h1 { font-size: ${px((type.headingSize * 36) / 60)}; line-height: ${px((type.headingSize * 39) / 60)}; }
  .bigtag { font-size: ${px((type.headingSize * 31) / 60)}; line-height: ${px((type.headingSize * 34) / 60)}; }
  .lede, .facts { font-size: ${px((type.bodySize * 14) / 15)}; }
}
@media (max-width: 620px) {
  h1 { font-size: ${px((type.headingSize * 31) / 60)}; line-height: ${px((type.headingSize * 34) / 60)}; }
  .bigtag { font-size: ${px((type.headingSize * 25) / 60)}; line-height: ${px((type.headingSize * 28) / 60)}; }
  .lede { font-size: ${px((type.bodySize * 13.5) / 15)}; }
}
@media (max-height: 720px) and (min-width: 820px) {
  h1 { font-size: ${px((type.headingSize * 42) / 60)}; line-height: ${px((type.headingSize * 45) / 60)}; }
  .bigtag { font-size: ${px((type.headingSize * 30) / 60)}; line-height: ${px((type.headingSize * 33) / 60)}; }
  .lede, .facts { font-size: ${px((type.bodySize * 13.5) / 15)}; }
}
@media (max-height: 560px) {
  h1 { font-size: ${px((type.headingSize * 34) / 60)}; line-height: ${px((type.headingSize * 37) / 60)}; }
  .bigtag { font-size: ${px((type.headingSize * 25) / 60)}; line-height: ${px((type.headingSize * 28) / 60)}; }
  .lede, .facts { font-size: ${px((type.bodySize * 13) / 15)}; }
}
`,
};

/* ── Cathode ─────────────────────────────────────────────────────────────────
   Cathode already expresses both main sizes as clamps, so the controls only
   replace their ceilings and keep the authored responsive floor and slope. */
export const CATHODE_TYPOGRAPHY: PageTypographyRecipe = {
  headingFonts: [INTER_LOADED, INSTRUMENT_SERIF, NEWSREADER, GEIST],
  bodyFonts: [INTER_LOADED, GEIST, NEWSREADER, INSTRUMENT_SERIF],
  headingWeights: ["300", "400", "500", "600"],
  headingWeight: "400",
  bodyWeights: ["300", "400", "500", "600"],
  bodyWeight: "400",
  primaryColor: "#f1f1f1",
  headingSize: [40, 64, 92],
  bodySize: [14, 19, 26],
  headingLetterSpacing: [-0.08, -0.016, 0.1],
  css: (type) => `
body { font-family: ${type.body}; font-weight: ${type.bodyWeight}; }
.title { font-family: ${type.heading}; font-weight: ${type.headingWeight}; color: ${type.primary}; }
.title {
  font-size: clamp(30px, 4.35vw, ${px(type.headingSize)});
  letter-spacing: ${type.headingLetterSpacing}em;
}
.lede { font-size: clamp(14px, 1.22vw, ${px(type.bodySize)}); font-weight: ${type.bodyWeight}; }
.cta { background: ${type.primary}; }
`,
};

/* ── Cadence ───────────────────────────────────────────────────────────────
   The page has many secondary scales; the control follows its opening 84px
   statement and 16px explanatory copy, while the signature blue retunes the
   blue cards and the three authored WebGL canvases together. */
export const CADENCE_TYPOGRAPHY: PageTypographyRecipe = {
  headingFonts: [GEIST_LOADED, INSTRUMENT_SERIF, NEWSREADER],
  bodyFonts: [GEIST_LOADED, NEWSREADER, INSTRUMENT_SERIF],
  headingWeights: ["300", "400", "500", "600", "700"],
  headingWeight: "400",
  bodyWeights: ["300", "400", "500", "600"],
  bodyWeight: "400",
  primaryColor: "#1e3e86",
  headingSize: [48, 84, 116],
  bodySize: [12, 16, 24],
  headingLetterSpacing: [-0.08, -0.031, 0.08],
  css: (type) => `
:root { --blue: ${type.primary}; --blue-hot: ${type.retone("#a6d2ff")}; }
body { font-family: ${type.body}; font-weight: ${type.bodyWeight}; }
.h1, .statement, .sc-head h2, .pf-title, .chain .t1, .chain .t2, .whatis h2, .f-head h2 {
  font-family: ${type.heading};
  font-weight: ${type.headingWeight};
}
/* The page sizes .h1 fluidly at every width, so the override has to restate a
   clamp rather than a flat px — a flat value here would pin the heading at its
   widest size right down to 1101px and undo the page's own scaling. Each term
   is the page's own number scaled by headingSize / 84, its authored default. */
.h1 {
  font-size: clamp(${px((type.headingSize * 46) / 84)}, calc(${n(type.headingSize / 84)} * 6.05vw), ${px(type.headingSize)});
  letter-spacing: ${type.headingLetterSpacing}em;
}
.hero-right p { font-size: ${px(type.bodySize)}; font-weight: ${type.bodyWeight}; }
.hero canvas, .chain canvas, .f-stage canvas { filter: ${type.filter()}; }
@media (max-width: 900px) {
  .h1 {
    font-size: clamp(${px((type.headingSize * 40) / 84)}, calc(${n(type.headingSize / 84)} * 8.4vw), ${px((type.headingSize * 76) / 84)});
    letter-spacing: ${n(type.headingLetterSpacing + 0.003)}em;
  }
}
@media (max-width: 720px) {
  .h1 { font-size: clamp(${px((type.headingSize * 34) / 84)}, calc(${n(type.headingSize / 84)} * 10.4vw), ${px((type.headingSize * 60) / 84)}); }
}
`,
};

/* ── Vella Bank ────────────────────────────────────────────────────────────
   Vella's display line mixes three authored weights. The heading control
   moves the light base while keeping those two emphasis steps intact, so its
   default remains the original 300 / 500 / 600 composition. The amber card
   and moss companion card share one palette shift with the WebGL stack. */
export const VELLA_BANK_TYPOGRAPHY: PageTypographyRecipe = {
  headingFonts: [FIGTREE, INSTRUMENT_SERIF, NEWSREADER, GEIST],
  bodyFonts: [FIGTREE, GEIST, NEWSREADER, INSTRUMENT_SERIF],
  headingWeights: ["300", "400", "500", "600", "700"],
  headingWeight: "300",
  bodyWeights: ["300", "400", "500", "600"],
  bodyWeight: "400",
  primaryColor: "#dd8940",
  headingSize: [44, 76, 104],
  bodySize: [13, 17.1, 24],
  headingLetterSpacing: [-0.08, -0.038, 0.08],
  css: (type) => {
    const baseWeight = Number(type.headingWeight);
    return `
:root { --amber: ${type.primary}; --moss: ${type.retone("#93a476")}; }
body { font-family: ${type.body}; font-weight: ${type.bodyWeight}; }
h1 {
  font-family: ${type.heading};
  font-size: clamp(31px, 5.3vw, ${px(type.headingSize)});
  letter-spacing: ${type.headingLetterSpacing}em;
  font-weight: ${type.headingWeight};
}
h1 .w5 { font-weight: ${Math.min(900, baseWeight + 200)}; }
h1 .w6 { font-weight: ${Math.min(900, baseWeight + 300)}; }
.lede {
  font-family: ${type.body};
  font-size: clamp(13.5px, 1.19vw, ${px(type.bodySize)});
  font-weight: ${type.bodyWeight};
}
#cardsCanvas { filter: ${type.filter()}; }
`;
  },
};

/* ── Tidecrest ─────────────────────────────────────────────────────────────
   Tidecrest already exposes internal typography presets. These props sit
   above them and use the default preset's raw reference-frame units. */
export const TIDECREST_TYPOGRAPHY: PageTypographyRecipe = {
  headingFonts: [FIGTREE, INSTRUMENT_SERIF, NEWSREADER, GEIST],
  bodyFonts: [HANKEN_GROTESK, GEIST, NEWSREADER, INSTRUMENT_SERIF],
  headingWeights: ["300", "400", "500", "600"],
  headingWeight: "300",
  bodyWeights: ["300", "400", "500", "600"],
  bodyWeight: "400",
  primaryColor: "#ffffff",
  headingSize: [30, 46, 72],
  bodySize: [10, 12.8, 20],
  headingLetterSpacing: [-0.1, -0.04, 0.1],
  css: (type) => `
:root {
  --ink: ${type.primary};
  --muted: ${withAlpha(type.primary, 0.6)};
  --nav: ${withAlpha(type.primary, 0.74)};
}
body { font-family: ${type.body}; font-weight: ${type.bodyWeight}; }
h1 {
  font-family: ${type.heading};
  font-size: calc(${n(type.headingSize)} * var(--s) * var(--type-scale));
  line-height: calc(${n((type.headingSize * 50) / 46)} * var(--s) * var(--type-scale));
  font-weight: ${type.headingWeight};
  letter-spacing: ${type.headingLetterSpacing}em;
}
.sub {
  font-family: ${type.body};
  font-size: calc(${n(type.bodySize)} * var(--s) * var(--type-scale));
  font-weight: ${type.bodyWeight};
}
@media (max-width: 760px) {
  h1 {
    font-size: calc(${n((type.headingSize * 36) / 46)} * var(--s));
    line-height: calc(${n((type.headingSize * 40) / 46)} * var(--s));
  }
  .sub { font-size: calc(${n((type.bodySize * 13.5) / 12.8)} * var(--s)); }
}
`,
};

/* ── Nocturne ────────────────────────────────────────────────────────────
   The blue secondary ink is the authored accent; the sea and card are moved
   through the same colour shift only after the control leaves its default. */
export const NOCTURNE_TYPOGRAPHY: PageTypographyRecipe = {
  headingFonts: [MULISH, INSTRUMENT_SERIF, NEWSREADER, GEIST],
  bodyFonts: [MULISH, GEIST, NEWSREADER, INSTRUMENT_SERIF],
  headingWeights: ["300", "400", "600"],
  headingWeight: "300",
  bodyWeights: ["300", "400", "600"],
  bodyWeight: "600",
  primaryColor: "#8ea6cc",
  headingSize: [36, 58.4, 84],
  bodySize: [12, 15.7, 22],
  headingLetterSpacing: [-0.08, 0, 0.1],
  css: (type) => `
:root { --ink-dim: ${type.primary}; --ink-dimmer: ${type.retone("#7d94b8")}; }
body { font-family: ${type.body}; }
h1, .bigtag { font-family: ${type.heading}; font-weight: ${type.headingWeight}; letter-spacing: ${type.headingLetterSpacing}em; }
h1 { font-size: ${px(type.headingSize)}; line-height: ${px((type.headingSize * 60) / 58.4)}; }
.bigtag { font-size: ${px((type.headingSize * 58.5) / 58.4)}; line-height: ${px((type.headingSize * 60) / 58.4)}; }
.lede, .facts { font-family: ${type.body}; font-size: ${px(type.bodySize)}; font-weight: ${type.bodyWeight}; }
#gl { filter: ${type.filter()}; }
@media (max-width: 1180px) {
  h1 { font-size: ${px((type.headingSize * 46) / 58.4)}; line-height: ${px((type.headingSize * 50) / 58.4)}; }
  .bigtag { font-size: ${px((type.headingSize * 40) / 58.4)}; line-height: ${px((type.headingSize * 45) / 58.4)}; }
}
@media (max-width: 820px) {
  h1 { font-size: ${px((type.headingSize * 38) / 58.4)}; line-height: ${px((type.headingSize * 42) / 58.4)}; }
  .bigtag { font-size: ${px((type.headingSize * 32) / 58.4)}; line-height: ${px((type.headingSize * 36) / 58.4)}; }
  .lede, .facts { font-size: ${px((type.bodySize * 14.5) / 15.7)}; }
}
@media (max-width: 620px) {
  h1 { font-size: ${px((type.headingSize * 31) / 58.4)}; line-height: ${px((type.headingSize * 35) / 58.4)}; }
  .bigtag { font-size: ${px((type.headingSize * 25) / 58.4)}; line-height: ${px((type.headingSize * 29) / 58.4)}; }
  .lede { font-size: ${px((type.bodySize * 14) / 15.7)}; }
}
@media (max-width: 620px) and (max-height: 820px) {
  .lede { font-size: ${px((type.bodySize * 13.5) / 15.7)}; }
  .bigtag { font-size: ${px((type.headingSize * 23) / 58.4)}; line-height: ${px((type.headingSize * 27) / 58.4)}; }
}
@media (max-height: 860px) and (min-width: 760px) {
  h1 { font-size: ${px((type.headingSize * 40) / 58.4)}; line-height: ${px((type.headingSize * 44) / 58.4)}; }
  .bigtag { font-size: ${px((type.headingSize * 28) / 58.4)}; line-height: ${px((type.headingSize * 32) / 58.4)}; }
  .lede, .facts { font-size: ${px((type.bodySize * 14.5) / 15.7)}; }
}
@media (max-height: 560px) {
  h1 { font-size: ${px((type.headingSize * 32) / 58.4)}; line-height: ${px((type.headingSize * 36) / 58.4)}; }
  .bigtag { font-size: ${px((type.headingSize * 26) / 58.4)}; line-height: ${px((type.headingSize * 30) / 58.4)}; }
  .lede, .facts { font-size: ${px((type.bodySize * 13.5) / 15.7)}; }
}
`,
};

/* ── Veyra ─────────────────────────────────────────────────────────────────────
   Veyra embeds DM Sans. Its violet CTA ramp is the brand colour, and the
   scene follows the same shift without changing at the authored default. */
export const VEYRA_TYPOGRAPHY: PageTypographyRecipe = {
  headingFonts: [DM_SANS, INSTRUMENT_SERIF, NEWSREADER, GEIST],
  bodyFonts: [DM_SANS, GEIST, NEWSREADER, INSTRUMENT_SERIF],
  headingWeights: ["300", "400", "500", "600", "700"],
  headingWeight: "400",
  bodyWeights: ["300", "400", "500", "600"],
  bodyWeight: "400",
  primaryColor: "#2a00ad",
  headingSize: [40, 64, 92],
  bodySize: [12, 16.5, 24],
  headingLetterSpacing: [-0.08, -0.0205, 0.1],
  css: (type) => `
body { font-family: ${type.body}; font-weight: ${type.bodyWeight}; }
h1, h1 em { font-family: ${type.heading}; font-weight: ${type.headingWeight}; }
h1 {
  font-size: clamp(40px, 4.34vw, ${px(type.headingSize)});
  letter-spacing: ${type.headingLetterSpacing}em;
}
.lede { font-size: ${px(type.bodySize)}; font-weight: ${type.bodyWeight}; }
.cta {
  background: linear-gradient(97deg, ${type.retone("#07071c")} 0%, ${type.retone("#0f0341")} 42%, ${type.retone("#1e0090")} 78%, ${type.primary} 100%);
}
#gl { filter: ${type.filter()}; }
@media (max-width: 860px) {
  h1 { font-size: clamp(32px, 7.6vw, ${px((type.headingSize * 48) / 64)}); }
  .lede { font-size: ${px((type.bodySize * 15.4) / 16.5)}; }
}
`,
};
