import React, { useState, useEffect } from 'react';
import { UserCheck, Plus, Search, Trash2, Phone, Calendar, Car, AlertCircle, Check } from 'lucide-react';
import { OwnerRegistry, OwnerRecord } from '../types';
import { ConfirmModal } from './ConfirmModal';

interface AdminRegistryManagerProps {
  adminToken: string;
}

export const AdminRegistryManager: React.FC<AdminRegistryManagerProps> = ({ adminToken }) => {
  const [registry, setRegistry] = useState<OwnerRegistry>({});
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [plateToDelete, setPlateToDelete] = useState<string | null>(null);

  // Form states
  const [plate, setPlate] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleType, setVehicleType] = useState<'car' | 'suv' | 'motorcycle' | 'van'>('car');

  const fetchRegistry = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/admin/api/registry', {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRegistry(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistry();
  }, [adminToken]);

  const handleAddOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plate.trim() || !name.trim() || !phone.trim()) return;

    try {
      const res = await fetch('/admin/api/registry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          plate: plate.trim().toUpperCase(),
          name: name.trim(),
          phone: phone.trim(),
          vehicle_type: vehicleType,
          registered_on: new Date().toISOString().split('T')[0]
        })
      });

      if (res.ok) {
        setStatusMessage(`Successfully registered ${plate.toUpperCase()}`);
        setShowAddModal(false);
        setPlate('');
        setName('');
        setPhone('');
        fetchRegistry();
      }
    } catch (err: any) {
      setStatusMessage('Error saving: ' + err.message);
    }
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleDelete = (targetPlate: string) => {
    setPlateToDelete(targetPlate);
  };

  const executeDelete = async () => {
    if (!plateToDelete) return;
    const targetPlate = plateToDelete;
    setPlateToDelete(null);

    try {
      const res = await fetch(`/admin/api/registry/${targetPlate}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (res.ok) {
        setStatusMessage(`Removed ${targetPlate}`);
        fetchRegistry();
      }
    } catch (err: any) {
      setStatusMessage('Error: ' + err.message);
    }
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const filteredEntries = Object.entries(registry).filter(([plt, recordVal]) => {
    const record = recordVal as OwnerRecord;
    const q = search.toLowerCase();
    return (
      plt.toLowerCase().includes(q) ||
      record.name.toLowerCase().includes(q) ||
      record.phone.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-800 p-4 rounded-xl border border-slate-700">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span>MCKL Vehicle & Owner Registry</span>
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-1.5 shadow-md shadow-emerald-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>Register Vehicle</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Search Filter */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by plate number, owner name, or contact number..."
          className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Registry Table */}
      <div className="bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700 text-[10px]">
              <tr>
                <th className="py-3 px-4">License Plate</th>
                <th className="py-3 px-4">Registered Owner</th>
                <th className="py-3 px-4">Phone Contact</th>
                <th className="py-3 px-4">Vehicle Type</th>
                <th className="py-3 px-4">Date Registered</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {filteredEntries.map(([plt, recordVal]) => {
                const record = recordVal as OwnerRecord;
                return (
                <tr key={plt} className="hover:bg-slate-700/40 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-amber-400">
                    {plt}
                  </td>
                  <td className="py-3 px-4 font-medium text-white">
                    {record.name}
                  </td>
                  <td className="py-3 px-4 font-mono text-emerald-300">
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-emerald-500" />
                      {record.phone}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="capitalize px-2 py-0.5 rounded bg-slate-700/80 text-slate-300 border border-slate-600 text-[10px]">
                      {record.vehicle_type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    {record.registered_on}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(plt)}
                      className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-700 transition-colors"
                      title="Delete entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
                );
              })}

              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No registry records matching your query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-slate-900 rounded-2xl border border-slate-700 p-6 text-white shadow-2xl">
            <h4 className="font-bold text-base mb-1 flex items-center gap-2">
              <Car className="w-4 h-4 text-emerald-400" />
              <span>Register New Vehicle Record</span>
            </h4>
            <p className="text-xs text-slate-400 mb-4">
              Authorized MCKL campus registration. Phone numbers remain confidential to administrators.
            </p>

            <form onSubmit={handleAddOwner} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  License Plate Number
                </label>
                <input
                  type="text"
                  value={plate}
                  onChange={(e) => setPlate(e.target.value)}
                  placeholder="e.g. WXX1234"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm uppercase font-mono text-amber-300 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Owner Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Tan Wei Ming"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Phone Number (Confidential)
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +6012-3456789"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-emerald-300 font-mono focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Vehicle Type
                </label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="car">Car (Sedan/Hatchback)</option>
                  <option value="suv">SUV / 4x4</option>
                  <option value="van">Van / Utility</option>
                  <option value="motorcycle">Motorcycle</option>
                </select>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-md shadow-emerald-600/30"
                >
                  Save to Registry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Non-blocking Confirm Modal */}
      <ConfirmModal
        isOpen={Boolean(plateToDelete)}
        title={`Delete Vehicle ${plateToDelete || ''}`}
        message={`Are you sure you want to remove vehicle ${plateToDelete || ''} from the owner registry? Registered contact details will be deleted.`}
        confirmLabel="Delete Vehicle"
        isDestructive={true}
        onConfirm={executeDelete}
        onCancel={() => setPlateToDelete(null)}
      />
    </div>
  );
};
