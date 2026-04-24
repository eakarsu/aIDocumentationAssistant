import React, { useState, useCallback } from 'react';

// Validation rule types
type ValidationRule = {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  email?: boolean;
  phone?: boolean;
  match?: string; // field name to match
  custom?: (value: string, allValues: Record<string, string>) => string | null;
  message?: string;
};

type ValidationRules = Record<string, ValidationRule>;
type ValidationErrors = Record<string, string>;

export function useFormValidation(rules: ValidationRules) {
  const [errors, setErrors] = useState<ValidationErrors>({});

  const validateField = useCallback(
    (name: string, value: string, allValues: Record<string, string> = {}): string | null => {
      const rule = rules[name];
      if (!rule) return null;

      if (rule.required && !value.trim()) {
        return rule.message || `${name} is required`;
      }

      if (value && rule.minLength && value.length < rule.minLength) {
        return `Must be at least ${rule.minLength} characters`;
      }

      if (value && rule.maxLength && value.length > rule.maxLength) {
        return `Must be no more than ${rule.maxLength} characters`;
      }

      if (value && rule.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return 'Please enter a valid email address';
        }
      }

      if (value && rule.phone) {
        const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,15}$/;
        if (!phoneRegex.test(value)) {
          return 'Please enter a valid phone number';
        }
      }

      if (value && rule.pattern && !rule.pattern.test(value)) {
        return rule.message || 'Invalid format';
      }

      if (rule.match && value !== allValues[rule.match]) {
        return `Must match ${rule.match}`;
      }

      if (rule.custom) {
        return rule.custom(value, allValues);
      }

      return null;
    },
    [rules]
  );

  const validateAll = useCallback(
    (values: Record<string, string>): boolean => {
      const newErrors: ValidationErrors = {};
      let isValid = true;

      for (const name of Object.keys(rules)) {
        const error = validateField(name, values[name] || '', values);
        if (error) {
          newErrors[name] = error;
          isValid = false;
        }
      }

      setErrors(newErrors);
      return isValid;
    },
    [rules, validateField]
  );

  const validateSingleField = useCallback(
    (name: string, value: string, allValues: Record<string, string> = {}) => {
      const error = validateField(name, value, allValues);
      setErrors((prev) => {
        if (error) {
          return { ...prev, [name]: error };
        }
        const { [name]: _, ...rest } = prev;
        return rest;
      });
    },
    [validateField]
  );

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  return { errors, validateAll, validateField: validateSingleField, clearErrors };
}

// Validated Input component
interface ValidatedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helpText?: string;
}

export function ValidatedInput({ label, error, helpText, className = '', ...props }: ValidatedInputProps) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {props.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          error ? 'border-red-500 bg-red-50' : 'border-gray-300'
        } ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {helpText && !error && <p className="mt-1 text-sm text-gray-500">{helpText}</p>}
    </div>
  );
}

// Validated Select component
interface ValidatedSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function ValidatedSelect({ label, error, options, className = '', ...props }: ValidatedSelectProps) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {props.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <select
        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          error ? 'border-red-500 bg-red-50' : 'border-gray-300'
        } ${className}`}
        {...props}
      >
        <option value="">Select...</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

// Validated Textarea component
interface ValidatedTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

export function ValidatedTextarea({ label, error, className = '', ...props }: ValidatedTextareaProps) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {props.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <textarea
        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          error ? 'border-red-500 bg-red-50' : 'border-gray-300'
        } ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
