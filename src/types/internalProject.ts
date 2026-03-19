export interface InternalProject {
  id?: string;
  userId: string;
  companyId: string;
  name: string;
  description?: string;
  color?: string; // bijv. 'blue' | 'green' | 'amber' | 'purple' | 'rose'
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
