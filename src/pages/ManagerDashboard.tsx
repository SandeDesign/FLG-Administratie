import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Clock,
  CheckCircle,
  Zap,
  Factory,
  Upload,
} from 'lucide-react';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';

const ManagerDashboard: React.FC = () => {
  const { user } = useAuth();
  const { selectedCompany, queryUserId, employees } = useApp();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalTeam: 0,
    activeMembers: 0,
  });

  // Determine if this is a project company
  const isProjectCompany = selectedCompany?.companyType === 'project' || selectedCompany?.companyType === 'work_company';

  const loadData = useCallback(async () => {
    if (!user || !selectedCompany || !queryUserId) {
      console.log('No user, selectedCompany, or queryUserId');
      return;
    }

    try {
      setLoading(true);
      console.log('Loading manager data for company:', selectedCompany.id, 'queryUserId:', queryUserId);

      // For project companies, filter employees by workCompanies/projectCompanies
      // employees are already loaded via AppContext
      let filteredEmployees = employees;
      if (isProjectCompany) {
        filteredEmployees = employees.filter(emp =>
          emp.workCompanies?.includes(selectedCompany.id) ||
          emp.projectCompanies?.includes(selectedCompany.id)
        );
      } else {
        filteredEmployees = employees.filter(emp => emp.companyId === selectedCompany.id);
      }

      console.log('Filtered employees:', filteredEmployees.length);
      setTeamMembers(filteredEmployees.slice(0, 8));

      // Calculate stats
      setStats({
        totalTeam: filteredEmployees.length,
        activeMembers: filteredEmployees.filter(e => e.status === 'active').length,
      });
      console.log('Manager data loaded successfully');
    } catch (error) {
      console.error('Error loading manager data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, selectedCompany, queryUserId, employees, isProjectCompany]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!selectedCompany) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Selecteer een bedrijf</p>
      </div>
    );
  }

  // Stats for project company vs employer company
  const projectStats = isProjectCompany ? [
    { label: 'Werknemers', value: stats.totalTeam, icon: Users },
    { label: 'Actief', value: stats.activeMembers, icon: CheckCircle },
  ] : [
    { label: 'Team Grootte', value: stats.totalTeam, icon: Users },
    { label: 'Actief', value: stats.activeMembers, icon: CheckCircle },
  ];

  return (
    <div className="space-y-8 pb-24 sm:pb-0">
      {/* Header Section */}
      <div className={`bg-gradient-to-r ${isProjectCompany ? 'from-emerald-600 to-emerald-700' : 'from-indigo-600 to-indigo-700'} rounded-2xl p-8 text-white shadow-lg`}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold mb-2">
              {isProjectCompany ? 'Project Dashboard' : 'Manager Dashboard'}
            </h1>
            <p className={`${isProjectCompany ? 'text-emerald-100' : 'text-indigo-100'} flex items-center gap-2`}>
              {isProjectCompany ? <Factory className="h-4 w-4" /> : <Users className="h-4 w-4" />}
              {selectedCompany?.name || 'Bedrijf'}
            </p>
          </div>
          <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center">
            {isProjectCompany ? <Factory className="h-8 w-8 text-white" /> : <Users className="h-8 w-8 text-white" />}
          </div>
        </div>

        {/* Quick Stats */}
        <div className={`grid grid-cols-2 gap-4`}>
          {projectStats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-4 w-4 ${isProjectCompany ? 'text-emerald-100' : 'text-indigo-100'}`} />
                  <p className={`text-xs ${isProjectCompany ? 'text-emerald-100' : 'text-indigo-100'}`}>{stat.label}</p>
                </div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Actions - Different for project vs employer companies */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Zap className="h-6 w-6 text-amber-500" />
          Snelle Acties
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {isProjectCompany ? (
            // Project Company Manager Actions
            <>
              <button onClick={() => navigate('/project-production')} className="group">
                <div className="relative overflow-hidden rounded-xl p-6 h-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95">
                  <div className="flex flex-col items-center text-center h-full justify-center">
                    <div className="inline-flex p-4 bg-emerald-100 rounded-xl mb-3 group-hover:scale-110 transition-transform duration-200">
                      <Factory className="h-6 w-6 text-emerald-600" />
                    </div>
                    <h3 className="font-bold text-sm mb-1">Productie</h3>
                    <p className="text-xs text-white/80">Overzicht</p>
                  </div>
                </div>
              </button>
              <button onClick={() => navigate('/incoming-invoices')} className="group">
                <div className="relative overflow-hidden rounded-xl p-6 h-full bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95">
                  <div className="flex flex-col items-center text-center h-full justify-center">
                    <div className="inline-flex p-4 bg-blue-100 rounded-xl mb-3 group-hover:scale-110 transition-transform duration-200">
                      <Upload className="h-6 w-6 text-blue-600" />
                    </div>
                    <h3 className="font-bold text-sm mb-1">Inkoop</h3>
                    <p className="text-xs text-white/80">Facturen</p>
                  </div>
                </div>
              </button>
            </>
          ) : (
            // Employer Company Manager Actions
            <>
              <button onClick={() => navigate('/timesheet-approvals')} className="group">
                <div className="relative overflow-hidden rounded-xl p-6 h-full bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95">
                  <div className="flex flex-col items-center text-center h-full justify-center">
                    <div className="inline-flex p-4 bg-blue-100 rounded-xl mb-3 group-hover:scale-110 transition-transform duration-200">
                      <Clock className="h-6 w-6 text-blue-600" />
                    </div>
                    <h3 className="font-bold text-sm mb-1">Uren</h3>
                    <p className="text-xs text-white/80">Goedkeuren</p>
                  </div>
                </div>
              </button>
              <button onClick={() => navigate('/employees')} className="group">
                <div className="relative overflow-hidden rounded-xl p-6 h-full bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95">
                  <div className="flex flex-col items-center text-center h-full justify-center">
                    <div className="inline-flex p-4 bg-green-100 rounded-xl mb-3 group-hover:scale-110 transition-transform duration-200">
                      <Users className="h-6 w-6 text-green-600" />
                    </div>
                    <h3 className="font-bold text-sm mb-1">Team</h3>
                    <p className="text-xs text-white/80">Beheren</p>
                  </div>
                </div>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Team Members Grid */}
      {teamMembers.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className={`h-6 w-6 ${isProjectCompany ? 'text-emerald-600' : 'text-green-600'}`} />
              {isProjectCompany ? 'Werknemers' : 'Team'} ({teamMembers.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {teamMembers.map((member) => (
              <Card key={member.id} className="p-4 hover:shadow-lg transition">
                <div className="flex items-start gap-3">
                  <div className={`h-12 w-12 rounded-full bg-gradient-to-br ${isProjectCompany ? 'from-emerald-400 to-emerald-600' : 'from-indigo-400 to-indigo-600'} flex items-center justify-center text-white font-bold flex-shrink-0`}>
                    {member.personalInfo?.firstName?.[0]?.toUpperCase() || 'E'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {member.personalInfo?.firstName} {member.personalInfo?.lastName}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {member.status === 'active' ? '✓ Actief' : 'Inactief'}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Status Card */}
      <Card className="p-6 border-l-4 border-green-500">
        <div className="flex items-start gap-3">
          <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
          <div>
            <h3 className="text-lg font-bold text-gray-900">Status</h3>
            <p className="text-sm text-gray-600 mt-1">
              {stats.activeMembers}/{stats.totalTeam} medewerkers actief
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ManagerDashboard;