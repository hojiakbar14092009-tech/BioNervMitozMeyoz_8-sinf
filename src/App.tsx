import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import NotFound from './pages/NotFound';
import { OfflineMissing } from './features/pwa/OfflineSafe';

const BookPage = lazy(() => import('./pages/BookPage'));
const TopicPage = lazy(() => import('./pages/TopicPage'));
const HighlightsPage = lazy(() => import('./pages/HighlightsPage'));

const wait = (el: React.ReactNode) => <Suspense fallback={<div className="page skeleton" role="status">Yuklanmoqda…</div>}>{el}</Suspense>;

// Explicit per-book routes: /8-sinf/39 and /10-sinf/2-13 can never collide.
const router = createBrowserRouter(
  [
    {
      element: <Layout />,
      // a page whose code could not be loaded (offline, not cached yet) shows a calm message, not a raw error
      errorElement: (
        <div className="page">
          <OfflineMissing onRetry={() => location.reload()} />
        </div>
      ),
      children: [
        { path: '/', element: <Home /> },
        { path: '/8-sinf', element: wait(<BookPage bookId="grade8" />) },
        { path: '/8-sinf/:slug', element: wait(<TopicPage bookId="grade8" />) },
        { path: '/10-sinf', element: wait(<BookPage bookId="grade10" />) },
        { path: '/10-sinf/:slug', element: wait(<TopicPage bookId="grade10" />) },
        { path: '/belgilanganlar', element: wait(<HighlightsPage />) },
        { path: '*', element: <NotFound /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' },
);

export default function App() {
  return <RouterProvider router={router} />;
}
