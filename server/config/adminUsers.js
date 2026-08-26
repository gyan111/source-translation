/**
 * Normalizes username by trimming, lowercasing, and treating spaces/underscores identically.
 */
function normalizeUsername(name) {
  return (name || '').trim().toLowerCase().replace(/_/g, ' ');
}

/**
 * Checks if a Wikimedia username is an administrator of the tool.
 * Configured via ADMIN_USERS or falls back to VERIFIED_MAINSPACE_USERS.
 * @param {string} username
 * @returns {boolean}
 */
export function isAdminUser(username) {
  if (!username) return false;

  const rawEnv = process.env.ADMIN_USERS || process.env.VERIFIED_MAINSPACE_USERS || '';
  if (!rawEnv.trim()) return false;

  const allowedUsers = rawEnv
    .split(',')
    .map(u => normalizeUsername(u))
    .filter(Boolean);

  return allowedUsers.includes(normalizeUsername(username));
}
