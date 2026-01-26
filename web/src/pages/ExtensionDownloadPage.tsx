/**
 * ============================================
 * FaceMyDealer - Extension Download Page
 * ============================================
 * 
 * Page for users to download and install the Chrome extension
 * Shows installation instructions based on user type (Admin vs User)
 */

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  Chrome,
  Shield,
  Zap,
  CheckCircle,
  ExternalLink,
  Settings,
  User,
  Crown,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Copy,
  Check
} from 'lucide-react';
import toast from 'react-hot-toast';

type UserType = 'admin' | 'user';

interface InstallStep {
  title: string;
  description: string;
  note?: string;
}

const adminSteps: InstallStep[] = [
  {
    title: 'Download Extension',
    description: 'Click the download button below to get the FaceMyDealer extension package (.zip file).',
  },
  {
    title: 'Extract the ZIP',
    description: 'Unzip the downloaded file to a permanent location on your computer (e.g., C:\\FaceMyDealer\\extension).',
    note: "Don't delete this folder - Chrome needs it to run the extension."
  },
  {
    title: 'Open Chrome Extensions',
    description: 'Navigate to chrome://extensions in your Chrome browser, or click Menu → More Tools → Extensions.',
  },
  {
    title: 'Enable Developer Mode',
    description: 'Toggle ON the "Developer mode" switch in the top right corner of the extensions page.',
  },
  {
    title: 'Load Unpacked Extension',
    description: 'Click "Load unpacked" button and select the extracted extension folder.',
  },
  {
    title: 'Pin Extension',
    description: 'Click the puzzle piece icon (Extensions) in Chrome toolbar and pin FaceMyDealer for easy access.',
  },
  {
    title: 'Login & Configure',
    description: 'Click the extension icon and login with your FaceMyDealer admin credentials to configure settings.',
  },
];

const userSteps: InstallStep[] = [
  {
    title: 'Get Extension from Admin',
    description: 'Ask your account administrator to send you the FaceMyDealer extension package (.zip file).',
  },
  {
    title: 'Extract the ZIP',
    description: 'Unzip the received file to a folder on your computer (e.g., Documents\\FaceMyDealer).',
    note: "Don't delete this folder - Chrome needs it to run the extension."
  },
  {
    title: 'Open Chrome Extensions',
    description: 'Type chrome://extensions in your Chrome address bar and press Enter.',
  },
  {
    title: 'Enable Developer Mode',
    description: 'Toggle ON the "Developer mode" switch in the top right corner.',
  },
  {
    title: 'Load Extension',
    description: 'Click "Load unpacked" and select your extracted extension folder.',
  },
  {
    title: 'Login',
    description: 'Click the FaceMyDealer icon in Chrome toolbar and login with your credentials.',
  },
];

