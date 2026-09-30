import { useCallback, useMemo } from "react";

import {
  splitTypographyProps,
  usePageTypography,
  type PageTypographyProps,
} from "./pageTypography";
import { LandingPageFrame, type LandingPageProps } from "./LandingPageFrame";
export { LandingPageFrame, applyBackgroundPresentation } from "./LandingPageFrame";
export type { LandingPageFrameProps, LandingPageProps } from "./LandingPageFrame";
import {
  ANTHRA_A40_TYPOGRAPHY,
  ATTUNE_TYPOGRAPHY,
  AURELLO_TYPOGRAPHY,
  AXONIS_TYPOGRAPHY,
  BESTSELLERS_TYPOGRAPHY,
  BETAWISE_HERO_TYPOGRAPHY,
  BETAWISE_TYPOGRAPHY,
  COMPLETE_SHELF_TYPOGRAPHY,
  INKBOUND_TYPOGRAPHY,
  ECHO_VALE_TYPOGRAPHY,
  HALVORSEN_TYPOGRAPHY,
  KAGE_TYPOGRAPHY,
  KAIRO_TYPOGRAPHY,
  MK78_KEYBOARD_TYPOGRAPHY,
  MARA_VOSS_TYPOGRAPHY,
  NOEMA_N1_TYPOGRAPHY,
  RENDERLAB_TYPOGRAPHY,
  MENG_TO_SKETCHBOOK_TYPOGRAPHY,
  NOCTURNE_TYPOGRAPHY,
  SYLVA_TYPOGRAPHY,
  TIDECREST_TYPOGRAPHY,
  VOLTA_ATELIER_TYPOGRAPHY,
} from "./pageRecipes";
import innerGreenSource from "../sylva-living-world/sources/inner-green-3d.html?raw";
/* Only the seam is imported here: the packaged Tidecrest document and its
   rewrites sit behind a module the public build guard stubs. */
import { buildTidecrestDocument } from "../tidecrest-hero/tidecrestDocument.js";
/* Same seam for Meridian's three sibling bodies. */
import { buildMeridianDocument } from "../meridian-landing-page/meridianDocument.js";
/* Same seam for the ASCII field's three generated sibling scenes. */
import { buildAsciiFieldDocument } from "../ascii-field/asciiFieldDocuments.js";
/* And for the Betawise globe's four other worlds. */
import { buildBetawiseGlobeDocument } from "../betawise-globe/betawiseGlobeDocument.js";
import axonisArborSource from "../axonis-field/axonis-arbor.html?raw";
import axonisVortexSource from "../axonis-field/axonis-vortex.html?raw";
import axonisTideSource from "../axonis-field/axonis-tide.html?raw";
import axonisDuneSource from "../axonis-field/axonis-dune.html?raw";
import {
  NOCTURNE_TITLES,
  NOCTURNE_VARIANTS,
  buildNocturneDocument,
  type NocturneVariant,
} from "../nocturne-hero/NocturneScene";
import { buildSandboxedPageDocument } from "./sandboxedPageDocument";
import {
  MAPLE_AUTUMN_STYLE,
  SAKURA_SUNSET_STYLE,
  SEQUOIA_MIST_STYLE,
  applyMapleAutumnVariant,
  applySakuraSunsetVariant,
  applySequoiaMistVariant,
} from "../sylva-living-world/SylvaLivingWorldScene";

export function KageLandingPage(props: LandingPageProps & PageTypographyProps) {
  const [type, frame] = splitTypographyProps(props);
  const customization = usePageTypography(KAGE_TYPOGRAPHY, type);
  return <LandingPageFrame {...frame} customization={customization} title="Kage — Where stillness reveals the unseen" sourceUrl="/landing-pages/kage.html" />;
}

export function CompleteShelfLandingPage(props: LandingPageProps & PageTypographyProps) {
  const [type, frame] = splitTypographyProps(props);
  const customization = usePageTypography(COMPLETE_SHELF_TYPOGRAPHY, type);
  return <LandingPageFrame {...frame} customization={customization} title="Working Volumes — Seven Tools for Making" sourceUrl="/landing-pages/complete-shelf-v2.html" />;
}

export function BestsellersBookShowcase(props: LandingPageProps & PageTypographyProps) {
  const [type, frame] = splitTypographyProps(props);
  const customization = usePageTypography(BESTSELLERS_TYPOGRAPHY, type);
  return <LandingPageFrame {...frame} customization={customization} title="Field Manuals — Tools for Thought" sourceUrl="/landing-pages/bestsellers-book-showcase.html" />;
}

export function InkboundRiverStory(props: LandingPageProps & PageTypographyProps) {
  const [type, frame] = splitTypographyProps(props);
  const customization = usePageTypography(INKBOUND_TYPOGRAPHY, type);
  return <LandingPageFrame {...frame} customization={customization} title="The River Remembers — Inkbound" sourceUrl="/landing-pages/inkbound-river-story.html" />;
}

export function NoctilucaLandingPage(props: LandingPageProps) {
  return <LandingPageFrame {...props} title="Noctiluca — The dark is not empty" sourceUrl="/landing-pages/noctiluca.html" />;
}

export function AgentArcanaLandingPage(props: LandingPageProps) {
  return <LandingPageFrame {...props} title="Meng To — Agent Arcana" sourceUrl="/landing-pages/agent-arcana.html" />;
}

export const ASCII_FIELD_VARIANTS = ["vortex", "tide", "ridge", "canopy"] as const;
export type AsciiFieldVariant = (typeof ASCII_FIELD_VARIANTS)[number];

