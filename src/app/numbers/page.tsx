'use client';

import { useCallback, useEffect, useState } from 'react';
import ActivityLog, { useActivityLog } from '@/components/ActivityLog';

type SipConfig = {
  phone_number: string;
  inbound_trunk_id?: string;
  outbound_trunk_id?: string;
  dispatch_rule_id?: string;
  agent_config_id?: string;
  created_at?: string;
  updated_at?: string;
};

type AgentConfig = {
  id: string;
  name: string;
  phone_number?: string;
  stt_model?: string;
  llm_model?: string;
  tts_voice?: string;
  instructions?: string;
};

type NumberEntry = {
  phone_number: string;
  sipConfig?: SipConfig;
  agentConfig?: AgentConfig;
};

const STATUS_BADGE = {
  configured: 'bg-green-100 text-green-800',
  partial: 'bg-yellow-100 text-yellow-800',
  missing: 'bg-red-100 text-red-800',
};

export default function NumbersPage() {
  const [numbers, setNumbers] = useState<NumberEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedNumber, setExpandedNumber] = useState<string | null>(null);
  const { entries, addEntry, updateEntry } = useActivityLog('numbers-activity', 20);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const entryId = addEntry({
      action: 'sync_complete',
      status: 'pending',
      details: 'Fetching registered numbers...',
    });

    try {
      const [sipRes, agentRes] = await Promise.all([
        fetch('/api/sip-configs'),
        fetch('/api/agent-configs'),
      ]);

      if (!sipRes.ok) {
        throw new Error(`Failed to fetch SIP configs: ${sipRes.statusText}`);
      }
      if (!agentRes.ok) {
        throw new Error(`Failed to fetch agent configs: ${agentRes.statusText}`);
      }

      const sipData = await sipRes.json();
      const agentData = await agentRes.json();

      const sipConfigs: SipConfig[] = sipData.configs || [];
      const agentConfigs: AgentConfig[] = agentData.configs || [];

      // Build a map of phone numbers to their configs
      const numberMap = new Map<string, NumberEntry>();

      // Add all SIP configs
      for (const sip of sipConfigs) {
        numberMap.set(sip.phone_number, {
          phone_number: sip.phone_number,
          sipConfig: sip,
        });
      }

      // Match agent configs by phone number
      for (const agent of agentConfigs) {
        if (agent.phone_number) {
          const existing = numberMap.get(agent.phone_number);
          if (existing) {
            existing.agentConfig = agent;
          } else {
            numberMap.set(agent.phone_number, {
              phone_number: agent.phone_number,
              agentConfig: agent,
            });
          }
        }
      }

      const numbersArray = Array.from(numberMap.values()).sort((a, b) =>
        a.phone_number.localeCompare(b.phone_number)
      );

      setNumbers(numbersArray);
      updateEntry(entryId, {
        status: 'success',
        details: `Loaded ${numbersArray.length} registered numbers`,
        apiResponse: { sipCount: sipConfigs.length, agentCount: agentConfigs.length },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      updateEntry(entryId, {
        status: 'error',
        details: message,
      });
    } finally {
      setLoading(false);
    }
  }, [addEntry, updateEntry]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getStatus = (entry: NumberEntry) => {
    if (entry.sipConfig && entry.agentConfig) {
      return { label: 'Configured', style: STATUS_BADGE.configured };
    }
    if (entry.sipConfig || entry.agentConfig) {
      return { label: 'Partial', style: STATUS_BADGE.partial };
    }
    return { label: 'Missing', style: STATUS_BADGE.missing };
  };

  const formatPhoneNumber = (phone: string) => {
    // Format E.164 to readable format
    if (phone.startsWith('+1') && phone.length === 12) {
      return `+1 (${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8)}`;
    }
    return phone;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Registered Numbers</h1>
          <p className="text-sm text-slate-500 mt-1">
            Phone numbers with SIP trunk and agent configurations
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {loading && numbers.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : numbers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
          <p className="text-slate-500">No registered numbers found</p>
          <p className="text-sm text-slate-400 mt-2">
            Numbers will appear here once SIP configs are added
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Phone Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Inbound Trunk
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Outbound Trunk
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Agent Config
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {numbers.map((entry) => {
                const status = getStatus(entry);
                const isExpanded = expandedNumber === entry.phone_number;

                return (
                  <>
                    <tr
                      key={entry.phone_number}
                      className="hover:bg-slate-50 cursor-pointer"
                      onClick={() =>
                        setExpandedNumber(isExpanded ? null : entry.phone_number)
                      }
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-sm font-medium text-slate-900">
                            {formatPhoneNumber(entry.phone_number)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`text-sm ${
                            entry.sipConfig?.inbound_trunk_id
                              ? 'text-slate-900'
                              : 'text-slate-400'
                          }`}
                        >
                          {entry.sipConfig?.inbound_trunk_id
                            ? `...${entry.sipConfig.inbound_trunk_id.slice(-8)}`
                            : 'Not configured'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`text-sm ${
                            entry.sipConfig?.outbound_trunk_id
                              ? 'text-slate-900'
                              : 'text-slate-400'
                          }`}
                        >
                          {entry.sipConfig?.outbound_trunk_id
                            ? `...${entry.sipConfig.outbound_trunk_id.slice(-8)}`
                            : 'Not configured'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`text-sm ${
                            entry.agentConfig ? 'text-slate-900' : 'text-slate-400'
                          }`}
                        >
                          {entry.agentConfig?.name || 'Not configured'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${status.style}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <span className="text-slate-400">
                          {isExpanded ? '▼' : '▶'}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${entry.phone_number}-details`}>
                        <td colSpan={6} className="px-6 py-4 bg-slate-50">
                          <div className="grid grid-cols-2 gap-6">
                            <div>
                              <h4 className="text-sm font-medium text-slate-700 mb-2">
                                SIP Configuration
                              </h4>
                              {entry.sipConfig ? (
                                <div className="bg-white p-3 rounded border border-slate-200 text-xs">
                                  <pre className="text-slate-600 overflow-x-auto">
                                    {JSON.stringify(entry.sipConfig, null, 2)}
                                  </pre>
                                </div>
                              ) : (
                                <p className="text-sm text-slate-400">
                                  No SIP configuration
                                </p>
                              )}
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-slate-700 mb-2">
                                Agent Configuration
                              </h4>
                              {entry.agentConfig ? (
                                <div className="bg-white p-3 rounded border border-slate-200 text-xs">
                                  <pre className="text-slate-600 overflow-x-auto">
                                    {JSON.stringify(entry.agentConfig, null, 2)}
                                  </pre>
                                </div>
                              ) : (
                                <p className="text-sm text-slate-400">
                                  No agent configuration
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ActivityLog storageKey="numbers-activity" maxEntries={20} />
    </div>
  );
}
