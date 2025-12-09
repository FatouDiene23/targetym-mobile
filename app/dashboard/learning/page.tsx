'use client';

import Header from '@/components/Header';
import { useState } from 'react';
import { 
  BookOpen, 
  Award, 
  Clock, 
  Users,
  CheckCircle,
  Star,
  Plus
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

const courses = [
  { 
    id: 1, 
    title: 'Leadership & Management', 
    category: 'Soft Skills',
    duration: '8h',
    enrolled: 45,
    completed: 28,
    rating: 4.8,
    image: '📊'
  },
  { 
    id: 2, 
    title: 'Communication Efficace', 
    category: 'Soft Skills',
    duration: '4h',
    enrolled: 62,
    completed: 55,
    rating: 4.6,
    image: '💬'
  },
  { 
    id: 3, 
    title: 'Excel Avancé', 
    category: 'Technique',
    duration: '12h',
    enrolled: 38,
    completed: 20,
    rating: 4.9,
    image: '📈'
  },
  { 
    id: 4, 
    title: 'Gestion de Projet Agile', 
    category: 'Management',
    duration: '10h',
    enrolled: 52,
    completed: 35,
    rating: 4.7,
    image: '🎯'
  },
  { 
    id: 5, 
    title: 'Cybersécurité', 
    category: 'Technique',
    duration: '6h',
    enrolled: 85,
    completed: 72,
    rating: 4.5,
    image: '🔒'
  },
];

const certifications = [
  { id: 1, name: 'PMP - Project Management', holders: 12, expiringSoon: 3 },
  { id: 2, name: 'AWS Solutions Architect', holders: 8, expiringSoon: 1 },
  { id: 3, name: 'Scrum Master', holders: 15, expiringSoon: 2 },
  { id: 4, name: 'Google Analytics', holders: 22, expiringSoon: 5 },
];

const learningProgress = [
  { month: 'Jan', completions: 45 },
  { month: 'Fév', completions: 52 },
  { month: 'Mar', completions: 48 },
  { month: 'Avr', completions: 61 },
  { month: 'Mai', completions: 55 },
  { month: 'Jun', completions: 67 },
  { month: 'Jul', completions: 72 },
  { month: 'Aoû', completions: 58 },
  { month: 'Sep', completions: 78 },
  { month: 'Oct', completions: 85 },
  { month: 'Nov', completions: 92 },
  { month: 'Déc', completions: 88 },
];

const recentActivity = [
  { user: 'Marie Dupont', action: 'a terminé', course: 'Leadership & Management', time: '2h' },
  { user: 'Jean Martin', action: 'a commencé', course: 'Excel Avancé', time: '4h' },
  { user: 'Sophie Bernard', action: 'a obtenu la certification', course: 'Scrum Master', time: '1j' },
  { user: 'Pierre Leroy', action: 'a terminé', course: 'Cybersécurité', time: '1j' },
];

export default function LearningPage() {
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const categories = ['Tous', 'Soft Skills', 'Technique', 'Management'];

  return (
    <>
      <Header title="Formation & Développement" subtitle="Parcours d'apprentissage, certifications et suivi des compétences" />
      
      <main className="flex-1 p-6 overflow-auto">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Cours Disponibles</p>
                <p className="text-2xl font-bold text-gray-900">24</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Formations Complétées</p>
                <p className="text-2xl font-bold text-green-600">342</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Certifications</p>
                <p className="text-2xl font-bold text-purple-600">57</p>
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Award className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Heures de Formation</p>
                <p className="text-2xl font-bold text-orange-600">1,248h</p>
              </div>
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          {/* Learning Progress Chart */}
          <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Évolution des Formations Complétées</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={learningProgress}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                  <YAxis stroke="#9CA3AF" fontSize={12} />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="completions" 
                    stroke="#8B5CF6" 
                    strokeWidth={3}
                    dot={{ fill: '#8B5CF6', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Activité Récente</h3>
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-start">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-medium text-purple-700">
                    {activity.user.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">{activity.user}</span> {activity.action} <span className="font-medium">{activity.course}</span>
                    </p>
                    <p className="text-xs text-gray-400">Il y a {activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Courses Section */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Catalogue de Formations</h3>
            <div className="flex gap-3">
              <div className="flex gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      selectedCategory === cat
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <button className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600">
                <Plus className="w-4 h-4 mr-2" />
                Ajouter
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.filter(c => selectedCategory === 'Tous' || c.category === selectedCategory).map((course) => (
              <div key={course.id} className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-2xl">
                    {course.image}
                  </div>
                  <div className="flex items-center">
                    <Star className="w-4 h-4 text-yellow-500 mr-1" />
                    <span className="text-sm font-medium text-gray-700">{course.rating}</span>
                  </div>
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">{course.title}</h4>
                <p className="text-sm text-gray-500 mb-3">{course.category} • {course.duration}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-sm text-gray-500">
                    <Users className="w-4 h-4 mr-1" />
                    {course.enrolled} inscrits
                  </div>
                  <div className="w-20 h-2 bg-gray-200 rounded-full">
                    <div 
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${(course.completed / course.enrolled) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Certifications */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Certifications</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {certifications.map((cert) => (
              <div key={cert.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <Award className="w-5 h-5 text-purple-600 mr-2" />
                  <h4 className="font-medium text-gray-900 text-sm">{cert.name}</h4>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{cert.holders} titulaires</span>
                  {cert.expiringSoon > 0 && (
                    <span className="text-orange-600">{cert.expiringSoon} expirent bientôt</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
