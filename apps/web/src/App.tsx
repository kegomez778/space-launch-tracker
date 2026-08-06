import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { LoadingList } from './components/StateViews';
import { CatalogPage } from './pages/CatalogPage';

/**
 * El catálogo se carga con la aplicación porque es la única página que ve alguien
 * que llega por primera vez. El resto se divide por ruta para no lastrar esa
 * primera carga con vistas que quizá no se visiten.
 */
const LaunchDetailPage = lazy(() =>
  import('./pages/LaunchDetailPage').then((module) => ({ default: module.LaunchDetailPage })),
);
const CountriesPage = lazy(() =>
  import('./pages/CountriesPage').then((module) => ({ default: module.CountriesPage })),
);
const CountryDetailPage = lazy(() =>
  import('./pages/CountriesPage').then((module) => ({ default: module.CountryDetailPage })),
);
const MyMissionsPage = lazy(() =>
  import('./pages/MyMissionsPage').then((module) => ({ default: module.MyMissionsPage })),
);
const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const DataQualityPage = lazy(() =>
  import('./pages/DataQualityPage').then((module) => ({ default: module.DataQualityPage })),
);
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })),
);

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<CatalogPage />} />
        <Route
          path="lanzamientos/:id"
          element={
            <Suspense fallback={<LoadingList count={3} />}>
              <LaunchDetailPage />
            </Suspense>
          }
        />
        <Route
          path="paises"
          element={
            <Suspense fallback={<LoadingList count={4} />}>
              <CountriesPage />
            </Suspense>
          }
        />
        <Route
          path="paises/:code"
          element={
            <Suspense fallback={<LoadingList count={3} />}>
              <CountryDetailPage />
            </Suspense>
          }
        />
        <Route
          path="mis-misiones"
          element={
            <Suspense fallback={<LoadingList count={3} />}>
              <MyMissionsPage />
            </Suspense>
          }
        />
        <Route
          path="acceder"
          element={
            <Suspense fallback={<LoadingList count={1} />}>
              <LoginPage />
            </Suspense>
          }
        />
        <Route
          path="calidad-datos"
          element={
            <Suspense fallback={<LoadingList count={3} />}>
              <DataQualityPage />
            </Suspense>
          }
        />
        <Route
          path="*"
          element={
            <Suspense fallback={<LoadingList count={1} />}>
              <NotFoundPage />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  );
}
