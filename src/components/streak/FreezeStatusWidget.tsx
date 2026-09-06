'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface FreezeStatus {
  tokensRemaining: number;
  lastFreezeDate: string | null;
  nextEligibleDate: string | null;
  freezeHistory: Array<{ date: string; reason: string }>;
  canFreeze: boolean;
}

export function FreezeStatusWidget() {
  const { data: session } = useSession();
  const [freezeStatus, setFreezeStatus] = useState<FreezeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applyingFreeze, setApplyingFreeze] = useState(false);

  useEffect(() => {
    if (session) {
      fetchFreezeStatus();
    }
  }, [session]);

  const fetchFreezeStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/streak/freeze/status');
      if (!response.ok) {
        throw new Error('Failed to fetch freeze status');
      }
      const data = await response.json();
      setFreezeStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFreeze = async () => {
    if (!freezeStatus?.canFreeze) return;

    try {
      setApplyingFreeze(true);
      const response = await fetch('/api/streak/freeze/apply', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to apply freeze');
      }

      const result = await response.json();
      alert(result.message || 'Streak frozen successfully! ❄️');
      
      // Refresh freeze status
      await fetchFreezeStatus();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setApplyingFreeze(false);
    }
  };

  if (!session) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <p className="text-red-600 dark:text-red-400">Error: {error}</p>
        <button
          onClick={fetchFreezeStatus}
          className="mt-2 text-blue-600 dark:text-blue-400 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!freezeStatus) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          ❄️ Streak Freeze
        </h3>
        <span className="text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
          {freezeStatus.tokensRemaining} token{freezeStatus.tokensRemaining !== 1 ? 's' : ''} remaining
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Status</span>
          <span className={freezeStatus.canFreeze ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}>
            {freezeStatus.canFreeze ? '✅ Available' : '❌ Not available'}
          </span>
        </div>

        {freezeStatus.lastFreezeDate && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Last Freeze</span>
            <span className="text-gray-900 dark:text-white">
              {new Date(freezeStatus.lastFreezeDate).toLocaleDateString()}
            </span>
          </div>
        )}

        {freezeStatus.nextEligibleDate && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Next Eligibility</span>
            <span className="text-gray-900 dark:text-white">
              {new Date(freezeStatus.nextEligibleDate).toLocaleDateString()}
            </span>
          </div>
        )}

        {freezeStatus.freezeHistory.length > 0 && (
          <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Recent Freezes</h4>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {freezeStatus.freezeHistory.slice(-3).reverse().map((entry, index) => (
                <div key={index} className="text-xs text-gray-600 dark:text-gray-400 flex justify-between">
                  <span>❄️ {new Date(entry.date).toLocaleDateString()}</span>
                  <span className="text-gray-400 dark:text-gray-500">{entry.reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleApplyFreeze}
          disabled={!freezeStatus.canFreeze || applyingFreeze}
          className={`
            w-full mt-4 py-2 px-4 rounded-lg font-medium transition-all duration-200
            ${freezeStatus.canFreeze && !applyingFreeze
              ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
              : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }
          `}
        >
          {applyingFreeze ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Freezing...
            </span>
          ) : (
            freezeStatus.canFreeze ? '❄️ Freeze Streak' : 'No tokens available'
          )}
        </button>
      </div>
    </div>
  );
}