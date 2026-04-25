import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { CartProvider } from '@/contexts/CartContext'
import { SetupPage } from '@/pages/SetupPage'
import { LandingPage } from '@/pages/marketing/LandingPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterStorePage } from '@/pages/auth/RegisterStorePage'
import { CatalogLayout } from '@/pages/public/CatalogLayout'
import { CatalogPageModern } from '@/pages/public/CatalogPageModern'
import { ProductDetailPage } from '@/pages/public/ProductDetailPage'
import { CartPage } from '@/pages/public/CartPage'
import { CheckoutPage } from '@/pages/public/CheckoutPage'
import { ThankYouPage } from '@/pages/public/ThankYouPage'
import { AdminLayout } from '@/pages/admin/AdminLayout'
import { DashboardPage } from '@/pages/admin/DashboardPage'
import { ProductsPage } from '@/pages/admin/ProductsPage'
import { ProductEditorPage } from '@/pages/admin/ProductEditorPage'
import { OrdersPage } from '@/pages/admin/OrdersPage'
import { OrderDetailPage } from '@/pages/admin/OrderDetailPage'
import { CustomersPage } from '@/pages/admin/CustomersPage'
import { CustomerDetailPage } from '@/pages/admin/CustomerDetailPage'
import { FinancePage } from '@/pages/admin/FinancePage'
import { SettingsPage } from '@/pages/admin/SettingsPage'
import { CatalogDataPage } from '@/pages/admin/CatalogDataPage'
import { PwaEntryHandler } from '@/components/PwaEntryHandler'
import { PlatformLayout } from '@/pages/platform/PlatformLayout'
import { PlatformStoreDetailPage } from '@/pages/platform/PlatformStoreDetailPage'
import { PlatformStoresPage } from '@/pages/platform/PlatformStoresPage'

function configured() {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}

export default function App() {
  if (!configured()) {
    return <SetupPage />
  }

  return (
    <BrowserRouter>
      <PwaEntryHandler />
      <AuthProvider>
        <CartProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/cadastro" element={<RegisterStorePage />} />

            <Route path="/loja/:slug" element={<CatalogLayout />}>
              <Route index element={<CatalogPageModern />} />
              <Route path="produto/:productSlug" element={<ProductDetailPage />} />
              <Route path="carrinho" element={<CartPage />} />
              <Route path="checkout" element={<CheckoutPage />} />
              <Route path="obrigado" element={<ThankYouPage />} />
            </Route>

            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="produtos" element={<ProductsPage />} />
              <Route path="produtos/:id" element={<ProductEditorPage />} />
              <Route path="pedidos" element={<OrdersPage />} />
              <Route path="pedidos/:id" element={<OrderDetailPage />} />
              <Route path="clientes" element={<CustomersPage />} />
              <Route path="clientes/:id" element={<CustomerDetailPage />} />
              <Route path="financeiro" element={<FinancePage />} />
              <Route path="dados-catalogo" element={<CatalogDataPage />} />
              <Route path="configuracoes" element={<SettingsPage />} />
            </Route>

            <Route path="/plataforma" element={<PlatformLayout />}>
              <Route index element={<Navigate to="/plataforma/lojas" replace />} />
              <Route path="lojas" element={<PlatformStoresPage />} />
              <Route path="lojas/:storeId" element={<PlatformStoreDetailPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
