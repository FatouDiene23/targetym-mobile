'use client';

import { useLearning } from '../LearningContext';
import { useI18n } from '@/lib/i18n/I18nContext';
import { hasPermission, getCertStatusColor } from '../shared';
import { Award, Plus, AlertTriangle, Users, Eye } from 'lucide-react';

export default function CertificationsPage() {
  const { userRole, stats, certifications, setShowCreateCertification, setShowCertHolders, fetchCertificationHolders } = useLearning();
  const { t } = useI18n();
  const tc = t.training.certifications_page;

  return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">{tc.certificationsLabel}</p>
                    <p className="text-2xl font-bold text-primary-600">{certifications.length}</p>
                  </div>
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                    <Award className="w-5 h-5 text-primary-600" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">{tc.totalHolders}</p>
                    <p className="text-2xl font-bold text-primary-600">{certifications.reduce((s, c) => s + (c.total_holders || 0), 0)}</p>
                  </div>
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary-600" />
                  </div>
                </div>
              </div>
              <div className={`rounded-xl p-4 shadow-sm border ${(stats?.expiring_certifications ?? 0) > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-xs ${(stats?.expiring_certifications ?? 0) > 0 ? 'text-orange-600' : 'text-gray-500'}`}>{tc.expiringSoon}</p>
                    <p className={`text-2xl font-bold ${(stats?.expiring_certifications ?? 0) > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{stats?.expiring_certifications ?? 0}</p>
                  </div>
                  <div className={`w-10 h-10 ${(stats?.expiring_certifications ?? 0) > 0 ? 'bg-orange-100' : 'bg-gray-100'} rounded-lg flex items-center justify-center`}>
                    <AlertTriangle className={`w-5 h-5 ${(stats?.expiring_certifications ?? 0) > 0 ? 'text-orange-600' : 'text-gray-400'}`} />
                  </div>
                </div>
              </div>
            </div>
            {hasPermission(userRole, 'create_certification') && (
              <div className="flex justify-end mb-2">
                <button onClick={() => setShowCreateCertification(true)} className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600">
                  <Plus className="w-4 h-4 mr-2" />{tc.addCertification}
                </button>
              </div>
            )}
            {stats?.expiring_certifications && stats.expiring_certifications > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                <div className="flex-1"><p className="text-sm font-medium text-orange-800">{stats.expiring_certifications} {tc.expireIn3Months}</p></div>
              </div>
            )}
            {certifications.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center">
                <Award className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">{tc.noCertificationCreated}</p>
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
                        <div className="text-right"><p className="text-2xl font-bold text-gray-900">{cert.total_holders}</p><p className="text-xs text-gray-500">{tc.holdersLabel}</p></div>
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">{tc.validity}: {cert.validity_months ? `${cert.validity_months} ${tc.months}` : tc.permanent}</span>
                        {cert.expiring_soon > 0 && <span className="text-xs text-orange-600 flex items-center"><AlertTriangle className="w-3 h-3 mr-1" />{cert.expiring_soon} {tc.expirations}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

  );
}
