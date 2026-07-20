import fs from "node:fs";
import path from "node:path";

/**
 * Preloaded before any test module (see bunfig.toml).
 *
 * `lib/config.ts` resolves VAULT_DIR and ENGRAM_DATA_DIR at *import* time, and Bun shares one
 * module registry across test files. So whichever test file imports the store first would freeze
 * the vault path for every other file — a test that sets its own VAULT_DIR then silently reads the
 * bundled sample-vault, and fails or passes depending on file order. Setting it here, before any
 * module loads, makes the whole suite deterministic regardless of order.
 */

const root = path.resolve(import.meta.dir, "..");
export const TEST_VAULT = path.join(root, ".test-vault");
export const TEST_DATA = path.join(root, ".test-data");

// Start from a clean vault every run, so a fixture left behind by a previous run can't
// mask a regression (or invent one).
fs.rmSync(TEST_VAULT, { recursive: true, force: true });
fs.rmSync(TEST_DATA, { recursive: true, force: true });
fs.mkdirSync(TEST_VAULT, { recursive: true });
fs.mkdirSync(TEST_DATA, { recursive: true });

process.env.VAULT_DIR = TEST_VAULT;
process.env.ENGRAM_DATA_DIR = TEST_DATA;
// Never let a test commit or push. The vault under test is not a git repo anyway, but be explicit.
process.env.GIT_SYNC_ENABLED = "false";
