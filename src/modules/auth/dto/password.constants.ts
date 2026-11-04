/** bcrypt only hashes the first 72 bytes; longer passwords would be silently truncated. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
/** RFC 5321 practical maximum. */
export const EMAIL_MAX_LENGTH = 254;
/** Opaque tokens are 64 hex chars; leave headroom without accepting arbitrary blobs. */
export const TOKEN_MAX_LENGTH = 512;
