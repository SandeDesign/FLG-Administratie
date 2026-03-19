import React, { useState, useEffect } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Filter,
  Calendar,
  ListChecks,
  Repeat,
  ChevronDown,
  ChevronRight,
  Circle,
  CheckCircle2,
  Users,
  Clock,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { BusinessTask, TaskCategory, TaskPriority, TaskStatus, TaskFrequency, TaskChecklistItem, Employee } from '../types';
import { InternalProject } from '../types/internalProject';
import {
  getAllCompanyTasks,
  createTask,
  updateTask,
  deleteTask,
  getEmployees,
} from '../services/firebase';
import { getInternalProjects } from '../services/internalProjectService';
import { getProjectColorMeta } from './InternalProjects';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../hooks/useToast';
import Modal from '../components/ui/Modal';
import { usePageTitle } from '../contexts/PageTitleContext';
import { isInQuarter } from '../utils/dateFilters';
import { CATEGORY_CONFIG, PRIORITY_CONFIG, STATUS_CONFIG, FREQUENCY_LABELS, FREQUENCY_CONFIG } from '../utils/taskConfig';

const Tasks: React.FC = () => {
  const { user } = useAuth();
  const { selectedCompany, selectedYear, selectedQuarter } = useApp();
  const { success, error } = useToast();
  usePageTitle('Taken');

  const [tasks, setTasks] = useState<BusinessTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [companyEmployees, setCompanyEmployees] = useState<Employee[]>([]);
  const [internalProjects, setInternalProjects] = useState<InternalProject[]>([]);
  const [editingTask, setEditingTask] = useState<BusinessTask | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<TaskCategory | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all');
  const [filterScheduled, setFilterScheduled] = useState<'all' | 'scheduled' | 'unscheduled'>('all');

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
    checklist: [] as TaskChecklistItem[],
    assignedTo: [] as string[],
    estimatedHours: '' as string,
    internalProjectId: '' as string,
  });
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  useEffect(() => {
    if (user && selectedCompany) {
      loadTasks();
      getEmployees(user.uid, selectedCompany.id).then(setCompanyEmployees).catch(() => {});
      getInternalProjects(user.uid, selectedCompany.id).then(setInternalProjects).catch(() => {});
    }
  }, [user, selectedCompany]);

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
      const progress = calculateProgress(formData.checklist);
      await createTask(user.uid, {
        ...formData,
        companyId: selectedCompany.id,
        dueDate: new Date(formData.dueDate),
        progress,
        assignedTo: formData.assignedTo,
        estimatedHours: formData.estimatedHours ? parseFloat(formData.estimatedHours) : undefined,
        internalProjectId: formData.internalProjectId || undefined,
        internalProjectName: internalProjects.find(p => p.id === formData.internalProjectId)?.name || undefined,
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
      const progress = calculateProgress(formData.checklist);
      await updateTask(editingTask.id, user.uid, {
        ...formData,
        dueDate: new Date(formData.dueDate),
        progress,
        assignedTo: formData.assignedTo,
        estimatedHours: formData.estimatedHours ? parseFloat(formData.estimatedHours) : undefined,
        internalProjectId: formData.internalProjectId || undefined,
        internalProjectName: internalProjects.find(p => p.id === formData.internalProjectId)?.name || undefined,
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
      checklist: task.checklist || [],
      assignedTo: task.assignedTo || [],
      estimatedHours: task.estimatedHours !== undefined ? String(task.estimatedHours) : '',
      internalProjectId: task.internalProjectId || '',
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
      checklist: [],
      assignedTo: [],
      estimatedHours: '',
      internalProjectId: '',
    });
    setNewSubtaskTitle('');
    setEditingTask(null);
  };

  // Filter taken
  const filteredTasks = tasks.filter(task => {
    // Period filter on dueDate
    if (task.dueDate) {
      const taskDate = task.dueDate instanceof Date ? task.dueDate : new Date(task.dueDate);
      if (!isInQuarter(taskDate, selectedYear, selectedQuarter)) return false;
    }

    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (filterCategory !== 'all' && task.category !== filterCategory) return false;
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;

    // Filter op inplanstatus
    if (filterScheduled === 'scheduled' && !task.isScheduled) return false;
    if (filterScheduled === 'unscheduled' && task.isScheduled) return false;

    return true;
  });

  // Groepeer taken op status
  const groupedTasks = {
    pending: filteredTasks.filter(t => t.status === 'pending'),
    in_progress: filteredTasks.filter(t => t.status === 'in_progress'),
    overdue: filteredTasks.filter(t => t.status === 'overdue'),
    completed: filteredTasks.filter(t => t.status === 'completed'),
  };

  // Calculate progress based on subtasks
  const calculateProgress = (checklist: TaskChecklistItem[]): number => {
    if (!checklist || checklist.length === 0) return 0;
    const completed = checklist.filter(item => item.completed).length;
    return Math.round((completed / checklist.length) * 100);
  };

  // Subtask management
  const addSubtask = () => {
    if (!newSubtaskTitle.trim()) return;

    const newSubtask: TaskChecklistItem = {
      id: `subtask-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: newSubtaskTitle.trim(),
      completed: false,
    };

    setFormData({ ...formData, checklist: [...formData.checklist, newSubtask] });
    setNewSubtaskTitle('');
  };

  const removeSubtask = (subtaskId: string) => {
    setFormData({
      ...formData,
      checklist: formData.checklist.filter(item => item.id !== subtaskId)
    });
  };

  const toggleSubtask = (subtaskId: string) => {
    setFormData({
      ...formData,
      checklist: formData.checklist.map(item =>
        item.id === subtaskId
          ? { ...item, completed: !item.completed }
          : item
      )
    });
  };

  // Toggle subtask in task list (update database directly)
  const toggleTaskSubtask = async (task: BusinessTask, subtaskId: string) => {
    if (!user) return;

    try {
      const updatedChecklist = (task.checklist || []).map(item => {
        if (item.id === subtaskId) {
          const newItem: any = {
            ...item,
            completed: !item.completed
          };

          // Voeg completedBy en completedAt alleen toe wanneer completed=true
          if (!item.completed) {
            newItem.completedBy = user.uid;
            newItem.completedAt = new Date();
          } else {
            // Verwijder deze velden als completed=false wordt
            delete newItem.completedBy;
            delete newItem.completedAt;
          }

          return newItem;
        }
        return item;
      });

      const progress = calculateProgress(updatedChecklist);
      await updateTask(task.id, user.uid, {
        checklist: updatedChecklist,
        progress
      });
      loadTasks();
    } catch (err) {
      console.error('Error updating subtask:', err);
      error('Fout bij bijwerken van subtaak');
    }
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
        <div className="hidden lg:block">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Inplanning
              </label>
              <select
                value={filterScheduled}
                onChange={(e) => setFilterScheduled(e.target.value as 'all' | 'scheduled' | 'unscheduled')}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="all">Alle</option>
                <option value="scheduled">Ingepland</option>
                <option value="unscheduled">Niet ingepland</option>
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
            const categoryConfig = CATEGORY_CONFIG[task.category] || CATEGORY_CONFIG['operational'];
            const priorityConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG['medium'];
            const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG['pending'];
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
                          {task.isRecurring && task.frequency && FREQUENCY_CONFIG[task.frequency] && (() => {
                            const FreqIcon = FREQUENCY_CONFIG[task.frequency!].icon;
                            return (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${FREQUENCY_CONFIG[task.frequency!].bgColor}`}>
                                <FreqIcon className="h-3 w-3" />
                                {FREQUENCY_CONFIG[task.frequency!].label}
                              </span>
                            );
                          })()}
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

                          {task.checklist && task.checklist.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-indigo-100 text-indigo-700">
                              <ListChecks className="h-3 w-3" />
                              {task.checklist.filter(s => s.completed).length}/{task.checklist.length}
                            </span>
                          )}

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
                  {isExpanded && (task.description || (task.checklist && task.checklist.length > 0)) && (
                    <div className="pl-8 pt-2 border-t border-gray-100 dark:border-gray-700 space-y-3">
                      {task.description && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Beschrijving</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{task.description}</p>
                        </div>
                      )}

                      {task.checklist && task.checklist.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                            Subtaken ({task.checklist.filter(s => s.completed).length}/{task.checklist.length})
                          </h4>
                          <div className="space-y-1">
                            {task.checklist.map((subtask) => (
                              <label
                                key={subtask.id}
                                className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={subtask.completed}
                                  onChange={() => toggleTaskSubtask(task, subtask.id)}
                                  className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                                />
                                <span className={`text-sm ${subtask.completed ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                  {subtask.title}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
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

          {/* Toewijzen aan medewerkers */}
          {companyEmployees.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                Toewijzen aan medewerkers
              </label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 p-2">
                {companyEmployees.map(emp => {
                  const name = [emp.personalInfo?.firstName, emp.personalInfo?.lastName].filter(Boolean).join(' ') || emp.id;
                  const checked = formData.assignedTo.includes(emp.id!);
                  return (
                    <label key={emp.id} className="flex items-center gap-2 cursor-pointer py-1 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const next = checked
                            ? formData.assignedTo.filter(id => id !== emp.id)
                            : [...formData.assignedTo, emp.id!];
                          setFormData({ ...formData, assignedTo: next });
                        }}
                        className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-900 dark:text-gray-100">{name}</span>
                    </label>
                  );
                })}
              </div>
              {formData.assignedTo.length > 0 && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    Verwachte duur (uren)
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={formData.estimatedHours}
                    onChange={(e) => setFormData({ ...formData, estimatedHours: e.target.value })}
                    placeholder="bijv. 2.5"
                    className="w-32 rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Hoelang de medewerker er mee bezig mag zijn</p>
                </div>
              )}
            </div>
          )}

          {/* Intern project koppeling */}
          {internalProjects.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Intern project (optioneel)
              </label>
              <select
                value={formData.internalProjectId}
                onChange={e => setFormData({ ...formData, internalProjectId: e.target.value })}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">— Geen project —</option>
                {internalProjects.map(p => {
                  const cm = getProjectColorMeta(p.color);
                  return (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  );
                })}
              </select>
              {formData.internalProjectId && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  {(() => {
                    const proj = internalProjects.find(p => p.id === formData.internalProjectId);
                    const cm = getProjectColorMeta(proj?.color);
                    return (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cm.bg} ${cm.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cm.dot}`} />
                        {proj?.name}
                      </span>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Subtaken sectie */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Subtaken
            </label>

            {/* Lijst van bestaande subtaken */}
            {formData.checklist.length > 0 && (
              <div className="space-y-2 mb-3">
                {formData.checklist.map((subtask) => (
                  <div key={subtask.id} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <input
                      type="checkbox"
                      checked={subtask.completed}
                      onChange={() => toggleSubtask(subtask.id)}
                      className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                    />
                    <span className={`flex-1 text-sm ${subtask.completed ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
                      {subtask.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeSubtask(subtask.id)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Nieuwe subtaak toevoegen */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSubtask();
                  }
                }}
                placeholder="Nieuwe subtaak..."
                className="flex-1 rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
              <Button
                type="button"
                onClick={addSubtask}
                variant="secondary"
                icon={Plus}
              >
                Toevoegen
              </Button>
            </div>
          </div>

          {/* Frequentie sectie - prominent */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Frequentie
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: null, label: 'Eenmalig', icon: Calendar },
                ...Object.entries(FREQUENCY_CONFIG).map(([freq, config]) => ({
                  value: freq as TaskFrequency,
                  label: config.label,
                  icon: config.icon,
                })),
              ].map((option) => {
                const isSelected = option.value === null
                  ? !formData.isRecurring
                  : formData.isRecurring && formData.frequency === option.value;
                const Icon = option.icon;

                return (
                  <button
                    key={option.value || 'once'}
                    type="button"
                    onClick={() => {
                      if (option.value === null) {
                        setFormData({ ...formData, isRecurring: false });
                      } else {
                        setFormData({ ...formData, isRecurring: true, frequency: option.value });
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 ring-1 ring-primary-500'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {option.label}
                  </button>
                );
              })}
            </div>

            {formData.isRecurring && (formData.frequency === 'monthly' || formData.frequency === 'quarterly') && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Dag van de maand (1-31)
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={formData.recurrenceDay}
                  onChange={(e) => setFormData({ ...formData, recurrenceDay: parseInt(e.target.value) })}
                  className="w-32 rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
                />
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
