/**
 * Normalizes username by trimming, lowercasing, and treating spaces/underscores identically.
 */
function normalizeUsername(name) {
  return (name || '').trim().toLowerCase().replace(/_/g, ' ');
}

/**
 * Checks if a Wikimedia username is verified to publish directly to Mainspace during Phase 1 beta.
 * Configured strictly via the VERIFIED_MAINSPACE_USERS environment variable for privacy.
 * @param {string} username
 * @returns {boolean}
 */
export function isVerifiedUser(username) {
  if (!username) return false;

  const rawEnv = process.env.VERIFIED_MAINSPACE_USERS || '';
  if (!rawEnv.trim()) return false;

  const allowedUsers = rawEnv
    .split(',')
    .map(u => normalizeUsername(u))
    .filter(Boolean);

  return allowedUsers.includes(normalizeUsername(username));
}
