import { NextApiRequest, NextApiResponse, NextApiHandler } from 'next';

// Sanitize a string value to prevent XSS and injection attacks
function sanitizeString(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove common SQL injection patterns
    .replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC|EXECUTE)\b)/gi, '');
}

// Recursively sanitize an object's string values
function sanitizeValue(value: any): any {
  if (typeof value === 'string') {
    return sanitizeString(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      sanitized[sanitizeString(key)] = sanitizeValue(val);
    }
    return sanitized;
  }
  return value;
}

// Validate and sanitize common input types
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  return { valid: true };
}

export function validateUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

// Input sanitization middleware
export function withSanitization(handler: NextApiHandler): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Sanitize query parameters
    if (req.query) {
      const sanitizedQuery: Record<string, any> = {};
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string') {
          sanitizedQuery[key] = sanitizeString(value);
        } else if (Array.isArray(value)) {
          sanitizedQuery[key] = value.map((v) => (typeof v === 'string' ? sanitizeString(v) : v));
        } else {
          sanitizedQuery[key] = value;
        }
      }
      req.query = sanitizedQuery;
    }

    // Sanitize body (skip for file uploads)
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      // Don't sanitize password fields
      const passwordFields = ['password', 'newPassword', 'currentPassword', 'confirmPassword'];
      const preserved: Record<string, any> = {};

      for (const field of passwordFields) {
        if (req.body[field] !== undefined) {
          preserved[field] = req.body[field];
        }
      }

      req.body = sanitizeValue(req.body);

      // Restore password fields (they shouldn't be sanitized as they need original chars)
      for (const [field, value] of Object.entries(preserved)) {
        req.body[field] = value;
      }
    }

    return handler(req, res);
  };
}
