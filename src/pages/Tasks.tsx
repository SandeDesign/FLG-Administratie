import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Plus,
  Pencil,
  Trash2,
  Filter,
  Calendar,
  User,
  Building2,
  Briefcase,
  FileText,
  DollarSign,
  Users,
  Folder,
  MoreHorizontal,
  XCircle,
  PlayCircle,
  ListChecks,
  Tag,
  Repeat,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { BusinessTask, TaskCategory, TaskPriority, TaskStatus, TaskFrequency } from '../types';
import {
  getTasks,
  getAllCompanyTasks,
  getCompanyUsers,
  createTask,
  updateTask,
  deleteTask,
  getOverdueTasks,
} from '../services/firebase';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../hooks/useToast';
import Modal from '../components/ui/Modal';

// Category configuratie
const CATEGORY_CONFIG: Record<TaskCategory, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
}> = {
  operational: { icon: Briefcase, label: 'Operationeel', color: 'bg-blue-100 text-blue-700' },
  compliance: { icon: FileText, label: 'Compliance', color: 'bg-purple-100 text-purple-700' },
  financial: { icon: DollarSign, label: 'Financieel', color: 'bg-emerald-100 text-emerald-700' },
  hr: { icon: Users, label: 'HR', color: 'bg-indigo-100 text-indigo-700' },
  sales: { icon: Briefcase, label: 'Verkoop', color: 'bg-pink-100 text-pink-700' },
  contracts: { icon: FileText, label: 'Contracten', color: 'bg-orange-100 text-orange-700' },
  administration: { icon: Folder, label: 'Administratie', color: 'bg-teal-100 text-teal-700' },
  other: { icon: MoreHorizontal, label: 'Overig', color: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300' },
};

// Priority configuratie
const PRIORITY_CONFIG: Record<TaskPriority, {
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  low: { label: 'Laag', color: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300', icon: Circle },
  medium: { label: 'Normaal', color: 'bg-blue-100 text-blue-700', icon: Circle },
  high: { label: 'Hoog', color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700', icon: AlertCircle },
};

// Status configuratie
const STATUS_CONFIG: Record<TaskStatus, {
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  pending: { label: 'Te doen', color: 'bg-yellow-100 text-yellow-700', icon: Circle },
  in_progress: { label: 'Bezig', color: 'bg-blue-100 text-blue-700', icon: PlayCircle },
  completed: { label: 'Voltooid', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  overdue: { label: 'Te laat', color: 'bg-red-100 text-red-700', icon: AlertCircle },
  cancelled: { label: 'Geannuleerd', color: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300', icon: XCircle },
};

// Frequency labels
const FREQUENCY_LABELS: Record<TaskFrequency, string> = {
  daily: 'Dagelijks',
  weekly: 'Wekelijks',
  monthly: 'Maandelijks',
  quarterly: 'Kwartaal',
  yearly: 'Jaarlijks',
};

const Tasks: React.FC = () => {
  const { user } = useAuth();
  const { selectedCompany } = useApp();
  const { success, error } = useToast();

  const [tasks, setTasks] = useState<BusinessTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<BusinessTask | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [companyUsers, setCompanyUsers] = useState<Array<{ uid: string; email: string; displayName?: string }>>([]);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<TaskCategory | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all');

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'operational' as TaskCategory,
    priority: 'medium' as TaskPriority,
    dueDate: '',
    isRecurring: false,
    frequency: 'monthly' as TaskFrequency,
    recurrenceDay: 1,
    assignedTo: [] as string[],
  });

  useEffect(() => {
    if (user && selectedCompany) {
      loadTasks();
      loadCompanyUsers();
    }
  }, [user, selectedCompany]);

  const loadCompanyUsers = async () => {
    if (!selectedCompany) return;

    try {
      const users = await getCompanyUsers(selectedCompany.id);
      setCompanyUsers(users);
    } catch (err) {
      console.error('Error loading company users:', err);
    }
  };

  const loadTasks = async () => {
    if (!user || !selectedCompany) return;

    try {
      setLoading(true);
      // Haal ALLE bedrijfstaken op voor admin, co-admin en manager
      const data = await getAllCompanyTasks(selectedCompany.id, user.uid);

      // Update status voor late taken
      const now = new Date();
      const updatedTasks = data.map(task => {
        if (
          task.status !== 'completed' &&
          task.status !== 'cancelled' &&
          new Date(task.dueDate) < now
        ) {
          return { ...task, status: 'overdue' as TaskStatus };
        }
        return task;
      });

      setTasks(updatedTasks);
    } catch (err) {
      console.error('Error loading tasks:', err);
      error('Fout bij laden van taken');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCompany) return;

    try {
      await createTask(user.uid, {
        ...formData,
        companyId: selectedCompany.id,
        dueDate: new Date(formData.dueDate),
      });

      success('Taak aangemaakt');
      setShowTaskModal(false);
      resetForm();
      loadTasks();
    } catch (err) {
      console.error('Error creating task:', err);
      error('Fout bij aanmaken van taak');
    }
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingTask) return;

    try {
      await updateTask(editingTask.id, user.uid, {
        ...formData,
        dueDate: new Date(formData.dueDate),
      });

      success('Taak bijgewerkt');
      setShowTaskModal(false);
      setEditingTask(null);
      resetForm();
      loadTasks();
    } catch (err) {
      console.error('Error updating task:', err);
      error('Fout bij bijwerken van taak');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!user) return;
    if (!confirm('Weet je zeker dat je deze taak wilt verwijderen?')) return;

    try {
      await deleteTask(taskId, user.uid);
      success('Taak verwijderd');
      loadTasks();
    } catch (err) {
      console.error('Error deleting task:', err);
      error('Fout bij verwijderen van taak');
    }
  };

  const handleStatusChange = async (task: BusinessTask, newStatus: TaskStatus) => {
    if (!user) return;

    try {
      await updateTask(task.id, user.uid, { status: newStatus });
      success('Status bijgewerkt');
      loadTasks();
    } catch (err) {
      console.error('Error updating status:', err);
      error('Fout bij bijwerken van status');
    }
  };

  const openEditModal = (task: BusinessTask) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      category: task.category,
      priority: task.priority,
      dueDate: task.dueDate instanceof Date ? task.dueDate.toISOString().split('T')[0] : '',
      isRecurring: task.isRecurring,
      frequency: task.frequency || 'monthly',
      recurrenceDay: task.recurrenceDay || 1,
      assignedTo: task.assignedTo || [],
    });
    setShowTaskModal(true);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: 'operational',
      priority: 'medium',
      dueDate: '',
      isRecurring: false,
      frequency: 'monthly',
      recurrenceDay: 1,
      assignedTo: [],
    });
    setEditingTask(null);
  };

  // Filter taken
  const filteredTasks = tasks.filter(task => {
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (filterCategory !== 'all' && task.category !== filterCategory) return false;
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
    return true;
  });

  // Groepeer taken op status
  const groupedTasks = {
    pending: filteredTasks.filter(t => t.status === 'pending'),
    in_progress: filteredTasks.filter(t => t.status === 'in_progress'),
    overdue: filteredTasks.filter(t => t.status === 'overdue'),
    completed: filteredTasks.filter(t => t.status === 'completed'),
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const isOverdue = (task: BusinessTask) => {
    if (task.status === 'completed' || task.status === 'cancelled') return false;
    return new Date(task.dueDate) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Taken</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {selectedCompany?.name} - {tasks.length} taken
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="secondary"
            icon={Filter}
          >
            Filters
          </Button>
          <Button
            onClick={() => {
              resetForm();
              setShowTaskModal(true);
            }}
            icon={Plus}
          >
            Nieuwe taak
          </Button>
        </div>
      </div>

      {/* Collapsible Filters */}
      {showFilters && (
        <Card>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as TaskStatus | 'all')}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="all">Alle statussen</option>
                {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                  <option key={status} value={status}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Categorie
              </label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as TaskCategory | 'all')}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="all">Alle categorieën</option>
                {Object.entries(CATEGORY_CONFIG).map(([category, config]) => (
                  <option key={category} value={category}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Prioriteit
              </label>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value as TaskPriority | 'all')}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="all">Alle prioriteiten</option>
                {Object.entries(PRIORITY_CONFIG).map(([priority, config]) => (
                  <option key={priority} value={priority}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>
      )}

      {/* Tasks List */}
      {filteredTasks.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Geen taken gevonden"
          description="Maak een nieuwe taak aan om te beginnen"
          action={{
            label: 'Nieuwe taak',
            onClick: () => {
              resetForm();
              setShowTaskModal(true);
            },
          }}
        />
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => {
            const categoryConfig = CATEGORY_CONFIG[task.category];
            const priorityConfig = PRIORITY_CONFIG[task.priority];
            const statusConfig = STATUS_CONFIG[task.status];
            const CategoryIcon = categoryConfig.icon;
            const StatusIcon = statusConfig.icon;
            const isExpanded = expandedTaskId === task.id;

            return (
              <Card key={task.id} className="hover:shadow-md transition-shadow">
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <button
                        onClick={() => {
                          const newStatus = task.status === 'completed' ? 'pending' : 'completed';
                          handleStatusChange(task, newStatus);
                        }}
                        className="mt-1"
                      >
                        {task.status === 'completed' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <Circle className="h-5 w-5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3
                            className={`font-semibold text-gray-900 dark:text-gray-100 ${ task.status === 'completed' ? 'line-through text-gray-500 dark:text-gray-400 dark:text-gray-500' : '' }`}
                          >
                            {task.title}
                          </h3>
                          {task.isRecurring && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                              <Repeat className="h-3 w-3" />
                              {FREQUENCY_LABELS[task.frequency || 'monthly']}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${categoryConfig.color}`}>
                            <CategoryIcon className="h-3 w-3" />
                            {categoryConfig.label}
                          </span>

                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${priorityConfig.color}`}>
                            {priorityConfig.label}
                          </span>

                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${statusConfig.color}`}>
                            <StatusIcon className="h-3 w-3" />
                            {statusConfig.label}
                          </span>

                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${ isOverdue(task) ? 'bg-red-100 text-red-700' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300' }`}>
                            <Calendar className="h-3 w-3" />
                            {formatDate(task.dueDate)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                        )}
                      </button>
                      <button
                        onClick={() => openEditModal(task)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      </button>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && task.description && (
                    <div className="pl-8 pt-2 border-t border-gray-100">
                      <p className="text-sm text-gray-600 dark:text-gray-400">{task.description}</p>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Task Modal */}
      <Modal
        isOpen={showTaskModal}
        onClose={() => {
          setShowTaskModal(false);
          setEditingTask(null);
          resetForm();
        }}
        title={editingTask ? 'Taak bewerken' : 'Nieuwe taak'}
      >
        <form onSubmit={editingTask ? handleUpdateTask : handleCreateTask} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Titel *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="Bijv. Facturen versturen"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Beschrijving
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="Optionele beschrijving..."
            />
          </div>

          {/* Toewijzen aan gebruikers */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Toewijzen aan
            </label>
            <div className="max-h-40 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-3 space-y-2">
              {companyUsers.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Geen gebruikers beschikbaar</p>
              ) : (
                companyUsers.map((companyUser) => (
                  <label key={companyUser.uid} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={formData.assignedTo.includes(companyUser.uid)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, assignedTo: [...formData.assignedTo, companyUser.uid] });
                        } else {
                          setFormData({ ...formData, assignedTo: formData.assignedTo.filter(uid => uid !== companyUser.uid) });
                        }
                      }}
                      className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {companyUser.displayName || companyUser.email}
                      </span>
                      {companyUser.displayName && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                          ({companyUser.email})
                        </span>
                      )}
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Categorie *
              </label>
              <select
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as TaskCategory })}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
              >
                {Object.entries(CATEGORY_CONFIG).map(([category, config]) => (
                  <option key={category} value={category}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Prioriteit *
              </label>
              <select
                required
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
              >
                {Object.entries(PRIORITY_CONFIG).map(([priority, config]) => (
                  <option key={priority} value={priority}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Vervaldatum *
            </label>
            <input
              type="date"
              required
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isRecurring}
                onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Terugkerende taak
              </span>
            </label>

            {formData.isRecurring && (
              <div className="mt-4 space-y-4 pl-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Frequentie
                  </label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value as TaskFrequency })}
                    className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
                  >
                    {Object.entries(FREQUENCY_LABELS).map(([freq, label]) => (
                      <option key={freq} value={freq}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                {(formData.frequency === 'monthly' || formData.frequency === 'quarterly') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Dag van de maand (1-31)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={formData.recurrenceDay}
                      onChange={(e) => setFormData({ ...formData, recurrenceDay: parseInt(e.target.value) })}
                      className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowTaskModal(false);
                setEditingTask(null);
                resetForm();
              }}
            >
              Annuleren
            </Button>
            <Button type="submit">
              {editingTask ? 'Opslaan' : 'Aanmaken'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Tasks;
