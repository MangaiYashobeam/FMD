import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle,
  ChevronRight,
  Facebook,
  Zap,
  BarChart3,
  Users,
  Mail,
  Database,
  Chrome,
  Globe,
  TrendingUp,
  Menu,
  X,
  Star,
  ArrowRight,
} from 'lucide-react';
import { DealersFaceIcon } from '../components/ui/Logo';

// SVG Illustrations
const HeroIllustration = () => (
  <svg viewBox="0 0 500 400" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
    {/* Dashboard mockup */}
    <rect x="50" y="40" width="400" height="280" rx="16" fill="white" filter="url(#shadow)" />
    <rect x="50" y="40" width="400" height="50" rx="16" fill="#1e40af" />
    <circle cx="80" cy="65" r="8" fill="#ef4444" />
    <circle cx="105" cy="65" r="8" fill="#fbbf24" />
    <circle cx="130" cy="65" r="8" fill="#22c55e" />
    
    {/* Sidebar */}
    <rect x="50" y="90" width="80" height="230" fill="#f1f5f9" />
    <rect x="60" y="110" width="60" height="8" rx="2" fill="#94a3b8" />
    <rect x="60" y="130" width="60" height="8" rx="2" fill="#3b82f6" />
    <rect x="60" y="150" width="60" height="8" rx="2" fill="#94a3b8" />
    <rect x="60" y="170" width="60" height="8" rx="2" fill="#94a3b8" />
    
    {/* Chart */}
    <rect x="150" y="110" width="280" height="100" rx="8" fill="#f8fafc" stroke="#e2e8f0" />
    <path d="M170 180 Q200 140, 230 160 T290 130 T350 150 T410 100" stroke="#3b82f6" strokeWidth="3" fill="none" />
    <circle cx="170" cy="180" r="4" fill="#3b82f6" />
    <circle cx="230" cy="160" r="4" fill="#3b82f6" />
    <circle cx="290" cy="130" r="4" fill="#3b82f6" />
    <circle cx="350" cy="150" r="4" fill="#3b82f6" />
    <circle cx="410" cy="100" r="4" fill="#3b82f6" />
    
    {/* Cards */}
    <rect x="150" y="230" width="130" height="70" rx="8" fill="#f8fafc" stroke="#e2e8f0" />
    <rect x="160" y="245" width="50" height="8" rx="2" fill="#94a3b8" />
    <text x="160" y="280" fill="#1e40af" fontSize="18" fontWeight="bold">1,247</text>
    
    <rect x="300" y="230" width="130" height="70" rx="8" fill="#f8fafc" stroke="#e2e8f0" />
    <rect x="310" y="245" width="50" height="8" rx="2" fill="#94a3b8" />
    <text x="310" y="280" fill="#22c55e" fontSize="18" fontWeight="bold">+23%</text>
    
    {/* Facebook icon floating */}
    <circle cx="420" cy="350" r="35" fill="#1877f2" />
    <text x="420" y="358" textAnchor="middle" fill="white" fontSize="28" fontWeight="bold">f</text>
    
    {/* Car icon floating */}
    <rect x="30" y="280" width="60" height="40" rx="8" fill="#1e40af" />
    <rect x="35" y="290" width="20" height="8" rx="2" fill="white" opacity="0.5" />
    <rect x="35" y="302" width="40" height="4" rx="2" fill="white" opacity="0.3" />
    
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="10" stdDeviation="20" floodOpacity="0.15" />
      </filter>
    </defs>
  </svg>
);

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const features = [
    {
      icon: Facebook,
      title: 'Facebook Marketplace Integration',
      description: 'Automatically post your entire inventory to Facebook Marketplace with one click. Reach millions of local buyers instantly.',
      color: 'bg-blue-500',
      slug: 'facebook-marketplace',
    },
    {
      icon: Database,
      title: 'DMS/FTP Auto-Sync',
      description: 'Connect directly to your DMS via FTP. Import CSV, Excel, or XML files. Inventory updates automatically.',
      color: 'bg-purple-500',
      slug: 'dms-ftp-sync',
    },
    {
      icon: Users,
      title: 'Multi-Account Management',
      description: 'Manage multiple dealership locations from a single dashboard. Role-based access for your entire team.',
      color: 'bg-green-500',
      slug: 'multi-account',
    },
    {
      icon: Mail,
      title: 'Lead Management & ADF',
      description: 'Capture leads from Facebook, send to your CRM via ADF (Auto-lead Data Format). Never miss a sale.',
      color: 'bg-orange-500',
      slug: 'lead-management',
    },
    {
      icon: Chrome,
      title: 'Chrome Extension',
      description: 'Our powerful Chrome extension makes posting to Marketplace seamless. Login once, post forever.',
      color: 'bg-red-500',
      slug: 'chrome-extension',
    },
    {
      icon: BarChart3,
      title: 'Analytics & Tracking',
      description: 'Track post performance, lead conversion, and email opens. Data-driven insights to boost sales.',
      color: 'bg-indigo-500',
      slug: 'analytics',
    },
  ];

  const stats = [
    { value: '10,000+', label: 'Vehicles Posted Daily' },
    { value: '500+', label: 'Dealerships Trust Us' },
    { value: '2M+', label: 'Leads Generated' },
    { value: '99.9%', label: 'Uptime SLA' },
  ];

  const testimonials = [
    {
      name: 'Mike Johnson',
      role: 'Owner, Johnson Auto Group',
      content: 'Dealers Face transformed our Facebook presence. We went from 5 leads a week to 50+ overnight. The ROI is incredible.',
      rating: 5,
    },
    {
      name: 'Sarah Chen',
      role: 'Marketing Director, Premier Motors',
      content: 'The DMS integration is flawless. Our inventory syncs automatically and posts go live without any manual work. Game changer!',
      rating: 5,
    },
    {
      name: 'David Rodriguez',
      role: 'General Manager, AutoMax Dealers',
      content: 'Managing 12 locations was a nightmare before Dealers Face. Now one person handles everything. Saved us $30K/month in labor.',
      rating: 5,
    },
  ];

  const pricingPlans = [
    {
      name: 'Starter',
      price: 699,
      period: '/month',
      description: '10 active posting accounts included',
      extraUserNote: '+$119 per extra user',
      features: [
        '10 active posting accounts',
        'Unlimited vehicle inventory',
        'Facebook Marketplace integration',
        'DMS/FTP auto-sync',
        'Chrome extension access',
        'Lead capture & ADF export',
        'Basic analytics',
        'Email support',
      ],
      cta: 'Start Free Trial',
      popular: false,
    },
    {
      name: 'Growth',
      price: 1199,
      period: '/month',
      description: '25 active posting accounts included',
      extraUserNote: '+$100 per extra user',
      features: [
        '25 active posting accounts',
        'All Starter features',
        'Multi-location management',
        'Advanced analytics dashboard',
        'Priority support (24hr)',
        'Phone support',
        'Custom posting schedules',
        'Team activity tracking',
      ],
      cta: 'Start Free Trial',
      popular: true,
    },
    {
      name: 'Pro',
      price: 2999,
      period: '/month',
      description: 'Unlimited accounts & users',
      extraUserNote: 'No extra user fees',
      features: [
        'Unlimited posting accounts',
        'Unlimited users included',
        'Full REST API access',
        'Custom integrations',
        'Dedicated account manager',
        'Premium support (4hr)',
        '24/7 phone support',
        'SLA guarantee (99.9%)',
      ],
      cta: 'Start Free Trial',
      popular: false,
    },
    {
      name: 'Enterprise Lifetime',
      price: 24999,
      period: ' one-time',
      description: '4 years unlimited access',
      savings: 'Save $118,953 (82.6%)',
      extraUserNote: null,
      features: [
        'All Pro features included',
        '4 years unlimited access',
        'Unlimited users forever',
        'Lock in current pricing',
        'VIP support status',
        'Priority feature requests',
        'Quarterly business reviews',
        'After 4 years: Pro rate',
      ],
      cta: 'Contact Sales',
      popular: false,
      isLifetime: true,
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <DealersFaceIcon size={40} />
              <span className="text-xl font-bold text-gray-900">Dealers <span className="text-blue-600">Face</span></span>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-blue-600 transition-colors font-medium">
                Features
              </a>
              <a href="#pricing" className="text-gray-600 hover:text-blue-600 transition-colors font-medium">
                Pricing
              </a>
              <a href="#testimonials" className="text-gray-600 hover:text-blue-600 transition-colors font-medium">
                Testimonials
              </a>
              <Link
                to="/login"
                className="text-gray-600 hover:text-blue-600 transition-colors font-medium"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all"
              >
                Get Started Free
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? (
                <X className="w-6 h-6 text-gray-600" />
              ) : (
                <Menu className="w-6 h-6 text-gray-600" />
              )}
            </button>
          </div>

          {/* Mobile Nav */}
          {isMenuOpen && (
            <div className="md:hidden py-4 border-t border-gray-100">
              <div className="flex flex-col space-y-4">
                <a href="#features" className="text-gray-600 hover:text-blue-600 font-medium">
                  Features
                </a>
                <a href="#pricing" className="text-gray-600 hover:text-blue-600 font-medium">
                  Pricing
                </a>
                <a href="#testimonials" className="text-gray-600 hover:text-blue-600 font-medium">
                  Testimonials
                </a>
                <Link to="/login" className="text-gray-600 hover:text-blue-600 font-medium">
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg text-center"
                >
                  Get Started Free
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-br from-gray-50 to-blue-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center px-4 py-2 bg-blue-100 rounded-full text-blue-700 text-sm font-medium mb-6">
                <Zap className="w-4 h-4 mr-2" />
                #1 Facebook Marketplace Automation for Dealers
              </div>
              <h1 className="text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
                Sell More Cars on{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                  Facebook
                </span>
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Automate your dealership's Facebook Marketplace listings. Post your entire inventory 
                in minutes, capture leads automatically, and watch your sales soar.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/register"
                  className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center group"
                >
                  Start Free 14-Day Trial
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Link>
                <a
                  href="#features"
                  className="px-8 py-4 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-xl shadow border border-gray-200 transition-all flex items-center justify-center"
                >
                  See How It Works
                </a>
              </div>
              <div className="mt-10 flex items-center gap-8">
                <div className="flex -space-x-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-white flex items-center justify-center text-white text-xs font-bold"
                    >
                      {String.fromCharCode(64 + i)}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center mb-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">500+ dealerships</span> trust us
                  </p>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-3xl blur-3xl opacity-20"></div>
              <HeroIllustration />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl lg:text-5xl font-extrabold text-blue-600 mb-2">
                  {stat.value}
                </div>
                <div className="text-gray-600 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold text-gray-900 mb-4">
              Everything You Need to Dominate Facebook
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Powerful tools built specifically for auto dealers. From inventory sync to lead capture, 
              we've got you covered.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Link
                key={index}
                to={`/features/${feature.slug}`}
                className="group p-8 bg-white rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-xl transition-all duration-300 cursor-pointer"
              >
                <div className={`w-14 h-14 ${feature.color} rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                <div className="mt-4 text-blue-600 font-semibold flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  Learn more <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold mb-4">How It Works</h2>
            <p className="text-xl text-blue-200 max-w-2xl mx-auto">
              Get up and running in less than 10 minutes. No technical expertise required.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Connect Your Inventory',
                description: 'Link your DMS via FTP or upload a CSV/Excel file. We support all major DMS providers.',
                icon: Database,
              },
              {
                step: '2',
                title: 'Connect Facebook',
                description: 'Authorize your Facebook account with one click. Our Chrome extension handles the rest.',
                icon: Facebook,
              },
              {
                step: '3',
                title: 'Start Selling',
                description: 'Post your inventory to Marketplace automatically. Leads flow directly to your CRM.',
                icon: TrendingUp,
              },
            ].map((item, index) => (
              <div key={index} className="relative">
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
                  <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center text-2xl font-bold mb-6">
                    {item.step}
                  </div>
                  <item.icon className="w-10 h-10 text-blue-300 mb-4" />
                  <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                  <p className="text-blue-200">{item.description}</p>
                </div>
                {index < 2 && (
                  <ChevronRight className="hidden md:block absolute top-1/2 -right-4 w-8 h-8 text-blue-400" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Choose the plan that fits your dealership. All monthly plans include a 14-day free trial.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pricingPlans.map((plan, index) => (
              <div
                key={index}
                className={`relative bg-white rounded-2xl p-6 ${
                  plan.popular
                    ? 'border-2 border-blue-500 shadow-xl ring-4 ring-blue-100'
                    : (plan as any).isLifetime
                    ? 'border-2 border-amber-400 bg-gradient-to-b from-amber-50 to-white'
                    : 'border border-gray-200'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <div className="px-4 py-1 bg-blue-500 text-white text-sm font-semibold rounded-full">
                      Most Popular
                    </div>
                  </div>
                )}
                {(plan as any).isLifetime && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <div className="px-4 py-1 bg-amber-500 text-white text-sm font-semibold rounded-full">
                      Best Value
                    </div>
                  </div>
                )}
                <h3 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h3>
                <p className="text-sm text-gray-500 mb-4">{plan.description}</p>
                {(plan as any).savings && (
                  <div className="mb-3 inline-block px-3 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-full">
                    {(plan as any).savings}
                  </div>
                )}
                <div className="mb-4">
                  <span className="text-4xl font-extrabold text-gray-900">
                    ${plan.price.toLocaleString()}
                  </span>
                  <span className="text-gray-600">{(plan as any).period}</span>
                </div>
                {(plan as any).extraUserNote && (
                  <p className="text-sm text-blue-600 font-medium mb-4">
                    {(plan as any).extraUserNote}
                  </p>
                )}
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to={(plan as any).isLifetime ? '/contact' : '/register'}
                  className={`block w-full py-3 px-4 text-center font-semibold rounded-xl transition-all ${
                    plan.popular
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
                      : (plan as any).isLifetime
                      ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg hover:shadow-xl'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          {/* Enterprise Note */}
          <div className="mt-12 text-center">
            <p className="text-gray-600">
              Need a custom solution for your dealer group?{' '}
              <Link to="/contact" className="text-blue-600 font-semibold hover:underline">
                Contact our sales team
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold text-gray-900 mb-4">
              Loved by Dealerships Everywhere
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              See why hundreds of dealers choose Dealers Face to grow their business.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="bg-gray-50 rounded-2xl p-8 border border-gray-100"
              >
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-700 mb-6 leading-relaxed">"{testimonial.content}"</p>
                <div className="flex items-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                    {testimonial.name.charAt(0)}
                  </div>
                  <div className="ml-4">
                    <div className="font-semibold text-gray-900">{testimonial.name}</div>
                    <div className="text-sm text-gray-600">{testimonial.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-blue-600 to-indigo-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl lg:text-5xl font-extrabold text-white mb-6">
            Ready to Sell More Cars?
          </h2>
          <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
            Join 500+ dealerships already using Dealers Face to dominate Facebook Marketplace. 
            Start your free trial today—no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="px-8 py-4 bg-white hover:bg-gray-100 text-blue-600 font-semibold rounded-xl shadow-xl hover:shadow-2xl transition-all flex items-center justify-center group"
            >
              Start Free Trial
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/login"
              className="px-8 py-4 bg-blue-500/30 hover:bg-blue-500/40 text-white font-semibold rounded-xl border border-white/30 transition-all flex items-center justify-center"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <DealersFaceIcon size={40} />
                <span className="text-xl font-bold text-white">Dealers <span className="text-blue-400">Face</span></span>
              </div>
              <p className="text-gray-400 leading-relaxed">
                The #1 Facebook Marketplace automation platform for auto dealers. 
                Sell more cars, save time, grow faster.
              </p>
              <p className="text-gray-500 text-sm mt-4">📧 support@dealersface.com</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-3">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><Link to="/login" className="hover:text-white transition-colors">Dashboard</Link></li>
                <li><a href="#" className="hover:text-white transition-colors">Chrome Extension</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-3">
                <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-3">
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Cookie Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">DMCA</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-800 flex flex-col md:flex-row items-center justify-between">
            <p className="text-gray-500">
              © {new Date().getFullYear()} Dealers Face. All rights reserved.
            </p>
            <div className="flex items-center space-x-4 mt-4 md:mt-0">
              <a href="#" className="w-10 h-10 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center transition-colors">
                <Globe className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center transition-colors">
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