export function ExtensionDownloadPage() {
  const { user, accountUser } = useAuth();
  const [userType, setUserType] = useState<UserType>(
    accountUser?.role === 'SUPER_ADMIN' || accountUser?.role === 'ACCOUNT_OWNER' || accountUser?.role === 'ADMIN' 
      ? 'admin' 
      : 'user'
  );
  const [expandedStep, setExpandedStep] = useState<number | null>(0);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const steps = userType === 'admin' ? adminSteps : userSteps;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedText(null), 2000);
  };

  const features = [
    { icon: <Zap className="w-5 h-5" />, title: 'AI-Powered Posting', description: 'Automatically post vehicles to Facebook Marketplace with intelligent descriptions.' },
    { icon: <Shield className="w-5 h-5" />, title: 'Secure Connection', description: 'End-to-end encrypted communication with FaceMyDealer servers.' },
    { icon: <Settings className="w-5 h-5" />, title: 'Easy Configuration', description: 'Simple setup process with guided configuration wizard.' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-3xl mb-6">
            <Chrome className="w-16 h-16 text-blue-400" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Install FaceMyDealer Extension
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Download and install our Chrome extension to enable AI-powered Facebook Marketplace posting and lead capture.
          </p>
        </motion.div>

        {/* User Type Toggle */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center mb-8"
        >
          <div className="inline-flex bg-gray-800/50 rounded-xl p-1 border border-gray-700">
            <button
              onClick={() => setUserType('admin')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-all ${
                userType === 'admin'
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Crown className="w-4 h-4" />
              Admin Setup
            </button>
            <button
              onClick={() => setUserType('user')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-all ${
                userType === 'user'
                  ? 'bg-gradient-to-r from-green-600 to-teal-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <User className="w-4 h-4" />
              User Setup
            </button>
          </div>
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Download Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-1"
          >
            <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-6 sticky top-8">
              <h2 className="text-xl font-semibold text-white mb-4">
                {userType === 'admin' ? 'Download Extension' : 'Get Extension'}
              </h2>
              
              {userType === 'admin' ? (
                <>
                  <p className="text-gray-400 text-sm mb-6">
                    Download the latest version of the FaceMyDealer Chrome extension for your team.
                  </p>
                  
                  <a
                    href="/api/extension/download"
                    className="flex items-center justify-center gap-2 w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl"
                  >
                    <Download className="w-5 h-5" />
                    Download Extension
                  </a>
                  
                  <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <p className="text-blue-400 text-xs">
                      <strong>Tip:</strong> After downloading, you can distribute this to your team members or host it on your internal network.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-gray-400 text-sm mb-6">
                    Contact your administrator to receive the extension package.
                  </p>
                  
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <div className="flex gap-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-yellow-400 text-sm font-medium">Admin Required</p>
                        <p className="text-yellow-400/70 text-xs mt-1">
                          The extension must be provided by your account administrator for security reasons.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Quick Links */}
              <div className="mt-6 pt-6 border-t border-gray-700">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Quick Links</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => copyToClipboard('chrome://extensions')}
                    className="flex items-center gap-2 w-full p-2 text-left text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors text-sm"
                  >
                    {copiedText === 'chrome://extensions' ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    chrome://extensions
                  </button>
                  <a
                    href="https://support.google.com/chrome/answer/2693767"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 w-full p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Chrome Extension Help
                  </a>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Installation Steps */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2"
          >
            <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-6">
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-400" />
                Installation Steps
              </h2>

              <div className="space-y-3">
                {steps.map((step, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * index }}
                    className="border border-gray-700 rounded-xl overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedStep(expandedStep === index ? null : index)}
                      className="flex items-center gap-4 w-full p-4 text-left hover:bg-gray-700/30 transition-colors"
                    >
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                        expandedStep === index 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-700 text-gray-400'
                      }`}>
                        {index + 1}
                      </div>
                      <span className="flex-1 font-medium text-white">{step.title}</span>
                      {expandedStep === index ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                    
                    <AnimatePresence>
                      {expandedStep === index && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 pl-16">
                            <p className="text-gray-400 text-sm">{step.description}</p>
                            {step.note && (
                              <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                                <p className="text-yellow-400 text-xs">
                                  <strong>Note:</strong> {step.note}
                                </p>
                              </div>
                            )}
                            {index < steps.length - 1 && (
                              <button
                                onClick={() => setExpandedStep(index + 1)}
                                className="mt-3 flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm"
                              >
                                Next step <ArrowRight className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>

              {/* Success Note */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl"
              >
                <div className="flex gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-green-400 font-medium">You're all set!</p>
                    <p className="text-green-400/70 text-sm mt-1">
                      Once installed, click the FaceMyDealer icon in your Chrome toolbar to get started.
                      The extension will guide you through initial setup.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Features Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="mt-8 grid sm:grid-cols-3 gap-4"
            >
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4 hover:border-blue-500/30 transition-colors"
                >
                  <div className="text-blue-400 mb-3">{feature.icon}</div>
                  <h3 className="text-white font-medium mb-1">{feature.title}</h3>
                  <p className="text-gray-500 text-sm">{feature.description}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>

        {/* Help Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-12 text-center"
        >
          <p className="text-gray-500">
            Need help? Contact support at{' '}
            <a href="mailto:support@facemydealer.com" className="text-blue-400 hover:text-blue-300">
              support@facemydealer.com
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

export default ExtensionDownloadPage;