/* The vortex is the packaged page itself, loaded from its own URL. The other
   three are complete documents of their own, built by
   `scripts/build-ascii-scenes.mjs`: each carries the authored drawing system —
   the layer depth rig, the near/far light ramp, the shading-cloud and grain
   passes, the glyph-sampling pointer dust and its suction well — and replaces
   only what the field is made of, its palette and its sky. None of them carries
   any page chrome, so there is no copy to suppress. */
const ASCII_FIELD_TITLES: Record<AsciiFieldVariant, string> = {
  vortex: "Sable — ASCII vortex background",
  tide: "ASCII Tide — glyph swell background",
  ridge: "ASCII Ridge — glyph range background",
  canopy: "ASCII Canopy — glyph tree background",
};

export type AsciiPageTransitionHeroProps = LandingPageProps & {
  variant?: AsciiFieldVariant;
  presentation?: "page" | "background";
};

export function AsciiPageTransitionHero({ variant = "vortex", presentation = "background", ...props }: AsciiPageTransitionHeroProps) {
  const safeVariant = ASCII_FIELD_VARIANTS.includes(variant) ? variant : "vortex";
  return (
    <LandingPageFrame
      {...props}
      key={safeVariant}
      backgroundCanvasSelector={presentation === "background" ? "#vortex" : undefined}
      title={presentation === "page" && safeVariant === "vortex" ? "Sable — Agents should ship, not start over" : ASCII_FIELD_TITLES[safeVariant]}
      sourceUrl="/landing-pages/ascii-page-transition-v1.html"
      srcDoc={buildAsciiFieldDocument(safeVariant)}
    />
  );
}

export function AsciiPageTransitionPage(props: Omit<AsciiPageTransitionHeroProps, "presentation">) {
  return <AsciiPageTransitionHero {...props} presentation="page" />;
}

export function TrochilHero(props: LandingPageProps) {
  return <LandingPageFrame {...props} backgroundCanvasSelector="#gl" title="Trochil — particle field background" sourceUrl="/landing-pages/trochil-hero.html" />;
}

export function AttuneHero(props: LandingPageProps & PageTypographyProps) {
  const [type, frame] = splitTypographyProps(props);
  const customization = usePageTypography(ATTUNE_TYPOGRAPHY, type);
  return <LandingPageFrame {...frame} customization={customization} title="attune — Tuned to every visitor" sourceUrl="/landing-pages/attune-hero.html" />;
}

export const BETAWISE_GLOBE_VARIANTS = ["betawise", "moon", "mars", "saturn", "sun"] as const;
export type BetawiseGlobeVariant = (typeof BETAWISE_GLOBE_VARIANTS)[number];

const BETAWISE_GLOBE_TITLES: Record<BetawiseGlobeVariant, string> = {
  betawise: "Betawise — network globe background",
  moon: "Moon — mare and highland background",
  mars: "Mars — albedo and crater background",
  saturn: "Saturn — ring system background",
  sun: "Sun — granulation and prominence background",
};

/**
 * The packaged document ends its IIFE by publishing `window.__betawise`, whose
 * `set()` writes into the scene's own CFG block and re-runs its `apply()`. Every
 * slider below is one CFG key, so the controls drive the authored renderer
 * rather than a second copy of its numbers — and they work identically on the
 * byte-exact Earth document and on the four derived worlds.
 */
export type BetawiseGlobeSceneProps = {
  /** Obliquity, radians. Read live by the frame loop, so it never jumps. */
  tilt?: number;
  /** How far the dark half of the surface map is pulled down: 1 - CFG.SEA_DIM. */
  surfaceContrast?: number;
  /** CFG.RIM_LIGHT — the halo the limb lights on its own. */
  limbGlow?: number;
  /** CFG.EXPOSURE, the tonemap's shoulder. */
  exposure?: number;
  /** CFG.BLOOM, how much of the three-mip chain is summed back. */
  bloom?: number;
  /** CFG.DUST_GAIN — the star volume, or the corona on the Sun. */
  starGlow?: number;
  /** CFG.ARC_GAIN — Earth's routes, Saturn's rings, the Sun's prominences. */
  arcGlow?: number;
};

export type BetawiseLandingPageProps = LandingPageProps & PageTypographyProps & BetawiseGlobeSceneProps & {
  variant?: BetawiseGlobeVariant;
  presentation?: "page" | "background";
};

/** Lifts the scene sliders out so the rest can go on to the frame untouched. */
function splitBetawiseSceneProps<T extends BetawiseGlobeSceneProps>(
  { tilt, surfaceContrast, limbGlow, exposure, bloom, starGlow, arcGlow, ...rest }: T,
): [BetawiseGlobeSceneProps, Omit<T, keyof BetawiseGlobeSceneProps>] {
  return [{ tilt, surfaceContrast, limbGlow, exposure, bloom, starGlow, arcGlow }, rest];
}

/** `undefined` means "leave the document's own value alone". */
function betawiseSceneSettings(scene: BetawiseGlobeSceneProps) {
  const settings: Record<string, number> = {};
  if (scene.tilt !== undefined) settings.TILT_X = scene.tilt;
  if (scene.surfaceContrast !== undefined) settings.SEA_DIM = 1 - scene.surfaceContrast;
  if (scene.limbGlow !== undefined) settings.RIM_LIGHT = scene.limbGlow;
  if (scene.exposure !== undefined) settings.EXPOSURE = scene.exposure;
  if (scene.bloom !== undefined) settings.BLOOM = scene.bloom;
  if (scene.starGlow !== undefined) settings.DUST_GAIN = scene.starGlow;
  if (scene.arcGlow !== undefined) settings.ARC_GAIN = scene.arcGlow;
  return settings;
}

