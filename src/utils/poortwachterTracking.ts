export interface PoortwachterMilestone {
  week: number;
  action: string;
  completedDate?: Date;
  status: 'pending' | 'completed' | 'overdue';
  dueDate: Date;
}

const POORTWACHTER_MILESTONES = [
  {
    week: 6,
    action: 'Probleemanalyse: Werkgever en werknemer maken samen een probleemanalyse',
  },
  {
    week: 8,
    action: 'Plan van aanpak: Opstellen van een concreet plan van aan aanpak voor re-integratie',
  },
  {
    week: 13,
    action: 'Evaluatie 1: Eerste evaluatie van de voortgang en bijstelling plan indien nodig',
  },
  {
    week: 26,
    action: 'Evaluatie 2: Tweede evaluatie en actualisatie van het plan van aanpak',
  },
  {
    week: 42,
    action: 'Arbo-arts: Betrek de bedrijfsarts/arbodienst voor ondersteuning en advies',
  },
  {
    week: 52,
    action: 'Evaluatie 3: Jaarlijkse evaluatie van de re-integratie inspanningen',
  },
  {
    week: 78,
    action: 'Evaluatie 4: Voorbereiden voor mogelijke WIA aanvraag binnen 6 maanden',
  },
  {
    week: 91,
    action: 'WIA Voorbereiding: Start voorbereidingen voor WIA aanvraag (3 maanden voor 2 jaar)',
  },
  {
    week: 104,
    action: 'WIA Aanvraag: Indienen WIA aanvraag bij UWV (verplicht na 2 jaar ziekte)',
  },
];

export function generatePoortwachterMilestones(startDate: Date): PoortwachterMilestone[] {
  return POORTWACHTER_MILESTONES.map(milestone => {
    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + (milestone.week * 7));

    return {
      week: milestone.week,
      action: milestone.action,
      status: 'pending',
      dueDate,
    };
  });
}

export function updateMilestoneStatus(
  milestone: PoortwachterMilestone,
  currentDate: Date = new Date()
): PoortwachterMilestone {
  if (milestone.completedDate) {
    return { ...milestone, status: 'completed' };
  }

  if (currentDate > milestone.dueDate) {
    return { ...milestone, status: 'overdue' };
  }

  return { ...milestone, status: 'pending' };
}

export function getOverdueMilestones(
  milestones: PoortwachterMilestone[],
  currentDate: Date = new Date()
): PoortwachterMilestone[] {
  return milestones
    .map(m => updateMilestoneStatus(m, currentDate))
    .filter(m => m.status === 'overdue');
}

export function getUpcomingMilestones(
  milestones: PoortwachterMilestone[],
  daysAhead: number = 7,
  currentDate: Date = new Date()
): PoortwachterMilestone[] {
  const futureDate = new Date(currentDate);
  futureDate.setDate(futureDate.getDate() + daysAhead);

  return milestones.filter(m =>
    !m.completedDate &&
    m.dueDate >= currentDate &&
    m.dueDate <= futureDate
  );
}

export function shouldActivatePoortwachter(
  startDate: Date,
  currentDate: Date = new Date()
): boolean {
  const sixWeeksInMs = 6 * 7 * 24 * 60 * 60 * 1000;
  const duration = currentDate.getTime() - startDate.getTime();
  return duration >= sixWeeksInMs;
}

export function getWeeksSinceSickLeave(
  startDate: Date,
  currentDate: Date = new Date()
): number {
  const durationInMs = currentDate.getTime() - startDate.getTime();
  const durationInDays = durationInMs / (1000 * 60 * 60 * 24);
  return Math.floor(durationInDays / 7);
}

export function shouldContactArbo(
  milestones: PoortwachterMilestone[],
  currentDate: Date = new Date()
): boolean {
  const arboMilestone = milestones.find(m => m.week === 42);
  if (!arboMilestone) return false;

  return currentDate >= arboMilestone.dueDate && !arboMilestone.completedDate;
}

export function shouldStartWIAPreparation(
  startDate: Date,
  currentDate: Date = new Date()
): boolean {
  const weeks = getWeeksSinceSickLeave(startDate, currentDate);
  return weeks >= 91;
}

export function getNextMilestone(
  milestones: PoortwachterMilestone[],
  currentDate: Date = new Date()
): PoortwachterMilestone | null {
  const upcoming = milestones
    .filter(m => !m.completedDate && m.dueDate >= currentDate)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  return upcoming || null;
}

export function completeMilestone(
  milestone: PoortwachterMilestone,
  completionDate: Date = new Date()
): PoortwachterMilestone {
  return {
    ...milestone,
    completedDate: completionDate,
    status: 'completed',
  };
}

export function getMilestoneCompletionPercentage(
  milestones: PoortwachterMilestone[]
): number {
  if (milestones.length === 0) return 0;

  const completed = milestones.filter(m => m.status === 'completed').length;
  return (completed / milestones.length) * 100;
}