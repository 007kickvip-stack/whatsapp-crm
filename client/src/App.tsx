import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import { Loader2 } from "lucide-react";

// Lazy load all page components for code splitting
const NotFound = lazy(() => import("@/pages/NotFound"));
const Home = lazy(() => import("./pages/Home"));
const CustomersPage = lazy(() => import("./pages/Customers"));
const OrdersPage = lazy(() => import("./pages/Orders"));
const OrderDetailPage = lazy(() => import("./pages/OrderDetail"));
const UsersPage = lazy(() => import("./pages/Users"));
const LoginPage = lazy(() => import("./pages/Login"));
const AuditLogsPage = lazy(() => import("./pages/AuditLogs"));
const ExchangeRatePage = lazy(() => import("./pages/ExchangeRate"));
const ProfitReportPage = lazy(() => import("./pages/ProfitReport"));
const StaffTargetsPage = lazy(() => import("./pages/StaffTargets"));
const DailyDataPage = lazy(() => import("./pages/DailyData"));
const AccountManagementPage = lazy(() => import("./pages/AccountManagement"));
const QuotationsPage = lazy(() => import("./pages/Quotations"));
const PaypalPage = lazy(() => import("./pages/Paypal"));
const ReshipmentsPage = lazy(() => import("./pages/Reshipments"));
const SalaryReportPage = lazy(() => import("./pages/SalaryReport"));
const CustomerAnalysisPage = lazy(() => import("./pages/CustomerAnalysis"));
const DataBackupPage = lazy(() => import("./pages/DataBackup"));

function PageLoading() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Switch>
        {/* Login page is outside DashboardLayout */}
        <Route path="/login" component={LoginPage} />
        {/* All other routes are inside DashboardLayout */}
        <Route>
          <DashboardLayout>
            <Suspense fallback={<PageLoading />}>
              <Switch>
                <Route path="/" component={Home} />
                <Route path="/customers" component={CustomersPage} />
                <Route path="/orders" component={OrdersPage} />
                <Route path="/orders/:id" component={OrderDetailPage} />
                <Route path="/users" component={UsersPage} />
                <Route path="/audit-logs" component={AuditLogsPage} />
                <Route path="/exchange-rate" component={ExchangeRatePage} />
                <Route path="/profit-report" component={ProfitReportPage} />
                <Route path="/staff-targets" component={StaffTargetsPage} />
                <Route path="/daily-data" component={DailyDataPage} />
                <Route path="/account-management" component={AccountManagementPage} />
                <Route path="/quotations" component={QuotationsPage} />
                <Route path="/paypal" component={PaypalPage} />
                <Route path="/reshipments" component={ReshipmentsPage} />
                <Route path="/salary-report" component={SalaryReportPage} />
                <Route path="/customer-analysis" component={CustomerAnalysisPage} />
                <Route path="/data-backup" component={DataBackupPage} />
                <Route path="/404" component={NotFound} />
                <Route component={NotFound} />
              </Switch>
            </Suspense>
          </DashboardLayout>
        </Route>
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