/**
 * Re-identified only when a value actually moves, so the frame effect re-runs on
 * a slider drag and on nothing else. `set()` writes CFG and calls the document's
 * own apply(); TILT_X needs neither, because the frame loop reads it live.
 */
function useSceneSettings(settings: Record<string, number>) {
  const signature = JSON.stringify(settings);
  return useCallback((element: HTMLIFrameElement) => {
    const scene = betawiseScene(element);
    const values = JSON.parse(signature) as Record<string, number>;
    if (scene && Object.keys(values).length > 0) scene.set(values);
  }, [signature]);
}

/** Reads the scene's published hook, which is absent until the frame has run. */
function betawiseScene(element: HTMLIFrameElement) {
  const view = element.contentWindow as { __betawise?: { set: (values: Record<string, number>) => void } } | null;
  return view?.__betawise;
}

/**
 * The authored page is served byte-for-byte for the base entry — the frame loads it
 * from its packaged URL, exactly as it did before the variants existed. The four
 * other worlds are derived: the same authored document with anchored rewrites applied
 * to its tuning block, the surface the stroke field samples, the star volume, and
 * what the arc and marker layers carry. The rewrites live in betawiseGlobeVariants.js
 * so the node test can assert every anchor against the packaged file rather than
 * against a copy of it.
 */
export function BetawiseLandingPage({ variant = "betawise", presentation = "background", ...props }: BetawiseLandingPageProps) {
  const safeVariant = BETAWISE_GLOBE_VARIANTS.includes(variant) ? variant : "betawise";
  const [type, rest] = splitTypographyProps(props);
  const customization = usePageTypography(BETAWISE_TYPOGRAPHY, type);
  const [scene, frame] = splitBetawiseSceneProps(rest);
  const srcDoc = useMemo(() => buildBetawiseGlobeDocument?.(safeVariant), [safeVariant]);
  const settings = betawiseSceneSettings(scene);
  const applyScene = useSceneSettings(settings);

  return (
    <LandingPageFrame
      {...frame}
      key={safeVariant}
      backgroundCanvasSelector={presentation === "background" ? "#gl" : undefined}
      applyScene={applyScene}
      backgroundVisualSelector={presentation === "background" ? ".veil" : undefined}
      customization={safeVariant === "betawise" ? customization : undefined}
      title={BETAWISE_GLOBE_TITLES[safeVariant]}
      sourceUrl="/landing-pages/betawise.html"
      srcDoc={srcDoc}
    />
  );
}

export function BetawiseGlobePage(props: Omit<BetawiseLandingPageProps, "presentation">) {
  return <BetawiseLandingPage {...props} presentation="page" />;
}

export function KairoLandingPage(props: LandingPageProps & PageTypographyProps) {
  const [type, frame] = splitTypographyProps(props);
  const customization = usePageTypography(KAIRO_TYPOGRAPHY, type);
  return <LandingPageFrame {...frame} customization={customization} title="KAIRO — Heat With Intent." sourceUrl="/landing-pages/kairo-culinary.html" />;
}

export function VoltaAtelierLandingPage(props: LandingPageProps & PageTypographyProps) {
  const [type, frame] = splitTypographyProps(props);
  const customization = usePageTypography(VOLTA_ATELIER_TYPOGRAPHY, type);
  return <LandingPageFrame {...frame} customization={customization} title="Volta Atelier — Creative Design & 3D Studio" sourceUrl="/landing-pages/volta-atelier.html" />;
}

export type BetawiseHeroProps = LandingPageProps & PageTypographyProps & { presentation?: "page" | "background" };

export function BetawiseHero({ presentation = "background", ...props }: BetawiseHeroProps) {
  const [type, frame] = splitTypographyProps(props);
  const customization = usePageTypography(BETAWISE_HERO_TYPOGRAPHY, type);
  return <LandingPageFrame {...frame} backgroundCanvasSelector={presentation === "background" ? "#gl" : undefined} backgroundVisualSelector={presentation === "background" ? "#veil" : undefined} customization={customization} title={presentation === "background" ? "Betawise — particle bust background" : "Betawise — Redefining Attribution with AI-Powered Data Precision"} sourceUrl="/landing-pages/betawise-hero.html" />;
}

export function BetawiseParticlePage(props: Omit<BetawiseHeroProps, "presentation">) {
  return <BetawiseHero {...props} presentation="page" />;
}

export const AXONIS_VARIANTS = ["signal-tree", "arbor", "vortex", "tide", "dune"] as const;
export type AxonisVariant = (typeof AXONIS_VARIANTS)[number];

/* The signal tree is the packaged page itself, loaded from its own URL so it
   stays byte-exact. The other four are complete documents of their own, built
   by `scripts/build-axonis-scenes.mjs`: each carries the authored drawing
   system — the GPU-extruded ribbons, the dual-filter bloom, the composite and
   its grain — and replaces the curve the strands follow, the palette and the
   sky. None of them carries any page chrome, so there is no copy to suppress. */
const AXONIS_DOCUMENTS: Record<Exclude<AxonisVariant, "signal-tree">, string> = {
  arbor: axonisArborSource,
  vortex: axonisVortexSource,
  tide: axonisTideSource,
  dune: axonisDuneSource,
};

