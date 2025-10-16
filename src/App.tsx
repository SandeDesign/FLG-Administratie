import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Layout from './components/layout/Layout';
import EmployeeLayout from './components/layout/EmployeeLayout';
import Dashboard from './pages/Dashboard';
import Companies from './pages/Companies';
import EmployeesNew from './pages/EmployeesNew';
import Leave from './pages/Leave';
import Absence from './pages/Absence';
import Expenses from './pages/Expenses';
import AdminLeaveApprovals from './pages/AdminLeaveApprovals';
import AdminAbsenceManagement from './pages/AdminAbsenceManagement';
import AdminExpenses from './pages/AdminExpenses';
import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import NotFound from './pages/NotFound';
import Settings from './pages/Settings';
import TaxReturns from './pages/TaxReturns';
import AuditLogPage from './pages/AuditLog';
import Timesheets from './pages/Timesheets';
import TimesheetApprovals from './pages/TimesheetApprovals';
import Projectteam from './pages/ProjectTeam';
import PayrollProcessing from './pages/PayrollProcessing';
import Payslips from './pages/Payslips';
import ExportsManagement from './pages/ExportsManagement';
import { AppProvider } from './contexts/AppContext';
import { ToastContainer } from './components/ui/Toast';
import EmployeeDashboard from './pages/EmployeeDashboard';
import { LoadingSpinner } from './components/ui/LoadingSpinner';

const Regulations = () => (
  <div className="text-center py-12">
    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
      Regelgeving
    </h1>
    <p className="text-gray-600 dark:text-gray-400">
      Deze functionaliteit wordt binnenkort toegevoegd
    </p>
  </div>
);

function App() {
  const AppContent: React.FC = () => {
    const { userRole, loading } = useAuth();

    if (loading) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      );
    }

    return (
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/Logo.png" element={<Navigate to="/Logo.png" replace />} />
        <Route path="/Logo-groot.png" element={<Navigate to="/Logo-groot.png" replace />} />
        
        {/* Protected routes */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Routes>
                {userRole === 'admin' && (
                  <Route
                    path="/*"
                    element={
                      <Layout>
                        <Routes>
                          <Route index element={<Dashboard />} />
                          <Route path="companies" element={<Companies />} />
                          <Route path="employees" element={<EmployeesNew />} />
                          <Route path="timesheets" element={<Timesheets />} />
                          <Route path="timesheet-approvals" element={<TimesheetApprovals />} />
                          <Route path="admin/leave-approvals" element={<AdminLeaveApprovals />} />
                          <Route path="admin/absence-management" element={<AdminAbsenceManagement />} />
                          <Route path="admin/expenses" element={<AdminExpenses />} />
                          <Route path="payroll-processing" element={<PayrollProcessing />} />
                          <Route path="payslips" element={<Payslips />} />
                          <Route path="regulations" element={<Regulations />} />
                          <Route path="exports" element={<ExportsManagement />} />
                          <Route path="settings" element={<Settings />} />
                          <Route path="tax-returns" element={<TaxReturns />} />
                          <Route path="audit-log" element={<AuditLogPage />} />
                          <Route path="employee-dashboard/*" element={<Navigate to="/" replace />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </Layout>
                    }
                  />
                )}
                
                {userRole === 'employee' && (
                  <>
                    <Route path="/" element={<Navigate to="/employee-dashboard" replace />} />
                    <Route
                      path="/employee-dashboard/*"
                      element={
                        <EmployeeLayout>
                          <Routes>
                            <Route index element={<EmployeeDashboard />} />
                            <Route path="leave" element={<Leave />} />
                            <Route path="absence" element={<Absence />} />
                            <Route path="expenses" element={<Expenses />} />
                            <Route path="timesheets" element={<Timesheets />} />
                            <Route path="payslips" element={<Payslips />} />
                            <Route path="*" element={<NotFound />} />
                          </Routes>
                        </EmployeeLayout>
                      }
                    />
                  </>
                )}
                
                {!userRole && (
                  <Route path="*" element={<LoadingSpinner />} />
                )}
              </Routes>
            </ProtectedRoute>
          }
        />
      </Routes>
    );
  };

  return (
    <AuthProvider>
      <AppProvider>
        <Router>
          <div className="App">
            <AppContent />
            <ToastContainer />
          </div>
        </Router>
      </AppProvider>
    </AuthProvider>
  );
}

export default App;