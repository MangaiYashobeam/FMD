import { Link } from 'react-router-dom';
import { FileText, ArrowLeft, Scale, AlertTriangle, CreditCard, XCircle, Shield, Mail } from 'lucide-react';
import { DealersFaceIcon } from '../../components/ui/Logo';

export default function TermsOfServicePage() {
  const lastUpdated = 'January 19, 2026';
  const effectiveDate = 'January 19, 2026';

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
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
              <FileText className="h-8 w-8 text-purple-600" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Terms of Service</h1>
            <p className="text-gray-500">Last updated: {lastUpdated}</p>
            <p className="text-gray-500">Effective: {effectiveDate}</p>
          </div>

          {/* Agreement Notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-10">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="font-semibold text-amber-900 mb-2">Important Agreement</h2>
                <p className="text-amber-800">
                  By accessing or using DealersFace, you agree to be bound by these Terms of Service. 
                  If you disagree with any part of these terms, you may not access the Service.
                </p>
              </div>
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-10 text-gray-700">
            {/* Definitions */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">1. Definitions</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>"Service"</strong> refers to the DealersFace website (dealersface.com) and Chrome browser extension</li>
                <li><strong>"User," "You," "Your"</strong> refers to the individual or entity accessing the Service</li>
                <li><strong>"We," "Us," "Our"</strong> refers to DealersFace</li>
                <li><strong>"Account"</strong> refers to your registered user account</li>
                <li><strong>"Content"</strong> refers to vehicle listings, images, text, and other materials</li>
              </ul>
            </section>

            {/* Description of Service */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Scale className="h-5 w-5 text-purple-600" />
                2. Description of Service
              </h2>
              <p className="mb-4">DealersFace provides:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Automotive inventory management tools</li>
                <li>Integration with Facebook Marketplace for vehicle listings</li>
                <li>Chrome browser extension for Facebook Marketplace automation</li>
                <li>Lead capture and management from Facebook inquiries</li>
                <li>DMS/FTP inventory synchronization</li>
                <li>ADF/XML lead delivery to CRM systems</li>
                <li>Analytics and reporting tools</li>
              </ul>
            </section>

            {/* Account Terms */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">3. Account Terms</h2>
              <h3 className="font-semibold text-gray-900 mt-6 mb-3">3.1 Registration</h3>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li>You must provide accurate, complete registration information</li>
                <li>You must be at least 18 years old to use this Service</li>
                <li>You are responsible for maintaining the security of your account credentials</li>
                <li>One person or entity may not maintain more than one account without permission</li>
              </ul>

              <h3 className="font-semibold text-gray-900 mt-6 mb-3">3.2 Account Security</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>You are responsible for all activity under your account</li>
                <li>You must notify us immediately of any unauthorized access</li>
                <li>We are not liable for any loss due to unauthorized account access</li>
              </ul>
            </section>

            {/* Acceptable Use */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-purple-600" />
                4. Acceptable Use Policy
              </h2>
              <p className="mb-4">You agree NOT to use the Service to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Violate any laws or regulations</li>
                <li>Post fraudulent, misleading, or deceptive listings</li>
                <li>Infringe on intellectual property rights of others</li>
                <li>Transmit malware, viruses, or harmful code</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Scrape, crawl, or collect data from our Service without permission</li>
                <li>Interfere with or disrupt the Service</li>
                <li>Violate Facebook's Terms of Service</li>
                <li>Post vehicles you do not have authorization to sell</li>
                <li>Engage in price manipulation or bait-and-switch tactics</li>
              </ul>
            </section>

            {/* Facebook Integration */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">5. Facebook Integration</h2>
              <p className="mb-4">Our Service integrates with Facebook Marketplace. By using this integration, you acknowledge:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>You authorize us to post listings on Facebook on your behalf</li>
                <li>You must comply with Facebook's Terms of Service and Commerce Policies</li>
                <li>We are not responsible for Facebook's actions (suspensions, content removal, etc.)</li>
                <li>Facebook may change their policies at any time, which may affect our Service</li>
                <li>You are responsible for ensuring your listings comply with Facebook's policies</li>
              </ul>
            </section>

            {/* Chrome Extension */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">6. Chrome Extension Terms</h2>
              <p className="mb-4">The DealersFace Chrome extension is subject to additional terms:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>The extension requires permissions to interact with facebook.com</li>
                <li>You grant us permission to automate actions on Facebook on your behalf</li>
                <li>You are responsible for all actions taken by the extension while logged into your Facebook account</li>
                <li>We are not liable for any consequences from Facebook due to extension usage</li>
                <li>You must keep the extension updated to the latest version</li>
              </ul>
            </section>

            {/* Payment Terms */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-purple-600" />
                7. Payment Terms
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Paid plans are billed in advance on a monthly or annual basis</li>
                <li>All fees are non-refundable except as required by law</li>
                <li>We may change pricing with 30 days notice</li>
                <li>Failure to pay may result in account suspension</li>
                <li>You are responsible for all applicable taxes</li>
              </ul>
            </section>

            {/* Intellectual Property */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">8. Intellectual Property</h2>
              <h3 className="font-semibold text-gray-900 mt-6 mb-3">8.1 Our Property</h3>
              <p className="mb-4">
                The Service, including its original content, features, and functionality, is owned by DealersFace 
                and protected by international copyright, trademark, and other intellectual property laws.
              </p>

              <h3 className="font-semibold text-gray-900 mt-6 mb-3">8.2 Your Content</h3>
              <p className="mb-4">
                You retain ownership of content you upload (vehicle photos, descriptions, etc.). By uploading 
                content, you grant us a license to use, display, and distribute it as necessary to provide the Service.
              </p>

              <h3 className="font-semibold text-gray-900 mt-6 mb-3">8.3 Your Responsibility</h3>
              <p>
                You represent that you have the right to upload all content and that it does not infringe on 
                any third party's intellectual property rights.
              </p>
            </section>

            {/* Termination */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <XCircle className="h-5 w-5 text-purple-600" />
                9. Termination
              </h2>
              <p className="mb-4">
                We may terminate or suspend your account immediately, without prior notice, for:
              </p>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li>Breach of these Terms</li>
                <li>Fraudulent or illegal activity</li>
                <li>Violation of Facebook's policies</li>
                <li>Non-payment of fees</li>
                <li>At our sole discretion for any reason</li>
              </ul>
              <p>
                Upon termination, your right to use the Service ceases immediately. You may request 
                export of your data within 30 days of termination.
              </p>
            </section>

            {/* Disclaimers */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">10. Disclaimers</h2>
              <div className="bg-gray-50 rounded-lg p-6">
                <p className="uppercase font-semibold text-gray-900 mb-3">
                  THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND.
                </p>
                <ul className="list-disc pl-6 space-y-2 text-gray-700">
                  <li>We do not guarantee uninterrupted or error-free service</li>
                  <li>We are not responsible for third-party services (Facebook, DMS systems, etc.)</li>
                  <li>We do not guarantee any specific results from using the Service</li>
                  <li>We are not liable for lost sales, leads, or business opportunities</li>
                </ul>
              </div>
            </section>

            {/* Limitation of Liability */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">11. Limitation of Liability</h2>
              <p className="mb-4">
                To the maximum extent permitted by law, DealersFace shall not be liable for any indirect, 
                incidental, special, consequential, or punitive damages, including without limitation:
              </p>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li>Loss of profits or revenue</li>
                <li>Loss of data or goodwill</li>
                <li>Service interruption</li>
                <li>Computer damage or system failure</li>
              </ul>
              <p>
                Our total liability shall not exceed the amount you paid us in the twelve (12) months 
                preceding the claim.
              </p>
            </section>

            {/* Indemnification */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">12. Indemnification</h2>
              <p>
                You agree to indemnify, defend, and hold harmless DealersFace and its officers, directors, 
                employees, and agents from any claims, damages, losses, liabilities, and expenses (including 
                legal fees) arising from your use of the Service or violation of these Terms.
              </p>
            </section>

            {/* Governing Law */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">13. Governing Law</h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the United States. 
                Any disputes shall be resolved in the courts of competent jurisdiction.
              </p>
            </section>

            {/* Changes */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">14. Changes to Terms</h2>
              <p>
                We reserve the right to modify these Terms at any time. We will provide notice of material 
                changes by posting the new Terms on this page and updating the "Last updated" date. Continued 
                use of the Service after changes constitutes acceptance of the new Terms.
              </p>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Mail className="h-5 w-5 text-purple-600" />
                15. Contact Us
              </h2>
              <p className="mb-4">
                If you have questions about these Terms of Service, please contact us:
              </p>
              <div className="bg-gray-50 rounded-lg p-6">
                <p><strong>DealersFace</strong></p>
                <p>Email: <a href="mailto:legal@dealersface.com" className="text-purple-600 hover:underline">legal@dealersface.com</a></p>
                <p>Website: <a href="https://dealersface.com" className="text-purple-600 hover:underline">https://dealersface.com</a></p>
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
            <Link to="/privacy" className="hover:text-purple-600">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-purple-600">Terms of Service</Link>
            <Link to="/cookies" className="hover:text-purple-600">Cookie Policy</Link>
            <Link to="/dmca" className="hover:text-purple-600">DMCA</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