const AXONIS_TITLES: Record<AxonisVariant, string> = {
  "signal-tree": "Axonis — signal tree background",
  arbor: "Axonis — canopy and root background",
  vortex: "Axonis — deep field funnel background",
  tide: "Axonis — open water background",
  dune: "Axonis — sand sea background",
};

export type AxonisLandingPageProps = LandingPageProps & PageTypographyProps & {
  variant?: AxonisVariant;
  presentation?: "page" | "background";
};

export function AxonisLandingPage({ variant = "signal-tree", presentation = "background", ...props }: AxonisLandingPageProps) {
  const safeVariant = AXONIS_VARIANTS.includes(variant) ? variant : "signal-tree";
  const [type, frame] = splitTypographyProps(props);
  const customization = usePageTypography(AXONIS_TYPOGRAPHY, type);
  return <LandingPageFrame {...frame} backgroundCanvasSelector={presentation === "background" ? "#scene" : undefined} key={safeVariant} customization={safeVariant === "signal-tree" ? customization : undefined} title={presentation === "page" && safeVariant === "signal-tree" ? "Axonis — Adaptive intelligence systems" : AXONIS_TITLES[safeVariant]} sourceUrl="/landing-pages/axonis.html" srcDoc={safeVariant === "signal-tree" ? undefined : AXONIS_DOCUMENTS[safeVariant]} />;
}

export function AxonisPage(props: Omit<AxonisLandingPageProps, "presentation">) {
  return <AxonisLandingPage {...props} presentation="page" />;
}

export function HalfwaveLandingPage(props: LandingPageProps) {
  return <LandingPageFrame {...props} title="Halfwave — analogue design studio" sourceUrl="/landing-pages/codescan.html" />;
}

// The Halfwave build re-authored as a solo motion designer's portfolio.
export type MiraSolvangLandingPageProps = LandingPageProps & { presentation?: "page" | "background" };

export function MiraSolvangLandingPage({ presentation = "background", ...props }: MiraSolvangLandingPageProps) {
  return <LandingPageFrame {...props} backgroundCanvasSelector={presentation === "background" ? "#gl" : undefined} title={presentation === "background" ? "Mira Solvang — monitor wall background" : "Mira Solvang — Motion Designer"} sourceUrl="/landing-pages/mira-solvang.html" />;
}

export function MiraSolvangPage(props: Omit<MiraSolvangLandingPageProps, "presentation">) {
  return <MiraSolvangLandingPage {...props} presentation="page" />;
}

export const TIDECREST_HERO_VARIANTS = ["tidecrest", "harbour-nights", "dune-reach", "river-hollow"] as const;
export type TidecrestHeroVariant = (typeof TIDECREST_HERO_VARIANTS)[number];

export type TidecrestHeroProps = LandingPageProps & PageTypographyProps & { variant?: TidecrestHeroVariant; presentation?: "page" | "background" };

const TIDECREST_HERO_BASE_URL = "/landing-pages/tidecrest-hero.html";

const TIDECREST_HERO_TITLES: Record<TidecrestHeroVariant, string> = {
  tidecrest: "Tidecrest — ridgeline field background",
  "harbour-nights": "Tidecrest — harbour nights background",
  "dune-reach": "Tidecrest — dune reach background",
  "river-hollow": "Tidecrest — river hollow background",
};

/**
 * The authored page is served byte-for-byte for the base entry — the frame loads it
 * from its packaged URL, exactly as it did before the variants existed. The three
 * re-dressings are derived: the same authored document with anchored rewrites applied
 * to the height field, the extra vertices folded into its terrain buffers, and the
 * four colours the whole scene is graded through. The rewrites live in
 * tidecrestVariants.js so the node test can assert every anchor against the packaged
 * file rather than against a copy of it.
 */
export function TidecrestHero({ variant = "tidecrest", presentation = "background", ...props }: TidecrestHeroProps) {
  const safeVariant = TIDECREST_HERO_VARIANTS.includes(variant) ? variant : "tidecrest";
  const [type, frame] = splitTypographyProps(props);
  const customization = usePageTypography(TIDECREST_TYPOGRAPHY, type);
  /* the optional call is not defensiveness: on the public site the builder is a
     stub, and the Pro entry it belongs to is never mounted there */
  const srcDoc = useMemo(() => {
    const source = buildTidecrestDocument?.(safeVariant);
    if (!source) return undefined;
    return buildSandboxedPageDocument(source, {
      presentation,
      canvasSelector: "#gl",
    });
  }, [presentation, safeVariant]);

  return (
    <LandingPageFrame
      {...frame}
      key={safeVariant}
      backgroundCanvasSelector={presentation === "background" ? "#gl" : undefined}
      customization={customization}
      title={TIDECREST_HERO_TITLES[safeVariant]}
      sourceUrl={TIDECREST_HERO_BASE_URL}
      srcDoc={srcDoc}
    />
  );
}

export function TidecrestPage(props: Omit<TidecrestHeroProps, "presentation">) {
  return <TidecrestHero {...props} presentation="page" />;
}

export function CentraLandingPage(props: LandingPageProps) {
  return <LandingPageFrame {...props} title="Centra — Intelligence In The Open" sourceUrl="/landing-pages/centra.html" />;
}

export const NOCTURNE_CONTROL_KEYS = [
  "objectScale",
  "floatMotion",
  "metalHighlight",
  "haloScale",
  "haloGlow",
  "planetScale",
  "sunAzimuth",
  "planetGlow",
  "surfaceRelief",
  "clouds",
  "cityLights",
  "atmosphere",
  "stars",
  "waterMotion",
  "pointerOrbit",
] as const;
export type NocturneControlKey = (typeof NOCTURNE_CONTROL_KEYS)[number];

