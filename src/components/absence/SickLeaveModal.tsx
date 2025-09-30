setSubmitting(true);
    try {
      await createSickLeave(user.uid, {
        employeeId,
        companyId: currentEmployee?.companyId || '',
        startDate: new Date(data.startDate),
        reportedAt: new Date(),
        reportedBy: user?.displayName || user?.email || 'Werknemer',
        reportedVia: 'app',
        workCapacityPercentage: data.workCapacityPercentage,
        status: 'active',
        notes: data.notes || '',
        arboServiceContacted: false,
        poortwachterActive: false,
        doctorVisits: [],
      });