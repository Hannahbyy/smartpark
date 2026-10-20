import React, { useState, useEffect } from 'react';
import { Camera, CheckCircle2, AlertTriangle, RefreshCw, BarChart2, ShieldCheck, ShieldAlert } from 'lucide-react';
import { PlateRead } from '../types';

interface AdminPlateReadsProps {
  adminToken: string;
}

export const AdminPlateReads: React.FC<AdminPlateReadsProps> = ({ adminToken }) => {
  const [reads, setReads] = useState<PlateRead[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchReads = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/admin/api/plate_reads', {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReads(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReads();
    const interval = setInterval(fetchReads, 3500);
    return () => clearInterval(interval);
  }, [adminToken]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-800 p-4 rounded-xl border border-slate-700">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-purple-400" />
            <span>Live OCR Plate Reads</span>
          </h3>
        </div>

        <button
          type="button"
          onClick={fetchReads}
          className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-white flex items-center gap-1.5 border border-slate-600"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700 text-[10px]">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Recognized Plate</th>
                <th className="py-3 px-4">Confidence Score</th>
                <th className="py-3 px-4">Associated Bay</th>
                <th className="py-3 px-4">Registry Match Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60 font-mono">
              {reads.map((read) => {
                const confPercent = Math.round(read.confidence * 100);
                const isHighConf = confPercent >= 85;
                const isMedConf = confPercent >= 70 && confPercent < 85;

                return (
                  <tr key={read.id} className="hover:bg-slate-700/40 transition-colors">
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {read.timestamp}
                    </td>
                    <td className="py-3 px-4 text-sm font-bold text-amber-300 tracking-wider">
                      {read.plate}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-700 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full ${
                              isHighConf ? 'bg-emerald-500' : isMedConf ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${confPercent}%` }}
                          />
                        </div>
                        <span className={`text-[11px] font-semibold ${
                          isHighConf ? 'text-emerald-400' : isMedConf ? 'text-amber-400' : 'text-rose-400'
                        }`}>
                          {confPercent}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-sans">
                      {read.spotId ? (
                        <span className="px-2 py-0.5 rounded bg-blue-900/40 text-blue-300 border border-blue-700/40 font-mono text-[11px]">
                          {read.spotId}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">Drive Lane</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-sans">
                      {read.registered ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px]">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Matched: {read.ownerName}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-400 border border-slate-600 text-[11px]">
                          <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
                          <span>Unregistered / Guest</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {reads.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 font-sans">
                    No plate reads captured in current window.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
