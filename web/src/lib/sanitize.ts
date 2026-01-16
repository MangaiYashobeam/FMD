/**
 * Security Utilities for Input Sanitization and XSS Protection
 * Production-level security for Dealers Face frontend
 */

// HTML entities map for encoding
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

// Characters that could be used in SQL injection
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|UNION|FETCH|DECLARE|CAST)\b)/gi,
  /(--)|(\/\*)|(\*\/)|(\bOR\b.*=)|(\bAND\b.*=)/gi,
  /(;|\||`|\$\()/g,
];

// Characters that could be used in XSS attacks
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /data:/gi,
  /vbscript:/gi,
  /expression\s*\(/gi,
];

/**
 * Encode HTML entities to prevent XSS
 */
export function encodeHTML(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Decode HTML entities
 */
export function decodeHTML(str: string): string {
  if (!str || typeof str !== 'string') return '';
  const textarea = document.createElement('textarea');
  textarea.innerHTML = str;
  return textarea.value;
}

/**
 * Sanitize string input - removes dangerous characters
 */
export function sanitizeString(input: string, options: {
  maxLength?: number;
  allowHTML?: boolean;
  trimWhitespace?: boolean;
} = {}): string {
  if (!input || typeof input !== 'string') return '';

  const { maxLength = 10000, allowHTML = false, trimWhitespace = true } = options;

  let sanitized = input;

  // Trim whitespace
  if (trimWhitespace) {
    sanitized = sanitized.trim();
  }

  // Truncate to max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Encode HTML if not allowed
  if (!allowHTML) {
    sanitized = encodeHTML(sanitized);
  }

  return sanitized;
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== 'string') return '';
  
  // Remove whitespace
  const trimmed = email.trim().toLowerCase();
  
  // Basic email validation regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(trimmed)) {
    return '';
  }
  
  // Max email length per RFC
  if (trimmed.length > 254) {
    return '';
  }
  
  return trimmed;
}

/**
 * Sanitize phone number - keeps only digits and basic formatting
 */
export function sanitizePhone(phone: string): string {
  if (!phone || typeof phone !== 'string') return '';
  
  // Remove everything except digits, spaces, dashes, parentheses, and plus
  return phone.replace(/[^\d\s\-()+ ]/g, '').trim();
}

/**
 * Sanitize URL
 */
export function sanitizeURL(url: string): string {
  if (!url || typeof url !== 'string') return '';
  
  const trimmed = url.trim();
  
  // Only allow http, https, and mailto protocols
  const allowedProtocols = ['http:', 'https:', 'mailto:'];
  
  try {
    const parsed = new URL(trimmed);
    if (!allowedProtocols.includes(parsed.protocol)) {
      return '';
    }
    return parsed.href;
  } catch {
    // If it doesn't have a protocol, try adding https
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      try {
        const withProtocol = new URL(`https://${trimmed}`);
        return withProtocol.href;
      } catch {
        return '';
      }
    }
    return '';
  }
}

/**
 * Sanitize numeric input
 */
export function sanitizeNumber(input: string | number, options: {
  min?: number;
  max?: number;
  decimals?: number;
  defaultValue?: number;
} = {}): number {
  const { min, max, decimals = 2, defaultValue = 0 } = options;
  
  let num = typeof input === 'string' ? parseFloat(input.replace(/[^0-9.-]/g, '')) : input;
  
  if (isNaN(num)) return defaultValue;
  
  // Apply min/max bounds
  if (min !== undefined && num < min) num = min;
  if (max !== undefined && num > max) num = max;
  
  // Round to specified decimals
  const multiplier = Math.pow(10, decimals);
  num = Math.round(num * multiplier) / multiplier;
  
  return num;
}

/**
 * Check for SQL injection patterns
 */
export function hasSQLInjection(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Check for XSS patterns
 */
export function hasXSSPatterns(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  return XSS_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Remove potentially dangerous SQL/XSS content
 */
export function removeDangerousContent(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  let sanitized = input;
  
  // Remove SQL injection patterns
  SQL_INJECTION_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });
  
  // Remove XSS patterns
  XSS_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });
  
  return sanitized;
}

/**
 * Sanitize object - recursively sanitize all string values
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sanitized = { ...obj };
  
  for (const key in sanitized) {
    const value = sanitized[key];
    
    if (typeof value === 'string') {
      (sanitized as Record<string, unknown>)[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      (sanitized as Record<string, unknown>)[key] = value.map(item =>
        typeof item === 'string' ? sanitizeString(item) : 
        typeof item === 'object' && item !== null ? sanitizeObject(item as Record<string, unknown>) : item
      );
    } else if (typeof value === 'object' && value !== null) {
      (sanitized as Record<string, unknown>)[key] = sanitizeObject(value as Record<string, unknown>);
    }
  }
  
  return sanitized;
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;
  
  if (!password) {
    return { isValid: false, score: 0, feedback: ['Password is required'] };
  }
  
  // Length check
  if (password.length >= 8) score += 1;
  else feedback.push('At least 8 characters required');
  
  if (password.length >= 12) score += 1;
  
  // Uppercase check
  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push('Include at least one uppercase letter');
  
  // Lowercase check
  if (/[a-z]/.test(password)) score += 1;
  else feedback.push('Include at least one lowercase letter');
  
  // Number check
  if (/\d/.test(password)) score += 1;
  else feedback.push('Include at least one number');
  
  // Special character check
  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) score += 1;
  else feedback.push('Include at least one special character');
  
  // No common patterns
  const commonPatterns = ['password', '123456', 'qwerty', 'admin', 'letmein'];
  if (commonPatterns.some(p => password.toLowerCase().includes(p))) {
    score -= 2;
    feedback.push('Avoid common password patterns');
  }
  
  return {
    isValid: score >= 4 && feedback.length <= 1,
    score: Math.max(0, Math.min(score, 6)),
    feedback,
  };
}

/**
 * Generate a secure random string (client-side)
 */
export function generateSecureToken(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Mask sensitive data for display
 */
export function maskSensitiveData(data: string, options: {
  showFirst?: number;
  showLast?: number;
  maskChar?: string;
} = {}): string {
  const { showFirst = 0, showLast = 4, maskChar = '*' } = options;
  
  if (!data || data.length <= showFirst + showLast) {
    return maskChar.repeat(data?.length || 8);
  }
  
  const first = data.substring(0, showFirst);
  const last = data.substring(data.length - showLast);
  const middle = maskChar.repeat(Math.min(data.length - showFirst - showLast, 10));
  
  return `${first}${middle}${last}`;
}

/**
 * Sanitize filename
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') return '';
  
  // Remove path traversal attempts
  let sanitized = filename.replace(/\.\./g, '');
  
  // Remove unsafe characters
  sanitized = sanitized.replace(/[<>:"/\\|?*\x00-\x1f]/g, '');
  
  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.split('.').pop() || '';
    sanitized = sanitized.substring(0, 250 - ext.length) + '.' + ext;
  }
  
  return sanitized.trim();
}

export default {
  encodeHTML,
  decodeHTML,
  sanitizeString,
  sanitizeEmail,
  sanitizePhone,
  sanitizeURL,
  sanitizeNumber,
  sanitizeObject,
  sanitizeFilename,
  hasSQLInjection,
  hasXSSPatterns,
  removeDangerousContent,
  validatePasswordStrength,
  generateSecureToken,
  maskSensitiveData,
};
