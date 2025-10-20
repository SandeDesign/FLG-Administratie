import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Edit3,
  Trash2,
  Shield,
  ShieldCheck,
  UserX,
  UserCheck,
  Mail
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../hooks/useToast';
import Modal from '../components/ui/Modal';
import { 
  collection, 
  query, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc,
  addDoc,
  Timestamp 
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail 
} from 'firebase/auth';
import { db, auth } from '../lib/firebase';

interface User {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'manager' | 'employee';
  isActive: boolean;
  createdAt: Date;
  lastLoginAt?: Date;
  companyIds: string[];
  permissions: string[];
}

interface CreateUserData {
  email: string;
  displayName: string;
  role: 'admin' | 'manager' | 'employee';
  companyIds: string[];
  sendWelcomeEmail: boolean;
}

const AdminUsers: React.FC = () => {
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadUsers = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      
      const usersData: User[] = usersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          email: data.email || '',
          displayName: data.displayName || data.name || '',
          role: data.role || 'employee',
          isActive: data.isActive !== false,
          createdAt: data.createdAt?.toDate() || new Date(),
          lastLoginAt: data.lastLoginAt?.toDate(),
          companyIds: data.companyIds || [],
          permissions: data.permissions || []
        };
      });

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

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         u.displayName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && u.isActive) ||
                         (statusFilter === 'inactive' && !u.isActive);
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleCreateUser = async (data: CreateUserData) => {
    if (!user) return;

    setCreating(true);
    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, 'TempPassword123!');
      const newUser = userCredential.user;

      // Create user document
      await addDoc(collection(db, 'users'), {
        uid: newUser.uid,
        email: data.email,
        displayName: data.displayName,
        role: data.role,
        isActive: true,
        companyIds: data.companyIds,
        permissions: [],
        createdAt: Timestamp.fromDate(new Date()),
        createdBy: user.uid
      });

      // Send password reset email if requested
      if (data.sendWelcomeEmail) {
        await sendPasswordResetEmail(auth, data.email);
      }

      success('Gebruiker aangemaakt', 'De nieuwe gebruiker is succesvol aangemaakt');
      setIsCreateModalOpen(false);
      loadUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      showError('Fout bij aanmaken', error.message || 'Kon gebruiker niet aanmaken');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        isActive: !currentStatus,
        updatedAt: Timestamp.fromDate(new Date()),
        updatedBy: user?.uid
      });

      success(
        !currentStatus ? 'Gebruiker geactiveerd' : 'Gebruiker gedeactiveerd',
        `De gebruiker is ${!currentStatus ? 'geactiveerd' : 'gedeactiveerd'}`
      );
      loadUsers();
    } catch (error) {
      console.error('Error toggling user status:', error);
      showError('Fout bij wijzigen', 'Kon gebruikersstatus niet wijzigen');
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Weet je zeker dat je de gebruiker ${userEmail} permanent wilt verwijderen?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', userId));
      success('Gebruiker verwijderd', 'De gebruiker is permanent verwijderd');
      loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      showError('Fout bij verwijderen', 'Kon gebruiker niet verwijderen');
    }
  };

  const handleSendPasswordReset = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      success('Reset e-mail verzonden', 'Er is een wachtwoord reset link verzonden');
    } catch (error) {
      console.error('Error sending password reset:', error);
      showError('Fout bij verzenden', 'Kon reset e-mail niet verzenden');
    }
  };

  const getRoleColor = (role: User['role']) => {
    switch (role) {
      case 'admin': return 'text-red-600 bg-red-100';
      case 'manager': return 'text-blue-600 bg-blue-100';
      case 'employee': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getRoleText = (role: User['role']) => {
    switch (role) {
      case 'admin': return 'Administrator';
      case 'manager': return 'Manager';
      case 'employee': return 'Werknemer';
      default: return role;
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gebruikersbeheer</h1>
          <p className="text-gray-600 mt-2">
            Beheer alle gebruikers en hun toegangsrechten
          </p>
        </div>
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="mt-4 sm:mt-0"
          icon={Plus}
        >
          Nieuwe Gebruiker
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Totaal</p>
              <p className="text-2xl font-bold text-gray-900">{users.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <UserCheck className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Actief</p>
              <p className="text-2xl font-bold text-gray-900">
                {users.filter(u => u.isActive).length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-3 bg-red-100 rounded-lg">
              <ShieldCheck className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Admins</p>
              <p className="text-2xl font-bold text-gray-900">
                {users.filter(u => u.role === 'admin').length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <UserX className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Inactief</p>
              <p className="text-2xl font-bold text-gray-900">
                {users.filter(u => !u.isActive).length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Zoek op naam of e-mail..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Alle rollen</option>
                <option value="admin">Administrator</option>
                <option value="manager">Manager</option>
                <option value="employee">Werknemer</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Alle statussen</option>
                <option value="active">Actief</option>
                <option value="inactive">Inactief</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Users Table */}
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
                  Laatste Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aangemaakt
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acties
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((userData) => (
                <tr key={userData.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-700">
                            {userData.displayName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {userData.displayName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {userData.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(userData.role)}`}>
                      {getRoleText(userData.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      userData.isActive ? 'text-green-800 bg-green-100' : 'text-red-800 bg-red-100'
                    }`}>
                      {userData.isActive ? 'Actief' : 'Inactief'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {userData.lastLoginAt 
                      ? userData.lastLoginAt.toLocaleDateString('nl-NL')
                      : 'Nooit'
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {userData.createdAt.toLocaleDateString('nl-NL')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Mail}
                        onClick={() => handleSendPasswordReset(userData.email)}
                      >
                        Reset
                      </Button>
                      <Button
                        variant={userData.isActive ? "ghost" : "primary"}
                        size="sm"
                        icon={userData.isActive ? UserX : UserCheck}
                        onClick={() => handleToggleUserStatus(userData.id, userData.isActive)}
                      >
                        {userData.isActive ? 'Deactiveren' : 'Activeren'}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        icon={Trash2}
                        onClick={() => handleDeleteUser(userData.id, userData.email)}
                      >
                        Verwijderen
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredUsers.length === 0 && (
          <EmptyState
            icon={Users}
            title="Geen gebruikers gevonden"
            description="Geen gebruikers gevonden die voldoen aan de zoekfilters"
          />
        )}
      </Card>

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateUser}
        loading={creating}
      />
    </div>
  );
};

// Create User Modal Component
const CreateUserModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateUserData) => void;
  loading: boolean;
}> = ({ isOpen, onClose, onSubmit, loading }) => {
  const [formData, setFormData] = useState<CreateUserData>({
    email: '',
    displayName: '',
    role: 'employee',
    companyIds: [],
    sendWelcomeEmail: true
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const resetForm = () => {
    setFormData({
      email: '',
      displayName: '',
      role: 'employee',
      companyIds: [],
      sendWelcomeEmail: true
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        onClose();
        resetForm();
      }}
      title="Nieuwe Gebruiker Aanmaken"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            E-mailadres
          </label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Volledige Naam
          </label>
          <input
            type="text"
            required
            value={formData.displayName}
            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rol
          </label>
          <select
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value as CreateUserData['role'] })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="employee">Werknemer</option>
            <option value="manager">Manager</option>
            <option value="admin">Administrator</option>
          </select>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="sendWelcomeEmail"
            checked={formData.sendWelcomeEmail}
            onChange={(e) => setFormData({ ...formData, sendWelcomeEmail: e.target.checked })}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="sendWelcomeEmail" className="ml-2 text-sm text-gray-700">
            Stuur welkomst e-mail met wachtwoord reset link
          </label>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button variant="ghost" onClick={() => { onClose(); resetForm(); }}>
            Annuleren
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Aanmaken...' : 'Gebruiker Aanmaken'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AdminUsers;