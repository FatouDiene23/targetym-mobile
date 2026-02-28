'use client';

import { useLearning } from '../LearningContext';
import { hasPermission, getCertStatusColor } from '../shared';
import { Award, Plus, AlertTriangle, Users, Eye } from 'lucide-react';

export default function CertificationsPage() {
  const { userRole, stats, certifications, setShowCreateCertification, setShowCertHolders, fetchCertificationHolders } = useLearning();

  return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Certifications</h2>
                <p className="text-sm text-gray-500">Certifications et habilitations de l'équipe</p>
              </div>
              <div className="flex gap-3">
                <div className="bg-white rounded-xl px-4 py-2.5 shadow-sm border border-gray-100 text-center">
                  <p className="text-lg font-bold text-primary-600">{certifications.length}</p>
                  <p className="text-xs text-gray-500">Certifications</p>
                </div>
                {(stats?.expiring_certifications ?? 0) > 0 && (
                  <div className="bg-orange-50 rounded-xl px-4 py-2.5 border border-orange-200 text-center">
                    <p className="text-lg font-bold text-orange-600">{stats!.expiring_certifications}</p>
                    <p className="text-xs text-orange-600">Expirent bientôt</p>
                  </div>
                )}
                {hasPermission(userRole, 'create_certification') && (
                  <button onClick={() => setShowCreateCertification(true)} className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600">
                    <Plus className="w-4 h-4 mr-2" />Ajouter Certification
                  </button>
                )}
              </div>
            </div>
            {stats?.expiring_certifications && stats.expiring_certifications > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                <div className="flex-1"><p className="text-sm font-medium text-orange-800">{stats.expiring_certifications} certifications expirent dans les 3 prochains mois</p></div>
              </div>
            )}
            {certifications.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center">
                <Award className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Aucune certification créée</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {certifications.map((cert) => (
                  <div key={cert.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md" onClick={() => { setShowCertHolders(cert); fetchCertificationHolders(cert.id); }}>
                    <div className="p-5 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center"><Award className="w-6 h-6 text-purple-600" /></div>
                          <div><h4 className="font-semibold text-gray-900">{cert.name}</h4><p className="text-sm text-gray-500">{cert.provider}</p></div>
                        </div>
                        <div className="text-right"><p className="text-2xl font-bold text-gray-900">{cert.total_holders}</p><p className="text-xs text-gray-500">titulaires</p></div>
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Validité: {cert.validity_months ? `${cert.validity_months} mois` : 'Permanent'}</span>
                        {cert.expiring_soon > 0 && <span className="text-xs text-orange-600 flex items-center"><AlertTriangle className="w-3 h-3 mr-1" />{cert.expiring_soon} expiration(s)</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

  );
}
