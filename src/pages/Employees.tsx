import React, { useState, useEffect } from 'react';
import { Plus, User, CreditCard as Edit, Trash2, Mail, Phone, Building2, MapPin, UserPlus, Copy, Eye, EyeOff } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Employee, Company, Branch, DUTCH_CAOS } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../hooks/useToast';
import { createEmployee, updateEmployee, deleteEmployee, getBranches, createEmployeeAuthAccount, generateSecurePassword } from '../services/firebase';
import { validateBSN, validateIBAN, validatePostalCode, validatePhone } from '../utils/validation';

interface EmployeeFormData {
  // Persoonlijke gegevens
  firstName: string;
  lastName: string;
  initials: string;
  bsn: string;
  dateOfBirth: string;
  placeOfBirth?: string;
  nationality?: string;
  maritalStatus: 'single' | 'married' | 'registered_partnership' | 'divorced' | 'widowed';
  
  // Adres
  street: string;
  houseNumber?: string;
  houseNumberAddition?: string;
  city: string;
  zipCode: string;
  
  // Contact
  email: string;
  phone: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  
  // Bank & Identiteit
  bankAccount: string;
  identityDocument?: string;
  
  // Bedrijf & Vestiging
  companyId: string;
  branchId: string;
  
  // Contract
  contractType: 'permanent' | 'temporary' | 'zero_hours' | 'on_call' | 'intern' | 'dga' | 'payroll' | 'freelance';
  startDate: string;
  endDate?: string;
  probationPeriod?: number;
  hoursPerWeek: number;
  position: string;
  department?: string;
  costCenter?: string;
  cao: string;
  caoCode?: string;
  contractStatus: 'active' | 'notice_period' | 'ended' | 'suspended';
  
  // Salaris
  salaryScale: string;
  paymentType: 'hourly' | 'monthly' | 'annual';
  paymentFrequency: 'monthly' | 'four_weekly' | 'weekly';
  hourlyRate?: number;
  monthlySalary?: number;
  annualSalary?: number;
  
  // Toeslagen
  overtimeAllowance: number;
  irregularAllowance: number;
  shiftAllowance: number;
  weekendAllowance: number;
  eveningAllowance: number;
  nightAllowance: number;
  sundayAllowance: number;
  callDutyAllowance: number;
  
  // Vergoedingen
  holidayAllowancePercentage: number;
  thirteenthMonth?: boolean;
  endOfYearBonus?: number;
  travelAllowanceType: 'per_km' | 'public_transport' | 'fixed';
  travelAllowancePerKm?: number;
  travelAllowanceFixed?: number;
  phoneAllowance?: number;
  homeWorkAllowance?: number;
  clothingAllowance?: number;
  
  // Pensioen
  pensionScheme?: string;
  pensionContribution: number;
  pensionEmployerContribution: number;
  pensionFund?: string;
  
  // Fiscaal
  taxCredit: boolean;
  taxTable: 'white' | 'green' | 'special';
  
  // Verlof
  statutoryHolidayDays?: number;
  extraStatutoryHolidayDays?: number;
  advDays?: number;
  seniorDays?: number;
  snipperDays?: number;
}

// Define which fields belong to each tab for targeted validation
const tabFields = {
  0: [
    'firstName', 'lastName', 'initials', 'bsn', 'dateOfBirth', 'placeOfBirth', 
    'nationality', 'maritalStatus', 'street', 'houseNumber', 'zipCode', 'city',
    'email', 'phone', 'bankAccount'
  ],
  1: [
    'companyId', 'branchId', 'contractType', 'startDate', 'position', 'cao', 'hoursPerWeek'
  ],
  2: [
    'salaryScale', 'paymentType', 'paymentFrequency', 'overtimeAllowance', 
    'irregularAllowance', 'shiftAllowance', 'weekendAllowance'
  ],
  3: [
    'holidayAllowancePercentage', 'travelAllowanceType', 'pensionContribution', 
    'pensionEmployerContribution', 'taxCredit', 'taxTable'
  ],
  4: [] // Leave tab has no required fields
};

// Validatie schema
const employeeSchema = yup.object({
  // Persoonlijke gegevens
  firstName: yup.string().required('Voornaam is verplicht').min(2, 'Minimaal 2 karakters'),
  lastName: yup.string().required('Achternaam is verplicht').min(2, 'Minimaal 2 karakters'),
  initials: yup.string().required('Initialen zijn verplicht'),
  bsn: yup.string()
    .required('BSN is verplicht')
    .test('bsn-valid', 'Ongeldig BSN nummer', (value) => value ? validateBSN(value) : false),
  dateOfBirth: yup.date().required('Geboortedatum is verplicht').max(new Date(), 'Geboortedatum kan niet in de toekomst liggen'),
  placeOfBirth: yup.string().required('Geboorteplaats is verplicht'),
  nationality: yup.string().required('Nationaliteit is verplicht'),
  maritalStatus: yup.string().required('Burgerlijke staat is verplicht'),
  
  // Adres
  street: yup.string().required('Straat is verplicht'),
  houseNumber: yup.string().required('Huisnummer is verplicht'),
  zipCode: yup.string()
    .required('Postcode is verplicht')
    .test('postcode-valid', 'Ongeldige postcode (gebruik 1234 AB formaat)', (value) => value ? validatePostalCode(value) : false),
  city: yup.string().required('Plaats is verplicht'),
  
  // Contact
  email: yup.string().required('E-mailadres is verplicht').email('Ongeldig e-mailadres'),
  phone: yup.string()
    .required('Telefoonnummer is verplicht')
    .test('phone-valid', 'Ongeldig Nederlands telefoonnummer', (value) => value ? validatePhone(value) : false),
  
  // Bank
  bankAccount: yup.string()
    .required('Bankrekeningnummer is verplicht')
    .test('iban-valid', 'Ongeldig IBAN nummer', (value) => value ? validateIBAN(value) : false),
  
  // Bedrijf
  companyId: yup.string().required('Bedrijf is verplicht'),
  branchId: yup.string().required('Vestiging is verplicht'),
  
  // Contract
  contractType: yup.string().required('Contracttype is verplicht'),
  startDate: yup.date().required('Startdatum is verplicht'),
  position: yup.string().required('Functie is verplicht'),
  cao: yup.string().required('CAO is verplicht'),
  
  // Salaris
  salaryScale: yup.string().required('Loonschaal is verplicht'),
  paymentType: yup.string().required('Betalingstype is verplicht'),
  paymentFrequency: yup.string().required('Betalingsfrequentie is verplicht'),
});

