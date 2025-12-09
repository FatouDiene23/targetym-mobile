'use client';

import Header from '@/components/Header';
import { useState } from 'react';
import { 
  User, 
  Building2, 
  Bell, 
  Shield, 
  Link2,
  Users,
  CreditCard,
  Save,
  Check
} from 'lucide-react';

const integrations = [
  { id: 'slack', name: 'Slack', description: 'Notifications et alertes', connected: true, icon: '💬' },
  { id: 'teams', name: 'Microsoft Teams', description: 'Communication d\'équipe', connected: false, icon: '👥' },
  { id: 'asana', name: 'Asana', description: 'Gestion de projets', connected: true, icon: '📋' },
  { id: 'notion', name: 'Notion', description: 'Documentation', connected: false, icon: '📝' },
  { id: 'zoho', name: 'Zoho CRM', description: 'Gestion clients', connected: false, icon: '🎯' },
  { id: 'google', name: 'Google Workspace', description: 'Suite Google', connected: true, icon: '🔷' },
];

const teamMembers = [
  { id: 1, name: 'Marie Reine', email: 'marie@targetym.ai', role: 'Super Admin', status: 'active' },
  { id: 2, name: 'Jean Martin', email: 'jean@targetym.ai', role: 'Admin RH', status: 'active' },
  { id: 3, name: 'Sophie Bernard', email: 'sophie@targetym.ai', role: 'Manager', status: 'active' },
  { id: 4, name: 'Pierre Leroy', email: 'pierre@targetym.ai', role: 'Recruteur', status: 'pending' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const tabs = [
    { id: 'general', name: 'Général', icon: Building2 },
    { id: 'profile', name: 'Mon Profil', icon: User },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'security', name: 'Sécurité', icon: Shield },
    { id: 'integrations', name: 'Intégrations', icon: Link2 },
    { id: 'team', name: 'Équipe', icon: Users },
    { id: 'billing', name: 'Facturation', icon: CreditCard },
  ];

  return (
    <>
      <Header title="Paramètres" subtitle="Configuration de votre espace Targetym AI" />
      
      <main className="flex-1 p-6 overflow-auto">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 h-fit">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <tab.icon className="w-5 h-5 mr-3" />
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            {activeTab === 'general' && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Paramètres Généraux</h3>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nom de l&apos;Entreprise
                    </label>
                    <input
                      type="text"
                      defaultValue="Ma Société SAS"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email de Contact
                    </label>
                    <input
                      type="email"
                      defaultValue="contact@masociete.com"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fuseau Horaire
                    </label>
                    <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
                      <option>Europe/Paris (UTC+1)</option>
                      <option>Africa/Dakar (UTC+0)</option>
                      <option>America/New_York (UTC-5)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Langue
                    </label>
                    <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
                      <option>Français</option>
                      <option>English</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Année Fiscale
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <select className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
                        <option>Janvier</option>
                        <option>Avril</option>
                        <option>Juillet</option>
                        <option>Octobre</option>
                      </select>
                      <select className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
                        <option>Décembre</option>
                        <option>Mars</option>
                        <option>Juin</option>
                        <option>Septembre</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
                  <button 
                    onClick={handleSave}
                    className="flex items-center px-6 py-2.5 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 transition-colors"
                  >
                    {saved ? <Check className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    {saved ? 'Enregistré !' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Mon Profil</h3>
                
                <div className="flex items-center mb-8">
                  <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-2xl font-bold">
                    MR
                  </div>
                  <div className="ml-6">
                    <button className="px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600">
                      Changer la photo
                    </button>
                    <p className="text-sm text-gray-500 mt-2">JPG, PNG. Max 2MB</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Prénom</label>
                    <input
                      type="text"
                      defaultValue="Marie"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nom</label>
                    <input
                      type="text"
                      defaultValue="Reine"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      defaultValue="marie.reine@company.com"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Téléphone</label>
                    <input
                      type="tel"
                      defaultValue="+221 77 123 45 67"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
                  <button 
                    onClick={handleSave}
                    className="flex items-center px-6 py-2.5 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600"
                  >
                    {saved ? <Check className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    {saved ? 'Enregistré !' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Préférences de Notifications</h3>
                
                <div className="space-y-6">
                  {[
                    { title: 'Nouvelles candidatures', description: 'Recevoir une alerte pour chaque nouvelle candidature' },
                    { title: 'Évaluations en attente', description: 'Rappel pour les évaluations à compléter' },
                    { title: 'Objectifs OKR', description: 'Mises à jour sur les objectifs de l\'équipe' },
                    { title: 'Alertes IA', description: 'Insights et recommandations de l\'IA' },
                    { title: 'Rapports hebdomadaires', description: 'Résumé hebdomadaire par email' },
                  ].map((item, index) => (
                    <div key={index} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="font-medium text-gray-900">{item.title}</p>
                        <p className="text-sm text-gray-500">{item.description}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" defaultChecked={index < 3} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'integrations' && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Intégrations</h3>
                
                <div className="grid md:grid-cols-2 gap-4">
                  {integrations.map((integration) => (
                    <div key={integration.id} className="border border-gray-200 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <span className="text-2xl mr-3">{integration.icon}</span>
                          <div>
                            <h4 className="font-semibold text-gray-900">{integration.name}</h4>
                            <p className="text-sm text-gray-500">{integration.description}</p>
                          </div>
                        </div>
                      </div>
                      <button className={`w-full py-2 text-sm font-medium rounded-lg transition-colors ${
                        integration.connected
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}>
                        {integration.connected ? '✓ Connecté' : 'Connecter'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'team' && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Gestion de l&apos;Équipe</h3>
                  <button className="px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600">
                    + Inviter un membre
                  </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Membre</th>
                        <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Rôle</th>
                        <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Statut</th>
                        <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamMembers.map((member) => (
                        <tr key={member.id} className="border-t border-gray-100">
                          <td className="px-4 py-4">
                            <div className="flex items-center">
                              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium">
                                {member.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <div className="ml-3">
                                <p className="font-medium text-gray-900">{member.name}</p>
                                <p className="text-sm text-gray-500">{member.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <select className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                              <option selected={member.role === 'Super Admin'}>Super Admin</option>
                              <option selected={member.role === 'Admin RH'}>Admin RH</option>
                              <option selected={member.role === 'Manager'}>Manager</option>
                              <option selected={member.role === 'Recruteur'}>Recruteur</option>
                            </select>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              member.status === 'active' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {member.status === 'active' ? 'Actif' : 'En attente'}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <button className="text-sm text-red-600 hover:text-red-700 font-medium">
                              Retirer
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Sécurité</h3>
                
                <div className="space-y-6">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Changer le mot de passe</h4>
                    <div className="space-y-3">
                      <input
                        type="password"
                        placeholder="Mot de passe actuel"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                      />
                      <input
                        type="password"
                        placeholder="Nouveau mot de passe"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                      />
                      <input
                        type="password"
                        placeholder="Confirmer le nouveau mot de passe"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                      />
                      <button className="px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600">
                        Mettre à jour
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900">Authentification à deux facteurs</h4>
                      <p className="text-sm text-gray-500">Ajoutez une couche de sécurité supplémentaire</p>
                    </div>
                    <button className="px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600">
                      Activée
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900">Sessions actives</h4>
                      <p className="text-sm text-gray-500">Gérez vos appareils connectés</p>
                    </div>
                    <button className="text-sm text-primary-600 font-medium hover:text-primary-700">
                      Voir tout
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'billing' && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Facturation</h3>
                
                <div className="p-6 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-xl text-white mb-6">
                  <p className="text-primary-100 text-sm">Plan actuel</p>
                  <h4 className="text-2xl font-bold mt-1">Entreprise</h4>
                  <p className="text-primary-100 mt-2">125€/mois • Jusqu&apos;à 1 000 employés</p>
                  <button className="mt-4 px-4 py-2 bg-white text-primary-600 text-sm font-medium rounded-lg hover:bg-gray-100">
                    Changer de plan
                  </button>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Historique des factures</h4>
                  {[
                    { date: 'Dec 2024', amount: '125€', status: 'Payée' },
                    { date: 'Nov 2024', amount: '125€', status: 'Payée' },
                    { date: 'Oct 2024', amount: '125€', status: 'Payée' },
                  ].map((invoice, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{invoice.date}</p>
                        <p className="text-sm text-gray-500">{invoice.amount}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                          {invoice.status}
                        </span>
                        <button className="text-sm text-primary-600 font-medium hover:text-primary-700">
                          Télécharger
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
