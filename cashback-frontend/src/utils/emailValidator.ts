/**
 * Unified email validation for all inputs: registration, bonus program, forum.
 * Complies with common partner requirements (Wise, payment systems, etc).
 * 
 * Rules:
 * - RFC 5321 simplified (local + domain, no spaces, proper TLD)
 * - 1-64 chars before @, 1-255 after
 * - Supports: letters, digits, dots, hyphens, underscores, plus
 * - TLD minimum 2 chars (e.g., "co.uk")
 * - No consecutive dots
 * - No leading/trailing dots in local or domain
 */

const EMAIL_REGEX = /^[a-zA-Z0-9._+\-]{1,64}@[a-zA-Z0-9.\-]{1,255}\.[a-zA-Z]{2,}$/;

export interface EmailValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates email format according to unified standard.
 * @param email - Email string to validate
 * @returns Object with validation status and optional error message
 */
export function validateEmail(email: string): EmailValidationResult {
  const trimmed = (email || "").trim();

  // Empty check
  if (!trimmed) {
    return {
      valid: false,
      error: "Email is required",
    };
  }

  // Length check
  if (trimmed.length > 320) {
    return {
      valid: false,
      error: "Email is too long (max 320 characters)",
    };
  }

  // Format check
  if (!EMAIL_REGEX.test(trimmed)) {
    return {
      valid: false,
      error: "Invalid email format",
    };
  }

  // Consecutive dots check
  if (trimmed.includes("..")) {
    return {
      valid: false,
      error: "Email cannot contain consecutive dots",
    };
  }

  // Local part (before @) validation
  const [local, domain] = trimmed.split("@");

  if (local.startsWith(".") || local.endsWith(".")) {
    return {
      valid: false,
      error: "Email local part cannot start or end with a dot",
    };
  }

  // Domain part (after @) validation
  if (domain.startsWith(".") || domain.endsWith(".")) {
    return {
      valid: false,
      error: "Email domain cannot start or end with a dot",
    };
  }

  if (domain.startsWith("-") || domain.endsWith("-")) {
    return {
      valid: false,
      error: "Email domain cannot start or end with a hyphen",
    };
  }

  // All checks passed
  return { valid: true };
}

/**
 * Checks if email is syntactically valid (quick boolean version).
 * @param email - Email string to check
 * @returns true if valid, false otherwise
 */
export function isValidEmail(email: string): boolean {
  return validateEmail(email).valid;
}