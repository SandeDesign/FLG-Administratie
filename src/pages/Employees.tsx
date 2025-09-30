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
  placeOfBirth: string;
  nationality: string;
  maritalStatus: 'single' | 'married' | 'registered_partnership' | 'divorced' | 'widowed';
  
  // Adres
  street: string;
  houseNumber: string;
  houseNumberAddition: string;
  city: string;
  zipCode: string;
  
  // Contact
  email: string;
  phone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  
  // Bank & Identiteit
  bankAccount: string;
  identityDocument: string;
  
  // Bedrijf & Vestiging
  companyId: string;
  branchId: string;
  
  // Contract
  contractType: 'permanent' | 'temporary' | 'zero_hours' | 'on_call' | 'intern' | 'dga' | 'payroll' | 'freelance';
  startDate: string;
  endDate: string;
  probationPeriod: number;
  hoursPerWeek: number;
  position: string;
  department: string;
  costCenter: string;
  cao: string;
  caoCode: string;
  contractStatus: 'active' | 'notice_period' | 'ended' | 'suspended';
  
  // Salaris
  salaryScale: string;
  paymentType: 'hourly' | 'monthly' | 'annual';
  paymentFrequency: 'monthly' | 'four_weekly' | 'weekly';
  hourlyRate: number;
  monthlySalary: number;
  annualSalary: number;
  
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
  thirteenthMonth: boolean;
  endOfYearBonus: number;
  travelAllowanceType: 'per_km' | 'public_transport' | 'fixed';
  travelAllowancePerKm: number;
  travelAllowanceFixed: number;
  phoneAllowance: number;
  homeWorkAllowance: number;
  clothingAllowance: number;
  
  // Pensioen
  pensionScheme: string;
  pensionContribution: number;
  pensionEmployerContribution: number;
  pensionFund: string;
  
  // Fiscaal
  taxCredit: boolean;
  taxTable: 'white' | 'green' | 'special';
  
  // Verlof
  statutoryHolidayDays: number;
  extraStatutoryHolidayDays: number;
  advDays: number;
  seniorDays: number;
  snipperDays: number;
}

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

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<EmployeeFormData>({
    resolver: yupResolver(employeeSchema)
  });
  
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

  const openModal = (employee?: Employee) => {
    setActiveTab(0); // Reset to first tab
    
    if (employee) {
      setEditingEmployee(employee);
      // Set all form values for editing
      setValue('firstName', employee.personalInfo.firstName);
      setValue('lastName', employee.personalInfo.lastName);
      setValue('initials', employee.personalInfo.initials || '');
      setValue('bsn', employee.personalInfo.bsn);
      setValue('dateOfBirth', employee.personalInfo.dateOfBirth.toISOString().split('T')[0]);
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
      setValue('startDate', employee.contractInfo.startDate.toISOString().split('T')[0]);
      setValue('endDate', employee.contractInfo.endDate ? employee.contractInfo.endDate.toISOString().split('T')[0] : '');
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
    } else {
      setEditingEmployee(null);
      reset();
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
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEmployee(null);
    setActiveTab(0);
    reset();
  };

  const onSubmit = async (data: EmployeeFormData) => {
    if (!user) return;
    
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
          dateOfBirth: new Date(data.dateOfBirth),
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
            emergencyContact: data.emergencyContactName ? {
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
          startDate: new Date(data.startDate),
          endDate: data.endDate ? new Date(data.endDate) : null,
          probationPeriod: data.probationPeriod || undefined,
          hoursPerWeek: data.hoursPerWeek,
          position: data.position,
          department: data.department || undefined,
          costCenter: data.costCenter || undefined,
          cao: data.cao,
          caoCode: data.caoCode || undefined,
          contractStatus: data.contractStatus,
        },
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
            remaining: data.statutoryHolidayDays + data.extraStatutoryHolidayDays,
            expiryDate: new Date(new Date().getFullYear() + 5, 11, 31), // 5 years from now
          },
          advDays: data.advDays ? {
            accumulated: data.advDays,
            taken: 0,
            remaining: data.advDays,
          } : undefined,
          seniorDays: data.seniorDays || undefined,
          snipperDays: data.snipperDays || undefined,
        },
        status: 'active',
      };

      if (editingEmployee) {
        await updateEmployee(editingEmployee.id, user.uid, employeeData);
        success('Werknemer bijgewerkt', `${data.firstName} ${data.lastName} is succesvol bijgewerkt`);
      } else {
        await createEmployee(user.uid, employeeData);
        success('Werknemer aangemaakt', `${data.firstName} ${data.lastName} is succesvol toegevoegd`);
      }

      await refreshEmployees();
      closeModal();
    } catch (err) {
      console.error('Error saving employee:', err);
      error('Er is een fout opgetreden', 'Probeer het opnieuw');
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
      success('Gekopieerd!', 'Wachtwoord is gekopieerd naar klembord');
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
    </div>
  );
};

export default Employees;