const Employees: React.FC = () => {
  const { user } = useAuth();
  const { userRole } = useAuth();
  const { employees, companies, refreshEmployees, loading } = useApp();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const { success, error } = useToast();

  const { register, handleSubmit, reset, setValue, watch, trigger, formState: { errors } } = useForm<EmployeeFormData>({
  });

  // Debug logging for user role
  useEffect(() => {
    console.log('=== USER ROLE DEBUG ===');
    console.log('Current user:', user);
    console.log('User role:', userRole);
    resolver: yupResolver(employeeSchema)
  });
  
  // Debug logging for user role
  useEffect(() => {
    console.log('=== USER ROLE DEBUG ===');
    console.log('Current user:', user);
    console.log('User role:', userRole);
    console.log('User UID:', user?.uid);
    console.log('User email:', user?.email);
  }, [user, userRole]);

  const selectedCompanyId = watch('companyId');
  const selectedCAO = watch('cao');
  const paymentType = watch('paymentType');
  const contractType = watch('contractType');

  const tabs = [
    { id: 0, name: 'Persoonlijke Gegevens', icon: User },
    { id: 1, name: 'Contract', icon: Building2 },
    { id: 2, name: 'Salaris & Toeslagen', icon: Edit },
    { id: 3, name: 'Vergoedingen', icon: Phone },
    { id: 4, name: 'Verlof', icon: Mail },
  ];

  useEffect(() => {
    if (user) {
      loadBranches();
    }
  }, [user]);

  const loadBranches = async () => {
    if (!user) return;
    
    try {
      const data = await getBranches(user.uid);
      setBranches(data);
    } catch (err) {
      console.error('Error loading branches:', err);
    }
  };

  // Handle tab navigation with validation
  const handleTabNavigation = async (direction: 'next' | 'prev') => {
    if (direction === 'prev') {
      setActiveTab(activeTab - 1);
      return;
    }

    // For next, validate current tab fields
    const currentTabFields = tabFields[activeTab as keyof typeof tabFields];
    if (currentTabFields.length > 0) {
      const isValid = await trigger(currentTabFields as any);
      if (!isValid) {
        error('Validatiefout', 'Vul alle verplichte velden in op dit tabblad.');
        return;
      }
    }

    setActiveTab(activeTab + 1);
  };

  const openModal = (employee?: Employee) => {
    setActiveTab(0); // Reset to first tab
    
    if (!employee) {
      // Adding new employee - reset state first
      setEditingEmployee(null);
      reset();
      
      // Check if companies exist
      if (companies.length === 0) {
        error('Geen bedrijven', 'Voeg eerst een bedrijf toe voordat je werknemers kunt aanmaken');
        return;
      }
      
      // Get default company and validate
      const defaultCompany = companies[0];
      if (!defaultCompany || !defaultCompany.id) {
        error('Ongeldig bedrijf', 'Het geselecteerde bedrijf is ongeldig');
        return;
      }
      
      // Get available branches for this company
      const availableBranches = branches.filter(b => b.companyId === defaultCompany.id);
      if (availableBranches.length === 0) {
        error('Geen vestigingen', `Voeg eerst een vestiging toe aan ${defaultCompany.name} voordat je werknemers kunt
        )
      }
    }
  }
} aanmaken`);
        return;
      }
      
      // Get default branch and validate
      const defaultBranch = availableBranches[0];
      if (!defaultBranch || !defaultBranch.id) {
        error('Ongeldige vestiging', 'De geselecteerde vestiging is ongeldig');
        return;
      }
      
      // Set company and branch values
      setValue('companyId', defaultCompany.id);
      setValue('branchId', defaultBranch.id);
      
      // Set default values for new employee
      setValue('nationality', 'Nederlandse');
      setValue('maritalStatus', 'single');
      setValue('paymentType', 'monthly');
      setValue('paymentFrequency', 'monthly');
      setValue('contractStatus', 'active');
      setValue('overtimeAllowance', 150);
      setValue('irregularAllowance', 130);
      setValue('shiftAllowance', 120);
      setValue('weekendAllowance', 150);
      setValue('eveningAllowance', 115);
      setValue('nightAllowance', 130);
      setValue('sundayAllowance', 170);
      setValue('callDutyAllowance', 125);
      setValue('holidayAllowancePercentage', 8);
      setValue('travelAllowanceType', 'per_km');
      setValue('travelAllowancePerKm', 0.23);
      setValue('taxCredit', true);
      setValue('taxTable', 'white');
      
      setIsModalOpen(true);
    } else {
      // Editing existing employee
      setEditingEmployee(employee);
      
      // Set all form values for editing
      setValue('firstName', employee.personalInfo.firstName);
      setValue('lastName', employee.personalInfo.lastName);
      setValue('initials', employee.personalInfo.initials || '');
      setValue('bsn', employee.personalInfo.bsn);
      setValue('dateOfBirth', employee.personalInfo.dateOfBirth?.toISOString()?.split('T')[0] || '');
      setValue('placeOfBirth', employee.personalInfo.placeOfBirth || '');
      setValue('nationality', employee.personalInfo.nationality || 'Nederlandse');
      setValue('maritalStatus', employee.personalInfo.maritalStatus || 'single');
      
      // Address
      setValue('street', employee.personalInfo.address.street);
      setValue('houseNumber', employee.personalInfo.address.houseNumber || '');
      setValue('houseNumberAddition', employee.personalInfo.address.houseNumberAddition || '');
      setValue('city', employee.personalInfo.address.city);
      setValue('zipCode', employee.personalInfo.address.postalCode || employee.personalInfo.address.zipCode || '');
      
      // Contact
      setValue('email', employee.personalInfo.contactInfo.email);
      setValue('phone', employee.personalInfo.contactInfo.phone);
      setValue('emergencyContactName', employee.personalInfo.contactInfo.emergencyContact?.name || '');
      setValue('emergencyContactPhone', employee.personalInfo.contactInfo.emergencyContact?.phone || '');
      setValue('emergencyContactRelation', employee.personalInfo.contactInfo.emergencyContact?.relation || '');
      
      setValue('bankAccount', employee.personalInfo.bankAccount);
      setValue('identityDocument', employee.personalInfo.identityDocument || '');
      
      setValue('companyId', employee.companyId);
      setValue('branchId', employee.branchId);
      
      // Contract
      setValue('contractType', employee.contractInfo.type);
      setValue('startDate', employee.contractInfo.startDate?.toISOString()?.split('T')[0] || '');
      setValue('endDate', employee.contractInfo.endDate?.toISOString()?.split('T')[0] || '');
      setValue('probationPeriod', employee.contractInfo.probationPeriod || 0);
      setValue('hoursPerWeek', employee.contractInfo.hoursPerWeek || 0);
      setValue('position', employee.contractInfo.position);
      setValue('department', employee.contractInfo.department || '');
      setValue('costCenter', employee.contractInfo.costCenter || '');
      setValue('cao', employee.contractInfo.cao || '');
      setValue('caoCode', employee.contractInfo.caoCode || '');
      setValue('contractStatus', employee.contractInfo.contractStatus || 'active');
      
      // Salary
      setValue('salaryScale', employee.salaryInfo.salaryScale);
      setValue('paymentType', employee.salaryInfo.paymentType || 'monthly');
      setValue('paymentFrequency', employee.salaryInfo.paymentFrequency || 'monthly');
      setValue('hourlyRate', employee.salaryInfo.hourlyRate || 0);
      setValue('monthlySalary', employee.salaryInfo.monthlySalary || 0);
      setValue('annualSalary', employee.salaryInfo.annualSalary || 0);
      
      // Allowances
      setValue('overtimeAllowance', employee.salaryInfo.allowances?.overtime || 150);
      setValue('irregularAllowance', employee.salaryInfo.allowances?.irregular || 130);
      setValue('shiftAllowance', employee.salaryInfo.allowances?.shift || 120);
      setValue('weekendAllowance', employee.salaryInfo.allowances?.weekend || 150);
      setValue('eveningAllowance', employee.salaryInfo.allowances?.evening || 115);
      setValue('nightAllowance', employee.salaryInfo.allowances?.night || 130);
      setValue('sundayAllowance', employee.salaryInfo.allowances?.sunday || 170);
      setValue('callDutyAllowance', employee.salaryInfo.allowances?.callDuty || 125);
      
      // Benefits
      setValue('holidayAllowancePercentage', employee.salaryInfo.holidayAllowancePercentage || 8);
      setValue('thirteenthMonth', employee.salaryInfo.thirteenthMonth || false);
      setValue('endOfYearBonus', employee.salaryInfo.endOfYearBonus || 0);
      setValue('travelAllowanceType', employee.salaryInfo.travelAllowance?.type || 'per_km');
      setValue('travelAllowancePerKm', employee.salaryInfo.travelAllowance?.amountPerKm || 0.23);
      setValue('travelAllowanceFixed', employee.salaryInfo.travelAllowance?.fixedAmount || 0);
      setValue('phoneAllowance', employee.salaryInfo.phoneAllowance || 0);
      setValue('homeWorkAllowance', employee.salaryInfo.homeWorkAllowance || 0);
      setValue('clothingAllowance', employee.salaryInfo.clothingAllowance || 0);
      
      // Pension
      setValue('pensionScheme', employee.salaryInfo.pensionScheme || '');
      setValue('pensionContribution', employee.salaryInfo.pensionContribution || 0);
      setValue('pensionEmployerContribution', employee.salaryInfo.pensionEmployerContribution || 0);
      setValue('pensionFund', employee.salaryInfo.pensionFund || '');
      
      // Tax
      setValue('taxCredit', employee.salaryInfo.taxCredit || true);
      setValue('taxTable', employee.salaryInfo.taxTable || 'white');
      
      // Leave
      setValue('statutoryHolidayDays', employee.leaveInfo?.holidayDays?.statutory || 0);
      setValue('extraStatutoryHolidayDays', employee.leaveInfo?.holidayDays?.extraStatutory || 0);
      setValue('advDays', employee.leaveInfo?.advDays?.accumulated || 0);
      setValue('seniorDays', employee.leaveInfo?.seniorDays || 0);
      setValue('snipperDays', employee.leaveInfo?.snipperDays || 0);
      
      setIsModalOpen(true);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEmployee(null);
    setActiveTab(0);
    reset();
  };

  const onSubmit = async (data: EmployeeFormData) => {
    if (!user) return;
    
    console.log('Form data received:', data);
    
    // Validate all fields before submission
    const isFormValid = await trigger();
    if (!isFormValid) {
      error('Formulier onvolledig', 'Niet alle verplichte velden zijn ingevuld. Controleer alle tabbladen.');
      // Find first tab with errors and navigate to it
      for (let i = 0; i < tabs.length; i++) {
        const tabFieldsToCheck = tabFields[i as keyof typeof tabFields];
        if (tabFieldsToCheck.length > 0) {
          const tabValid = await trigger(tabFieldsToCheck as any);
          if (!tabValid) {
            setActiveTab(i);
            return;
          }
        }
      }
      return;
    }

    setSubmitting(true);
    try {
      const employeeData = {
        companyId: data.companyId,
        branchId: data.branchId,
        personalInfo: {
          firstName: data.firstName,
          lastName: data.lastName,
          initials: data.initials,
          bsn: data.bsn,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
          placeOfBirth: data.placeOfBirth,
          nationality: data.nationality,
          address: {
            street: data.street,
            houseNumber: data.houseNumber,
            houseNumberAddition: data.houseNumberAddition || undefined,
            postalCode: data.zipCode,
            city: data.city,
            country: 'Nederland',
          },
          contactInfo: {
            email: data.email,
            phone: data.phone,
            emergencyContact: (data.emergencyContactName && data.emergencyContactPhone) ? {
              name: data.emergencyContactName,
              phone: data.emergencyContactPhone,
              relation: data.emergencyContactRelation,
            } : undefined,
          },
          bankAccount: data.bankAccount,
          maritalStatus: data.maritalStatus,
          identityDocument: data.identityDocument || undefined,
        },
        contractInfo: {
          type: data.contractType,
          startDate: data.startDate ? new Date(data.startDate) : new Date(),
          endDate: data.endDate ? new Date(data.endDate) : undefined,
          probationPeriod: data.probationPeriod || undefined,
          hoursPerWeek: data.hoursPerWeek,
          position: data.position,
          department: data.department || undefined,
          costCenter: data.costCenter || undefined,
          cao: data.cao,
          caoCode: data.caoCode || undefined,
          contractStatus: data.contractStatus,
          noticeDate: data.noticeDate ? new Date(data.noticeDate) : undefined,
        salaryInfo: {
          salaryScale: data.salaryScale,
          paymentType: data.paymentType,
          paymentFrequency: data.paymentFrequency,
          hourlyRate: data.paymentType === 'hourly' ? data.hourlyRate : undefined,
          monthlySalary: data.paymentType === 'monthly' ? data.monthlySalary : undefined,
          annualSalary: data.paymentType === 'annual' ? data.annualSalary : undefined,
          allowances: {
            overtime: data.overtimeAllowance,
            irregular: data.irregularAllowance,
            shift: data.shiftAllowance,
            weekend: data.weekendAllowance,
            evening: data.eveningAllowance,
            night: data.nightAllowance,
            sunday: data.sundayAllowance,
            callDuty: data.callDutyAllowance,
          },
          holidayAllowancePercentage: data.holidayAllowancePercentage,
          thirteenthMonth: data.thirteenthMonth,
          endOfYearBonus: data.endOfYearBonus || undefined,
          travelAllowance: {
            type: data.travelAllowanceType,
            amountPerKm: data.travelAllowanceType === 'per_km' ? data.travelAllowancePerKm : undefined,
            fixedAmount: data.travelAllowanceType === 'fixed' ? data.travelAllowanceFixed : undefined,
          },
          phoneAllowance: data.phoneAllowance || undefined,
          homeWorkAllowance: data.homeWorkAllowance || undefined,
          clothingAllowance: data.clothingAllowance || undefined,
          pensionScheme: data.pensionScheme || undefined,
          pensionContribution: data.pensionContribution,
          pensionEmployerContribution: data.pensionEmployerContribution,
          pensionFund: data.pensionFund || undefined,
          taxCredit: data.taxCredit,
          taxTable: data.taxTable,
        },
        leaveInfo: {
          holidayDays: {
            statutory: data.statutoryHolidayDays,
            extraStatutory: data.extraStatutoryHolidayDays,
            accumulated: data.statutoryHolidayDays + data.extraStatutoryHolidayDays,
            taken: 0,
          advDays: (data.advDaysAccumulated !== undefined && data.advDaysAccumulated !== null) ? {
            accumulated: data.advDays,
            taken: 0,
            remaining: data.advDays,
          } : undefined,
          seniorDays: data.seniorDays || undefined,
          snipperDays: data.snipperDays || undefined,
        },
        status: 'active',
        salaryHistory: data.salaryHistory ? (Array.isArray(data.salaryHistory) ? data.salaryHistory : []) : [],
      };
      console.log('Employee data being sent to Firebase:', employeeData);

      if (editingEmployee) {
        console.log('Updating existing employee:', editingEmployee.id);
        await updateEmployee(editingEmployee.id, user.uid, employeeData);
        success('Werknemer bijgewerkt', `${data.firstName} ${data.lastName} is succesvol bijgewerkt`);
      } else {
        console.log('Creating new employee...');
        await createEmployee(user.uid, employeeData);
        success('Werknemer aangemaakt', `${data.firstName} ${data.lastName} is succesvol toegevoegd`);
      }

      await refreshEmployees();
      console.log('Constructing employee data...');
      closeModal();
    } catch (err) {
      console.error('Error saving employee:', err);
      console.error('Error details:', {
        message: err.message,
        code: err.code,
        stack: err.stack,
        fullError: err
      });
      
      const errorMessage = err.message || 'Onbekende fout opgetreden';
      error('Fout bij opslaan werknemer', errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (employee: Employee) => {
    if (!user) return;
    
    const fullName = `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`;
    if (window.confirm(`Weet je zeker dat je ${fullName} wilt verwijderen?`)) {
      try {
        await deleteEmployee(employee.id, user.uid);
        await refreshEmployees();
        success('Werknemer verwijderd', `${fullName} is succesvol verwijderd`);
      } catch (err) {
        console.error('Error deleting employee:', err);
        error('Fout bij verwijderen', 'Kon werknemer niet verwijderen');
      }
    }
  };

  const handleCreateEmployeeAccount = async (employee: Employee) => {
    if (!user) return;
    
    setCreatingAccount(true);
    try {
      // Generate secure password
      const password = generateSecurePassword();
      
      // Create Firebase Auth account
      await createEmployeeAuthAccount(
        employee.id,
        user.uid,
        employee.personalInfo.contactInfo.email,
        password
      );
      
      // Show password modal
      setSelectedEmployee(employee);
      setGeneratedPassword(password);
      setShowPasswordModal(true);
      
      // Refresh employees list
      await refreshEmployees();
      
      success('Account aangemaakt', `Account voor ${employee.personalInfo.firstName} ${employee.personalInfo.lastName} is succesvol aangemaakt`);
    } catch (err: any) {
      console.error('Error creating employee account:', err);
      let message = 'Er is een fout opgetreden bij het aanmaken van het account';
      
      if (err.code === 'auth/email-already-in-use') {
        message = 'Er bestaat al een account met dit e-mailadres';
      } else if (err.code === 'auth/invalid-email') {
        message = 'Ongeldig e-mailadres';
      }
      
      error('Account aanmaken mislukt', message);
    } finally {
      setCreatingAccount(false);
    }
  };

  const copyPasswordToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedPassword);
      success('Gekopieerd!', 'Wachtwoord i
  }
}s gekopieerd naar klembord');
    } catch (err) {
      error('Kopiëren mislukt', 'Kon wachtwoord niet kopiëren');
    }
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setGeneratedPassword('');
    setSelectedEmployee(null);
    setShowPassword(false);
  };

  const getCompanyName = (companyId: string) => {
    return companies.find(c => c.id === companyId)?.name || 'Onbekend';
  };

  const getBranchName = (branchId: string) => {
    return branches.find(b => b.id === branchId)?.name || 'Onbekend';
  };

  const getAvailableBranches = () => {
    return branches.filter(b => b.companyId === selectedCompanyId);
  };

  const maskBSN = (bsn: string) => {
    if (bsn.length !== 9) return bsn;
    return `***-**-${bsn.slice(-3)}`;
  };

  const contractTypeLabels = {
    permanent: 'Vast',
    temporary: 'Tijdelijk',
    zero_hours: '0-uren',
    on_call: 'Oproep',
    intern: 'Stagiair',
    dga: 'DGA',
    payroll: 'Payroll',
    freelance: 'ZZP',
  };

  const maritalStatusLabels = {
    single: 'Ongehuwd',
    married: 'Gehuwd',
    registered_partnership: 'Geregistreerd partnerschap',
    divorced: 'Gescheiden',
    widowed: 'Weduwe/Weduwnaar',
  };

  const columns = [
    {
      key: 'personalInfo' as keyof Employee,
      label: 'Naam',
      render: (personalInfo: Employee['personalInfo']) => (
        <div className="flex items-center">
          <User className="h-5 w-5 text-gray-400 mr-2" />
          <div>
            <div className="font-medium">
              {personalInfo.firstName} {personalInfo.lastName}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              BSN: {maskBSN(personalInfo.bsn)}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'companyId' as keyof Employee,
      label: 'Bedrijf',
      render: (companyId: string, employee: Employee) => (
        <div>
          <div className="flex items-center text-sm">
            <Building2 className="h-4 w-4 text-gray-400 mr-1" />
            {getCompanyName(companyId)}
          </div>
          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
            <MapPin className="h-4 w-4 mr-1" />
            {getBranchName(employee.branchId)}
          </div>
        </div>
      ),
    },
    {
      key: 'contractInfo' as keyof Employee,
      label: 'Contract',
      render: (contractInfo: Employee['contractInfo']) => (
        <div>
          <div className="text-sm font-medium">
            {contractTypeLabels[contractInfo.type]}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {contractInfo.position}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            CAO: {contractInfo.cao || 'Niet ingesteld'}
          </div>
        </div>
      ),
    },
    {
      key: 'personalInfo' as keyof Employee,
      label: 'Contact',
      render: (personalInfo: Employee['personalInfo']) => (
        <div className="space-y-1">
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <Mail className="h-4 w-4 mr-1" />
            {personalInfo.contactInfo.email}
          </div>
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <Phone className="h-4 w-4 mr-1" />
            {personalInfo.contactInfo.phone}
          </div>
        </div>
      ),
    },
    {
      key: 'salaryInfo' as keyof Employee,
      label: 'Loon',
      render: (salaryInfo: Employee['salaryInfo']) => (
        <div>
          <div className="text-sm font-medium">
            Schaal {salaryInfo.salaryScale}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {salaryInfo.hourlyRate ? `€${salaryInfo.hourlyRate}/uur` : 
             salaryInfo.monthlySalary ? `€${salaryInfo.monthlySalary}/maand` :
             salaryInfo.annualSalary ? `€${salaryInfo.annualSalary}/jaar` : 'Niet ingesteld'}
          </div>
        </div>
      ),
    },
    {
      key: 'contractInfo' as keyof Employee,
      label: 'Status',
      render: (contractInfo: Employee['contractInfo']) => (
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
          contractInfo.contractStatus === 'active' 
            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
            : contractInfo.contractStatus === 'notice_period'
            ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300'
            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
        }`}>
          {contractInfo.contractStatus === 'active' ? 'Actief' : 
           contractInfo.contractStatus === 'notice_period' ? 'Opzegtermijn' :
           contractInfo.contractStatus === 'ended' ? 'Beëindigd' : 'Geschorst'}
        </span>
      ),
    },
    {
      key: 'actions' as keyof Employee,
      label: 'Acties',
      render: (value: any, employee: Employee) => (
        <div className="flex space-x-2">
          {!employee.hasAccount && (
            <Button
              size="sm"
              variant="success"
              onClick={(e) => {
                e.stopPropagation();
                handleCreateEmployeeAccount(employee);
              }}
              loading={creatingAccount}
              title="Account aanmaken voor werknemer"
            >
              <UserPlus className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              openModal(employee);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteEmployee(employee);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return <LoadingSpinner />;
  }

  // Show empty state if no employees exist
  if (employees.length === 0) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Werknemers
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Beheer uw werknemers en hun contractgegevens
            </p>
          </div>
          <Button onClick={() => openModal()}>
            <Plus className="h-5 w-5 mr-2" />
            Nieuwe Werknemer
          </Button>
        </div>

        <Card>
          <EmptyState
            icon={User}
            title="Geen werknemers"
            description="Voeg je eerste werknemer toe om te beginnen met loonadministratie"
            actionLabel="Werknemer Toevoegen"
            onAction={() => openModal()}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Werknemers
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Beheer uw werknemers en hun contractgegevens
          </p>
        </div>
        <Button onClick={() => openModal()}>
          <Plus className="h-5 w-5 mr-2" />
          Nieuwe Werknemer
        </Button>
      </div>

      {/* Employees Table */}
      <Card>
        <Table data={employees} columns={columns} />
      </Card>

      {/* Employee Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingEmployee ? 'Werknemer Bewerken' : 'Nieuwe Werknemer'}
        size="xl"
      >
        <div className="space-y-6">
          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => {
                const IconComponent = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    <IconComponent className="h-5 w-5 mr-2" />
                    {tab.name}
                  </button>
                );
              })}
            </nav>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Tab Content */}
            {activeTab === 0 && (
              <div className="space-y-6">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                  Persoonlijke Gegevens
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Voornaam *"
                    {...register('firstName')}
                    error={errors.firstName?.message}
                  />
                  <Input
                    label="Achternaam *"
                    {...register('lastName')}
                    error={errors.lastName?.message}
                  />
                  <Input
                    label="Initialen *"
                    {...register('initials')}
                    error={errors.initials?.message}
                  />
                  <Input
                    label="BSN *"
                    {...register('bsn')}
                    error={errors.bsn?.message}
                  />
                  <Input
                    label="Geboortedatum *"
                    type="date"
                    {...register('dateOfBirth')}
                    error={errors.dateOfBirth?.message}
                  />
                  <Input
                    label="Geboorteplaats"
                    {...register('placeOfBirth')}
                    error={errors.placeOfBirth?.message}
                  />
                  <Input
                    label="Nationaliteit"
                    {...register('nationality')}
                    error={errors.nationality?.message}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Burgerlijke Staat *
                    </label>
                    <select
                      {...register('maritalStatus')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                    >
                      <option value="single">Ongehuwd</option>
                      <option value="married">Gehuwd</option>
                      <option value="registered_partnership">Geregistreerd partnerschap</option>
                      <option value="divorced">Gescheiden</option>
                      <option value="widowed">Weduwe/Weduwnaar</option>
                    </select>
                    {errors.maritalStatus && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                        {errors.maritalStatus.message}
                      </p>
                    )}
                  </div>
                </div>

                <h5 className="text-md font-medium text-gray-900 dark:text-white">
                  Adresgegevens
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="Straat *"
                    {...register('street')}
                    error={errors.street?.message}
                  />
                  <Input
                    label="Huisnummer"
                    {...register('houseNumber')}
                    error={errors.houseNumber?.message}
                  />
                  <Input
                    label="Toevoeging"
                    {...register('houseNumberAddition')}
                    error={errors.houseNumberAddition?.message}
                  />
                  <Input
                    label="Postcode *"
                    {...register('zipCode')}
                    error={errors.zipCode?.message}
                  />
                  <Input
                    label="Plaats *"
                    {...register('city')}
                    error={errors.city?.message}
                  />
                </div>

                <h5 className="text-md font-medium text-gray-900 dark:text-white">
                  Contactgegevens
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="E-mailadres *"
                    type="email"
                    {...register('email')}
                    error={errors.email?.message}
                  />
                  <Input
                    label="Telefoonnummer *"
                    {...register('phone')}
                    error={errors.phone?.message}
                  />
                  <Input
                    label="Noodcontact Naam"
                    {...register('emergencyContactName')}
                    error={errors.emergencyContactName?.message}
                  />
                  <Input
                    label="Noodcontact Telefoon"
                    {...register('emergencyContactPhone')}
                    error={errors.emergencyContactPhone?.message}
                  />
                  <Input
                    label="Noodcontact Relatie"
                    {...register('emergencyContactRelation')}
                    error={errors.emergencyContactRelation?.message}
                  />
                </div>

                <h5 className="text-md font-medium text-gray-900 dark:text-white">
                  Bank & Identiteit
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="IBAN *"
                    {...register('bankAccount')}
                    error={errors.bankAccount?.message}
                  />
                  <Input
                    label="Identiteitsdocument"
                    {...register('identityDocument')}
                    error={errors.identityDocument?.message}
                  />
                </div>
              </div>
            )}

            {activeTab === 1 && (
              <div className="space-y-6">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                  Contract Informatie
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Bedrijf *
                    </label>
                    <select
                      {...register('companyId')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                    >
                      <option value="">Selecteer bedrijf...</option>
                      {companies.map(company => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                    {errors.companyId && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                        {errors.companyId.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Vestiging *
                    </label>
                    <select
                      {...register('branchId')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                    >
                      <option value="">Selecteer vestiging...</option>
                      {getAvailableBranches().map(branch => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name} - {branch.location}
                        </option>
                      ))}
                    </select>
                    {errors.branchId && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                        {errors.branchId.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Contracttype *
                    </label>
                    <select
                      {...register('contractType')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                    >
                      <option value="permanent">Vast</option>
                      <option value="temporary">Tijdelijk</option>
                      <option value="zero_hours">0-uren</option>
                      <option value="on_call">Oproep</option>
                      <option value="intern">Stagiair</option>
                      <option value="dga">DGA</option>
                      <option value="payroll">Payroll</option>
                      <option value="freelance">ZZP</option>
                    </select>
                    {errors.contractType && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                        {errors.contractType.message}
                      </p>
                    )}
                  </div>
                  <Input
                    label="Startdatum *"
                    type="date"
                    {...register('startDate')}
                    error={errors.startDate?.message}
                  />
                  {contractType === 'temporary' && (
                    <Input
                      label="Einddatum"
                      type="date"
                      {...register('endDate')}
                      error={errors.endDate?.message}
                    />
                  )}
                  <Input
                    label="Proeftijd (maanden)"
                    type="number"
                    {...register('probationPeriod')}
                    error={errors.probationPeriod?.message}
                  />
                  <Input
                    label="Uren per week"
                    type="number"
                    {...register('hoursPerWeek')}
                    error={errors.hoursPerWeek?.message}
                  />
                  <Input
                    label="Functie"
                    {...register('position')}
                    error={errors.position?.message}
                  />
                  <Input
                    label="Afdeling"
                    {...register('department')}
                    error={errors.department?.message}
                  />
                  <Input
                    label="Kostenplaats"
                    {...register('costCenter')}
                    error={errors.costCenter?.message}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      CAO
                    </label>
                    <select
                      {...register('cao')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                    >
                      <option value="">Selecteer CAO...</option>
                      {DUTCH_CAOS.map(cao => (
                        <option key={cao.id} value={cao.name}>
                          {cao.name}
                        </option>
                      ))}
                    </select>
                    {errors.cao && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                        {errors.cao.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 2 && (
              <div className="space-y-6">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                  Salaris & Toeslagen
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Loonschaal"
                    {...register('salaryScale')}
                    error={errors.salaryScale?.message}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Betalingstype
                    </label>
                    <select
                      {...register('paymentType')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                    >
                      <option value="hourly">Per uur</option>
                      <option value="monthly">Per maand</option>
                      <option value="annual">Per jaar</option>
                    </select>
                    {errors.paymentType && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                        {errors.paymentType.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Betalingsfrequentie
                    </label>
                    <select
                      {...register('paymentFrequency')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                    >
                      <option value="monthly">Maandelijks</option>
                      <option value="four_weekly">4-wekelijks</option>
                      <option value="weekly">Wekelijks</option>
                    </select>
                    {errors.paymentFrequency && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                        {errors.paymentFrequency.message}
                      </p>
                    )}
                  </div>
                  
                  {paymentType === 'hourly' && (
                    <Input
                      label="Uurloon (€)"
                      type="number"
                      step="0.01"
                      {...register('hourlyRate')}
                      error={errors.hourlyRate?.message}
                    />
                  )}
                  {paymentType === 'monthly' && (
                    <Input
                      label="Maandsalaris (€)"
                      type="number"
                      step="0.01"
                      {...register('monthlySalary')}
                      error={errors.monthlySalary?.message}
                    />
                  )}
                  {paymentType === 'annual' && (
                    <Input
                      label="Jaarsalaris (€)"
                      type="number"
                      step="0.01"
                      {...register('annualSalary')}
                      error={errors.annualSalary?.message}
                    />
                  )}
                </div>

                <h5 className="text-md font-medium text-gray-900 dark:text-white">
                  Toeslagen (%)
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Overwerk (%)"
                    type="number"
                    {...register('overtimeAllowance')}
                    error={errors.overtimeAllowance?.message}
                  />
                  <Input
                    label="Onregelmatig (%)"
                    type="number"
                    {...register('irregularAllowance')}
                    error={errors.irregularAllowance?.message}
                  />
                  <Input
                    label="Ploegendienst (%)"
                    type="number"
                    {...register('shiftAllowance')}
                    error={errors.shiftAllowance?.message}
                  />
                  <Input
                    label="Weekend (%)"
                    type="number"
                    {...register('weekendAllowance')}
                    error={errors.weekendAllowance?.message}
                  />
                  <Input
                    label="Avond (%)"
                    type="number"
                    {...register('eveningAllowance')}
                    error={errors.eveningAllowance?.message}
                  />
                  <Input
                    label="Nacht (%)"
                    type="number"
                    {...register('nightAllowance')}
                    error={errors.nightAllowance?.message}
                  />
                  <Input
                    label="Zondag (%)"
                    type="number"
                    {...register('sundayAllowance')}
                    error={errors.sundayAllowance?.message}
                  />
                  <Input
                    label="Consignatie (%)"
                    type="number"
                    {...register('callDutyAllowance')}
                    error={errors.callDutyAllowance?.message}
                  />
                </div>
              </div>
            )}

            {activeTab === 3 && (
              <div className="space-y-6">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                  Vergoedingen & Fiscaal
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Vakantietoeslag (%)"
                    type="number"
                    step="0.1"
                    {...register('holidayAllowancePercentage')}
                    error={errors.holidayAllowancePercentage?.message}
                  />
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('thirteenthMonth')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900 dark:text-white">
                      13e maand
                    </label>
                  </div>
                  <Input
                    label="Eindejaarsuitkering (€)"
                    type="number"
                    step="0.01"
                    {...register('endOfYearBonus')}
                    error={errors.endOfYearBonus?.message}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Reiskostenvergoeding
                    </label>
                    <select
                      {...register('travelAllowanceType')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                    >
                      <option value="per_km">Per kilometer</option>
                      <option value="public_transport">OV vergoeding</option>
                      <option value="fixed">Vast bedrag</option>
                    </select>
                  </div>
                  <Input
                    label="Reisvergoeding per km (€)"
                    type="number"
                    step="0.01"
                    {...register('travelAllowancePerKm')}
                    error={errors.travelAllowancePerKm?.message}
                  />
                  <Input
                    label="Telefoonvergoeding (€)"
                    type="number"
                    step="0.01"
                    {...register('phoneAllowance')}
                    error={errors.phoneAllowance?.message}
                  />
                  <Input
                    label="Thuiswerkvergoeding (€)"
                    type="number"
                    step="0.01"
                    {...register('homeWorkAllowance')}
                    error={errors.homeWorkAllowance?.message}
                  />
                  <Input
                    label="Kledingvergoeding (€)"
                    type="number"
                    step="0.01"
                    {...register('clothingAllowance')}
                    error={errors.clothingAllowance?.message}
                  />
                </div>

                <h5 className="text-md font-medium text-gray-900 dark:text-white">
                  Pensioen
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Pensioenregeling"
                    {...register('pensionScheme')}
                    error={errors.pensionScheme?.message}
                  />
                  <Input
                    label="Pensioenpremie werknemer (%)"
                    type="number"
                    step="0.1"
                    {...register('pensionContribution')}
                    error={errors.pensionContribution?.message}
                  />
                  <Input
                    label="Pensioenpremie werkgever (%)"
                    type="number"
                    step="0.1"
                    {...register('pensionEmployerContribution')}
                    error={errors.pensionEmployerContribution?.message}
                  />
                  <Input
                    label="Pensioenfonds"
                    {...register('pensionFund')}
                    error={errors.pensionFund?.message}
                  />
                </div>

                <h5 className="text-md font-medium text-gray-900 dark:text-white">
                  Fiscale Instellingen
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('taxCredit')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900 dark:text-white">
                      Loonheffingskorting toepassen
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Loontabel
                    </label>
                    <select
                      {...register('taxTable')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                    >
                      <option value="white">Witte tabel</option>
                      <option value="green">Groene tabel</option>
                      <option value="special">Bijzondere tabel</option>
                    </select>
                    {errors.taxTable && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                        {errors.taxTable.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 4 && (
              <div className="space-y-6">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                  Verlof & Vakantiedagen
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Wettelijke vakantiedagen"
                    type="number"
                    {...register('statutoryHolidayDays')}
                    error={errors.statutoryHolidayDays?.message}
                  />
                  <Input
                    label="Bovenwettelijke vakantiedagen"
                    type="number"
                    {...register('extraStatutoryHolidayDays')}
                    error={errors.extraStatutoryHolidayDays?.message}
                  />
                  <Input
                    label="ADV dagen"
                    type="number"
                    {...register('advDays')}
                    error={errors.advDays?.message}
                  />
                  <Input
                    label="Senioren dagen"
                    type="number"
                    {...register('seniorDays')}
                    error={errors.seniorDays?.message}
                  />
                  <Input
                    label="Snipperdagen"
                    type="number"
                    {...register('snipperDays')}
                    error={errors.snipperDays?.message}
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex space-x-3">
                {activeTab > 0 && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleTabNavigation('prev')}
                  >
                    Vorige
                  </Button>
                )}
              </div>
              <div className="flex space-x-3">
                <Button type="button" variant="secondary" onClick={closeModal}>
                  Annuleren
                </Button>
                {activeTab < tabs.length - 1 ? (
                  <Button
                    type="button"
                    onClick={() => handleTabNavigation('next')}
                  >
                    Volgende
                  </Button>
                ) : (
                  <Button type="submit" loading={submitting}>
                    {editingEmployee ? 'Bijwerken' : 'Aanmaken'}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </div>
      </Modal>

      {/* Password Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={closePasswordModal}
        title="Account Aangemaakt"
        size="md"
      >
        <div className="space-y-4">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20">
              <UserPlus className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Account succesvol aangemaakt
              </h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Voor: {selectedEmployee?.personalInfo.firstName} {selectedEmployee?.personalInfo.lastName}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Gegenereerd wachtwoord:
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={generatedPassword}
                    readOnly
                    className="flex-1 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-mono"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={copyPasswordToClipboard}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <Mail className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  Belangrijk
                </h3>
                <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                  <p>
                    Deel dit wachtwoord veilig met de werknemer. Ze kunnen inloggen met hun e-mailadres en dit wachtwoord.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={closePasswordModal}>
              Sluiten
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Employees;