import { Link } from 'react-router-dom';
import { Cookie, ArrowLeft, Settings, ToggleLeft, Info, Shield, Mail } from 'lucide-react';
import { DealersFaceIcon } from '../../components/ui/Logo';

export default function CookiePolicyPage() {
  const lastUpdated = 'January 19, 2026';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <DealersFaceIcon className="h-8 w-8" />
              <span className="text-xl font-bold text-gray-900">DealersFace</span>
            </Link>
            <Link to="/" className="flex items-center gap-2 text-gray-600 hover:text-blue-600">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 md:p-12">
          {/* Title */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
              <Cookie className="h-8 w-8 text-amber-600" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Cookie Policy</h1>
            <p className="text-gray-500">Last updated: {lastUpdated}</p>
          </div>

          {/* Quick Summary */}
          <div className="bg-amber-50 rounded-xl p-6 mb-10">
            <h2 className="font-semibold text-amber-900 mb-3">🍪 Cookies in a Nutshell</h2>
            <ul className="space-y-2 text-amber-800">
              <li>• We use cookies to keep you logged in and remember your preferences</li>
              <li>• We use minimal analytics to improve our service</li>
              <li>• We do NOT use cookies for advertising or tracking across websites</li>
              <li>• You can control cookies through your browser settings</li>
            </ul>
          </div>

          {/* Sections */}
          <div className="space-y-10 text-gray-700">
            {/* What Are Cookies */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Info className="h-5 w-5 text-amber-600" />
                1. What Are Cookies?
              </h2>
              <p className="mb-4">
                Cookies are small text files that are stored on your computer or mobile device when you 
                visit a website. They are widely used to make websites work more efficiently and provide 
                information to website owners.
              </p>
              <p>
                Cookies help us remember your preferences, keep you logged in, and understand how you 
                use our Service so we can improve it.
              </p>
            </section>

            {/* Types of Cookies */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Settings className="h-5 w-5 text-amber-600" />
                2. Types of Cookies We Use
              </h2>

              {/* Essential Cookies */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-5 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded">Required</span>
                  <h3 className="font-semibold text-green-900">Essential Cookies</h3>
                </div>
                <p className="text-green-800 mb-3">
                  These cookies are necessary for the website to function and cannot be disabled.
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-green-200">
                      <th className="text-left py-2 text-green-900">Cookie</th>
                      <th className="text-left py-2 text-green-900">Purpose</th>
                      <th className="text-left py-2 text-green-900">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="text-green-800">
                    <tr className="border-b border-green-100">
                      <td className="py-2 font-mono">df_session</td>
                      <td className="py-2">Keeps you logged in</td>
                      <td className="py-2">Session</td>
                    </tr>
                    <tr className="border-b border-green-100">
                      <td className="py-2 font-mono">df_token</td>
                      <td className="py-2">Authentication token</td>
                      <td className="py-2">7 days</td>
                    </tr>
                    <tr className="border-b border-green-100">
                      <td className="py-2 font-mono">df_csrf</td>
                      <td className="py-2">Security token</td>
                      <td className="py-2">Session</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-mono">df_account</td>
                      <td className="py-2">Selected account ID</td>
                      <td className="py-2">30 days</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Functional Cookies */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded">Functional</span>
                  <h3 className="font-semibold text-blue-900">Preference Cookies</h3>
                </div>
                <p className="text-blue-800 mb-3">
                  These cookies remember your preferences to enhance your experience.
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-blue-200">
                      <th className="text-left py-2 text-blue-900">Cookie</th>
                      <th className="text-left py-2 text-blue-900">Purpose</th>
                      <th className="text-left py-2 text-blue-900">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="text-blue-800">
                    <tr className="border-b border-blue-100">
                      <td className="py-2 font-mono">df_theme</td>
                      <td className="py-2">Dark/light mode preference</td>
                      <td className="py-2">1 year</td>
                    </tr>
                    <tr className="border-b border-blue-100">
                      <td className="py-2 font-mono">df_sidebar</td>
                      <td className="py-2">Sidebar collapsed state</td>
                      <td className="py-2">30 days</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-mono">df_filters</td>
                      <td className="py-2">Saved filter preferences</td>
                      <td className="py-2">30 days</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Analytics Cookies */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-purple-500 text-white text-xs px-2 py-0.5 rounded">Analytics</span>
                  <h3 className="font-semibold text-purple-900">Analytics Cookies</h3>
                </div>
                <p className="text-purple-800 mb-3">
                  These cookies help us understand how visitors interact with our website.
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-purple-200">
                      <th className="text-left py-2 text-purple-900">Cookie</th>
                      <th className="text-left py-2 text-purple-900">Purpose</th>
                      <th className="text-left py-2 text-purple-900">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="text-purple-800">
                    <tr className="border-b border-purple-100">
                      <td className="py-2 font-mono">df_analytics</td>
                      <td className="py-2">Page views, feature usage</td>
                      <td className="py-2">1 year</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-mono">df_session_id</td>
                      <td className="py-2">Anonymous session tracking</td>
                      <td className="py-2">Session</td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-purple-700 text-sm mt-3 italic">
                  Note: We do NOT use Google Analytics or any third-party tracking services.
                </p>
              </div>
            </section>

            {/* What We DON'T Do */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-amber-600" />
                3. What We DON'T Do With Cookies
              </h2>
              <div className="bg-gray-50 rounded-lg p-6 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-red-500 font-bold">✗</span>
                  <span>We do NOT use advertising or retargeting cookies</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-red-500 font-bold">✗</span>
                  <span>We do NOT track you across other websites</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-red-500 font-bold">✗</span>
                  <span>We do NOT sell cookie data to third parties</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-red-500 font-bold">✗</span>
                  <span>We do NOT use cookies for behavioral profiling</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-red-500 font-bold">✗</span>
                  <span>We do NOT share analytics with advertisers</span>
                </div>
              </div>
            </section>

            {/* Chrome Extension */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">4. Chrome Extension & Cookies</h2>
              <p className="mb-4">
                Our Chrome extension does NOT set its own cookies. However:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>The extension uses browser local storage to store your authentication state</li>
                <li>The extension accesses Facebook's cookies only to perform authorized actions on your behalf</li>
                <li>No cookie data from Facebook is transmitted to DealersFace servers</li>
              </ul>
            </section>

            {/* Managing Cookies */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <ToggleLeft className="h-5 w-5 text-amber-600" />
                5. Managing Cookies
              </h2>
              <p className="mb-4">
                You can control and/or delete cookies as you wish. You can delete all cookies that are 
                already on your computer and set most browsers to prevent them from being placed.
              </p>
              <h3 className="font-semibold text-gray-900 mt-6 mb-3">Browser Cookie Settings</h3>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li><strong>Chrome:</strong> Settings → Privacy and security → Cookies and other site data</li>
                <li><strong>Firefox:</strong> Settings → Privacy & Security → Cookies and Site Data</li>
                <li><strong>Safari:</strong> Preferences → Privacy → Manage Website Data</li>
                <li><strong>Edge:</strong> Settings → Cookies and site permissions → Cookies and site data</li>
              </ul>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-amber-800">
                  <strong>Note:</strong> If you disable essential cookies, you will not be able to log in 
                  or use the DealersFace platform. The Service requires cookies to function.
                </p>
              </div>
            </section>

            {/* Third-Party Cookies */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">6. Third-Party Cookies</h2>
              <p className="mb-4">
                We minimize the use of third-party services that set cookies. Currently:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Facebook:</strong> When you connect your Facebook account, Facebook may set 
                cookies for authentication purposes. These are governed by Facebook's Cookie Policy.</li>
                <li><strong>Payment Processor:</strong> If you use a paid plan, our payment processor may 
                set cookies for transaction security.</li>
              </ul>
            </section>

            {/* Updates */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">7. Updates to This Policy</h2>
              <p>
                We may update this Cookie Policy from time to time to reflect changes in our practices or 
                for other operational, legal, or regulatory reasons. We will post any changes on this page 
                and update the "Last updated" date.
              </p>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Mail className="h-5 w-5 text-amber-600" />
                8. Contact Us
              </h2>
              <p className="mb-4">
                If you have questions about our use of cookies, please contact us:
              </p>
              <div className="bg-gray-50 rounded-lg p-6">
                <p><strong>DealersFace</strong></p>
                <p>Email: <a href="mailto:privacy@dealersface.com" className="text-amber-600 hover:underline">privacy@dealersface.com</a></p>
                <p>Website: <a href="https://dealersface.com" className="text-amber-600 hover:underline">https://dealersface.com</a></p>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8">
        <div className="max-w-4xl mx-auto px-4 text-center text-gray-500 text-sm">
          <p>© {new Date().getFullYear()} DealersFace. All rights reserved.</p>
          <div className="flex justify-center gap-6 mt-4">
            <Link to="/privacy" className="hover:text-amber-600">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-amber-600">Terms of Service</Link>
            <Link to="/cookies" className="hover:text-amber-600">Cookie Policy</Link>
            <Link to="/dmca" className="hover:text-amber-600">DMCA</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
