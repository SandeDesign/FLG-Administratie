import React, { useState, useEffect, useRef, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import { EventInput, EventClickArg, DateSelectArg } from '@fullcalendar/core';
import {
  Link2,
  Link2Off,
  CalendarDays,
  LayoutGrid,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { usePageTitle } from '../contexts/PageTitleContext';
import { useToast } from '../hooks/useToast';
import { BusinessTask } from '../types';
import { MicrosoftCalendarEvent } from '../types/microsoft';
import {
  getTasksAssignedToUser,
  getAllCompanyTasks,
  scheduleTask,
  unscheduleTask,
  updateTask,
} from '../services/firebase';
import {
  isMicrosoftConnected,
  getMicrosoftCalendarEvents,
  getMicrosoftAccount,
  loginMicrosoft,
  disconnectMicrosoft,
  saveMicrosoftConnection,
} from '../services/microsoftService';
import {
  checkAndShowSchedulingReminders,
  getNextFridayDeadline,
} from '../services/taskSchedulingService';
import { PRIORITY_CONFIG } from '../utils/taskConfig';
import TaskScheduleSidebar from '../components/tasks/TaskScheduleSidebar';
import ScheduledTaskPopover from '../components/tasks/ScheduledTaskPopover';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

const EmployeeAgenda: React.FC = () => {
  const { user, adminUserId } = useAuth();
  const { selectedCompany } = useApp();
  const { success, error } = useToast();
  usePageTitle('Mijn Agenda');

  const calendarRef = useRef<FullCalendar>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // State
  const [loading, setLoading] = useState(true);
  const [allTasks, setAllTasks] = useState<BusinessTask[]>([]);
  const [microsoftEvents, setMicrosoftEvents] = useState<MicrosoftCalendarEvent[]>([]);
  const [msConnected, setMsConnected] = useState(false);
  const [msAccount, setMsAccount] = useState<string>('');
  const [msLoading, setMsLoading] = useState(false);
  const [currentView, setCurrentView] = useState<'timeGridWeek' | 'dayGridMonth'>('timeGridWeek');
  const [selectedTask, setSelectedTask] = useState<BusinessTask | null>(null);
  const [selectedMsEvent, setSelectedMsEvent] = useState<MicrosoftCalendarEvent | null>(null);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [schedulingReminder, setSchedulingReminder] = useState<{ level: string; count: number } | null>(null);

  const unscheduledTasks = allTasks.filter(
    t => !t.isScheduled && t.status !== 'completed' && t.status !== 'cancelled'
  );
  const scheduledTasks = allTasks.filter(t => t.isScheduled);
  const fridayDeadline = getNextFridayDeadline();

  // Initialize FullCalendar Draggable on sidebar container
  useEffect(() => {
    if (sidebarRef.current) {
      const draggable = new Draggable(sidebarRef.current, {
        itemSelector: '[data-task-id]',
        eventData: (eventEl) => {
          const taskId = eventEl.getAttribute('data-task-id');
          const taskTitle = eventEl.getAttribute('data-task-title') || 'Taak';
          const taskColor = eventEl.getAttribute('data-task-color') || '#3b82f6';
          return {
            title: taskTitle,
            duration: '01:00',
            backgroundColor: taskColor,
            borderColor: taskColor,
            textColor: '#ffffff',
            extendedProps: { taskId, type: 'task' },
          };
        },
      });
      return () => draggable.destroy();
    }
  }, []);

  // Load data
  useEffect(() => {
    if (user && selectedCompany) {
      loadTasks();
      checkMicrosoftConnection();
      checkReminders();
    }
  }, [user, selectedCompany]);

  const loadTasks = async () => {
    if (!user || !selectedCompany) return;
    try {
      setLoading(true);
      // Haal alle bedrijfstaken op en filter client-side:
      // - taken expliciet toegewezen aan deze gebruiker
      // - taken zonder toewijzing (zichtbaar voor iedereen in het bedrijf)
      const allCompanyTasks = await getAllCompanyTasks(selectedCompany.id, user.uid);
      const myTasks = allCompanyTasks.filter(task =>
        !task.assignedTo || task.assignedTo.length === 0 || task.assignedTo.includes(user.uid)
      );
      setAllTasks(myTasks as BusinessTask[]);
    } catch (err) {
      console.error('Error loading tasks:', err);
      error('Fout bij laden van taken');
    } finally {
      setLoading(false);
    }
  };

  const checkMicrosoftConnection = async () => {
    try {
      const connected = await isMicrosoftConnected();
      setMsConnected(connected);
      if (connected) {
        const account = await getMicrosoftAccount();
        setMsAccount(account?.username || '');
        loadMicrosoftEvents();
      }
    } catch {
      // Microsoft niet beschikbaar
    }
  };

  const loadMicrosoftEvents = async () => {
    try {
      const calApi = calendarRef.current?.getApi();
      if (!calApi) return;

      const start = calApi.view.activeStart;
      const end = calApi.view.activeEnd;
      const events = await getMicrosoftCalendarEvents(start, end);
      setMicrosoftEvents(events);
    } catch (err) {
      console.error('Error loading Microsoft events:', err);
    }
  };

  const checkReminders = async () => {
    if (!user || !adminUserId || !selectedCompany) return;
    try {
      const result = await checkAndShowSchedulingReminders(adminUserId, user.uid, selectedCompany.id);
      if (result) {
        setSchedulingReminder({ level: result.level, count: result.unscheduledCount });
      }
    } catch {
      // Silence
    }
  };

  const handleMicrosoftConnect = async () => {
    if (!user) return;
    setMsLoading(true);
    try {
      const account = await loginMicrosoft();
      if (account) {
        await saveMicrosoftConnection(user.uid, account);
        setMsConnected(true);
        setMsAccount(account.username || '');
        success('Microsoft account gekoppeld');
        loadMicrosoftEvents();
      }
    } catch (err) {
      console.error('Error connecting Microsoft:', err);
      error('Fout bij koppelen van Microsoft account');
    } finally {
      setMsLoading(false);
    }
  };

  const handleMicrosoftDisconnect = async () => {
    if (!user) return;
    try {
      await disconnectMicrosoft(user.uid);
      setMsConnected(false);
      setMsAccount('');
      setMicrosoftEvents([]);
      success('Microsoft account ontkoppeld');
    } catch (err) {
      error('Fout bij ontkoppelen');
    }
  };

  // Convert tasks to FullCalendar events
  const getCalendarEvents = useCallback((): EventInput[] => {
    const taskEvents: EventInput[] = scheduledTasks.map(task => {
      const priorityColor = task.priority === 'urgent' ? '#ef4444'
        : task.priority === 'high' ? '#f97316'
        : task.priority === 'medium' ? '#3b82f6'
        : '#6b7280';

      const scheduledDate = task.scheduledDate ? new Date(task.scheduledDate) : new Date(task.dueDate);
      const dateStr = scheduledDate.toISOString().split('T')[0];

      return {
        id: `task-${task.id}`,
        title: task.title,
        start: task.scheduledStartTime ? `${dateStr}T${task.scheduledStartTime}:00` : dateStr,
        end: task.scheduledEndTime ? `${dateStr}T${task.scheduledEndTime}:00` : undefined,
        backgroundColor: priorityColor,
        borderColor: priorityColor,
        textColor: '#ffffff',
        extendedProps: {
          type: 'task',
          taskId: task.id,
          task,
        },
      };
    });

    const msEvents: EventInput[] = microsoftEvents.map(event => ({
      id: `ms-${event.id}`,
      title: event.subject,
      start: event.start.dateTime,
      end: event.end.dateTime,
      backgroundColor: '#8b5cf6',
      borderColor: '#7c3aed',
      textColor: '#ffffff',
      editable: false,
      extendedProps: {
        type: 'microsoft',
        msEvent: event,
      },
    }));

    return [...taskEvents, ...msEvents];
  }, [scheduledTasks, microsoftEvents]);

  // Handle event click (show popover)
  const handleEventClick = (info: EventClickArg) => {
    const rect = info.el.getBoundingClientRect();
    setPopoverPosition({
      top: rect.top + window.scrollY,
      left: Math.min(rect.right + 8, window.innerWidth - 340),
    });

    if (info.event.extendedProps.type === 'microsoft') {
      setSelectedMsEvent(info.event.extendedProps.msEvent);
      setSelectedTask(null);
    } else {
      setSelectedTask(info.event.extendedProps.task);
      setSelectedMsEvent(null);
    }
  };

  // Handle drop from external sidebar — remove element to prevent duplicates
  const handleDrop = (info: { date: Date; draggedEl: HTMLElement }) => {
    info.draggedEl.remove();
  };

  // Handle event receive (when external task is dropped on calendar)
  const handleEventReceive = async (info: any) => {
    const taskId = info.event.extendedProps?.taskId || info.draggedEl?.dataset?.taskid;
    if (!taskId || !user) return;

    const start = info.event.start;
    if (!start) return;

    const dateStr = start.toISOString().split('T')[0];
    const startTime = start.toTimeString().substring(0, 5);
    const endDate = info.event.end || new Date(start.getTime() + 60 * 60 * 1000);
    const endTime = endDate.toTimeString().substring(0, 5);

    try {
      await scheduleTask(taskId, user.uid, start, startTime, endTime);
      success('Taak ingepland');
      loadTasks();
    } catch (err) {
      console.error('Error scheduling task:', err);
      error('Fout bij inplannen van taak');
      info.revert();
    }
  };

  // Handle event drop (drag within calendar to reschedule)
  const handleEventDrop = async (info: any) => {
    const taskId = info.event.extendedProps?.task?.id;
    if (!taskId || !user || info.event.extendedProps?.type === 'microsoft') {
      info.revert();
      return;
    }

    const start = info.event.start;
    if (!start) return;

    const startTime = start.toTimeString().substring(0, 5);
    const endDate = info.event.end || new Date(start.getTime() + 60 * 60 * 1000);
    const endTime = endDate.toTimeString().substring(0, 5);

    try {
      await scheduleTask(taskId, user.uid, start, startTime, endTime);
      success('Taak verplaatst');
      loadTasks();
    } catch (err) {
      error('Fout bij verplaatsen');
      info.revert();
    }
  };

  // Handle event resize
  const handleEventResize = async (info: any) => {
    const taskId = info.event.extendedProps?.task?.id;
    if (!taskId || !user) {
      info.revert();
      return;
    }

    const start = info.event.start;
    const end = info.event.end;
    if (!start || !end) return;

    const startTime = start.toTimeString().substring(0, 5);
    const endTime = end.toTimeString().substring(0, 5);

    try {
      await scheduleTask(taskId, user.uid, start, startTime, endTime);
      loadTasks();
    } catch (err) {
      info.revert();
    }
  };

  // Handle date range change (load Microsoft events for new range)
  const handleDatesSet = () => {
    if (msConnected) {
      loadMicrosoftEvents();
    }
  };

  // Handle select (click on empty slot to schedule)
  const handleDateSelect = (selectInfo: DateSelectArg) => {
    // Als er niet-ingeplande taken zijn, toon de sidebar op mobile
    if (unscheduledTasks.length > 0) {
      setShowMobileSidebar(true);
    }
  };

  const handleUnschedule = async (taskId: string) => {
    if (!user) return;
    try {
      await unscheduleTask(taskId, user.uid);
      setSelectedTask(null);
      success('Inplanning verwijderd');
      loadTasks();
    } catch (err) {
      error('Fout bij verwijderen inplanning');
    }
  };

  const handleStatusChange = async (taskId: string, status: 'in_progress' | 'completed') => {
    if (!user || !adminUserId) return;
    try {
      await updateTask(taskId, user.uid, { status });
      setSelectedTask(null);
      success('Status bijgewerkt');
      loadTasks();
    } catch (err) {
      error('Fout bij bijwerken status');
    }
  };

  const handleSidebarTaskClick = (task: BusinessTask) => {
    // Op mobile: sluit sidebar en laat de kalender zien
    setShowMobileSidebar(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mijn Agenda</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {unscheduledTasks.length > 0
              ? `${unscheduledTasks.length} ${unscheduledTasks.length === 1 ? 'taak' : 'taken'} nog in te plannen`
              : 'Alle taken zijn ingepland'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
            <button
              onClick={() => {
                setCurrentView('timeGridWeek');
                calendarRef.current?.getApi().changeView('timeGridWeek');
              }}
              className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 ${
                currentView === 'timeGridWeek'
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              <CalendarDays className="h-4 w-4" />
              Week
            </button>
            <button
              onClick={() => {
                setCurrentView('dayGridMonth');
                calendarRef.current?.getApi().changeView('dayGridMonth');
              }}
              className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 border-l border-gray-300 dark:border-gray-600 ${
                currentView === 'dayGridMonth'
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              Maand
            </button>
          </div>

          {/* Microsoft connect */}
          {msConnected ? (
            <Button
              variant="secondary"
              onClick={handleMicrosoftDisconnect}
              icon={Link2Off}
              className="text-xs"
            >
              <span className="hidden sm:inline">{msAccount || 'Microsoft'}</span>
              <span className="sm:hidden">MS</span>
            </Button>
          ) : (
            <Button
              onClick={handleMicrosoftConnect}
              variant="secondary"
              icon={Link2}
              disabled={msLoading}
              className="text-xs"
            >
              {msLoading ? 'Verbinden...' : 'Microsoft koppelen'}
            </Button>
          )}

          {/* Mobile sidebar toggle */}
          {unscheduledTasks.length > 0 && (
            <button
              onClick={() => setShowMobileSidebar(!showMobileSidebar)}
              className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-sm font-medium"
            >
              <AlertTriangle className="h-4 w-4" />
              {unscheduledTasks.length} open
            </button>
          )}
        </div>
      </div>

      {/* Scheduling reminder banner */}
      {schedulingReminder && (
        <div className={`rounded-lg p-3 flex items-center gap-3 ${
          schedulingReminder.level === 'overdue'
            ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
            : schedulingReminder.level === 'strong'
              ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
              : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
        }`}>
          <AlertTriangle className={`h-5 w-5 flex-shrink-0 ${
            schedulingReminder.level === 'overdue' ? 'text-red-600' : schedulingReminder.level === 'strong' ? 'text-amber-600' : 'text-blue-600'
          }`} />
          <p className={`text-sm font-medium ${
            schedulingReminder.level === 'overdue' ? 'text-red-800 dark:text-red-300' : schedulingReminder.level === 'strong' ? 'text-amber-800 dark:text-amber-300' : 'text-blue-800 dark:text-blue-300'
          }`}>
            {schedulingReminder.level === 'overdue'
              ? `Deadline verstreken! ${schedulingReminder.count} taken niet ingepland.`
              : schedulingReminder.level === 'strong'
                ? `Morgen is de deadline! Plan je ${schedulingReminder.count} taken in voor vrijdag 19:00.`
                : `${schedulingReminder.count} taken moeten nog ingepland worden deze week.`}
          </p>
        </div>
      )}

      {/* Main content: Sidebar + Calendar */}
      <div className="flex gap-4">
        {/* Desktop Sidebar */}
        <div ref={sidebarRef} className="hidden lg:block w-72 flex-shrink-0">
          <Card className="h-[calc(100vh-250px)] overflow-hidden !p-0">
            <TaskScheduleSidebar
              tasks={unscheduledTasks}
              onTaskClick={handleSidebarTaskClick}
              fridayDeadline={fridayDeadline}
            />
          </Card>
        </div>

        {/* Calendar */}
        <div className="flex-1 min-w-0">
          <Card className="employee-agenda-calendar">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              locale="nl"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: '',
              }}
              buttonText={{
                today: 'Vandaag',
                month: 'Maand',
                week: 'Week',
                day: 'Dag',
              }}
              slotMinTime="06:00:00"
              slotMaxTime="22:00:00"
              slotDuration="00:30:00"
              slotLabelInterval="01:00:00"
              slotLabelFormat={{
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              }}
              allDaySlot={true}
              allDayText="Hele dag"
              weekNumbers={true}
              weekNumberFormat={{ week: 'numeric' }}
              firstDay={1}
              nowIndicator={true}
              editable={true}
              droppable={true}
              selectable={true}
              selectMirror={true}
              eventResizableFromStart={true}
              events={getCalendarEvents()}
              eventClick={handleEventClick}
              eventDrop={handleEventDrop}
              eventResize={handleEventResize}
              eventReceive={handleEventReceive}
              drop={handleDrop}
              select={handleDateSelect}
              datesSet={handleDatesSet}
              height="auto"
              expandRows={true}
              dayMaxEvents={3}
              eventTimeFormat={{
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              }}
            />
          </Card>
        </div>
      </div>

      {/* Mobile Sidebar (bottom sheet) */}
      {showMobileSidebar && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowMobileSidebar(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-2xl max-h-[70vh] overflow-hidden shadow-xl">
            <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mt-3" />
            <TaskScheduleSidebar
              tasks={unscheduledTasks}
              onTaskClick={handleSidebarTaskClick}
              fridayDeadline={fridayDeadline}
            />
          </div>
        </div>
      )}

      {/* Task Popover */}
      {(selectedTask || selectedMsEvent) && (
        <div className="fixed inset-0 z-40" onClick={() => { setSelectedTask(null); setSelectedMsEvent(null); }}>
          <div
            className="absolute"
            style={{ top: popoverPosition.top, left: popoverPosition.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <ScheduledTaskPopover
              task={selectedTask || undefined}
              microsoftEvent={selectedMsEvent || undefined}
              onClose={() => { setSelectedTask(null); setSelectedMsEvent(null); }}
              onUnschedule={selectedTask ? handleUnschedule : undefined}
              onStatusChange={selectedTask ? handleStatusChange : undefined}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeAgenda;
