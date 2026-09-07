const CATALOG: Record<string, Record<string, string>> = {
  gender: {
    male: "Adult male subject, preserve exact facial identity.",
    female: "Adult female subject, preserve exact facial identity.",
    nonbinary: "Adult subject, preserve exact facial identity.",
  },
  purpose: {
    linkedin: "LinkedIn-ready professional portrait.",
    resume: "Resume and CV portrait, clean and formal.",
    corporate: "Corporate staff portrait.",
    dating: "Natural, approachable portrait.",
  },
  style: {
    corporate: "Corporate studio style, polished but natural.",
    creative: "Modern creative professional style.",
    casual: "Smart casual style.",
  },
  outfit: {
    navy_blazer: "Navy blazer over a light shirt.",
    white_shirt: "Crisp white dress shirt.",
    black_suit: "Black tailored suit jacket.",
  },
  background: {
    studio_grey: "Seamless grey studio backdrop.",
    office: "Soft office interior bokeh.",
    outdoor: "Soft natural outdoor backdrop.",
  },
  pose: {
    front: "Front-facing head-and-shoulders pose.",
    three_quarter: "Slight three-quarter angle.",
    smile: "Natural confident smile.",
  },
};

export const IDENTITY_INSTRUCTION =
  "Preserve the person's exact facial identity, skin tone, age, and unique features. Do not beautify into a different person. Photorealistic studio headshot.";

export function promptFromSelections(
  selections: Record<string, { id?: string; prompt?: string }> | undefined,
  referencePrompts?: Array<{ id?: string; visualReferencePrompt?: string }>,
): string {
  const bits: string[] = [];
  for (const [key, value] of Object.entries(selections ?? {})) {
    if (value.prompt?.trim()) {
      bits.push(value.prompt.trim());
      continue;
    }
    const id = value.id ?? "";
    const mapped = CATALOG[key]?.[id];
    bits.push(mapped || id);
  }
  for (const ref of referencePrompts ?? []) {
    if (ref.visualReferencePrompt?.trim()) bits.push(ref.visualReferencePrompt.trim());
  }
  const body = bits.filter(Boolean).join(" ");
  return body
    ? `Professional headshot. ${body}`
    : "Professional studio headshot, natural lighting, sharp identity, LinkedIn ready.";
}

export const STYLE_CATALOG = {
  genders: Object.keys(CATALOG.gender ?? {}),
  purposes: Object.keys(CATALOG.purpose ?? {}),
  styles: Object.keys(CATALOG.style ?? {}),
  outfits: Object.keys(CATALOG.outfit ?? {}),
  backgrounds: Object.keys(CATALOG.background ?? {}),
  poses: Object.keys(CATALOG.pose ?? {}),
};
