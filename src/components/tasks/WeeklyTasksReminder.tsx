import React, { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { getTasks, getAllCompanyTasks, updateTask, createTask } from '../../services/firebase';
import { BusinessTask } from '../../types';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Calendar, CheckCircle2, AlertCircle, Clock, ChevronRight, Check, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../hooks/useToast';

export interface WeeklyTasksReminderRef {
  openManually: () => void;
}

const WeeklyTasksReminder = forwardRef<WeeklyTasksReminderRef>((props, ref) => {
  const { user, userRole } = useAuth();
  const { selectedCompany } = useApp();
  const navigate = useNavigate();
  const { success, error: showError } = useToast();

  const [showReminder, setShowReminder] = useState(false);
  const [thisWeekTasks, setThisWeekTasks] = useState<BusinessTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingTasks, setCompletingTasks] = useState<Set<string>>(new Set());

  // Expose openManually functie voor external triggering
  useImperativeHandle(ref, () => ({
    openManually: async () => {
      if (!user || !selectedCompany) return;

      try {
        // Laad taken
        const allTasks = await getAllCompanyTasks(selectedCompany.id, user.uid);

        const today = new Date();
        const weekStart = getWeekStart(today);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const tasksThisWeek = allTasks.filter(task => {
          if (task.status === 'completed' || task.status === 'cancelled') return false;
          const dueDate = new Date(task.dueDate);
          return dueDate < today || (dueDate >= weekStart && dueDate < weekEnd);
        });

        if (tasksThisWeek.length > 0) {
          setThisWeekTasks(tasksThisWeek);
          setShowReminder(true);
        }
      } catch (error) {
        console.error('❌ Error loading tasks manually:', error);
      }
    }
  }));

  useEffect(() => {
    checkWeeklyTasks();
  }, [user, selectedCompany]);

  const checkWeeklyTasks = async () => {
    if (!user || !selectedCompany) {
      setLoading(false);
      return;
    }

    try {
      // Haal ALLE taken op voor dit bedrijf
      // Admin, co-admin en manager zien alle bedrijfstaken
      // Ook taken die aan hen toegewezen zijn
      const allTasks = await getAllCompanyTasks(selectedCompany.id, user.uid);

      console.log('📋 Alle taken opgehaald:', allTasks.length);

      // Filter taken voor deze week (inclusief late taken)
      const today = new Date();
      const weekStart = getWeekStart(today);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const tasksThisWeek = allTasks.filter(task => {
        if (task.status === 'completed' || task.status === 'cancelled') return false;

        const dueDate = new Date(task.dueDate);

        // Toon late taken OF taken die deze week vervallen
        return dueDate < today || (dueDate >= weekStart && dueDate < weekEnd);
      });

      console.log('📅 Taken deze week:', tasksThisWeek.length);

      if (tasksThisWeek.length > 0) {
        // Check of we vandaag al de reminder hebben getoond
        const lastShown = localStorage.getItem(`tasksReminder_${user.uid}_${selectedCompany.id}`);
        const todayKey = today.toISOString().split('T')[0]; // YYYY-MM-DD format

        console.log('🔑 LastShown:', lastShown, 'TodayKey:', todayKey);

        if (lastShown === todayKey) {
          console.log('⏭️ Popup al getoond vandaag, skip');
          setLoading(false);
          return; // Al getoond vandaag
        }

        console.log('✅ Toon popup met', tasksThisWeek.length, 'taken');
        setThisWeekTasks(tasksThisWeek);
        setShowReminder(true);
      } else {
        console.log('❌ Geen taken om te tonen');
      }

      setLoading(false);
    } catch (error) {
      console.error('❌ Error checking weekly tasks:', error);
      setLoading(false);
    }
  };

  const getWeekStart = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Maandag als start
    return new Date(d.setDate(diff));
  };

  const handleClose = () => {
    if (!user || !selectedCompany) return;

    // Sla op dat we de reminder vandaag hebben getoond
    const today = new Date();
    const todayKey = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    localStorage.setItem(`tasksReminder_${user.uid}_${selectedCompany.id}`, todayKey);

    setShowReminder(false);
  };

  const handleViewTasks = () => {
    handleClose();
    navigate('/tasks');
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('nl-NL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  const calculateNextOccurrence = (task: BusinessTask): Date | undefined => {
    if (!task.isRecurring || !task.frequency) return undefined;

    const currentDue = new Date(task.dueDate);
    const next = new Date(currentDue);

    switch (task.frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'quarterly':
        next.setMonth(next.getMonth() + 3);
        break;
      case 'yearly':
        next.setFullYear(next.getFullYear() + 1);
        break;
    }

    return next;
  };

  const handleCompleteTask = async (task: BusinessTask, createFollowUp: boolean = false) => {
    if (!user) return;

    try {
      setCompletingTasks(prev => new Set(prev).add(task.id));

      if (task.isRecurring) {
        // Voor terugkerende taken: plan volgende cyclus en markeer huidige als voltooid
        const nextOccurrence = calculateNextOccurrence(task);

        if (nextOccurrence) {
          // Create new task for next occurrence
          const { completedDate, id, ...taskWithoutCompleted } = task;
          const newTaskData = {
            ...taskWithoutCompleted,
            dueDate: nextOccurrence,
            status: 'pending' as const,
            progress: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastGenerated: new Date(),
            nextOccurrence: calculateNextOccurrence({ ...task, dueDate: nextOccurrence }),
          };

          await createTask(user.uid, newTaskData);

          // Mark current task as completed
          await updateTask(task.id, user.uid, {
            status: 'completed',
            completedDate: new Date(),
            progress: 100,
            updatedAt: new Date(),
          });

          success('Taak voltooid!', `Volgende cyclus ingepland voor ${formatDate(nextOccurrence)}`);
        }
      } else if (createFollowUp) {
        // Create follow-up task
        const { completedDate, id, ...taskWithoutCompleted } = task;
        const followUpData = {
          ...taskWithoutCompleted,
          title: `[Vervolg] ${task.title}`,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week later
          status: 'pending' as const,
          progress: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await createTask(user.uid, followUpData);

        // Set current task to pending (waiting for follow-up)
        await updateTask(task.id, user.uid, {
          status: 'pending',
          updatedAt: new Date(),
          notes: (task.notes || '') + `\n\n[Wacht op vervolgtaak]`,
        });

        success('Vervolgtaak aangemaakt!', 'Huidige taak staat op pending tot vervolgtaak voltooid is');
      } else {
        // Gewone completion zonder follow-up
        await updateTask(task.id, user.uid, {
          status: 'completed',
          completedDate: new Date(),
          progress: 100,
          updatedAt: new Date(),
        });

        success('Taak voltooid!', task.title);
      }

      // Refresh tasks list
      if (selectedCompany) {
        const allTasks = await getAllCompanyTasks(selectedCompany.id, user.uid);
        const today = new Date();
        const weekStart = getWeekStart(today);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const tasksThisWeek = allTasks.filter(t => {
          if (t.status === 'completed' || t.status === 'cancelled') return false;
          const dueDate = new Date(t.dueDate);
          return dueDate < today || (dueDate >= weekStart && dueDate < weekEnd);
        });

        setThisWeekTasks(tasksThisWeek);
      }

    } catch (error) {
      console.error('Error completing task:', error);
      showError('Fout', 'Kon taak niet voltooien');
    } finally {
      setCompletingTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(task.id);
        return newSet;
      });
    }
  };

  const isOverdue = (task: BusinessTask) => {
    if (task.status === 'completed' || task.status === 'cancelled') return false;
    return new Date(task.dueDate) < new Date();
  };

  const isToday = (task: BusinessTask) => {
    const today = new Date();
    const dueDate = new Date(task.dueDate);
    return (
      dueDate.getDate() === today.getDate() &&
      dueDate.getMonth() === today.getMonth() &&
      dueDate.getFullYear() === today.getFullYear()
    );
  };

  if (loading || !showReminder || thisWeekTasks.length === 0) {
    return null;
  }

  const overdueTasks = thisWeekTasks.filter(isOverdue);
  const todayTasks = thisWeekTasks.filter(t => !isOverdue(t) && isToday(t));
  const upcomingTasks = thisWeekTasks.filter(t => !isOverdue(t) && !isToday(t));

  return (
    <Modal
      isOpen={showReminder}
      onClose={handleClose}
      title="Taken deze week"
      size="lg"
    >
      <div className="space-y-6">
        {/* Summary */}
        <div className="bg-gradient-to-r from-primary-50 to-indigo-50 rounded-lg p-4 border border-primary-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white rounded-lg shadow-sm">
              <Calendar className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                {thisWeekTasks.length} {thisWeekTasks.length === 1 ? 'taak' : 'taken'} deze week
              </h3>
              <p className="text-sm text-gray-600">
                {selectedCompany?.name}
              </p>
            </div>
          </div>
        </div>

        {/* Overdue tasks */}
        {overdueTasks.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <h4 className="font-semibold text-gray-900">
                Te laat ({overdueTasks.length})
              </h4>
            </div>
            <div className="space-y-2">
              {overdueTasks.map(task => (
                <div
                  key={task.id}
                  className="p-3 bg-red-50 border border-red-200 rounded-lg"
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => handleCompleteTask(task)}
                      disabled={completingTasks.has(task.id)}
                      className="mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 border-red-400 hover:bg-red-100 disabled:opacity-50 flex items-center justify-center transition-colors"
                    >
                      {completingTasks.has(task.id) && (
                        <Check className="h-3 w-3 text-red-600" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{task.title}</p>
                      <p className="text-sm text-red-600">{formatDate(task.dueDate)}</p>
                      {task.isRecurring && (
                        <p className="text-xs text-gray-500 mt-1">
                          🔄 Terugkerend ({task.frequency})
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {!task.isRecurring && (
                        <button
                          onClick={() => handleCompleteTask(task, true)}
                          disabled={completingTasks.has(task.id)}
                          className="p-1.5 rounded hover:bg-red-100 disabled:opacity-50 transition-colors"
                          title="Vervolgtaak aanmaken"
                        >
                          <Plus className="h-4 w-4 text-red-600" />
                        </button>
                      )}
                      <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Today tasks */}
        {todayTasks.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-5 w-5 text-orange-600" />
              <h4 className="font-semibold text-gray-900">
                Vandaag ({todayTasks.length})
              </h4>
            </div>
            <div className="space-y-2">
              {todayTasks.map(task => (
                <div
                  key={task.id}
                  className="p-3 bg-orange-50 border border-orange-200 rounded-lg"
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => handleCompleteTask(task)}
                      disabled={completingTasks.has(task.id)}
                      className="mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 border-orange-400 hover:bg-orange-100 disabled:opacity-50 flex items-center justify-center transition-colors"
                    >
                      {completingTasks.has(task.id) && (
                        <Check className="h-3 w-3 text-orange-600" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{task.title}</p>
                      <p className="text-sm text-orange-600">Vandaag</p>
                      {task.isRecurring && (
                        <p className="text-xs text-gray-500 mt-1">
                          🔄 Terugkerend ({task.frequency})
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {!task.isRecurring && (
                        <button
                          onClick={() => handleCompleteTask(task, true)}
                          disabled={completingTasks.has(task.id)}
                          className="p-1.5 rounded hover:bg-orange-100 disabled:opacity-50 transition-colors"
                          title="Vervolgtaak aanmaken"
                        >
                          <Plus className="h-4 w-4 text-orange-600" />
                        </button>
                      )}
                      <Clock className="h-5 w-5 text-orange-500 mt-0.5" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming tasks */}
        {upcomingTasks.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-5 w-5 text-blue-600" />
              <h4 className="font-semibold text-gray-900">
                Binnenkort ({upcomingTasks.length})
              </h4>
            </div>
            <div className="space-y-2">
              {upcomingTasks.slice(0, 5).map(task => (
                <div
                  key={task.id}
                  className="p-3 bg-blue-50 border border-blue-200 rounded-lg"
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => handleCompleteTask(task)}
                      disabled={completingTasks.has(task.id)}
                      className="mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 border-blue-400 hover:bg-blue-100 disabled:opacity-50 flex items-center justify-center transition-colors"
                    >
                      {completingTasks.has(task.id) && (
                        <Check className="h-3 w-3 text-blue-600" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{task.title}</p>
                      <p className="text-sm text-blue-600">{formatDate(task.dueDate)}</p>
                      {task.isRecurring && (
                        <p className="text-xs text-gray-500 mt-1">
                          🔄 Terugkerend ({task.frequency})
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {!task.isRecurring && (
                        <button
                          onClick={() => handleCompleteTask(task, true)}
                          disabled={completingTasks.has(task.id)}
                          className="p-1.5 rounded hover:bg-blue-100 disabled:opacity-50 transition-colors"
                          title="Vervolgtaak aanmaken"
                        >
                          <Plus className="h-4 w-4 text-blue-600" />
                        </button>
                      )}
                      <ChevronRight className="h-5 w-5 text-blue-400 mt-0.5" />
                    </div>
                  </div>
                </div>
              ))}
              {upcomingTasks.length > 5 && (
                <p className="text-sm text-gray-500 text-center py-2">
                  + {upcomingTasks.length - 5} meer
                </p>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <Button
            variant="secondary"
            onClick={handleClose}
            className="flex-1"
          >
            Sluiten
          </Button>
          <Button
            onClick={handleViewTasks}
            icon={ChevronRight}
            className="flex-1"
          >
            Bekijk alle taken
          </Button>
        </div>
      </div>
    </Modal>
  );
});

WeeklyTasksReminder.displayName = 'WeeklyTasksReminder';

export default WeeklyTasksReminder;
