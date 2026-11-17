import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

import Home from './pages/Home.jsx';
import SpeciesList from './pages/SpeciesList.jsx';
import SpeciesDetail from './pages/SpeciesDetail.jsx';
import PlantsList from './pages/PlantsList.jsx';
import Articles from './pages/Articles.jsx';
import Tools from './pages/Tools.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import MyTanks from './pages/MyTanks.jsx';
import TankDetail from './pages/TankDetail.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/species" element={<SpeciesList />} />
        <Route path="/species/:slug" element={<SpeciesDetail />} />
        <Route path="/plants" element={<PlantsList />} />
        <Route path="/articles" element={<Articles />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Cần đăng nhập */}
        <Route
          path="/tanks"
          element={
            <ProtectedRoute>
              <MyTanks />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tanks/:id"
          element={
            <ProtectedRoute>
              <TankDetail />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
