import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';

const Login = React.lazy(() => import('./pages/Login'));
const TeacherDashboard = React.lazy(() => import('./pages/TeacherDashboard'));
const StudentDashboard = React.lazy(() => import('./pages/StudentDashboard'));
const ExamBuilder = React.lazy(() => import('./pages/ExamBuilder'));
const TakeExam = React.lazy(() => import('./pages/TakeExam'));
const ExamResults = React.lazy(() => import('./pages/ExamResults'));
const StudentExamResult = React.lazy(() => import('./pages/StudentExamResult'));
const EssayBuilder = React.lazy(() => import('./pages/EssayBuilder'));
const EssayResults = React.lazy(() => import('./pages/EssayResults'));
const TakeEssay = React.lazy(() => import('./pages/TakeEssay'));
const TextbookBuilder = React.lazy(() => import('./pages/TextbookBuilder'));

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) => {
  const { user, appUser, loading } = useAuth();

  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;

  if (!user || !appUser) {
    return <Navigate to="/login" />;
  }

  if (allowedRoles && !allowedRoles.includes(appUser.role)) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  const { appUser, loading } = useAuth();

  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;

  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          appUser?.role === 'teacher' ? <Navigate to="/teacher" /> :
          appUser?.role === 'student' ? <Navigate to="/student" /> :
          <Navigate to="/login" />
        } />
        
        {/* Teacher Routes */}
        <Route path="/teacher" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <TeacherDashboard />
          </ProtectedRoute>
        } />
        <Route path="/teacher/exam/new" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <ExamBuilder />
          </ProtectedRoute>
        } />
        <Route path="/teacher/exam/:examId/edit" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <ExamBuilder />
          </ProtectedRoute>
        } />
        <Route path="/teacher/exam/:examId/results" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <ExamResults />
          </ProtectedRoute>
        } />

        <Route path="/teacher/essay/new" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <EssayBuilder />
          </ProtectedRoute>
        } />
        
        <Route path="/teacher/essay/:essayId/edit" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <EssayBuilder />
          </ProtectedRoute>
        } />
        
        <Route path="/teacher/essay/:essayId/results" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <EssayResults />
          </ProtectedRoute>
        } />

        <Route path="/teacher/textbook/builder/:lessonId" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <TextbookBuilder />
          </ProtectedRoute>
        } />

        {/* Student Routes */}
        <Route path="/student/essay/:essayId" element={
          <ProtectedRoute allowedRoles={['student']}>
            <TakeEssay />
          </ProtectedRoute>
        } />
        <Route path="/student" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentDashboard />
          </ProtectedRoute>
        } />
        <Route path="/student/exam/:examId" element={
          <ProtectedRoute allowedRoles={['student']}>
            <TakeExam />
          </ProtectedRoute>
        } />
        <Route path="/student/exam/:examId/result" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentExamResult />
          </ProtectedRoute>
        } />
        <Route path="/teacher/exam/:examId/result/:studentId" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <StudentExamResult />
          </ProtectedRoute>
        } />
      </Routes>
    </Suspense>
  );
};

import InAppBrowserCheck from './components/InAppBrowserCheck';

export default function App() {
  return (
    <>
      <InAppBrowserCheck />
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </>
  );
}