export type NocturneHeroProps = LandingPageProps & PageTypographyProps &
  Partial<Record<NocturneControlKey, number>> & { variant?: NocturneVariant; presentation?: "page" | "background" };

/**
 * The authored page is lumen.html; the page it holds is Nocturne. This entry
 * serves its scene alone — the marketing layer is gone from the document rather
 * than hidden inside the frame — and each variant swaps the body in the sky and
 * the object over the water. The canvas selector is kept so the presentation
 * pass still owns the layer if anything else ever lands in the document.
 */
export function NocturneHero({
  variant = "midnight",
  presentation = "background",
  objectScale,
  floatMotion,
  metalHighlight,
  haloScale,
  haloGlow,
  planetScale,
  sunAzimuth,
  planetGlow,
  surfaceRelief,
  clouds,
  cityLights,
  atmosphere,
  stars,
  waterMotion,
  pointerOrbit,
  ...props
}: NocturneHeroProps) {
  const safeVariant = NOCTURNE_VARIANTS.includes(variant) ? variant : "midnight";
  const [type, frame] = splitTypographyProps(props);
  const customization = usePageTypography(NOCTURNE_TYPOGRAPHY, type);
  const srcDoc = useMemo(
    () => presentation === "page" && safeVariant === "midnight" ? undefined : buildNocturneDocument(safeVariant),
    [presentation, safeVariant],
  );
  const applyScene = useCallback((element: HTMLIFrameElement) => {
    const given = {
      objectScale,
      floatMotion,
      metalHighlight,
      haloScale,
      haloGlow,
      planetScale,
      sunAzimuth,
      planetGlow,
      surfaceRelief,
      clouds,
      cityLights,
      atmosphere,
      stars,
      waterMotion,
      pointerOrbit,
    };
    const values: Record<string, number> = {};
    for (const [key, value] of Object.entries(given)) {
      if (typeof value === "number" && Number.isFinite(value)) values[key] = value;
    }
    element.contentWindow?.postMessage({ type: "threeui-nocturne-controls", values }, "*");
  }, [
    atmosphere,
    cityLights,
    clouds,
    floatMotion,
    haloGlow,
    haloScale,
    metalHighlight,
    objectScale,
    planetGlow,
    planetScale,
    pointerOrbit,
    stars,
    sunAzimuth,
    surfaceRelief,
    waterMotion,
  ]);
  return (
    <LandingPageFrame
      {...frame}
      key={safeVariant}
      applyScene={applyScene}
      backgroundCanvasSelector={presentation === "background" ? "#gl" : undefined}
      customization={customization}
      title={NOCTURNE_TITLES[safeVariant]}
      sourceUrl="/landing-pages/lumen.html"
      srcDoc={srcDoc}
    />
  );
}

export function NocturnePage(props: Omit<NocturneHeroProps, "presentation">) {
  return <NocturneHero {...props} presentation="page" />;
}

export const MERIDIAN_VARIANTS = ["earth", "moon", "mars", "saturn"] as const;
export type MeridianVariant = (typeof MERIDIAN_VARIANTS)[number];

/** Every knob `window.__meridian` in ascend.html will accept, as a multiplier
    over what the page was authored with — so 1 is the scene, not the middle of
    a slider, and one control set fits all four bodies. */
export const MERIDIAN_CONTROL_KEYS = [
  "orbitSpeed",
  "pointerSway",
  "sunAzimuth",
  "haze",
  "halo",
  "exposure",
  "relief",
  "clouds",
  "stars",
  "rings",
] as const;
export type MeridianControlKey = (typeof MERIDIAN_CONTROL_KEYS)[number];

export type MeridianLandingPageProps = LandingPageProps &
  Partial<Record<MeridianControlKey, number>> & { variant?: MeridianVariant; presentation?: "page" | "background" };

const MERIDIAN_TITLES: Record<MeridianVariant, string> = {
  earth: "Meridian — orbital Earth background",
  moon: "Meridian — orbital Moon background",
  mars: "Meridian — orbital Mars background",
  saturn: "Meridian — orbital Saturn background",
};

/**
 * The authored file is named ascend.html; the page it holds is Meridian.
 *
 * Earth is served from that URL, exactly as it was before the other bodies
 * existed. The three siblings are derived: the same document with anchored
 * rewrites applied to what the surface shader builds its albedo out of, how
 * much air stands over it, and the colours the frame is graded through —
 * plus, for Saturn, a ring system and the shadow it lays across the disc. The
 * rewrites live in meridianVariants.js so the node test can assert every
 * anchor against the packaged file rather than against a copy of it.
 */
