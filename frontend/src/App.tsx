import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Receipts from './pages/Receipts';
import Deliveries from './pages/Deliveries';
import Products from './pages/Products';
import MoveHistory from './pages/MoveHistory';
import Settings from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="receipts" element={<Receipts />} />
          <Route path="deliveries" element={<Deliveries />} />
          <Route path="products" element={<Products />} />
          <Route path="moves" element={<MoveHistory />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
