import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { Check, AlertCircle } from 'lucide-react';

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  interval: string;
  features: string[];
  isActive: boolean;
}

interface Subscription {
  id: string;
  status: string;
  planId: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  plan: {
    name: string;
    price: number;
    interval: string;
  };
}

interface Payment {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  description: string;
}

export const SubscriptionPage: React.FC = () => {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const { data: subscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: Subscription }>('/subscriptions/current');
      return response.data.data;
    },
  });

  const { data: plans } = useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: SubscriptionPlan[] }>('/subscriptions/plans');
      return response.data.data;
    },
  });

  const { data: payments } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: Payment[] }>('/subscriptions/payments');
      return response.data.data;
    },
  });

  const handleUpgrade = async (plan: SubscriptionPlan) => {
    try {
      const response = await api.post('/subscriptions/create-checkout-session', {
        planId: plan.id,
      });
      
      if (response.data.data.url) {
        window.location.href = response.data.data.url;
      }
    } catch (error) {
      console.error('Failed to create checkout session:', error);
    }
  };

  const handleCancelSubscription = async () => {
    if (confirm('Are you sure you want to cancel your subscription?')) {
      try {
        await api.post('/subscriptions/cancel');
      } catch (error) {
        console.error('Failed to cancel subscription:', error);
      }
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      past_due: 'bg-yellow-100 text-yellow-800',
      canceled: 'bg-red-100 text-red-800',
      trialing: 'bg-blue-100 text-blue-800',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Subscription & Billing</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your subscription and billing information</p>
      </div>

      {/* Current Subscription */}
      {subscription && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg font-medium text-gray-900">Current Plan</h2>
              <p className="mt-1 text-sm text-gray-500">Your subscription details</p>
            </div>
            {getStatusBadge(subscription.status)}
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Plan</dt>
                  <dd className="mt-1 text-sm text-gray-900">{subscription.plan.name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Price</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    ${subscription.plan.price}/{subscription.plan.interval}
                  </dd>
                </div>
              </dl>
            </div>

            <div>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Current Period</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(subscription.currentPeriodStart).toLocaleDateString()} - {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </dd>
                </div>
                {subscription.cancelAtPeriodEnd && (
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 mr-2" />
                    <div>
                      <dt className="text-sm font-medium text-gray-900">Cancellation Scheduled</dt>
                      <dd className="mt-1 text-sm text-gray-500">
                        Your subscription will end on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                      </dd>
                    </div>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {subscription.status === 'active' && !subscription.cancelAtPeriodEnd && (
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
              >
                Upgrade Plan
              </button>
              <button
                onClick={handleCancelSubscription}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel Subscription
              </button>
            </div>
          )}
        </div>
      )}

      {/* Available Plans */}
      {showUpgradeModal && plans && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-6">Available Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`border rounded-lg p-6 ${
                  plan.isActive ? 'border-primary-500 ring-2 ring-primary-500' : 'border-gray-200'
                }`}
              >
                <h3 className="text-lg font-medium text-gray-900">{plan.name}</h3>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  ${plan.price}
                  <span className="text-base font-normal text-gray-500">/{plan.interval}</span>
                </p>

                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleUpgrade(plan)}
                  disabled={plan.isActive}
                  className={`mt-6 w-full inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md ${
                    plan.isActive
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'text-white bg-primary-600 hover:bg-primary-700'
                  }`}
                >
                  {plan.isActive ? 'Current Plan' : 'Upgrade'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment History */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Payment History</h2>
        
        {payments && payments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(payment.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {payment.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${(payment.amount / 100).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(payment.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-8">No payment history available</p>
        )}
      </div>
    </div>
  );
};