export function MeridianLandingPage({
  variant = "earth",
  presentation = "background",
  orbitSpeed,
  pointerSway,
  sunAzimuth,
  haze,
  halo,
  exposure,
  relief,
  clouds,
  stars,
  rings,
  ...props
}: MeridianLandingPageProps) {
  const safeVariant = MERIDIAN_VARIANTS.includes(variant) ? variant : "earth";
  /* the optional call is not defensiveness: on the public site the builder is a
     stub, and the Pro entry it belongs to is never mounted there */
  const srcDoc = useMemo(() => buildMeridianDocument?.(safeVariant, presentation), [presentation, safeVariant]);

  /* Rebuilt whenever a slider moves, which is what re-runs the frame effect.
     A knob left undefined never reaches the document, so the authored value
     stands rather than being overwritten by a slider's own default. The three
     that are not uniforms — orbit speed, pointer sway, sun azimuth — need no
     apply at all: the frame loop reads them every frame. */
  const applyScene = useCallback((element: HTMLIFrameElement) => {
    const given = { orbitSpeed, pointerSway, sunAzimuth, haze, halo, exposure, relief, clouds, stars, rings };
    const values: Record<string, number> = {};
    for (const [key, value] of Object.entries(given)) {
      if (typeof value === "number" && Number.isFinite(value)) values[key] = value;
    }
    if (Object.keys(values).length === 0) return;

    if (safeVariant === "earth") {
      const scene = (element.contentWindow as { __meridian?: { set: (values: Record<string, number>) => void } } | null)?.__meridian;
      scene?.set(values);
      return;
    }

    /* Derived documents use srcDoc and intentionally keep an opaque sandbox
       origin. Reaching into contentWindow throws there, so their control seam
       travels through the same isolated postMessage bridge as Nocturne. */
    element.contentWindow?.postMessage({ type: "threeui-meridian-controls", values }, "*");
  }, [clouds, exposure, halo, haze, orbitSpeed, pointerSway, relief, rings, safeVariant, stars, sunAzimuth]);

  return (
    <LandingPageFrame
      {...props}
      key={safeVariant}
      applyScene={applyScene}
      backgroundCanvasSelector={presentation === "background" ? "#scene" : undefined}
      backgroundVisualSelector={presentation === "background" ? "#veil" : undefined}
      title={MERIDIAN_TITLES[safeVariant]}
      sourceUrl="/landing-pages/ascend.html"
      srcDoc={srcDoc}
    />
  );
}

export function MeridianPage(props: Omit<MeridianLandingPageProps, "presentation">) {
  return <MeridianLandingPage {...props} presentation="page" />;
}

export function MengToSketchbookLandingPage(props: LandingPageProps & PageTypographyProps) {
  const [type, frame] = splitTypographyProps(props);
  const customization = usePageTypography(MENG_TO_SKETCHBOOK_TYPOGRAPHY, type);
  return <LandingPageFrame {...frame} customization={customization} title="Meng To — Singapore Sketchbook" sourceUrl="/landing-pages/meng-to-sketchbook.html" />;
}

export function SekiteiLandingPage(props: LandingPageProps) {
  return <LandingPageFrame {...props} title="Sekitei — One day in a dry garden" sourceUrl="/landing-pages/sekitei.html" />;
}

export function RenderLabLandingPage(props: LandingPageProps & PageTypographyProps) {
  const [type, frame] = splitTypographyProps(props);
  const customization = usePageTypography(RENDERLAB_TYPOGRAPHY, type);
  return <LandingPageFrame {...frame} customization={customization} title="RenderLab — Motion House" sourceUrl="/landing-pages/renderlab-motion-house.html" />;
}

export function EchoValeLandingPage(props: LandingPageProps & PageTypographyProps) {
  const [type, frame] = splitTypographyProps(props);
  const customization = usePageTypography(ECHO_VALE_TYPOGRAPHY, type);
  return <LandingPageFrame {...frame} customization={customization} title="Echo Vale — Follow the signal beneath the stone" sourceUrl="/landing-pages/echo-vale.html" />;
}

export function AurelloLandingPage(props: LandingPageProps & PageTypographyProps) {
  const [type, frame] = splitTypographyProps(props);
  const customization = usePageTypography(AURELLO_TYPOGRAPHY, type);
  return <LandingPageFrame {...frame} customization={customization} title="Aurello — Orange Spritz, Ready to Drink" sourceUrl="/landing-pages/aurello-beverage.html" />;
}

export function LampLandingPage(props: LandingPageProps) {
  return <LandingPageFrame {...props} title="Latent — We develop film slowly, by hand" sourceUrl="/landing-pages/lamp.html" />;
}

export function MaraVossLandingPage(props: LandingPageProps & PageTypographyProps) {
  const [type, frame] = splitTypographyProps(props);
  const customization = usePageTypography(MARA_VOSS_TYPOGRAPHY, type);
  return <LandingPageFrame {...frame} customization={customization} title="Mara Voss — An Archive of Vanishing Sounds" sourceUrl="/landing-pages/mara-voss.html" />;
}

export function Mk78KeyboardLandingPage(props: LandingPageProps & PageTypographyProps) {
  const [type, frame] = splitTypographyProps(props);
  const customization = usePageTypography(MK78_KEYBOARD_TYPOGRAPHY, type);
  return <LandingPageFrame {...frame} customization={customization} title="MK·78 — Every key. Every detail." sourceUrl="/landing-pages/mk78-keyboard.html" />;
}

export function NoemaN1LandingPage(props: LandingPageProps & PageTypographyProps) {
  const [type, frame] = splitTypographyProps(props);
  const customization = usePageTypography(NOEMA_N1_TYPOGRAPHY, type);
  return <LandingPageFrame {...frame} customization={customization} title="NOEMA N1 — A machine that listens" sourceUrl="/landing-pages/noema-n1.html" />;
}

export function AnthraA40LandingPage(props: LandingPageProps & PageTypographyProps) {
  const [type, frame] = splitTypographyProps(props);
  const customization = usePageTypography(ANTHRA_A40_TYPOGRAPHY, type);
  return <LandingPageFrame {...frame} customization={customization} title="Anthra A-40 — The titanium automatic" sourceUrl="/landing-pages/anthra-a40.html" />;
}

export function AstralAtlasLandingPage(props: LandingPageProps) {
  return <LandingPageFrame {...props} title="Astral Atlas — Singular Objects in Orbit" sourceUrl="/landing-pages/astral-atlas.html" />;
}

