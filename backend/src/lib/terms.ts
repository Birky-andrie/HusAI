/**
 * The version of the Terms of Service / Privacy Notice currently in force.
 *
 * Bump this ONLY when the terms change in a way a reasonable user would want
 * to know about — new categories of data, a new processor, a new purpose.
 * Bumping it makes every existing user re-accept, which is the point: under the
 * Data Privacy Act (RA 10173) consent is a "specific, informed" indication tied
 * to what was actually disclosed, so consent to the old text is not consent to
 * the new one.
 *
 * Date-stamped rather than semver so the stored value on a user row says, on
 * its own, which document they agreed to.
 */
export const TERMS_VERSION = '2026-07-31';
