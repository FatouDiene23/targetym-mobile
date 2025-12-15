'use client';

import { useState } from 'react';
import { X, User, Building2, Layers } from 'lucide-react';
import AddEmployeeModal from './AddEmployeeModal';
import AddDepartmentModal from './AddDepartmentModal';
import AddServiceModal from './AddServiceModal';

interface AddModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type ModalType = 'choice' | 'employee' | 'department' | 'service';

export default function AddModal({ onClose, onSuccess }: AddModalProps) {
  const [activeModal, setActiveModal] = useState<ModalType>('choice');

  if (activeModal === 'employee') {
    return <AddEmployeeModal onClose={onClose} onSuccess={onSuccess} />;
  }

  if (activeModal === 'department') {
    return <AddDepartmentModal onClose={onClose} onSuccess={onSuccess} />;
  }

  if (activeModal === 'service') {
    return <AddServiceModal onClose={onClose} onSuccess={onSuccess} />;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Que souhaitez-vous ajouter ?</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options */}
        <div className="p-6 space-y-3">
          {/* Employé */}
          <button
            onClick={() => setActiveModal('employee')}
            className="w-full flex items-center p-4 border-2 border-gray-200 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all group"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition-colors">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4 text-left">
              <p className="font-semibold text-gray-900">Employé</p>
              <p className="text-sm text-gray-500">Ajouter un nouveau collaborateur</p>
            </div>
          </button>

          {/* Département */}
          <button
            onClick={() => setActiveModal('department')}
            className="w-full flex items-center p-4 border-2 border-gray-200 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all group"
          >
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center group-hover:bg-purple-200 transition-colors">
              <Building2 className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4 text-left">
              <p className="font-semibold text-gray-900">Département</p>
              <p className="text-sm text-gray-500">Créer un département principal</p>
            </div>
          </button>

          {/* Service */}
          <button
            onClick={() => setActiveModal('service')}
            className="w-full flex items-center p-4 border-2 border-gray-200 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all group"
          >
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center group-hover:bg-green-200 transition-colors">
              <Layers className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4 text-left">
              <p className="font-semibold text-gray-900">Service</p>
              <p className="text-sm text-gray-500">Ajouter un service à un département</p>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm text-gray-600 font-medium hover:bg-gray-200 rounded-lg"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