export function MugenLandingPage(props: LandingPageProps) {
  return <LandingPageFrame {...props} title="MUGEN — The Gate Remembers" sourceUrl="/landing-pages/mugen.html" />;
}

export function NodalLandingPage(props: LandingPageProps) {
  return <LandingPageFrame {...props} title="NODAL — Series A 40mm T1.9" sourceUrl="/landing-pages/nodal.html" />;
}

export function Kestrel65LandingPage(props: LandingPageProps) {
  return <LandingPageFrame {...props} title="Kestrel 65" sourceUrl="/landing-pages/kestrel-65.html" />;
}

export function OscillaM1LandingPage(props: LandingPageProps) {
  return <LandingPageFrame {...props} title="OSCILLA M-1 — Blender-baked synthesiser" sourceUrl="/landing-pages/oscilla-m1.html" />;
}

// Halvorsen is Understory's layout and hand scene recut as a dark monotone
// portfolio; the 3D pipeline is unchanged, only the page tone around it.
export function HalvorsenLandingPage(props: LandingPageProps & PageTypographyProps) {
  const [type, frame] = splitTypographyProps(props);
  const customization = usePageTypography(HALVORSEN_TYPOGRAPHY, type);
  return <LandingPageFrame {...frame} customization={customization} title="halvorsen — Interfaces built to disappear" sourceUrl="/landing-pages/halvorsen.html" />;
}

export function SublevelStudioLandingPage(props: LandingPageProps) {
  return <LandingPageFrame {...props} title="sublevel.studio — We build the stuff people remember" sourceUrl="/landing-pages/sublevel-studio.html" />;
}

// The authored file is named cogniwave.html; the page it holds is Understory.
export function UnderstoryLandingPage(props: LandingPageProps) {
  return <LandingPageFrame {...props} title="understory — What grows here grows slowly" sourceUrl="/landing-pages/cogniwave.html" />;
}

export const SYLVA_HERO_VARIANTS = ["living-green", "sakura-sunset", "maple-autumn", "sequoia-mist"] as const;
export type SylvaHeroVariant = (typeof SYLVA_HERO_VARIANTS)[number];

export type SylvaHeroProps = LandingPageProps & PageTypographyProps & { variant?: SylvaHeroVariant };

const SYLVA_HERO_BASE_URL = "/landing-pages/inner-green-3d.html";

/**
 * The authored page is served byte-for-byte for Living Green. Sakura Sunset is derived:
 * the same authored document with the owner's authored Sakura Sunset scene transformation
 * applied — reused from SylvaLivingWorldScene rather than reimplemented here, so the two
 * entries can never drift apart. A <base> is injected because a srcdoc frame would otherwise
 * resolve the authored relative asset paths against the app origin instead of /landing-pages/.
 */
const SYLVA_HERO_ASSET_DIR = "inner-green-assets/";
const SYLVA_HERO_ASSET_BASE = `${SYLVA_HERO_BASE_URL.replace(/[^/]+$/, "")}${SYLVA_HERO_ASSET_DIR}`;

/**
 * Page chrome for the derived variants. Each one puts a different field behind
 * the page — dusk plum under Sakura, cold slate under Maple — so the dock is
 * retoned to sit in that light, and the two native controls get the frosted
 * backdrop a flat field no longer gives them for free.
 *
 * The authored page documents why its dock carries no backdrop-filter: over a
 * canvas that repaints every frame the backdrop is re-sampled and re-blurred
 * every frame, which measured ~20 fps off the whole page. That reasoning still
 * holds for a bar the width of the nav, so the dock keeps its translucent panel
 * and only its colour changes. The buttons are small and already clipped to
 * their own silhouette, so the blur is bounded to those two shapes.
 */
type SylvaHeroChromeTone = {
  edge: string;
  lift: string;
  panel: string;
  drop: string;
  nearPanel: string;
  mark: string;
  markInk: string;
  plate: string;
};

const SYLVA_HERO_CHROME_TONES: Record<Exclude<SylvaHeroVariant, "living-green">, SylvaHeroChromeTone> = {
  "sakura-sunset": {
    edge: "255, 236, 243",
    lift: "255, 240, 246",
    panel: "48, 33, 43",
    drop: "20, 10, 18",
    nearPanel: "53, 35, 46",
    mark: "#f3e9ee",
    markInk: "#33222c",
    plate: "58, 40, 51",
  },
  "maple-autumn": {
    edge: "228, 240, 246",
    lift: "232, 244, 250",
    panel: "33, 41, 47",
    drop: "8, 14, 18",
    nearPanel: "37, 46, 53",
    mark: "#e8eff2",
    markInk: "#23303a",
    plate: "34, 46, 54",
  },
  /* The fog field is the one pale ground of the four, so this dock is the one
     that has to hold its own against light rather than sit in the dark. */
  "sequoia-mist": {
    edge: "236, 244, 232",
    lift: "238, 246, 232",
    panel: "38, 48, 40",
    drop: "16, 24, 18",
    nearPanel: "43, 54, 44",
    mark: "#eef3e8",
    markInk: "#26302a",
    plate: "48, 60, 50",
  },
};

