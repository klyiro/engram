/**
 * Anthropic models offered across Engram — the single source of truth shared by the
 * Curator chat picker (client), the Settings capture-model dropdown (client), and the
 * server (curator stream + brain_capture harness). Plain constants, no other imports,
 * so it's safe in both client and server bundles and can't create an import cycle.
 */

export const CURATOR_MODELS = [
  { id: "claude-opus-4-8", label: "Opus 4.8" },
  { id: "claude-sonnet-5", label: "Sonnet 5" },
  { id: "claude-haiku-4-5", label: "Haiku 4.5" },
] as const;

/** Default model for the Curator chat (the strongest — you're reasoning over your brain). */
export const DEFAULT_CURATOR_MODEL = "claude-opus-4-8";

/** Default model for brain_capture auto-filing (cheap + fast — filing a rough note is a simple task). */
export const DEFAULT_CAPTURE_MODEL = "claude-haiku-4-5";

/** All supported model IDs, for validation. */
export const SUPPORTED_MODEL_IDS = new Set<string>(CURATOR_MODELS.map((m) => m.id));
