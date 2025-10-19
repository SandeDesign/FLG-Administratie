import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Company, Employee, WorkContext, TimesheetCompanyContext } from '../types';
import { getBuddyEcosystemService } from '../services/BuddyEcosystemService';
import { useAuth } from './AuthContext';

/**
 * SMART COMPANY MANAGER CONTEXT
 * 
 * Centralized context voor intelligent company management.
 * Implementeert alle "invisible" logica voor company selection.
 */

interface SmartCompanyContextType {
  // Current state
  workContext: WorkContext | null;
  timesheetContext: TimesheetCompanyContext | null;
  currentWorkCompany: Company | null;
  
  // UI state
  shouldShowCompanySelector: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setCurrentWorkCompany: (company: Company) => void;
  refreshWorkContext: () => Promise<void>;
  getTimesheetContext: (week: number, year: number) => Promise<TimesheetCompanyContext>;
  autoDetectWorkCompany: (timeEntryHint?: any) => Promise<Company | null>;
  
  // Validation
  validateCompanyAccess: (companyId: string) => boolean;
  getAvailableCompanies: () => Company[];
  getDefaultCompany: () => Company | null;
}

const SmartCompanyContext = createContext<SmartCompanyContextType | undefined>(undefined);

interface SmartCompanyProviderProps {
  children: React.ReactNode;
  employeeId?: string; // If provided, context is for specific employee
}

