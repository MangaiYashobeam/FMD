import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Car, ArrowLeft, Mail, Loader2, CheckCircle } from 'lucide-react';
import api from '../lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await api.post('/auth/forgot-password', { email });
      setIsSubmitted(true);
    } catch (err: any) {
      // Don't reveal if email exists or not for security
      setIsSubmitted(true);
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
          <p className="text-blue-200 mt-2">Password Recovery</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {isSubmitted ? (
            // Success State
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h2>
              <p className="text-gray-600 mb-6">
                If an account exists for <strong>{email}</strong>, we've sent password reset instructions to that address.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Didn't receive the email? Check your spam folder or try again.
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setIsSubmitted(false);
                    setEmail('');
                  }}
                  className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors"
                >
                  Try another email
                </button>
                <Link
                  to="/login"
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center"
                >
                  Return to login
                </Link>
              </div>
            </div>
          ) : (
            // Form State
            <>
              <div className="mb-6">
                <Link
                  to="/login"
                  className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back to login
                </Link>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-2">Forgot your password?</h2>
              <p className="text-gray-600 mb-6">
                No worries! Enter your email address and we'll send you a link to reset your password.
              </p>

              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email address
                  </label>
                  <div className="relative">
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="you@dealership.com"
                    />
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Sending...
                    </>
                  ) : (
                    'Send reset link'
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
