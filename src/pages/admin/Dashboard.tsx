import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  Building2, 
  Shield, 
  Activity, 
  AlertTriangle, 
  TrendingUp,
  Clock,
  FileText,
  Database,
  Server,
  UserCheck,
  UserX,
  Settings
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db } from '../lib/firebase';

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  totalCompanies: number;
  totalEmployees: number;
  pendingApprovals: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
  lastBackup: Date;
  storageUsed: number;
  storageLimit: number;
}

interface RecentActivity {
  id: string;
  action: string;
  user: string;
  timestamp: Date;
  type: 'user' | 'company' | 'employee' | 'system';
  severity: 'info' | 'warning' | 'error';
}

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { companies, employees } = useApp();
  const { success, error: showError } = useToast();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAdminStats = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get user statistics
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const activeUsers = users.filter(u => u.isActive !== false).length;
      const inactiveUsers = users.length - activeUsers;

      // Get pending approvals count
      const leavesQuery = query(
        collection(db, 'leaveRequests'),
        where('status', '==', 'pending')
      );
      const leavesSnapshot = await getDocs(leavesQuery);

      const timesheetsQuery = query(
        collection(db, 'weeklyTimesheets'),
        where('status', '==', 'submitted')
      );
      const timesheetsSnapshot = await getDocs(timesheetsQuery);

      const pendingApprovals = leavesSnapshot.size + timesheetsSnapshot.size;

      // Get recent audit logs
      const auditQuery = query(
        collection(db, 'auditLogs'),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
      const auditSnapshot = await getDocs(auditQuery);
      
      const activities: RecentActivity[] = auditSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          action: `${data.action} ${data.entityType}`,
          user: data.performedBy?.name || data.performedBy?.email || 'Systeem',
          timestamp: data.createdAt?.toDate() || new Date(),
          type: data.entityType === 'user' ? 'user' : 
                data.entityType === 'company' ? 'company' :
                data.entityType === 'employee' ? 'employee' : 'system',
          severity: data.severity || 'info'
        };
      });

      // Calculate storage (mock for now)
      const storageUsed = Math.floor(Math.random() * 8000) + 2000; // MB
      const storageLimit = 10000; // MB

      const adminStats: AdminStats = {
        totalUsers: users.length,
        activeUsers,
        inactiveUsers,
        totalCompanies: companies.length,
        totalEmployees: employees.length,
        pendingApprovals,
        systemHealth: storageUsed > storageLimit * 0.9 ? 'critical' : 
                     storageUsed > storageLimit * 0.7 ? 'warning' : 'healthy',
        lastBackup: new Date(),
        storageUsed,
        storageLimit
      };

      setStats(adminStats);
      setRecentActivity(activities);

    } catch (error) {
      console.error('Error loading admin stats:', error);
      showError('Fout bij laden', 'Kon admin statistieken niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, companies.length, employees.length, showError]);

  useEffect(() => {
    loadAdminStats();
  }, [loadAdminStats]);

  const getHealthColor = (health: AdminStats['systemHealth']) => {
    switch (health) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-600" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Kon statistieken niet laden</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Systeem overzicht en beheer
        </p>
      </div>

      {/* System Health Alert */}
      {stats.systemHealth !== 'healthy' && (
        <div className={`p-4 rounded-lg border ${
          stats.systemHealth === 'critical' 
            ? 'bg-red-50 border-red-200' 
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="flex">
            <AlertTriangle className={`h-5 w-5 ${
              stats.systemHealth === 'critical' ? 'text-red-600' : 'text-yellow-600'
            }`} />
            <div className="ml-3">
              <h3 className={`text-sm font-medium ${
                stats.systemHealth === 'critical' ? 'text-red-800' : 'text-yellow-800'
              }`}>
                {stats.systemHealth === 'critical' ? 'Kritieke systeemstatus' : 'Systeemwaarschuwing'}
              </h3>
              <p className={`text-sm mt-1 ${
                stats.systemHealth === 'critical' ? 'text-red-700' : 'text-yellow-700'
              }`}>
                Opslaggebruik: {((stats.storageUsed / stats.storageLimit) * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Users Stats */}
        <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100">
          <div className="flex items-center">
            <div className="p-3 bg-blue-600 rounded-xl">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Totaal Gebruikers</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
              <p className="text-xs text-gray-500">
                {stats.activeUsers} actief, {stats.inactiveUsers} inactief
              </p>
            </div>
          </div>
        </Card>

        {/* Companies Stats */}
        <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100">
          <div className="flex items-center">
            <div className="p-3 bg-green-600 rounded-xl">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Bedrijven</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalCompanies}</p>
              <p className="text-xs text-gray-500">
                {stats.totalEmployees} werknemers
              </p>
            </div>
          </div>
        </Card>

        {/* Pending Approvals */}
        <Card className="p-6 bg-gradient-to-br from-orange-50 to-orange-100">
          <div className="flex items-center">
            <div className="p-3 bg-orange-600 rounded-xl">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Wachtend</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pendingApprovals}</p>
              <p className="text-xs text-gray-500">
                Goedkeuringen vereist
              </p>
            </div>
          </div>
        </Card>

        {/* System Health */}
        <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100">
          <div className="flex items-center">
            <div className="p-3 bg-purple-600 rounded-xl">
              <Server className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Systeem Status</p>
              <div className="flex items-center space-x-2">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getHealthColor(stats.systemHealth)}`}>
                  {stats.systemHealth === 'healthy' ? 'Gezond' : 
                   stats.systemHealth === 'warning' ? 'Waarschuwing' : 'Kritiek'}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {stats.storageUsed}MB / {stats.storageLimit}MB
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Recente Activiteit">
          <div className="space-y-4">
            {recentActivity.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Geen recente activiteit</p>
            ) : (
              recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    <Activity className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">
                      {activity.action}
                    </p>
                    <p className="text-xs text-gray-500">
                      {activity.user} • {activity.timestamp.toLocaleDateString('nl-NL')} {activity.timestamp.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Quick Actions */}
        <Card title="Snelle Acties">
          <div className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full justify-start"
              icon={Users}
              onClick={() => window.location.href = '/admin/users'}
            >
              Gebruikers beheren
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              icon={Shield}
              onClick={() => window.location.href = '/admin/roles'}
            >
              Rollen & rechten
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              icon={Database}
              onClick={() => window.location.href = '/audit-log'}
            >
              Audit log bekijken
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              icon={Settings}
              onClick={() => window.location.href = '/settings'}
            >
              Systeeminstellingen
            </Button>
          </div>
        </Card>
      </div>

      {/* System Information */}
      <Card title="Systeem Informatie">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Laatste Backup</h4>
            <p className="text-sm text-gray-600">
              {stats.lastBackup.toLocaleDateString('nl-NL')} om {stats.lastBackup.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Opslag Gebruik</h4>
            <div className="flex items-center space-x-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    (stats.storageUsed / stats.storageLimit) > 0.9 ? 'bg-red-600' :
                    (stats.storageUsed / stats.storageLimit) > 0.7 ? 'bg-yellow-600' : 'bg-green-600'
                  }`}
                  style={{ width: `${(stats.storageUsed / stats.storageLimit) * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-600">
                {((stats.storageUsed / stats.storageLimit) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Versie</h4>
            <p className="text-sm text-gray-600">AlloonApp v2.1.0</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AdminDashboard;