function sylvaHeroChromeStyle(tone: SylvaHeroChromeTone) {
  return `<style data-threeui-sylva-hero-chrome>
/* ── nav: the authored glass, retoned to the field behind it ────────────── */
.dock {
  border-color: rgba(${tone.edge}, 0.13) !important;
  background:
    linear-gradient(180deg, rgba(${tone.lift}, 0.06), rgba(${tone.lift}, 0) 42%),
    rgba(${tone.panel}, 0.76) !important;
  box-shadow: 0 calc(8 * var(--u)) calc(22 * var(--u)) rgba(${tone.drop}, 0.34),
              inset 0 1px rgba(${tone.lift}, 0.07) !important;
}

.dock-item[data-near="true"] {
  border-color: rgba(${tone.edge}, 0.20) !important;
  background: rgba(${tone.nearPanel}, 0.94) !important;
  box-shadow: 0 calc(7 * var(--u)) calc(16 * var(--u)) rgba(${tone.drop}, 0.32) !important;
}

.dock-mark {
  background: ${tone.mark} !important;
  border-color: ${tone.mark} !important;
  color: ${tone.markInk} !important;
}

.dock-mark[data-near="true"] {
  background: #fff !important;
  border-color: #fff !important;
  color: ${tone.markInk} !important;
}

.dock-item--enter { background: rgba(${tone.lift}, 0.085) !important; }

/* ── the two native controls ────────────────────────────────────────────
   The frosted plate cannot go on the clip elements themselves: their clip is
   cut to the button's whole bloom, so the blur would read as a slab twice the
   button's size. It cannot go inside them either — clip-path makes a backdrop
   root, so a child's backdrop-filter would have nothing behind it to sample.

   So each plate is its own layer outside the reveal clip, sized one unit past
   the native 202 x 60 Explore control and the 88-unit Play control. The small
   overshoot lets the frost meet the button edge instead of stopping inside it. */
.pill-glass {
  position: absolute;
  z-index: 4;
  left: calc(644 * var(--u));
  top: calc(360 * var(--u));
  width: calc(204 * var(--u));
  height: calc(62 * var(--u));
  margin: calc(-31 * var(--u)) 0 0 calc(-102 * var(--u));
  border-radius: 999px;
  pointer-events: none;
  -webkit-backdrop-filter: blur(calc(13 * var(--u))) saturate(1.16);
  backdrop-filter: blur(calc(13 * var(--u))) saturate(1.16);
  background: rgba(${tone.plate}, 0.22);
}

.play-wrap::before {
  content: "";
  position: absolute;
  z-index: -1;
  left: 50%;
  top: 50%;
  width: calc(90 * var(--u));
  height: calc(90 * var(--u));
  margin: calc(-45 * var(--u)) 0 0 calc(-45 * var(--u));
  border-radius: 50%;
  -webkit-backdrop-filter: blur(calc(13 * var(--u))) saturate(1.16);
  backdrop-filter: blur(calc(13 * var(--u))) saturate(1.16);
  background: rgba(${tone.plate}, 0.22);
}
</style>`;
}

const SYLVA_HERO_SCENES: Record<Exclude<SylvaHeroVariant, "living-green">, {
  style: string;
  apply: (source: string) => string;
}> = {
  "sakura-sunset": { style: SAKURA_SUNSET_STYLE, apply: applySakuraSunsetVariant },
  "maple-autumn": { style: MAPLE_AUTUMN_STYLE, apply: applyMapleAutumnVariant },
  "sequoia-mist": { style: SEQUOIA_MIST_STYLE, apply: applySequoiaMistVariant },
};

export function buildSylvaHeroDocument(variant: Exclude<SylvaHeroVariant, "living-green">) {
  const scene = SYLVA_HERO_SCENES[variant];
  // The authored relative asset paths are rewritten to absolute ones rather than steered with
  // <base>: a srcdoc frame's preload scanner resolves against the parent document and ignores
  // <base>, so it would speculatively 404 on every asset before the real parse corrected it.
  const rooted = innerGreenSource
    .replaceAll(SYLVA_HERO_ASSET_DIR, SYLVA_HERO_ASSET_BASE)
    .replace("</head>", `${scene.style}${sylvaHeroChromeStyle(SYLVA_HERO_CHROME_TONES[variant])}</head>`)
    // The Explore button's frosted plate has to be a sibling of its clip rather
    // than a child, so it is one added element rather than a CSS-only change.
    .replace(
      '<div class="pill-clip">',
      '<span class="pill-glass" aria-hidden="true"></span>\n    <div class="pill-clip">',
    );
  if (!rooted.includes("pill-glass")) throw new Error("Sylva hero chrome no longer matches the authored page.");
  return scene.apply(rooted);
}

const SYLVA_HERO_TITLES: Record<SylvaHeroVariant, string> = {
  "living-green": "Sylva — Into the living world",
  "sakura-sunset": "Sylva — Sakura Sunset",
  "maple-autumn": "Sylva — Maple Autumn",
  "sequoia-mist": "Sylva — Sequoia Mist",
};

export function SylvaHero({ variant = "living-green", ...props }: SylvaHeroProps) {
  const safeVariant = SYLVA_HERO_VARIANTS.includes(variant) ? variant : "living-green";
  const [type, frame] = splitTypographyProps(props);
  const customization = usePageTypography(SYLVA_TYPOGRAPHY, type);
  const srcDoc = useMemo(
    () => (safeVariant === "living-green" ? undefined : buildSylvaHeroDocument(safeVariant)),
    [safeVariant],
  );

  return (
    <LandingPageFrame
      {...frame}
      key={safeVariant}
      customization={customization}
      title={SYLVA_HERO_TITLES[safeVariant]}
      sourceUrl={SYLVA_HERO_BASE_URL}
      srcDoc={srcDoc}
    />
  );
}
