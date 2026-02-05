import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer'; // Asigură-te că Footer este importat
import { Home } from './pages/Home';
import { ProductDetails } from './pages/ProductDetails';
import { About } from './pages/About';
import { Admin } from './pages/Admin';
import { Diagnostics } from './pages/Diagnostics';
import { Terms } from './pages/Terms'; // Pagina noua
import { Privacy } from './pages/Privacy'; // Pagina noua
import { CartProvider } from './context/CartContext';
import { CartDrawer } from './components/CartDrawer';
import { CookieConsent } from './components/CookieConsent';
import { CookieChoice } from './types'; // Asigură-te că ai exportat CookieChoice

// Aceasta componentă se ocupă de Tracking (Analytics) doar dacă e permis
const AnalyticsManager = () => {
  const location = useLocation();

  useEffect(() => {
    // 1. Citim permisiunea
    const consent = localStorage.getItem('lumina_cookie_consent');

    // 2. Daca utilizatorul a acceptat TOT
    if (consent === CookieChoice.ACCEPTED_ALL) {
      console.log("Analytics: ACTIVAT (Userul a acceptat). Aici se încarcă Google Analytics/Pixel.");
      // AICI vei pune codul de Google Analytics (GTM) pe viitor
      // Exemplu: window.gtag('config', 'GA-MEASUREMENT-ID', { page_path: location.pathname });
    } else {
      console.log("Analytics: DEZACTIVAT (Userul nu a acceptat sau a ales doar esențiale).");
      // Aici te asiguri că nu se încarcă nimic
    }
  }, [location]); // Se rulează la fiecare schimbare de pagină

  return null; // Componenta asta nu randează nimic vizual
};

function App() {
  return (
    <Router>
      <CartProvider>
        <div className="min-h-screen bg-neutral-50 flex flex-col font-sans text-neutral-900 selection:bg-brand-yellow selection:text-black">
          <Navbar />
          <CartDrawer />
          
          {/* Managerul de Analytics care "ascultă" cookies */}
          <AnalyticsManager />
          
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/product/:id" element={<ProductDetails />} />
            <Route path="/about" element={<About />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/diagnostics" element={<Diagnostics />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
          </Routes>
          
          <Footer />
          <CookieConsent />
        </div>
      </CartProvider>
    </Router>
  );
}

export default App;