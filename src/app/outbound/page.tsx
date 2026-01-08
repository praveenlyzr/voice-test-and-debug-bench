'use client';

import CallTrigger from '@/components/CallTrigger';

export default function OutboundPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Outbound Calls</h1>
        <p className="text-sm text-slate-600">
          Trigger outbound SIP calls and view logs.
        </p>
      </div>
      <CallTrigger />
    </div>
  );
}
