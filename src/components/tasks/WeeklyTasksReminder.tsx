import React, { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { getTasks, getAllCompanyTasks } from '../../services/firebase';
import { BusinessTask } from '../../types';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Calendar, CheckCircle2, AlertCircle, Clock, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface WeeklyTasksReminderRef {
  openManually: () => void;
}

const WeeklyTasksReminder = forwardRef<WeeklyTasksReminderRef>((props, ref) => {
  const { user, userRole } = useAuth();
  const { selectedCompany } = useApp();
  const navigate = useNavigate();

  const [showReminder, setShowReminder] = useState(false);
  const [thisWeekTasks, setThisWeekTasks] = useState<BusinessTask[]>([]);
  const [loading, setLoading] = useState(true);

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
                  className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{task.title}</p>
                    <p className="text-sm text-red-600">{formatDate(task.dueDate)}</p>
                  </div>
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 ml-2" />
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
                  className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{task.title}</p>
                    <p className="text-sm text-orange-600">Vandaag</p>
                  </div>
                  <Clock className="h-5 w-5 text-orange-500 flex-shrink-0 ml-2" />
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
                  className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{task.title}</p>
                    <p className="text-sm text-blue-600">{formatDate(task.dueDate)}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-blue-400 flex-shrink-0 ml-2" />
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
