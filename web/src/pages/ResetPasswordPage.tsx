import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Car, Eye, EyeOff, Loader2, CheckCircle, AlertCircle, Lock } from 'lucide-react';
import api from '../lib/api';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  // Validate token exists
  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token. Please request a new password reset link.');
    }
  }, [token]);

  // Password strength indicators
  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };

  const passwordStrength = Object.values(passwordChecks).filter(Boolean).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    if (passwordStrength < 3) {
      setError('Password is too weak. Please meet at least 3 requirements.');
      return;
    }

    setIsLoading(true);

    try {
      await api.post('/auth/reset-password', { token, password });
      setIsSuccess(true);
      // Redirect to login after 3 seconds
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-xl mb-4">
            <Car className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-white">FaceMyDealer</h1>
          <p className="text-blue-200 mt-2">Create New Password</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {isSuccess ? (
            // Success State
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Password reset successful!</h2>
              <p className="text-gray-600 mb-6">
                Your password has been changed. You can now log in with your new password.
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Redirecting to login in 3 seconds...
              </p>
              <Link
                to="/login"
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center"
              >
                Go to login now
              </Link>
            </div>
          ) : !token ? (
            // No Token State
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Invalid Link</h2>
              <p className="text-gray-600 mb-6">
                This password reset link is invalid or has expired. Please request a new one.
              </p>
              <Link
                to="/forgot-password"
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center"
              >
                Request new link
              </Link>
            </div>
          ) : (
            // Form State
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Set new password</h2>
              <p className="text-gray-600 mb-6">
                Your new password must be at least 8 characters and include a mix of letters and numbers.
              </p>

              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors pr-12"
                      placeholder="••••••••"
                    />
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>

                  {/* Password strength indicator */}
                  {password && (
                    <div className="mt-3 space-y-2">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded ${
                              i <= passwordStrength
                                ? passwordStrength <= 1
                                  ? 'bg-red-500'
                                  : passwordStrength <= 2
                                  ? 'bg-yellow-500'
                                  : passwordStrength <= 3
                                  ? 'bg-blue-500'
                                  : 'bg-green-500'
                                : 'bg-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        <span className={passwordChecks.length ? 'text-green-600' : 'text-gray-400'}>
                          ✓ 8+ characters
                        </span>
                        <span className={passwordChecks.uppercase ? 'text-green-600' : 'text-gray-400'}>
                          ✓ Uppercase letter
                        </span>
                        <span className={passwordChecks.lowercase ? 'text-green-600' : 'text-gray-400'}>
                          ✓ Lowercase letter
                        </span>
                        <span className={passwordChecks.number ? 'text-green-600' : 'text-gray-400'}>
                          ✓ Number
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm new password
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors pr-12"
                      placeholder="••••••••"
                    />
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="mt-1 text-sm text-red-600">Passwords do not match</p>
                  )}
                  {confirmPassword && password === confirmPassword && (
                    <p className="mt-1 text-sm text-green-600">✓ Passwords match</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading || password !== confirmPassword || passwordStrength < 3}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Resetting password...
                    </>
                  ) : (
                    'Reset password'
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-blue-200 text-sm mt-8">
          © 2026 FaceMyDealer. All rights reserved.
        </p>
      </div>
    </div>
  );
}
