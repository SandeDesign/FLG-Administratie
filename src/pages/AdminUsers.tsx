import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Shield,
  Mail,
  Ban,
  UserCheck,
  AlertCircle,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../hooks/useToast';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  Timestamp,
  addDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';

interface UserRole {
  id: string;
  uid: string;
  role: 'admin' | 'manager' | 'employee';
  employeeId?: string | null;
  email?: string;
  displayName?: string;
  isActive?: boolean;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const AdminUsers: React.FC = () => {
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const [users, setUsers] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [newUserData, setNewUserData] = useState({
    email: '',
    displayName: '',
    role: 'employee' as const
  });

  const loadUsers = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      console.log('Loading users from Firebase...');
      
      const usersCollection = collection(db, 'users');
      const usersSnapshot = await getDocs(usersCollection);
      
      console.log('Found', usersSnapshot.docs.length, 'user records');
      
      const usersData: UserRole[] = usersSnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('User document:', doc.id, data);
        
        return {
          id: doc.id,
          uid: data.uid || '',
          role: data.role || 'employee',
          employeeId: data.employeeId,
          email: data.email || '',
          displayName: data.displayName || '',
          isActive: data.isActive !== false,
          lastLoginAt: data.lastLoginAt?.toDate ? data.lastLoginAt.toDate() : undefined,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : undefined,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : undefined
        };
      });

      console.log('Processed users:', usersData);
      setUsers(usersData);
    } catch (error) {
      console.error('Error loading users:', error);
      showError('Fout bij laden', 'Kon gebruikers niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, showError]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = users.filter(userRole => {
    const email = userRole.email || '';
    const displayName = userRole.displayName || '';
    
    const matchesSearch = 
      email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userRole.uid.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || userRole.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  const handleUpdateUserRole = async (userId: string, newRole: UserRole['role']) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        role: newRole,
        updatedAt: Timestamp.fromDate(new Date())
      });
      
      success('Rol bijgewerkt', 'Gebruikersrol is succesvol gewijzigd');
      loadUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      showError('Fout bij bijwerken', 'Kon gebruikersrol niet wijzigen');
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isActive: !currentStatus,
        updatedAt: Timestamp.fromDate(new Date())
      });
      
      const statusText = !currentStatus ? 'geactiveerd' : 'gedeactiveerd';
      success('Status bijgewerkt', `Gebruiker is ${statusText}`);
      loadUsers();
    } catch (error) {
      console.error('Error updating status:', error);
      showError('Fout bij bijwerken', 'Kon gebruikersstatus niet wijzigen');
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Weet je zeker dat je gebruiker ${userEmail} wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', userId));
      success('Gebruiker verwijderd', 'Gebruiker is succesvol verwijderd');
      loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      showError('Fout bij verwijderen', 'Kon gebruiker niet verwijderen');
    }
  };

  const handleCreateNewUser = async () => {
    if (!newUserData.email || !newUserData.displayName) {
      showError('Validatie fout', 'Email en naam zijn verplicht');
      return;
    }

    try {
      const usersCollection = collection(db, 'users');
      await addDoc(usersCollection, {
        email: newUserData.email,
        displayName: newUserData.displayName,
        role: newUserData.role,
        isActive: true,
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date())
      });

      success('Gebruiker aangemaakt', `${newUserData.displayName} is succesvol aangemaakt`);
      setShowNewUserModal(false);
      setNewUserData({ email: '', displayName: '', role: 'employee' });
      loadUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      showError('Fout bij aanmaken', 'Kon gebruiker niet aanmaken');
    }
  };

  const getRoleColor = (role: UserRole['role']) => {
    switch (role) {
      case 'admin': return 'text-red-600 bg-red-100';
      case 'manager': return 'text-blue-600 bg-blue-100';
      case 'employee': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive 
      ? 'text-green-600 bg-green-100'
      : 'text-red-600 bg-red-100';
  };

  const getRoleBadge = (role: UserRole['role']) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'manager': return 'Manager';
      case 'employee': return 'Werknemer';
      default: return role;
    }
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return 'Onbekend';
    return new Intl.DateTimeFormat('nl-NL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const formatDateShort = (date: Date | undefined) => {
    if (!date) return 'Onbekend';
    return new Intl.DateTimeFormat('nl-NL', {
      day: 'numeric',
      month: 'short'
    }).format(date);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-6 px-4 sm:px-0 pb-24 sm:pb-6">
      {/* Header - Mobile Optimized */}
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Gebruikersbeheer</h1>
          <p className="mt-1 text-xs sm:text-sm text-gray-500">
            Beheer rollen en toegang • {users.length} gebruikers
          </p>
        </div>
        <button
          onClick={() => setShowNewUserModal(true)}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm sm:text-base transition-colors"
        >
          <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
          Nieuwe Gebruiker
        </button>
      </div>

      {/* Nieuwe Gebruiker Modal */}
      {showNewUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <div className="p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Nieuwe Gebruiker</h2>
              
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newUserData.email}
                    onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="gebruiker@voorbeeld.nl"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
                    Naam
                  </label>
                  <input
                    type="text"
                    value={newUserData.displayName}
                    onChange={(e) => setNewUserData({ ...newUserData, displayName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="Jan Jansen"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
                    Rol
                  </label>
                  <select
                    value={newUserData.role}
                    onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value as 'admin' | 'manager' | 'employee' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="employee">Werknemer</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 sm:gap-3 mt-6">
                <button
                  onClick={() => setShowNewUserModal(false)}
                  className="flex-1 px-3 sm:px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm sm:text-base"
                >
                  Annuleren
                </button>
                <button
                  onClick={handleCreateNewUser}
                  className="flex-1 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm sm:text-base"
                >
                  Aanmaken
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Debug Info */}
      {users.length === 0 && (
        <Card className="p-3 sm:p-4 bg-yellow-50 border border-yellow-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-yellow-800 text-xs sm:text-sm">
              <strong>Debug Info:</strong>
              <ul className="mt-2 space-y-1">
                <li>• Geen gebruikers in 'users' collectie</li>
                <li>• Check Firebase verbinding</li>
                <li>• Console voor errors</li>
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Filters - Mobile Optimized */}
      <Card>
        <div className="p-3 sm:p-6 space-y-3 sm:space-y-0 sm:flex sm:gap-4 sm:items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Zoek gebruiker..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Alle rollen</option>
            <option value="admin">Administrator</option>
            <option value="manager">Manager</option>
            <option value="employee">Werknemer</option>
          </select>
        </div>
      </Card>

      {/* Stats - Mobile Optimized Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Users className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Totaal</p>
              <p className="text-lg sm:text-xl font-bold text-gray-900">{users.length}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <UserCheck className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Actief</p>
              <p className="text-lg sm:text-xl font-bold text-gray-900">
                {users.filter(u => u.isActive !== false).length}
              </p>
            </div>
          </div>
        </Card>
        
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-red-600 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Admins</p>
              <p className="text-lg sm:text-xl font-bold text-gray-900">
                {users.filter(u => u.role === 'admin').length}
              </p>
            </div>
          </div>
        </Card>
        
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Ban className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Inactief</p>
              <p className="text-lg sm:text-xl font-bold text-gray-900">
                {users.filter(u => u.isActive === false).length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Users List - Mobile Card View */}
      {filteredUsers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Geen gebruikers gevonden"
          description={users.length === 0 
            ? "Er zijn nog geen gebruikers in de database"
            : "Pas je filters aan om meer resultaten te zien"
          }
        />
      ) : (
        <div className="space-y-2 sm:space-y-0">
          {/* Mobile View */}
          <div className="block sm:hidden space-y-2">
            {filteredUsers.map((systemUser) => (
              <Card key={systemUser.id} className="p-3">
                <div className="space-y-3">
                  {/* Name & Email */}
                  <div className="space-y-1">
                    <p className="font-medium text-gray-900 text-sm">
                      {systemUser.displayName || 'Geen naam'}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Mail className="h-3 w-3" />
                      {systemUser.email || 'Geen email'}
                    </div>
                  </div>

                  {/* Role & Status */}
                  <div className="flex gap-2">
                    <select
                      value={systemUser.role}
                      onChange={(e) => handleUpdateUserRole(systemUser.id, e.target.value as UserRole['role'])}
                      className={`text-xs px-2 py-1 rounded border-none cursor-pointer font-medium ${getRoleColor(systemUser.role)}`}
                    >
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="employee">Werknemer</option>
                    </select>
                    
                    <button
                      onClick={() => handleToggleUserStatus(systemUser.id, systemUser.isActive !== false)}
                      className={`text-xs px-2 py-1 rounded border-none cursor-pointer font-medium ${getStatusColor(systemUser.isActive !== false)}`}
                    >
                      {systemUser.isActive !== false ? 'Actief' : 'Inactief'}
                    </button>
                  </div>

                  {/* Dates */}
                  <div className="text-xs text-gray-500 space-y-0.5">
                    <p>Aangemaakt: {formatDateShort(systemUser.createdAt)}</p>
                    <p>Laatste login: {formatDateShort(systemUser.lastLoginAt)}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => handleDeleteUser(systemUser.id, systemUser.email || 'Onbekend')}
                      className="flex-1 text-xs px-2 py-1.5 text-red-600 hover:bg-red-50 rounded font-medium"
                    >
                      Verwijderen
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop View */}
          <div className="hidden sm:block">
            <Card>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Gebruiker
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rol
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Aangemaakt
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Laatste Login
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acties
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUsers.map((systemUser) => (
                      <tr key={systemUser.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                                <Users className="h-5 w-5 text-gray-500" />
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {systemUser.displayName || 'Geen naam'}
                              </div>
                              <div className="text-sm text-gray-500 flex items-center">
                                <Mail className="h-3 w-3 mr-1" />
                                {systemUser.email || 'Geen email'}
                              </div>
                              {systemUser.uid && (
                                <div className="text-xs text-gray-400">
                                  UID: {systemUser.uid.substring(0, 8)}...
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={systemUser.role}
                            onChange={(e) => handleUpdateUserRole(systemUser.id, e.target.value as UserRole['role'])}
                            className={`text-sm px-2 py-1 rounded-full border-none cursor-pointer ${getRoleColor(systemUser.role)}`}
                          >
                            <option value="admin">Administrator</option>
                            <option value="manager">Manager</option>
                            <option value="employee">Werknemer</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleToggleUserStatus(systemUser.id, systemUser.isActive !== false)}
                            className={`text-sm px-2 py-1 rounded-full border-none cursor-pointer ${getStatusColor(systemUser.isActive !== false)}`}
                          >
                            {systemUser.isActive !== false ? 'Actief' : 'Inactief'}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(systemUser.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(systemUser.lastLoginAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleDeleteUser(systemUser.id, systemUser.email || 'Onbekend')}
                              className="text-red-600 hover:text-red-900 font-medium"
                            >
                              Verwijderen
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;