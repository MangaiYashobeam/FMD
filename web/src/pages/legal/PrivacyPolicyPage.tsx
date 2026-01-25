import { Link } from 'react-router-dom';
import { Shield, ArrowLeft, Lock, Eye, Database, Trash2, UserCheck, Mail } from 'lucide-react';
import { DealersFaceIcon } from '../../components/ui/Logo';

export default function PrivacyPolicyPage() {
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
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <Shield className="h-8 w-8 text-blue-600" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
            <p className="text-gray-500">Last updated: {lastUpdated}</p>
          </div>

          {/* Quick Summary */}
          <div className="bg-blue-50 rounded-xl p-6 mb-10">
            <h2 className="font-semibold text-blue-900 mb-3">🔒 Privacy at a Glance</h2>
            <ul className="space-y-2 text-blue-800">
              <li>• We only collect data necessary to provide our service</li>
              <li>• Your inventory data stays in your control</li>
              <li>• We never sell your personal information</li>
              <li>• You can request data deletion at any time</li>
              <li>• Our Chrome extension only accesses Facebook when you activate it</li>
            </ul>
          </div>

          {/* Sections */}
          <div className="space-y-10 text-gray-700">
            {/* Introduction */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Eye className="h-5 w-5 text-blue-600" />
                1. Introduction
              </h2>
              <p className="mb-4">
                DealersFace ("we," "our," or "us") operates the dealersface.com website and the DealersFace 
                Chrome browser extension (collectively, the "Service"). This Privacy Policy explains how we 
                collect, use, disclose, and safeguard your information when you use our Service.
              </p>
              <p>
                We are committed to protecting your privacy and being transparent about our data practices. 
                This policy applies to all users of our dealership management platform, including those who 
                use our Chrome extension to manage Facebook Marketplace listings.
              </p>
            </section>

            {/* Information We Collect */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-600" />
                2. Information We Collect
              </h2>
              
              <h3 className="font-semibold text-gray-900 mt-6 mb-3">2.1 Account Information</h3>
              <p className="mb-4">When you create an account, we collect:</p>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li>Email address (for account authentication and notifications)</li>
                <li>Name (for personalization)</li>
                <li>Dealership name and business information</li>
                <li>Password (stored encrypted, never in plain text)</li>
              </ul>

              <h3 className="font-semibold text-gray-900 mt-6 mb-3">2.2 Vehicle Inventory Data</h3>
              <p className="mb-4">To provide our core service, we process:</p>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li>Vehicle details (VIN, make, model, year, price, mileage, photos)</li>
                <li>Inventory files uploaded via FTP or manual import</li>
                <li>Facebook Marketplace listing data</li>
              </ul>

              <h3 className="font-semibold text-gray-900 mt-6 mb-3">2.3 Chrome Extension Data</h3>
              <p className="mb-4">Our Chrome extension operates with transparency:</p>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li>The extension ONLY activates on facebook.com domains</li>
                <li>We access Marketplace pages to facilitate vehicle posting</li>
                <li>We capture Facebook conversation data ONLY with your explicit action</li>
                <li>We DO NOT access your personal Facebook messages, photos, or profile</li>
                <li>We DO NOT track your browsing on any non-Facebook websites</li>
              </ul>

              <h3 className="font-semibold text-gray-900 mt-6 mb-3">2.4 Lead & Customer Data</h3>
              <p className="mb-4">When processing leads:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>We collect buyer inquiries from Facebook Marketplace</li>
                <li>Customer contact information (name, email, phone) when provided</li>
                <li>Conversation history for lead management purposes</li>
                <li>This data is used ONLY to help you manage sales leads</li>
              </ul>
            </section>

            {/* How We Use Information */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-blue-600" />
                3. How We Use Your Information
              </h2>
              <p className="mb-4">We use collected information to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide, maintain, and improve our Service</li>
                <li>Post and manage your vehicle listings on Facebook Marketplace</li>
                <li>Sync inventory from your DMS/FTP server</li>
                <li>Capture and organize sales leads</li>
                <li>Send ADF/XML leads to your CRM system</li>
                <li>Send service notifications and updates</li>
                <li>Provide customer support</li>
                <li>Analyze usage to improve our platform</li>
              </ul>
            </section>

            {/* Data Sharing */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Lock className="h-5 w-5 text-blue-600" />
                4. Data Sharing & Third Parties
              </h2>
              <p className="mb-4">
                <strong>We do NOT sell your personal information.</strong> We may share data only in these circumstances:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Facebook:</strong> To post listings on your behalf (you authorize this via browser session)</li>
                <li><strong>Your CRM:</strong> When you configure ADF lead delivery</li>
                <li><strong>Service Providers:</strong> Hosting (Railway), email (AWS SES), database services</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect rights</li>
              </ul>
            </section>

            {/* Data Security */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                5. Data Security
              </h2>
              <p className="mb-4">We implement industry-standard security measures:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>All data transmitted via HTTPS/TLS encryption</li>
                <li>Passwords are hashed using bcrypt</li>
                <li>Database encryption at rest</li>
                <li>Regular security audits and updates</li>
                <li>Role-based access control for team members</li>
                <li>Session tokens with automatic expiration</li>
              </ul>
            </section>

            {/* Data Retention */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-blue-600" />
                6. Data Retention & Deletion
              </h2>
              <p className="mb-4">
                We retain your data only as long as necessary to provide our Service:
              </p>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li>Account data: Until you delete your account</li>
                <li>Inventory data: While your account is active</li>
                <li>Lead data: As configured in your account settings</li>
                <li>Logs: 90 days for security and debugging</li>
              </ul>
              <p>
                <strong>Your Rights:</strong> You can request complete deletion of your data at any time by 
                contacting us at <a href="mailto:privacy@dealersface.com" className="text-blue-600 hover:underline">privacy@dealersface.com</a> or 
                using the data deletion option in your account settings.
              </p>
            </section>

            {/* Your Rights */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">7. Your Privacy Rights</h2>
              <p className="mb-4">Depending on your location, you may have the right to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Access:</strong> Request a copy of your personal data</li>
                <li><strong>Rectification:</strong> Correct inaccurate data</li>
                <li><strong>Deletion:</strong> Request deletion of your data</li>
                <li><strong>Portability:</strong> Receive your data in a portable format</li>
                <li><strong>Withdraw Consent:</strong> Revoke previously granted permissions</li>
              </ul>
            </section>

            {/* Chrome Extension Specific */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">8. Chrome Extension Transparency</h2>
              <p className="mb-4">
                Our Chrome extension is designed with privacy in mind:
              </p>
              <div className="bg-gray-50 rounded-lg p-6 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-green-500 font-bold">✓</span>
                  <span>Only activates on facebook.com/marketplace pages</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-green-500 font-bold">✓</span>
                  <span>Requires your explicit action to capture any data</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-green-500 font-bold">✓</span>
                  <span>Does not run in the background</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-green-500 font-bold">✓</span>
                  <span>Does not access your personal Facebook content</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-red-500 font-bold">✗</span>
                  <span>Does NOT track browsing history</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-red-500 font-bold">✗</span>
                  <span>Does NOT collect data from other websites</span>
                </div>
              </div>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-600" />
                9. Contact Us
              </h2>
              <p className="mb-4">
                If you have questions about this Privacy Policy or our data practices, please contact us:
              </p>
              <div className="bg-gray-50 rounded-lg p-6">
                <p><strong>DealersFace</strong></p>
                <p>Email: <a href="mailto:privacy@dealersface.com" className="text-blue-600 hover:underline">privacy@dealersface.com</a></p>
                <p>Website: <a href="https://dealersface.com" className="text-blue-600 hover:underline">https://dealersface.com</a></p>
              </div>
            </section>

            {/* Updates */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">10. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any material changes 
                by posting the new policy on this page and updating the "Last updated" date. We encourage you 
                to review this Privacy Policy periodically.
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8">
        <div className="max-w-4xl mx-auto px-4 text-center text-gray-500 text-sm">
          <p>© {new Date().getFullYear()} DealersFace. All rights reserved.</p>
          <div className="flex justify-center gap-6 mt-4">
            <Link to="/privacy" className="hover:text-blue-600">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-blue-600">Terms of Service</Link>
            <Link to="/cookies" className="hover:text-blue-600">Cookie Policy</Link>
            <Link to="/dmca" className="hover:text-blue-600">DMCA</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
