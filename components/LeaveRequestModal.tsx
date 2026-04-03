'use client';

import { useState } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  User, 
  Briefcase, 
  Building2, 
  CheckCircle, 
  XCircle,
  FileText,
  MessageSquare,
  Palmtree,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface LeaveRequest {
  id: number;
  employee_id: number;
  employee_name: string;
  leave_type_id: number;
  leave_type_name: string;
  leave_type_code?: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  start_half_day?: boolean;
  end_half_day?: boolean;
  reason?: string;
  status: string;
  approved_by_name?: string;
  approved_at?: string;
  rejection_reason?: string;
  created_at: string;
  // Infos employé supplémentaires (optionnel)
  department?: string;
  job_title?: string;
  manager_name?: string;
  leave_balance?: number;
}

interface LeaveRequestModalProps {
  request: LeaveRequest;
  onClose: () => void;
  onApprove?: (id: number) => Promise<void>;
  onReject?: (id: number, reason: string) => Promise<void>;
}

export default function LeaveRequestModal({ 
  request, 
  onClose, 
  onApprove, 
  onReject 
}: LeaveRequestModalProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { 
      weekday: 'long',
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-4 h-4 mr-1.5" />
            Approuvé
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-4 h-4 mr-1.5" />
            En attente
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            <XCircle className="w-4 h-4 mr-1.5" />
            Refusé
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  const getLeaveTypeColor = (code?: string) => {
    const colors: Record<string, string> = {
      'CA': 'bg-emerald-100 text-emerald-700 border-emerald-200',
      'RTT': 'bg-blue-100 text-blue-700 border-blue-200',
      'MAL': 'bg-red-100 text-red-700 border-red-200',
      'MAT': 'bg-pink-100 text-pink-700 border-pink-200',
      'PAT': 'bg-purple-100 text-purple-700 border-purple-200',
      'CSS': 'bg-gray-100 text-gray-700 border-gray-200',
      'EXC': 'bg-amber-100 text-amber-700 border-amber-200',
    };
    return colors[code || ''] || 'bg-primary-100 text-primary-700 border-primary-200';
  };

  const handleApprove = async () => {
    if (!onApprove) return;
    setIsApproving(true);
    try {
      await onApprove(request.id);
      onClose();
    } catch (error) {
      console.error('Erreur lors de l\'approbation:', error);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!onReject || !rejectionReason.trim()) return;
    setIsRejecting(true);
    try {
      await onReject(request.id, rejectionReason);
      onClose();
    } catch (error) {
      console.error('Erreur lors du refus:', error);
    } finally {
      setIsRejecting(false);
    }
  };

  const initials = request.employee_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                <Palmtree className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Demande de congé</h2>
                <p className="text-primary-100 text-sm">#{request.id} • Créée le {formatShortDate(request.created_at)}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Status */}
          <div className="flex items-center justify-between mb-6">
            {getStatusBadge(request.status)}
            <span className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${getLeaveTypeColor(request.leave_type_code)}`}>
              {request.leave_type_name}
            </span>
          </div>

          {/* Employee Info */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-lg">
                {initials}
              </div>
              <div className="ml-4 flex-1">
                <h3 className="font-semibold text-gray-900 text-lg">{request.employee_name}</h3>
                <div className="flex items-center text-sm text-gray-500 mt-0.5 flex-wrap gap-x-4 gap-y-1">
                  {request.job_title && (
                    <span className="flex items-center">
                      <Briefcase className="w-3.5 h-3.5 mr-1" />
                      {request.job_title}
                    </span>
                  )}
                  {request.department && (
                    <span className="flex items-center">
                      <Building2 className="w-3.5 h-3.5 mr-1" />
                      {request.department}
                    </span>
                  )}
                  {request.manager_name && (
                    <span className="flex items-center">
                      <User className="w-3.5 h-3.5 mr-1" />
                      Manager: {request.manager_name}
                    </span>
                  )}
                </div>
              </div>
              {request.leave_balance !== undefined && (
                <div className="text-right">
                  <p className="text-xs text-gray-500">Solde disponible</p>
                  <p className="text-lg font-bold text-primary-600">{request.leave_balance} jours</p>
                </div>
              )}
            </div>
          </div>

          {/* Period Details */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center text-gray-500 mb-2">
                <Calendar className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">Date de début</span>
              </div>
              <p className="font-semibold text-gray-900">{formatDate(request.start_date)}</p>
              {request.start_half_day && (
                <span className="text-xs text-amber-600 mt-1 inline-block">Demi-journée (après-midi)</span>
              )}
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center text-gray-500 mb-2">
                <Calendar className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">Date de fin</span>
              </div>
              <p className="font-semibold text-gray-900">{formatDate(request.end_date)}</p>
              {request.end_half_day && (
                <span className="text-xs text-amber-600 mt-1 inline-block">Demi-journée (matin)</span>
              )}
            </div>
          </div>

          {/* Duration */}
          <div className="bg-primary-50 border border-primary-100 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Clock className="w-5 h-5 text-primary-600 mr-2" />
                <span className="text-primary-700 font-medium">Durée totale</span>
              </div>
              <span className="text-2xl font-bold text-primary-700">
                {request.days_requested} jour{request.days_requested > 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Reason */}
          {request.reason && (
            <div className="mb-6">
              <div className="flex items-center text-gray-700 mb-2">
                <MessageSquare className="w-4 h-4 mr-2" />
                <span className="font-medium">Motif</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-gray-600">
                {request.reason}
              </div>
            </div>
          )}

          {/* Rejection Reason (if rejected) */}
          {request.status === 'rejected' && request.rejection_reason && (
            <div className="mb-6">
              <div className="flex items-center text-red-700 mb-2">
                <AlertCircle className="w-4 h-4 mr-2" />
                <span className="font-medium">Motif du refus</span>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-lg p-4 text-red-700">
                {request.rejection_reason}
              </div>
            </div>
          )}

          {/* Approved By (if approved) */}
          {request.status === 'approved' && request.approved_by_name && (
            <div className="bg-green-50 border border-green-100 rounded-lg p-4 mb-6">
              <div className="flex items-center text-green-700">
                <CheckCircle className="w-4 h-4 mr-2" />
                <span>
                  Approuvé par <strong>{request.approved_by_name}</strong>
                  {request.approved_at && ` le ${formatShortDate(request.approved_at)}`}
                </span>
              </div>
            </div>
          )}

          {/* Rejection Form */}
          {showRejectForm && (
            <div className="mb-6">
              <div className="flex items-center text-gray-700 mb-2">
                <FileText className="w-4 h-4 mr-2" />
                <span className="font-medium">Motif du refus <span className="text-red-500">*</span></span>
              </div>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Indiquez la raison du refus..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                rows={3}
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {request.status === 'pending' && (onApprove || onReject) && (
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
            {!showRejectForm ? (
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                >
                  Fermer
                </button>
                <button
                  onClick={() => setShowRejectForm(true)}
                  className="flex items-center px-5 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium transition-colors"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Refuser
                </button>
                <button
                  onClick={handleApprove}
                  disabled={isApproving}
                  className="flex items-center px-5 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium transition-colors disabled:opacity-50"
                >
                  {isApproving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Approuver
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setShowRejectForm(false);
                    setRejectionReason('');
                  }}
                  className="px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleReject}
                  disabled={isRejecting || !rejectionReason.trim()}
                  className="flex items-center px-5 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium transition-colors disabled:opacity-50"
                >
                  {isRejecting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-2" />
                  )}
                  Confirmer le refus
                </button>
              </div>
            )}
          </div>
        )}

        {/* Close button for non-pending */}
        {request.status !== 'pending' && (
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
