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

import ProjectProduction from './pages/ProjectProduction';
import ProjectStatistics from './pages/ProjectStatistics';
// ✅ NEW ADMIN PAGES
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminRoles from './pages/AdminRoles';
import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import NotFound from './pages/NotFound';
import Settings from './pages/Settings';
import AuditLogPage from './pages/AuditLog';
import Timesheets from './pages/Timesheets';
import TimesheetApprovals from './pages/TimesheetApprovals';
import Payslips from './pages/Payslips';
// ✅ INVOICE RELATIONS - NIEUW!
import InvoiceRelations from './pages/InvoiceRelations';
// ✅ FACTUREN IMPORTS
import OutgoingInvoices from './pages/OutgoingInvoices';
import IncomingInvoices from './pages/IncomingInvoices';
import TimesheetExport from './pages/TimesheetExport';
import DriveFiles from './pages/DriveFiles';
import { AppProvider } from './contexts/AppContext';
import { ToastContainer } from './components/ui/Toast';
import EmployeeDashboard from './pages/EmployeeDashboard';
import { LoadingSpinner } from './components/ui/LoadingSpinner';

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
                {/* ✅ ADMIN ROUTES */}
                {userRole === 'admin' && (
                  <Route
                    path="/*"
                    element={
                      <Layout>
                        <Routes>
                          <Route index element={<Dashboard />} />
                          <Route path="companies" element={<Companies />} />
                          <Route path="employees" element={<EmployeesNew />} />
                          <Route path="project-production" element={<ProjectProduction />} />
                          <Route path="project-statistics" element={<ProjectStatistics />} />
                          
                          {/* ✅ NEW ADMIN ROUTES */}
                          <Route path="admin/dashboard" element={<AdminDashboard />} />
                          <Route path="admin/users" element={<AdminUsers />} />
                          <Route path="admin/roles" element={<AdminRoles />} />
                          
                          {/* ✅ TIJD & UREN */}
                          <Route path="timesheets" element={<Timesheets />} />
                          <Route path="timesheet-approvals" element={<TimesheetApprovals />} />
                          
                          {/* ✅ VERLOF & VERZUIM */}
                          <Route path="admin/leave-approvals" element={<AdminLeaveApprovals />} />
                          <Route path="admin/absence-management" element={<AdminAbsenceManagement />} />
                          
                          {/* ✅ FACTURATIE - MET RELATIES! */}
                          <Route path="invoice-relations" element={<InvoiceRelations />} />
                          <Route path="outgoing-invoices" element={<OutgoingInvoices />} />
                          <Route path="incoming-invoices" element={<IncomingInvoices />} />
                          
                          {/* ✅ DATA & EXPORTS */}
                          <Route path="timesheet-export" element={<TimesheetExport />} />
                          <Route path="drive-files" element={<DriveFiles />} />
                          
                          {/* ✅ SYSTEEM */}
                          <Route path="payslips" element={<Payslips />} />
                          <Route path="audit-log" element={<AuditLogPage />} />
                          <Route path="settings" element={<Settings />} />
                          
                          <Route path="employee-dashboard/*" element={<Navigate to="/" replace />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </Layout>
                    }
                  />
                )}

                {/* ✅ MANAGER ROUTES */}
                {userRole === 'manager' && (
                  <Route
                    path="/*"
                    element={
                      <Layout>
                        <Routes>
                          <Route index element={<Dashboard />} />
                          <Route path="employees" element={<EmployeesNew />} />
                          
                          {/* Manager kan uren beheren */}
                          <Route path="timesheets" element={<Timesheets />} />
                          <Route path="timesheet-approvals" element={<TimesheetApprovals />} />
                          
                          {/* Manager kan verlof/verzuim goedkeuren */}
                          <Route path="admin/leave-approvals" element={<AdminLeaveApprovals />} />
                          <Route path="admin/absence-management" element={<AdminAbsenceManagement />} />
                          
                          {/* Manager kan exporteren */}
                          <Route path="timesheet-export" element={<TimesheetExport />} />
                          
                          {/* Manager eigen loonstroken en instellingen */}
                          <Route path="payslips" element={<Payslips />} />
                          <Route path="settings" element={<Settings />} />
                          
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </Layout>
                    }
                  />
                )}

                {/* ✅ EMPLOYEE ROUTES */}
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