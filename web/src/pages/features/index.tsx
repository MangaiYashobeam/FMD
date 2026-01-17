/**
 * Feature Pages - Dealers Face
 * Rich content pages for each major feature with SEO optimization
 */

import { Link } from 'react-router-dom';
import { SEO } from '../../components/SEO';
import {
  Facebook,
  Database,
  Users,
  Mail,
  Chrome,
  BarChart3,
  CheckCircle,
  ArrowRight,
  Shield,
  Clock,
  Zap,
  Car,
  DollarSign,
  Target,
  Phone,
  MessageCircle,
  Settings,
  FileText,
  Upload,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';

// =================================================================
// SEO Schema Generator
// =================================================================

interface SchemaConfig {
  type: 'SoftwareApplication' | 'Product' | 'Service' | 'FAQPage';
  name: string;
  description: string;
  url: string;
  features?: string[];
  faqs?: { question: string; answer: string }[];
}

function generateSchema(config: SchemaConfig): object {
  const baseSchema = {
    '@context': 'https://schema.org',
  };

  if (config.type === 'SoftwareApplication') {
    return {
      ...baseSchema,
      '@type': 'SoftwareApplication',
      name: config.name,
      description: config.description,
      url: config.url,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      offers: {
        '@type': 'Offer',
        price: '699',
        priceCurrency: 'USD',
        priceValidUntil: '2027-12-31',
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.9',
        ratingCount: '847',
        bestRating: '5',
        worstRating: '1',
      },
      featureList: config.features?.join(', '),
    };
  }

  if (config.type === 'FAQPage' && config.faqs) {
    return {
      ...baseSchema,
      '@type': 'FAQPage',
      mainEntity: config.faqs.map(faq => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    };
  }

  return baseSchema;
}

// =================================================================
// Shared Components
// =================================================================

interface FeaturePageLayoutProps {
  metaTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  schema: object | object[];
  children: React.ReactNode;
}

function FeaturePageLayout({
  metaTitle,
  metaDescription,
  canonicalUrl,
  schema,
  children,
}: FeaturePageLayoutProps) {
  return (
    <>
      <SEO
        title={metaTitle}
        description={metaDescription}
        canonicalUrl={canonicalUrl}
        schema={schema}
        keywords="auto dealer software, Facebook Marketplace, car dealership automation, automotive marketing"
      />
      
      <div className="min-h-screen bg-white">
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link to="/" className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-lg">DF</span>
                </div>
                <span className="text-xl font-bold text-gray-900">
                  Dealers <span className="text-blue-600">Face</span>
                </span>
              </Link>
              
              <div className="hidden md:flex items-center space-x-8">
                <Link to="/features" className="text-gray-600 hover:text-blue-600">Features</Link>
                <Link to="/pricing" className="text-gray-600 hover:text-blue-600">Pricing</Link>
                <Link to="/markets" className="text-gray-600 hover:text-blue-600">Markets</Link>
                <Link to="/login" className="text-gray-600 hover:text-blue-600">Sign In</Link>
                <Link
                  to="/register"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
                >
                  Start Free Trial
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="pt-16">
          {children}
        </main>

        {/* Footer CTA */}
        <section className="py-20 bg-gradient-to-r from-blue-600 to-blue-800">
          <div className="max-w-4xl mx-auto text-center px-4">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Ready to Transform Your Dealership?
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              Join 2,500+ dealers already selling more cars with Dealers Face.
              Start your 14-day free trial today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="px-8 py-4 bg-white text-blue-600 font-bold rounded-xl hover:bg-gray-100 transition-all"
              >
                Start Free Trial
              </Link>
              <Link
                to="/contact"
                className="px-8 py-4 bg-transparent border-2 border-white text-white font-bold rounded-xl hover:bg-white/10 transition-all"
              >
                Schedule Demo
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-900 text-gray-400 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-4 gap-8">
              <div>
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                    <span className="text-white font-bold text-lg">DF</span>
                  </div>
                  <span className="text-xl font-bold text-white">Dealers Face</span>
                </div>
                <p className="text-sm">
                  The #1 Facebook Marketplace automation platform for auto dealers.
                </p>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-4">Features</h4>
                <ul className="space-y-2 text-sm">
                  <li><Link to="/features/facebook-marketplace" className="hover:text-white">Facebook Integration</Link></li>
                  <li><Link to="/features/dms-ftp-sync" className="hover:text-white">DMS/FTP Sync</Link></li>
                  <li><Link to="/features/multi-account" className="hover:text-white">Multi-Account</Link></li>
                  <li><Link to="/features/lead-management" className="hover:text-white">Lead Management</Link></li>
                  <li><Link to="/features/chrome-extension" className="hover:text-white">Chrome Extension</Link></li>
                  <li><Link to="/features/analytics" className="hover:text-white">Analytics</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-4">Markets</h4>
                <ul className="space-y-2 text-sm">
                  <li><Link to="/markets/california" className="hover:text-white">California</Link></li>
                  <li><Link to="/markets/texas" className="hover:text-white">Texas</Link></li>
                  <li><Link to="/markets/florida" className="hover:text-white">Florida</Link></li>
                  <li><Link to="/markets/new-york" className="hover:text-white">New York</Link></li>
                  <li><Link to="/markets" className="hover:text-white">View All States →</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-4">Contact</h4>
                <ul className="space-y-2 text-sm">
                  <li>support@dealersface.com</li>
                  <li>1-800-DEALERS</li>
                  <li>Mon-Fri 8am-8pm EST</li>
                </ul>
              </div>
            </div>
            <div className="border-t border-gray-800 mt-8 pt-8 text-sm text-center">
              © {new Date().getFullYear()} Dealers Face. All rights reserved.
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

// =================================================================
// Facebook Marketplace Integration Page
// =================================================================

export function FacebookMarketplacePage() {
  const schema = generateSchema({
    type: 'SoftwareApplication',
    name: 'Dealers Face - Facebook Marketplace Integration',
    description: 'Automatically post your entire vehicle inventory to Facebook Marketplace. Reach millions of local buyers instantly.',
    url: 'https://dealersface.com/features/facebook-marketplace',
    features: [
      'Automatic inventory posting',
      'Multi-account management',
      'Smart scheduling',
      'Lead capture integration',
      'Performance tracking',
    ],
  });

  const faqs = [
    {
      question: 'How does automatic posting to Facebook Marketplace work?',
      answer: 'Dealers Face connects to your inventory system and automatically creates optimized listings for each vehicle on Facebook Marketplace. Posts include professional photos, detailed descriptions, and pricing information.',
    },
    {
      question: 'Can I post to multiple Facebook accounts?',
      answer: 'Yes! Depending on your plan, you can manage 10, 25, or unlimited Facebook accounts from a single dashboard. Each account can post to different local markets.',
    },
    {
      question: 'How many vehicles can I post per day?',
      answer: 'There\'s no limit on vehicle postings. Our system intelligently schedules posts to maximize visibility while staying within Facebook\'s guidelines.',
    },
    {
      question: 'Do leads come directly to me?',
      answer: 'Yes, all buyer inquiries from Facebook Marketplace come directly to you through our platform, and can be automatically exported to your CRM via ADF format.',
    },
  ];

  const faqSchema = generateSchema({
    type: 'FAQPage',
    name: 'Facebook Marketplace FAQ',
    description: 'Frequently asked questions about Facebook Marketplace integration',
    url: 'https://dealersface.com/features/facebook-marketplace',
    faqs,
  });

  return (
    <FeaturePageLayout
      metaTitle="Facebook Marketplace Integration for Auto Dealers | Dealers Face"
      metaDescription="Automatically post your entire vehicle inventory to Facebook Marketplace. Reach millions of local buyers instantly. Used by 2,500+ dealerships nationwide."
      canonicalUrl="https://dealersface.com/features/facebook-marketplace"
      schema={[schema, faqSchema]}
    >
      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-6">
                <Facebook className="w-4 h-4 mr-2" />
                Facebook Marketplace Integration
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">
                Post Your Entire Inventory to{' '}
                <span className="text-blue-600">Facebook Marketplace</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Reach millions of local car buyers with one click. Automatically sync your 
                inventory, capture leads, and close more deals—all from a single dashboard.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/register"
                  className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-center"
                >
                  Start Free Trial
                </Link>
                <Link
                  to="/contact"
                  className="px-8 py-4 border-2 border-gray-300 text-gray-700 font-bold rounded-xl text-center hover:border-blue-600 hover:text-blue-600"
                >
                  Watch Demo
                </Link>
              </div>
              <div className="mt-8 flex items-center gap-8 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  14-day free trial
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  No credit card required
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="bg-white rounded-2xl shadow-2xl p-6">
                <img
                  src="/images/facebook-marketplace-demo.png"
                  alt="Facebook Marketplace integration dashboard"
                  className="rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: '2.9B+', label: 'Monthly Facebook Users' },
              { value: '2,500+', label: 'Active Dealerships' },
              { value: '500K+', label: 'Vehicles Posted Monthly' },
              { value: '45%', label: 'Average Lead Increase' },
            ].map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl font-extrabold text-blue-600">{stat.value}</div>
                <div className="text-gray-600 mt-2">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
              Everything You Need to Dominate Facebook Marketplace
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our comprehensive integration handles every aspect of Facebook Marketplace 
              selling, from posting to lead capture to analytics.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Zap,
                title: 'One-Click Posting',
                description: 'Post your entire inventory with a single click. Our AI optimizes titles, descriptions, and pricing for maximum engagement.',
              },
              {
                icon: RefreshCw,
                title: 'Auto-Sync Inventory',
                description: 'Connect your DMS or FTP feed and watch your Marketplace listings update automatically as inventory changes.',
              },
              {
                icon: Clock,
                title: 'Smart Scheduling',
                description: 'Posts are intelligently scheduled to go live when your target buyers are most active on Facebook.',
              },
              {
                icon: Target,
                title: 'Local Targeting',
                description: 'Reach buyers in your exact service area. Post to multiple locations to expand your reach.',
              },
              {
                icon: MessageCircle,
                title: 'Lead Capture',
                description: 'Every Messenger inquiry is captured, organized, and can be automatically exported to your CRM.',
              },
              {
                icon: BarChart3,
                title: 'Performance Analytics',
                description: 'Track views, clicks, and leads for every vehicle. Know exactly which listings perform best.',
              },
            ].map((feature, index) => (
              <div key={index} className="bg-white rounded-xl p-8 shadow-sm hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                  <feature.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600">Get started in minutes, not days</p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              {
                step: '1',
                title: 'Connect Your Inventory',
                description: 'Import via CSV, connect your DMS, or use our FTP auto-sync.',
              },
              {
                step: '2',
                title: 'Link Facebook Accounts',
                description: 'Securely connect your Facebook accounts using our Chrome extension.',
              },
              {
                step: '3',
                title: 'Customize & Post',
                description: 'Set pricing rules, customize descriptions, and hit publish.',
              },
              {
                step: '4',
                title: 'Capture Leads',
                description: 'Inquiries flow into your dashboard and CRM automatically.',
              },
            ].map((item, index) => (
              <div key={index} className="relative text-center">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-6">
                  {item.step}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm">{item.description}</p>
                {index < 3 && (
                  <ArrowRight className="hidden md:block absolute top-8 -right-4 w-8 h-8 text-gray-300" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-3">{faq.question}</h3>
                <p className="text-gray-600">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </FeaturePageLayout>
  );
}

// =================================================================
// DMS/FTP Auto-Sync Page
// =================================================================

export function DMSFTPSyncPage() {
  const schema = generateSchema({
    type: 'SoftwareApplication',
    name: 'Dealers Face - DMS/FTP Auto-Sync',
    description: 'Connect directly to your DMS via FTP. Import CSV, Excel, or XML files. Inventory updates automatically.',
    url: 'https://dealersface.com/features/dms-ftp-sync',
    features: [
      'FTP auto-sync',
      'CSV/Excel/XML import',
      'Real-time updates',
      'DMS integration',
      'Scheduled sync',
    ],
  });

  return (
    <FeaturePageLayout
      metaTitle="DMS & FTP Auto-Sync for Auto Dealers | Inventory Integration | Dealers Face"
      metaDescription="Connect your DMS directly to Facebook Marketplace via FTP. Auto-sync CSV, Excel, or XML inventory files. Updates happen automatically."
      canonicalUrl="https://dealersface.com/features/dms-ftp-sync"
      schema={schema}
    >
      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-b from-purple-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-medium mb-6">
                <Database className="w-4 h-4 mr-2" />
                DMS/FTP Auto-Sync
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">
                Your Inventory, Always{' '}
                <span className="text-purple-600">In Sync</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Connect directly to your DMS via FTP. Import CSV, Excel, or XML files. 
                Your Facebook Marketplace listings update automatically as your inventory changes.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/register"
                  className="px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-center"
                >
                  Start Free Trial
                </Link>
                <Link
                  to="/contact"
                  className="px-8 py-4 border-2 border-gray-300 text-gray-700 font-bold rounded-xl text-center hover:border-purple-600 hover:text-purple-600"
                >
                  See Integration Guide
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="bg-white rounded-2xl shadow-2xl p-8">
                <div className="space-y-4">
                  {[
                    { name: 'DealerSocket', status: 'Connected', color: 'green' },
                    { name: 'vAuto', status: 'Connected', color: 'green' },
                    { name: 'CDK Global', status: 'Connected', color: 'green' },
                    { name: 'Reynolds & Reynolds', status: 'Available', color: 'blue' },
                  ].map((dms, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-900">{dms.name}</span>
                      <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                        dms.color === 'green' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {dms.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Supported Formats */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-4">
              Works With Your Existing Systems
            </h2>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { format: 'CSV', desc: 'Comma-separated values' },
              { format: 'Excel', desc: 'XLS and XLSX files' },
              { format: 'XML', desc: 'Standard XML feeds' },
              { format: 'API', desc: 'Direct API integration' },
            ].map((item, index) => (
              <div key={index} className="text-center p-6 bg-gray-50 rounded-xl">
                <div className="text-3xl font-bold text-purple-600 mb-2">{item.format}</div>
                <div className="text-gray-600">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DMS Partners */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-4">
              Compatible With All Major DMS Providers
            </h2>
            <p className="text-xl text-gray-600">
              We integrate with every major Dealer Management System
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {[
              'DealerSocket',
              'vAuto',
              'CDK Global',
              'Reynolds',
              'Dealertrack',
              'Frazer',
              'AutoManager',
              'Wayne Reaves',
              'DealerCenter',
              'PBS Systems',
              'Autosoft',
              'RouteOne',
            ].map((dms, index) => (
              <div key={index} className="bg-white p-4 rounded-lg text-center text-gray-700 font-medium shadow-sm">
                {dms}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: RefreshCw,
                title: 'Real-Time Sync',
                description: 'Inventory changes reflect on Marketplace within minutes. Sold vehicles are automatically removed.',
              },
              {
                icon: Upload,
                title: 'Scheduled Imports',
                description: 'Set it and forget it. Schedule daily, hourly, or custom sync intervals.',
              },
              {
                icon: Shield,
                title: 'Secure Transfer',
                description: 'All data transfers use encrypted SFTP connections. Your data is always protected.',
              },
              {
                icon: FileText,
                title: 'Field Mapping',
                description: 'Our smart mapping automatically matches your fields. Custom mapping available.',
              },
              {
                icon: Settings,
                title: 'Data Transformation',
                description: 'Apply pricing rules, format descriptions, and standardize data automatically.',
              },
              {
                icon: BarChart3,
                title: 'Sync Logs',
                description: 'Full visibility into every sync. Track successes, errors, and changes.',
              },
            ].map((feature, index) => (
              <div key={index} className="bg-gray-50 rounded-xl p-8">
                <feature.icon className="w-10 h-10 text-purple-600 mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </FeaturePageLayout>
  );
}

// =================================================================
// Multi-Account Management Page
// =================================================================

export function MultiAccountPage() {
  const schema = generateSchema({
    type: 'SoftwareApplication',
    name: 'Dealers Face - Multi-Account Management',
    description: 'Manage multiple dealership locations from a single dashboard. Role-based access for your entire team.',
    url: 'https://dealersface.com/features/multi-account',
    features: [
      'Multiple locations',
      'Role-based access',
      'Team management',
      'Centralized reporting',
      'Location-specific posting',
    ],
  });

  return (
    <FeaturePageLayout
      metaTitle="Multi-Location Dealer Management | Team Access Control | Dealers Face"
      metaDescription="Manage multiple dealership locations from a single dashboard. Role-based access for your entire team. Perfect for dealer groups."
      canonicalUrl="https://dealersface.com/features/multi-account"
      schema={schema}
    >
      {/* Hero */}
      <section className="py-20 bg-gradient-to-b from-green-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-medium mb-6">
              <Users className="w-4 h-4 mr-2" />
              Multi-Account Management
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">
              One Dashboard.{' '}
              <span className="text-green-600">Multiple Locations.</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Whether you have 2 locations or 200, manage all your Facebook Marketplace 
              accounts from a single, unified dashboard with role-based team access.
            </p>
            <Link
              to="/register"
              className="inline-block px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-extrabold text-gray-900 mb-6">
                Built for Dealer Groups
              </h2>
              <div className="space-y-6">
                {[
                  {
                    title: 'Centralized Control',
                    description: 'Manage all locations from one login. Switch between accounts instantly.',
                  },
                  {
                    title: 'Role-Based Permissions',
                    description: 'Assign Admin, Sales Rep, or Viewer roles. Control who can post, edit, or view.',
                  },
                  {
                    title: 'Location-Specific Posting',
                    description: 'Post inventory to specific local markets based on dealership location.',
                  },
                  {
                    title: 'Consolidated Reporting',
                    description: 'See performance across all locations or drill down into individual stores.',
                  },
                ].map((feature, index) => (
                  <div key={index} className="flex gap-4">
                    <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                    <div>
                      <h3 className="font-bold text-gray-900">{feature.title}</h3>
                      <p className="text-gray-600">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-50 rounded-2xl p-8">
              <h3 className="font-bold text-gray-900 mb-4">Team Roles</h3>
              <div className="space-y-4">
                {[
                  { role: 'Account Owner', permissions: 'Full access, billing, user management' },
                  { role: 'Admin', permissions: 'Post, edit, view analytics, manage team' },
                  { role: 'Sales Rep', permissions: 'View inventory, respond to leads' },
                  { role: 'Viewer', permissions: 'View-only access to dashboards' },
                ].map((item, index) => (
                  <div key={index} className="bg-white p-4 rounded-lg">
                    <div className="font-medium text-gray-900">{item.role}</div>
                    <div className="text-sm text-gray-500">{item.permissions}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </FeaturePageLayout>
  );
}

// =================================================================
// Lead Management & ADF Page
// =================================================================

export function LeadManagementPage() {
  const schema = generateSchema({
    type: 'SoftwareApplication',
    name: 'Dealers Face - Lead Management & ADF',
    description: 'Capture leads from Facebook, send to your CRM via ADF (Auto-lead Data Format). Never miss a sale.',
    url: 'https://dealersface.com/features/lead-management',
    features: [
      'Lead capture',
      'ADF/XML export',
      'CRM integration',
      'Lead tracking',
      'Follow-up automation',
    ],
  });

  return (
    <FeaturePageLayout
      metaTitle="Auto Dealer Lead Management | ADF CRM Integration | Dealers Face"
      metaDescription="Capture leads from Facebook Marketplace, send to your CRM via ADF format. Never miss a sale with our lead management system."
      canonicalUrl="https://dealersface.com/features/lead-management"
      schema={schema}
    >
      {/* Hero */}
      <section className="py-20 bg-gradient-to-b from-orange-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center px-4 py-2 bg-orange-100 text-orange-700 rounded-full text-sm font-medium mb-6">
                <Mail className="w-4 h-4 mr-2" />
                Lead Management & ADF
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">
                Every Lead, Captured.{' '}
                <span className="text-orange-600">Every Sale, Closed.</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Facebook Marketplace inquiries flow directly into your CRM via industry-standard 
                ADF format. Track, follow up, and close more deals than ever.
              </p>
              <Link
                to="/register"
                className="inline-block px-8 py-4 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl"
              >
                Start Free Trial
              </Link>
            </div>
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="text-sm text-gray-500 mb-4">Recent Leads</div>
              <div className="space-y-4">
                {[
                  { name: 'John D.', vehicle: '2024 Ford F-150', time: '2 min ago', status: 'New' },
                  { name: 'Sarah M.', vehicle: '2023 Honda Accord', time: '15 min ago', status: 'Contacted' },
                  { name: 'Mike R.', vehicle: '2024 Toyota Tacoma', time: '1 hr ago', status: 'Appointment' },
                ].map((lead, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{lead.name}</div>
                      <div className="text-sm text-gray-500">{lead.vehicle}</div>
                    </div>
                    <div className="text-right">
                      <div className={`px-2 py-1 text-xs rounded-full ${
                        lead.status === 'New' ? 'bg-green-100 text-green-700' :
                        lead.status === 'Contacted' ? 'bg-blue-100 text-blue-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>{lead.status}</div>
                      <div className="text-xs text-gray-400 mt-1">{lead.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ADF Integration */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-4">
              Industry-Standard ADF Integration
            </h2>
            <p className="text-xl text-gray-600">
              Works with every major automotive CRM
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[
              'VinSolutions',
              'DealerSocket',
              'Elead',
              'CDK CRM',
              'DealerTrack',
              'ProMax',
              'AutoRaptor',
              'Salesforce Auto',
              'Autosoft',
              'CARFAX',
              'HomeNet',
              'Custom CRM',
            ].map((crm, index) => (
              <div key={index} className="bg-gray-50 p-4 rounded-lg text-center text-sm font-medium text-gray-700">
                {crm}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: MessageCircle,
                title: 'Messenger Integration',
                description: 'All Facebook Messenger inquiries captured and logged automatically.',
              },
              {
                icon: FileText,
                title: 'ADF/XML Export',
                description: 'Leads exported in standard ADF format, compatible with any CRM.',
              },
              {
                icon: Target,
                title: 'Lead Scoring',
                description: 'Prioritize hot leads with intelligent scoring based on engagement.',
              },
              {
                icon: Clock,
                title: 'Response Tracking',
                description: 'Track response times and follow-up cadence for each team member.',
              },
              {
                icon: BarChart3,
                title: 'Conversion Analytics',
                description: 'See which vehicles and posts generate the most qualified leads.',
              },
              {
                icon: Phone,
                title: 'Contact Management',
                description: 'Full contact history, notes, and activity timeline for each lead.',
              },
            ].map((feature, index) => (
              <div key={index} className="bg-white rounded-xl p-8 shadow-sm">
                <feature.icon className="w-10 h-10 text-orange-600 mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </FeaturePageLayout>
  );
}

// =================================================================
// Chrome Extension Page
// =================================================================

export function ChromeExtensionPage() {
  const schema = generateSchema({
    type: 'SoftwareApplication',
    name: 'Dealers Face Chrome Extension',
    description: 'Our powerful Chrome extension makes posting to Facebook Marketplace seamless. Login once, post forever.',
    url: 'https://dealersface.com/features/chrome-extension',
    features: [
      'One-click posting',
      'Secure Facebook login',
      'Bulk posting',
      'Auto-fill listings',
      'Real-time sync',
    ],
  });

  return (
    <FeaturePageLayout
      metaTitle="Facebook Marketplace Chrome Extension for Dealers | Dealers Face"
      metaDescription="Our powerful Chrome extension makes posting to Facebook Marketplace seamless. Login once, post forever. Install free today."
      canonicalUrl="https://dealersface.com/features/chrome-extension"
      schema={schema}
    >
      {/* Hero */}
      <section className="py-20 bg-gradient-to-b from-red-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center px-4 py-2 bg-red-100 text-red-700 rounded-full text-sm font-medium mb-6">
              <Chrome className="w-4 h-4 mr-2" />
              Chrome Extension
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">
              Login Once.{' '}
              <span className="text-red-600">Post Forever.</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Our powerful Chrome extension bridges the gap between your inventory and 
              Facebook Marketplace. Secure, fast, and incredibly easy to use.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="https://chrome.google.com/webstore"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl inline-flex items-center justify-center"
              >
                <Chrome className="w-5 h-5 mr-2" />
                Add to Chrome - Free
              </a>
              <Link
                to="/register"
                className="px-8 py-4 border-2 border-gray-300 text-gray-700 font-bold rounded-xl"
              >
                Create Account First
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-4">
              Simple Yet Powerful
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Chrome,
                title: 'Install Extension',
                description: 'Add our extension from the Chrome Web Store in one click.',
              },
              {
                icon: Shield,
                title: 'Secure Login',
                description: 'Log into your Facebook accounts securely. Credentials never leave your browser.',
              },
              {
                icon: Zap,
                title: 'Start Posting',
                description: 'Click post in Dealers Face and watch listings appear on Marketplace.',
              },
            ].map((step, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <step.icon className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
                <p className="text-gray-600">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-extrabold text-gray-900 mb-6">
                Security First
              </h2>
              <p className="text-lg text-gray-600 mb-6">
                We take your security seriously. Our Chrome extension is designed with 
                privacy and security at its core.
              </p>
              <div className="space-y-4">
                {[
                  'Credentials never sent to our servers',
                  'Local browser-based authentication',
                  'No password storage',
                  'Encrypted communications',
                  'Regular security audits',
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-green-500" />
                    <span className="text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl p-8 shadow-xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Shield className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <div className="font-bold text-gray-900">SOC 2 Compliant</div>
                  <div className="text-sm text-gray-500">Enterprise-grade security</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-gray-900">256-bit</div>
                  <div className="text-sm text-gray-500">Encryption</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-gray-900">99.9%</div>
                  <div className="text-sm text-gray-500">Uptime SLA</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </FeaturePageLayout>
  );
}

// =================================================================
// Analytics & Tracking Page
// =================================================================

export function AnalyticsTrackingPage() {
  const schema = generateSchema({
    type: 'SoftwareApplication',
    name: 'Dealers Face - Analytics & Tracking',
    description: 'Track post performance, lead conversion, and email opens. Data-driven insights to boost sales.',
    url: 'https://dealersface.com/features/analytics',
    features: [
      'Post performance tracking',
      'Lead conversion analytics',
      'ROI reporting',
      'Custom dashboards',
      'Exportable reports',
    ],
  });

  return (
    <FeaturePageLayout
      metaTitle="Auto Dealer Analytics | Facebook Marketplace Insights | Dealers Face"
      metaDescription="Track post performance, lead conversion, and ROI. Data-driven insights to help auto dealers sell more cars on Facebook Marketplace."
      canonicalUrl="https://dealersface.com/features/analytics"
      schema={schema}
    >
      {/* Hero */}
      <section className="py-20 bg-gradient-to-b from-indigo-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium mb-6">
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics & Tracking
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">
              Data-Driven{' '}
              <span className="text-indigo-600">Decisions</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Track post performance, lead conversion, and ROI across all your 
              Facebook Marketplace activity. Know exactly what's working.
            </p>
            <Link
              to="/register"
              className="inline-block px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </section>

      {/* Metrics Grid */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'Post Views', value: '1.2M+', change: '+23%' },
              { label: 'Leads Generated', value: '8,432', change: '+45%' },
              { label: 'Avg. Response Time', value: '12 min', change: '-38%' },
              { label: 'Conversion Rate', value: '4.8%', change: '+12%' },
            ].map((metric, index) => (
              <div key={index} className="bg-gray-50 rounded-xl p-6 text-center">
                <div className="text-3xl font-extrabold text-gray-900">{metric.value}</div>
                <div className="text-sm text-gray-600 mt-1">{metric.label}</div>
                <div className={`text-sm font-medium mt-2 ${
                  metric.change.startsWith('+') ? 'text-green-600' : 'text-blue-600'
                }`}>{metric.change} vs last month</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-4">
              Comprehensive Analytics Suite
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: TrendingUp,
                title: 'Performance Tracking',
                description: 'Track views, clicks, and engagement for every listing in real-time.',
              },
              {
                icon: Target,
                title: 'Lead Attribution',
                description: 'Know exactly which posts and accounts generate the most leads.',
              },
              {
                icon: DollarSign,
                title: 'ROI Calculation',
                description: 'Calculate your return on investment with automatic cost tracking.',
              },
              {
                icon: Users,
                title: 'Team Performance',
                description: 'Compare response times and conversion rates across team members.',
              },
              {
                icon: Car,
                title: 'Inventory Insights',
                description: 'Discover which vehicle types perform best on Marketplace.',
              },
              {
                icon: FileText,
                title: 'Custom Reports',
                description: 'Build and export custom reports for stakeholders and management.',
              },
            ].map((feature, index) => (
              <div key={index} className="bg-white rounded-xl p-8 shadow-sm">
                <feature.icon className="w-10 h-10 text-indigo-600 mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </FeaturePageLayout>
  );
}

// =================================================================
// Features Index Page
// =================================================================

export function FeaturesIndexPage() {
  const features = [
    {
      slug: 'facebook-marketplace',
      icon: Facebook,
      name: 'Facebook Marketplace Integration',
      description: 'Automatically post your entire inventory to Facebook Marketplace with one click.',
      color: 'blue',
    },
    {
      slug: 'dms-ftp-sync',
      icon: Database,
      name: 'DMS/FTP Auto-Sync',
      description: 'Connect your DMS via FTP. Import CSV, Excel, or XML files automatically.',
      color: 'purple',
    },
    {
      slug: 'multi-account',
      icon: Users,
      name: 'Multi-Account Management',
      description: 'Manage multiple locations from a single dashboard with role-based access.',
      color: 'green',
    },
    {
      slug: 'lead-management',
      icon: Mail,
      name: 'Lead Management & ADF',
      description: 'Capture leads and export to your CRM via industry-standard ADF format.',
      color: 'orange',
    },
    {
      slug: 'chrome-extension',
      icon: Chrome,
      name: 'Chrome Extension',
      description: 'Our powerful extension makes posting to Marketplace seamless.',
      color: 'red',
    },
    {
      slug: 'analytics',
      icon: BarChart3,
      name: 'Analytics & Tracking',
      description: 'Track performance, conversions, and ROI with detailed analytics.',
      color: 'indigo',
    },
  ];

  const colorClasses: Record<string, { bg: string; text: string; iconBg: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', iconBg: 'bg-blue-100' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', iconBg: 'bg-purple-100' },
    green: { bg: 'bg-green-50', text: 'text-green-600', iconBg: 'bg-green-100' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-600', iconBg: 'bg-orange-100' },
    red: { bg: 'bg-red-50', text: 'text-red-600', iconBg: 'bg-red-100' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', iconBg: 'bg-indigo-100' },
  };

  return (
    <FeaturePageLayout
      metaTitle="Auto Dealer Features | Facebook Marketplace Automation | Dealers Face"
      metaDescription="Explore all features of Dealers Face: Facebook Marketplace integration, DMS sync, lead management, analytics, and more for auto dealers."
      canonicalUrl="https://dealersface.com/features"
      schema={{
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: features.map((f, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: f.name,
          url: `https://dealersface.com/features/${f.slug}`,
        })),
      }}
    >
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">
              Everything You Need to{' '}
              <span className="text-blue-600">Dominate Facebook Marketplace</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              A complete suite of tools designed specifically for auto dealers 
              to maximize their Facebook Marketplace presence.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => {
              const colors = colorClasses[feature.color];
              return (
                <Link
                  key={feature.slug}
                  to={`/features/${feature.slug}`}
                  className={`${colors.bg} rounded-2xl p-8 hover:shadow-lg transition-all group`}
                >
                  <div className={`w-14 h-14 ${colors.iconBg} rounded-xl flex items-center justify-center mb-6`}>
                    <feature.icon className={`w-7 h-7 ${colors.text}`} />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                    {feature.name}
                  </h2>
                  <p className="text-gray-600 mb-4">{feature.description}</p>
                  <span className={`${colors.text} font-semibold inline-flex items-center`}>
                    Learn more <ArrowRight className="w-4 h-4 ml-2" />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </FeaturePageLayout>
  );
}
