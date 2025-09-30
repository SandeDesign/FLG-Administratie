import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
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
import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import NotFound from './pages/NotFound';
import { AppProvider } from './contexts/AppContext';
import { ToastContainer } from './components/ui/Toast';
import EmployeeDashboard from './pages/EmployeeDashboard';
import { useAuth } from './contexts/AuthContext';

// Placeholder components for routes not yet implemented
const Hours = () => (
  <div className="text-center py-12">
    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
      Uren Management
    </h1>
    <p className="text-gray-600 dark:text-gray-400">
      Deze functionaliteit wordt binnenkort toegevoegd
    </p>
  </div>
);

const Payroll = () => (
  <div className="text-center py-12">
    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
      Loonberekening
    </h1>
    <p className="text-gray-600 dark:text-gray-400">
      Deze functionaliteit wordt binnenkort toegevoegd
    </p>
  </div>
);

const Payslips = () => (
  <div className="text-center py-12">
    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
      Loonstroken
    </h1>
    <p className="text-gray-600 dark:text-gray-400">
      Deze functionaliteit wordt binnenkort toegevoegd
    </p>
  </div>
);

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

const Export = () => (
  <div className="text-center py-12">
    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
      Export
    </h1>
    <p className="text-gray-600 dark:text-gray-400">
      Deze functionaliteit wordt binnenkort toegevoegd
    </p>
  </div>
);

const Settings = () => (
  <div className="text-center py-12">
    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
      Instellingen
    </h1>
    <p className="text-gray-600 dark:text-gray-400">
      Deze functionaliteit wordt binnenkort toegevoegd
    </p>
  </div>
);

// Employee Hours placeholder
const EmployeeHours = () => (
  <div className="text-center py-12">
    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
      Mijn Uren
    </h1>
    <p className="text-gray-600 dark:text-gray-400">
      Deze functionaliteit wordt binnenkort toegevoegd
    </p>
  </div>
);

// Protected Route wrapper that determines layout based on user role
const ProtectedRouteWithLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userRole } = useAuth();

  return (
    <ProtectedRoute>
      {userRole === 'employee' ? (
        <EmployeeLayout>{children}</EmployeeLayout>
      ) : (
        <Layout>{children}</Layout>
      )}
    </ProtectedRoute>
  );
};
function App() {
  return (
    <AuthProvider>
      <AppProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            {/* Protected routes */}
            <Route
              path="/*"
              element={
                <ProtectedRouteWithLayout>
                  <Routes>
                    {/* Admin routes */}
                    <Route index element={<Dashboard />} />
                    <Route path="companies" element={<Companies />} />
                    <Route path="employees" element={<EmployeesNew />} />
                    <Route path="admin/leave-approvals" element={<AdminLeaveApprovals />} />
                    <Route path="admin/absence-management" element={<AdminAbsenceManagement />} />
                    <Route path="hours" element={<Hours />} />
                    <Route path="payroll" element={<Payroll />} />
                    <Route path="payslips" element={<Payslips />} />
                    <Route path="regulations" element={<Regulations />} />
                    <Route path="export" element={<Export />} />
                    <Route path="settings" element={<Settings />} />
                    
                    {/* Employee routes */}
                    <Route path="employee-dashboard" element={<EmployeeDashboard />} />
                    <Route path="employee-dashboard/leave" element={<Leave />} />
                    <Route path="employee-dashboard/absence" element={<Absence />} />
                    <Route path="employee-dashboard/expenses" element={<Expenses />} />
                    <Route path="employee-dashboard/hours" element={<EmployeeHours />} />
                    
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </ProtectedRouteWithLayout>
              }
            />
          </Routes>
          <ToastContainer />
        </div>
      </Router>
      </AppProvider>
    </AuthProvider>
  );
}

export default App;