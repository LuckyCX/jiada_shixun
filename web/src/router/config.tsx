import { lazy } from 'react';
import { RouteObject } from 'react-router-dom';
import { USER_GUIDE_PATH } from '../lib/appPaths';
import RequireRole from './RequireRole';
import RequireStudentPersonalClass from './RequireStudentPersonalClass';

const HomePage = lazy(() => import('../pages/home/page'));
const TeamFormationPage = lazy(() => import('../pages/team-formation/page'));
const IdeationPage = lazy(() => import('../pages/ideation/page'));
const MarketResearchPage = lazy(() => import('../pages/market-research/page'));
const ProductDesignPage = lazy(() => import('../pages/product-design/page'));
const BusinessModelPage = lazy(() => import('../pages/business-model/page'));
const RoleSimulationPage = lazy(() => import('../pages/role-simulation/page'));
const BusinessPlanPage = lazy(() => import('../pages/business-plan/page'));
const EvaluationPage = lazy(() => import('../pages/evaluation/page'));
const TeacherDashboardPage = lazy(() => import('../pages/teacher-dashboard/page'));
const KnowledgeSystemPage = lazy(() => import('../pages/knowledge-system/page'));
const FullStackToolsPage = lazy(() => import('../pages/full-stack-tools/page'));
const IterationOptimizationPage = lazy(() => import('../pages/iteration-optimization/page'));
const AIValidationPage = lazy(() => import('../pages/ai-validation/page'));
const StudentCenterPage = lazy(() => import('../pages/student-center/page'));
const AdminDashboardPage = lazy(() => import('../pages/admin-dashboard/page'));
const AdminLoginPage = lazy(() => import('../pages/admin-login/page'));
const NotFoundPage = lazy(() => import('../pages/NotFound'));
const UserGuidePage = lazy(() => import('../pages/user-guide/page'));
const TeacherGuidePage = lazy(() => import('../pages/teacher-guide/page'));
const CourseSettingsPage = lazy(() => import('../pages/course-settings/page'));
const ClassProjectOverviewPage = lazy(() => import('../pages/class-project-overview/page'));
const BMCDetailPage = lazy(() => import('../pages/bmc-detail/page'));
const PublicSurveyPage = lazy(() => import('../pages/public-survey/page'));

const routes: RouteObject[] = [
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '/team-formation',
    element: <TeamFormationPage />,
  },
  {
    path: '/ideation',
    element: <IdeationPage />,
  },
  {
    path: '/market-research',
    element: <MarketResearchPage />,
  },
  {
    path: '/product-design',
    element: <ProductDesignPage />,
  },
  {
    path: '/business-model',
    element: <BusinessModelPage />,
  },
  {
    path: '/role-simulation',
    element: <RoleSimulationPage />,
  },
  {
    path: '/business-plan',
    element: <BusinessPlanPage />,
  },
  {
    path: '/evaluation',
    element: <EvaluationPage />,
  },
  {
    path: '/teacher-dashboard',
    element: (
      <RequireRole role="teacher">
        <TeacherDashboardPage />
      </RequireRole>
    ),
  },
  {
    path: '/knowledge-system',
    element: <KnowledgeSystemPage />,
  },
  {
    path: '/full-stack-tools',
    element: <FullStackToolsPage />,
  },
  {
    path: '/iteration-optimization',
    element: <IterationOptimizationPage />,
  },
  {
    path: '/ai-validation',
    element: <AIValidationPage />,
  },
  {
    path: '/student-center',
    element: (
      <RequireRole role="student">
        <RequireStudentPersonalClass>
          <StudentCenterPage />
        </RequireStudentPersonalClass>
      </RequireRole>
    ),
  },
  {
    path: '/admin-dashboard',
    element: (
      <RequireRole role="admin">
        <AdminDashboardPage />
      </RequireRole>
    ),
  },
  {
    path: '/admin',
    element: <AdminLoginPage />,
  },
  {
    path: USER_GUIDE_PATH,
    element: <UserGuidePage />,
  },
  {
    path: '/teacher-guide',
    element: <TeacherGuidePage />,
  },
  {
    path: '/course-settings',
    element: <CourseSettingsPage />,
  },
  {
    path: '/class-project-overview',
    element: <ClassProjectOverviewPage />,
  },
  {
    path: '/bmc-detail',
    element: <BMCDetailPage />,
  },
  {
    path: '/s/:slug',
    element: <PublicSurveyPage />,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
];

export default routes;