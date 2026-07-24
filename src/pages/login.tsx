import { useState, FormEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import Link from 'next/link';

const demoPassword = process.env.NEXT_PUBLIC_ENABLE_DEMO_CREDENTIAL_AUTOFILL === 'true'
  ? process.env.NEXT_PUBLIC_DEMO_PASSWORD || ''
  : '';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();

  if (isAuthenticated) {
    router.push('/dashboard');
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-center text-3xl font-bold text-blue-600">
            AI Documentation Assistant
          </h1>
          <h2 className="mt-6 text-center text-2xl font-semibold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Healthcare documentation made simple
          </p>
        </div>

        <form className="mt-8 space-y-6 card" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="label">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="input"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-700">
              Forgot your password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full btn btn-primary flex items-center justify-center"
          >
            {isLoading ? (
              <div className="spinner"></div>
            ) : (
              'Sign in'
            )}
          </button>

          <p className="text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <Link href="/register" className="text-blue-600 hover:text-blue-700 font-medium">
              Register
            </Link>
          </p>

          <div className="text-center text-sm text-gray-500">
            <p className="mb-2">Quick login:</p>
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={() => {
                  setEmail('admin@healthcare.com');
                  setPassword(demoPassword);
                }}
                disabled={!demoPassword}
                className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-xs"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('dr.smith@healthcare.com');
                  setPassword(demoPassword);
                }}
                disabled={!demoPassword}
                className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-xs"
              >
                Doctor
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('nurse.jones@healthcare.com');
                  setPassword(demoPassword);
                }}
                disabled={!demoPassword}
                className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-xs"
              >
                Nurse
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