export const SmartCompanyProvider: React.FC<SmartCompanyProviderProps> = ({
  children,
  employeeId
}) => {
  const { user, adminUserId, currentEmployeeId } = useAuth();
  const [workContext, setWorkContext] = useState<WorkContext | null>(null);
  const [timesheetContext, setTimesheetContext] = useState<TimesheetCompanyContext | null>(null);
  const [currentWorkCompany, setCurrentWorkCompanyState] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const effectiveEmployeeId = employeeId || currentEmployeeId;
  const ecosystemService = user ? getBuddyEcosystemService(adminUserId || user.uid) : null;

  // Load work context
  const refreshWorkContext = useCallback(async () => {
    if (!effectiveEmployeeId || !ecosystemService) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const context = await ecosystemService.getEmployeeWorkContext(effectiveEmployeeId);
      setWorkContext(context);
      
      // Auto-select company if not already set
      if (!currentWorkCompany && context.defaultBehavior.autoSelectPrimary) {
        setCurrentWorkCompanyState(context.primaryEmployer);
      }
      
    } catch (err) {
      console.error('Error loading work context:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [effectiveEmployeeId, ecosystemService, currentWorkCompany]);

  // Load timesheet context
  const getTimesheetContext = useCallback(async (week: number, year: number): Promise<TimesheetCompanyContext> => {
    if (!effectiveEmployeeId || !ecosystemService) {
      throw new Error('No employee or service available');
    }

    const context = await ecosystemService.getTimesheetCompanyContext(effectiveEmployeeId, week, year);
    setTimesheetContext(context);
    return context;
  }, [effectiveEmployeeId, ecosystemService]);

  // Auto-detect optimal work company
  const autoDetectWorkCompany = useCallback(async (timeEntryHint?: any): Promise<Company | null> => {
    if (!effectiveEmployeeId || !ecosystemService) return null;

    try {
      const detected = await ecosystemService.detectOptimalWorkCompany(
        effectiveEmployeeId,
        timeEntryHint
      );
      
      if (detected && workContext?.capabilities.canSwitchCompanies) {
        setCurrentWorkCompanyState(detected);
      }
      
      return detected;
    } catch (err) {
      console.error('Error detecting work company:', err);
      return null;
    }
  }, [effectiveEmployeeId, ecosystemService, workContext]);

  // Set current work company with validation
  const setCurrentWorkCompany = useCallback((company: Company) => {
    if (!workContext) return;

    const hasAccess = workContext.availableWorkCompanies.some(c => c.id === company.id);
    if (!hasAccess) {
      setError(`Geen toegang tot bedrijf ${company.name}`);
      return;
    }

    setCurrentWorkCompanyState(company);
    setError(null);
  }, [workContext]);

  // Validation helpers
  const validateCompanyAccess = useCallback((companyId: string): boolean => {
    if (!workContext) return false;
    return workContext.availableWorkCompanies.some(c => c.id === companyId);
  }, [workContext]);

  const getAvailableCompanies = useCallback((): Company[] => {
    return workContext?.availableWorkCompanies || [];
  }, [workContext]);

  const getDefaultCompany = useCallback((): Company | null => {
    return workContext?.primaryEmployer || null;
  }, [workContext]);

  // Initialize on mount
  useEffect(() => {
    refreshWorkContext();
  }, [refreshWorkContext]);

  // Smart UI logic
  const shouldShowCompanySelector = workContext ? 
    !workContext.defaultBehavior.showCompanySelector === false &&
    workContext.availableWorkCompanies.length > 1 &&
    workContext.capabilities.requiresCompanySelection : false;

  const contextValue: SmartCompanyContextType = {
    workContext,
    timesheetContext,
    currentWorkCompany,
    shouldShowCompanySelector,
    isLoading,
    error,
    setCurrentWorkCompany,
    refreshWorkContext,
    getTimesheetContext,
    autoDetectWorkCompany,
    validateCompanyAccess,
    getAvailableCompanies,
    getDefaultCompany
  };

  return (
    <SmartCompanyContext.Provider value={contextValue}>
      {children}
    </SmartCompanyContext.Provider>
  );
};

/**
 * HOOK FOR ACCESSING SMART COMPANY CONTEXT
 */
export const useSmartCompany = (): SmartCompanyContextType => {
  const context = useContext(SmartCompanyContext);
  if (!context) {
    throw new Error('useSmartCompany must be used within SmartCompanyProvider');
  }
  return context;
};

/**
 * SMART COMPANY SELECTOR COMPONENT
 */
interface SmartCompanySelectorProps {
  className?: string;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  showLabel?: boolean;
  onCompanyChange?: (company: Company) => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'minimal' | 'invisible';
}

export const SmartCompanySelector: React.FC<SmartCompanySelectorProps> = ({
  className = '',
  disabled = false,
  label = 'Bedrijf',
  placeholder = 'Selecteer bedrijf...',
  showLabel = true,
  onCompanyChange,
  size = 'md',
  variant = 'default'
}) => {
  const {
    shouldShowCompanySelector,
    currentWorkCompany,
    setCurrentWorkCompany,
    getAvailableCompanies,
    getDefaultCompany,
    isLoading
  } = useSmartCompany();

  const availableCompanies = getAvailableCompanies();
  const defaultCompany = getDefaultCompany();

  // Auto-select default if no current selection
  useEffect(() => {
    if (!currentWorkCompany && defaultCompany && !shouldShowCompanySelector) {
      setCurrentWorkCompany(defaultCompany);
      onCompanyChange?.(defaultCompany);
    }
  }, [currentWorkCompany, defaultCompany, shouldShowCompanySelector, setCurrentWorkCompany, onCompanyChange]);

  const handleCompanyChange = (companyId: string) => {
    const company = availableCompanies.find(c => c.id === companyId);
    if (company) {
      setCurrentWorkCompany(company);
      onCompanyChange?.(company);
    }
  };

  // INVISIBLE VARIANT: No UI, just auto-selection
  if (variant === 'invisible' || !shouldShowCompanySelector) {
    // Still render hidden input for form compatibility
    return (
      <input
        type="hidden"
        value={currentWorkCompany?.id || ''}
        readOnly
      />
    );
  }

  // MINIMAL VARIANT: Subtle UI
  if (variant === 'minimal') {
    if (availableCompanies.length <= 1) return null;

    return (
      <div className={`${className}`}>
        <select
          value={currentWorkCompany?.id || ''}
          onChange={(e) => handleCompanyChange(e.target.value)}
          disabled={disabled || isLoading}
          className="text-xs px-2 py-1 border border-gray-200 rounded bg-gray-50 text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {availableCompanies.map(company => (
            <option key={company.id} value={company.id}>
              {company.name}
              {company.id !== defaultCompany?.id && ' (Project)'}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // DEFAULT VARIANT: Full selector
  const sizeClasses = {
    sm: 'text-sm px-2 py-1',
    md: 'text-sm px-3 py-2',
    lg: 'text-base px-4 py-3'
  };

  return (
    <div className={className}>
      {showLabel && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      
      <select
        value={currentWorkCompany?.id || ''}
        onChange={(e) => handleCompanyChange(e.target.value)}
        disabled={disabled || isLoading}
        className={`
          w-full ${sizeClasses[size]} 
          text-gray-900 dark:text-white 
          bg-white dark:bg-gray-800 
          border border-gray-300 dark:border-gray-700 
          rounded-lg 
          focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500
          disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed
        `}
      >
        <option value="" disabled>{placeholder}</option>
        
        {/* Primary employer first */}
        {defaultCompany && (
          <option key={defaultCompany.id} value={defaultCompany.id}>
            {defaultCompany.name}
          </option>
        )}
        
        {/* Project companies */}
        {availableCompanies
          .filter(c => c.id !== defaultCompany?.id)
          .map(company => (
            <option key={company.id} value={company.id}>
              {company.name} (Project)
            </option>
          ))}
      </select>
    </div>
  );
};

/**
 * COMPANY INDICATOR COMPONENT
 */
interface CompanyIndicatorProps {
  showOnlyWhenRelevant?: boolean;
  className?: string;
}

export const CompanyIndicator: React.FC<CompanyIndicatorProps> = ({
  showOnlyWhenRelevant = true,
  className = ''
}) => {
  const { currentWorkCompany, workContext } = useSmartCompany();

  // Only show if working for non-primary company
  if (showOnlyWhenRelevant && 
      currentWorkCompany?.id === workContext?.primaryEmployer.id) {
    return null;
  }

  if (!currentWorkCompany) return null;

  return (
    <div className={`inline-flex items-center px-2 py-1 rounded-md text-xs bg-blue-50 text-blue-700 border border-blue-200 ${className}`}>
      <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
      Werkend voor: <strong className="ml-1">{currentWorkCompany.name}</strong>
    </div>
  );
};

/**
 * QUICK COMPANY SWITCH COMPONENT
 */
export const QuickCompanySwitch: React.FC = () => {
  const {
    shouldShowCompanySelector,
    currentWorkCompany,
    setCurrentWorkCompany,
    getAvailableCompanies,
    workContext
  } = useSmartCompany();

  const availableCompanies = getAvailableCompanies();

  if (!shouldShowCompanySelector || 
      !workContext?.defaultBehavior.enableQuickSwitch ||
      availableCompanies.length <= 1) {
    return null;
  }

  return (
    <div className="flex items-center space-x-1">
      {availableCompanies.map(company => (
        <button
          key={company.id}
          onClick={() => setCurrentWorkCompany(company)}
          className={`
            px-2 py-1 text-xs rounded transition-colors
            ${currentWorkCompany?.id === company.id
              ? 'bg-blue-100 text-blue-700 border border-blue-300'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300'
            }
          `}
        >
          {company.name.split(' ')[0]} {/* First word only for space */}
        </button>
      ))}
    </div>
  );
};

/**
 * EXPORT HOOKS FOR SPECIFIC USE CASES
 */

// Hook for timesheet components
export const useTimesheetCompany = () => {
  const smartCompany = useSmartCompany();
  
  return {
    currentWorkCompany: smartCompany.currentWorkCompany,
    setCurrentWorkCompany: smartCompany.setCurrentWorkCompany,
    shouldShowSelector: smartCompany.shouldShowCompanySelector,
    getTimesheetContext: smartCompany.getTimesheetContext,
    autoDetect: smartCompany.autoDetectWorkCompany
  };
};

// Hook for employee forms
export const useEmployeeCompany = () => {
  const smartCompany = useSmartCompany();
  
  return {
    workContext: smartCompany.workContext,
    availableCompanies: smartCompany.getAvailableCompanies(),
    defaultCompany: smartCompany.getDefaultCompany(),
    validateAccess: smartCompany.validateCompanyAccess
  };
};

// Hook for import functionality
export const useImportCompany = () => {
  const smartCompany = useSmartCompany();
  
  return {
    autoDetectForImport: (source: string, data?: any) => 
      smartCompany.autoDetectWorkCompany({ importSource: source, ...data }),
    currentWorkCompany: smartCompany.currentWorkCompany,
    setCurrentWorkCompany: smartCompany.setCurrentWorkCompany
  };
};