import { useState } from 'react';
import { Mail, Send, FileText, Settings, Activity } from 'lucide-react';

// Tab components
import EmailComposerTab from './email/EmailComposerTab';
import EmailLogsTab from './email/EmailLogsTab';
import EmailTemplatesTab from './email/EmailTemplatesTab';
import EmailSettingsTab from './email/EmailSettingsTab';

type TabId = 'composer' | 'logs' | 'templates' | 'settings';

interface Tab {
  id: TabId;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const tabs: Tab[] = [
  {
    id: 'composer',
    name: 'Composer',
    icon: Send,
    description: 'Compose and send emails',
  },
  {
    id: 'logs',
    name: 'Email Logs',
    icon: Activity,
    description: 'Monitor sent emails',
  },
  {
    id: 'templates',
    name: 'Templates',
    icon: FileText,
    description: 'Manage email templates',
  },
  {
    id: 'settings',
    name: 'Settings',
    icon: Settings,
    description: 'SMTP configuration',
  },
];

export default function EmailManagementPage() {
  const [activeTab, setActiveTab] = useState<TabId>('composer');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'composer':
        return <EmailComposerTab />;
      case 'logs':
        return <EmailLogsTab />;
      case 'templates':
        return <EmailTemplatesTab />;
      case 'settings':
        return <EmailSettingsTab />;
      default:
        return <EmailComposerTab />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-blue-100 rounded-xl">
          <Mail className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Management</h1>
          <p className="text-gray-500">
            Compose emails, manage templates, and monitor delivery • System: dealersface.com
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    group relative min-w-0 flex-1 overflow-hidden py-4 px-4 text-sm font-medium text-center 
                    hover:bg-gray-50 focus:z-10 focus:outline-none transition-colors
                    ${isActive 
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' 
                      : 'text-gray-500 border-b-2 border-transparent hover:text-gray-700'
                    }
                  `}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-500'}`} />
                    <span>{tab.name}</span>
                  </div>
                  <span className="hidden md:block text-xs mt-1 font-normal text-gray-400">
                    {tab.description}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}
