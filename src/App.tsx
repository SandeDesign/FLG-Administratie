import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Companies from './pages/Companies';
import Employees from './pages/Employees';
import NotFound from './pages/NotFound';
import { AppProvider } from './contexts/AppContext';
import { ToastContainer } from './components/ui/Toast';

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

function App() {
  return (
    <AppProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route
              path="/*"
              element={
                <Layout>
                  <Routes>
                    <Route index element={<Dashboard />} />
                    <Route path="companies" element={<Companies />} />
                    <Route path="employees" element={<Employees />} />
                    <Route path="hours" element={<Hours />} />
                    <Route path="payroll" element={<Payroll />} />
                    <Route path="payslips" element={<Payslips />} />
                    <Route path="regulations" element={<Regulations />} />
                    <Route path="export" element={<Export />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Layout>
              }
            />
          </Routes>
          <ToastContainer />
        </div>
      </Router>
    </AppProvider>
  );
}

export default App;