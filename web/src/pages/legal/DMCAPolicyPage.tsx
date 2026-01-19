import { Link } from 'react-router-dom';
import { Copyright, ArrowLeft, AlertTriangle, FileText, CheckCircle, Mail, Clock } from 'lucide-react';
import { DealersFaceIcon } from '../../components/ui/Logo';

export default function DMCAPolicyPage() {
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
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <Copyright className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">DMCA Policy</h1>
            <p className="text-lg text-gray-600">Digital Millennium Copyright Act Notice</p>
            <p className="text-gray-500 mt-2">Last updated: {lastUpdated}</p>
          </div>

          {/* Sections */}
          <div className="space-y-10 text-gray-700">
            {/* Overview */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">1. Overview</h2>
              <p className="mb-4">
                DealersFace respects the intellectual property rights of others and expects users of our 
                Service to do the same. In accordance with the Digital Millennium Copyright Act of 1998 
                ("DMCA"), we will respond promptly to claims of copyright infringement committed using 
                our Service.
              </p>
              <p>
                If you believe that content hosted on DealersFace infringes your copyright, please follow 
                the procedures outlined below to submit a DMCA takedown notice.
              </p>
            </section>

            {/* What This Policy Covers */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-red-600" />
                2. What This Policy Covers
              </h2>
              <p className="mb-4">This DMCA policy applies to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Vehicle photos uploaded by users to our platform</li>
                <li>Vehicle descriptions and listing content</li>
                <li>Any other user-generated content hosted on dealersface.com</li>
              </ul>
            </section>

            {/* Filing a DMCA Notice */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                3. Filing a DMCA Takedown Notice
              </h2>
              <p className="mb-4">
                If you believe that material on our Service infringes your copyright, you may submit a 
                written notification pursuant to the DMCA. Your notice must include:
              </p>
              
              <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <span className="bg-red-100 text-red-600 rounded-full w-6 h-6 flex items-center justify-center font-semibold text-sm flex-shrink-0">1</span>
                  <div>
                    <p className="font-semibold text-gray-900">Physical or Electronic Signature</p>
                    <p className="text-gray-600">A physical or electronic signature of the copyright owner or a person authorized to act on their behalf.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <span className="bg-red-100 text-red-600 rounded-full w-6 h-6 flex items-center justify-center font-semibold text-sm flex-shrink-0">2</span>
                  <div>
                    <p className="font-semibold text-gray-900">Identification of Copyrighted Work</p>
                    <p className="text-gray-600">Identification of the copyrighted work claimed to have been infringed.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <span className="bg-red-100 text-red-600 rounded-full w-6 h-6 flex items-center justify-center font-semibold text-sm flex-shrink-0">3</span>
                  <div>
                    <p className="font-semibold text-gray-900">Identification of Infringing Material</p>
                    <p className="text-gray-600">Identification of the material that is claimed to be infringing and information sufficient to locate the material (e.g., URL links).</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <span className="bg-red-100 text-red-600 rounded-full w-6 h-6 flex items-center justify-center font-semibold text-sm flex-shrink-0">4</span>
                  <div>
                    <p className="font-semibold text-gray-900">Contact Information</p>
                    <p className="text-gray-600">Your address, telephone number, and email address.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <span className="bg-red-100 text-red-600 rounded-full w-6 h-6 flex items-center justify-center font-semibold text-sm flex-shrink-0">5</span>
                  <div>
                    <p className="font-semibold text-gray-900">Good Faith Statement</p>
                    <p className="text-gray-600">A statement that you have a good faith belief that use of the material is not authorized by the copyright owner, its agent, or the law.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <span className="bg-red-100 text-red-600 rounded-full w-6 h-6 flex items-center justify-center font-semibold text-sm flex-shrink-0">6</span>
                  <div>
                    <p className="font-semibold text-gray-900">Accuracy Statement</p>
                    <p className="text-gray-600">A statement, under penalty of perjury, that the information in the notification is accurate, and that you are authorized to act on behalf of the copyright owner.</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Designated Agent */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Mail className="h-5 w-5 text-red-600" />
                4. Designated DMCA Agent
              </h2>
              <p className="mb-4">
                DMCA notices should be sent to our designated Copyright Agent:
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <p className="font-semibold text-red-900">DealersFace Copyright Agent</p>
                <p className="text-red-800 mt-2">
                  Email: <a href="mailto:dmca@dealersface.com" className="underline">dmca@dealersface.com</a>
                </p>
                <p className="text-red-800">
                  Subject Line: DMCA Takedown Notice
                </p>
              </div>
            </section>

            {/* Counter-Notification */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-red-600" />
                5. Counter-Notification
              </h2>
              <p className="mb-4">
                If you believe that your content was removed or disabled by mistake or misidentification, 
                you may submit a counter-notification. Your counter-notification must include:
              </p>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li>Your physical or electronic signature</li>
                <li>Identification of the material that was removed and its location before removal</li>
                <li>A statement under penalty of perjury that you have a good faith belief the material was removed due to mistake or misidentification</li>
                <li>Your name, address, telephone number, and email address</li>
                <li>A statement consenting to jurisdiction of federal court in your district and that you will accept service of process from the party who submitted the takedown notice</li>
              </ul>
              <p>
                Upon receipt of a valid counter-notification, we will forward it to the original complainant. 
                If we do not receive notice within 10-14 business days that the complainant is seeking a 
                court order, we may restore the removed material.
              </p>
            </section>

            {/* Repeat Infringers */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">6. Repeat Infringers</h2>
              <p className="mb-4">
                In accordance with the DMCA and other applicable laws, DealersFace has adopted a policy of 
                terminating, in appropriate circumstances, users who are deemed to be repeat infringers.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-amber-800">
                  <strong>Warning:</strong> DealersFace may also, at its sole discretion, limit access to 
                  the Service and/or terminate the accounts of any users who infringe any intellectual 
                  property rights of others, whether or not there is any repeat infringement.
                </p>
              </div>
            </section>

            {/* Response Timeline */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-red-600" />
                7. Response Timeline
              </h2>
              <p className="mb-4">Upon receiving a valid DMCA notice, we will:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Within 24-48 hours:</strong> Acknowledge receipt of the notice</li>
                <li><strong>Within 5 business days:</strong> Remove or disable access to the allegedly infringing material</li>
                <li><strong>Promptly:</strong> Notify the user who posted the content</li>
              </ul>
            </section>

            {/* False Claims */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">8. False Claims Warning</h2>
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <p className="text-red-800 mb-3">
                  <strong>⚠️ Warning:</strong> Under Section 512(f) of the DMCA, any person who knowingly 
                  materially misrepresents that material or activity is infringing may be subject to liability.
                </p>
                <p className="text-red-800">
                  Please carefully consider whether the material actually infringes your copyright before 
                  filing a DMCA notice. If you are not sure whether the material infringes your rights, 
                  we recommend seeking legal advice before submitting a notice.
                </p>
              </div>
            </section>

            {/* Modifications */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">9. Modifications</h2>
              <p>
                DealersFace reserves the right to modify, suspend, or discontinue this DMCA Policy at any time. 
                Changes will be effective immediately upon posting to this page. Your continued use of the 
                Service after changes are posted constitutes your acceptance of the modified policy.
              </p>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">10. Contact Information</h2>
              <p className="mb-4">
                For questions about this DMCA Policy (not for filing notices), please contact us:
              </p>
              <div className="bg-gray-50 rounded-lg p-6">
                <p><strong>DealersFace</strong></p>
                <p>Email: <a href="mailto:legal@dealersface.com" className="text-red-600 hover:underline">legal@dealersface.com</a></p>
                <p>DMCA Notices: <a href="mailto:dmca@dealersface.com" className="text-red-600 hover:underline">dmca@dealersface.com</a></p>
                <p>Website: <a href="https://dealersface.com" className="text-red-600 hover:underline">https://dealersface.com</a></p>
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
            <Link to="/privacy" className="hover:text-red-600">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-red-600">Terms of Service</Link>
            <Link to="/cookies" className="hover:text-red-600">Cookie Policy</Link>
            <Link to="/dmca" className="hover:text-red-600">DMCA</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
