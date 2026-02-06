import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async'; // <--- IMPORT NOU PENTRU SEO

import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { Home } from './pages/Home';
import { ProductDetails } from './pages/ProductDetails';
import { About } from './pages/About';
import { Admin } from './pages/Admin';
import { Diagnostics } from './pages/Diagnostics';
import { Terms } from './pages/Terms';
import { Privacy } from './pages/Privacy';
import { CartProvider } from './context/CartContext';
import { CartDrawer } from './components/CartDrawer';
import { CookieConsent } from './components/CookieConsent';
import { CookieChoice } from './types'; // Asigură-te că exporți CookieChoice din types.ts

// --- ANALYTICS MANAGER ---
// Această componentă ascultă schimbările de pagină și cookie-urile
const AnalyticsManager = () => {
  const location = useLocation();

  useEffect(() => {
    // Verificăm dacă avem permisiunea utilizatorului
    const consent = localStorage.getItem('lumina_cookie_consent');

    // Executăm codul de tracking DOAR dacă avem 'ACCEPTED_ALL'
    // Verificăm ambele variante pentru siguranță (string sau enum)
    if (consent === CookieChoice.ACCEPTED_ALL || consent === 'ACCEPTED_ALL') {
      
      console.log('Analytics Enabled: User accepted cookies.');

      // 1. GOOGLE ANALYTICS 4
      const gaId = 'G-XXXXXXXXXX'; // <--- PUNE AICI ID-UL TAU GA4 CAND IL AI
      
      // @ts-ignore
      if (!window.dataLayer) {
        // @ts-ignore
        window.dataLayer = [];
        // @ts-ignore
        function gtag(){dataLayer.push(arguments);}
        // @ts-ignore
        gtag('js', new Date());
        // @ts-ignore
        gtag('config', gaId);

        // Injectăm scriptul Google în <head>
        const script = document.createElement('script');
        script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
        script.async = true;
        document.head.appendChild(script);
      } else {
        // Dacă e deja încărcat, trimitem doar un semnal de "page view" nou
        // @ts-ignore
        if (window.gtag) window.gtag('config', gaId, { page_path: location.pathname });
      }

      // 2. META PIXEL (FACEBOOK)
      const pixelId = '123456789012345'; // <--- PUNE AICI ID-UL TAU PIXEL CAND IL AI
      
      // @ts-ignore
      if (!window.fbq) {
        // @ts-ignore
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        
        // @ts-ignore
        window.fbq('init', pixelId);
      }
      
      // Trimitem evenimentul de vizualizare
      // @ts-ignore
      if (window.fbq) window.fbq('track', 'PageView');
    }
  }, [location]); // Se reactivează la fiecare schimbare de rută (pagină)

  return null;
};

function App() {
  return (
    // Învelim totul în HelmetProvider pentru SEO
    <HelmetProvider>
      <Router>
        <CartProvider>
          <div className="min-h-screen bg-neutral-50 flex flex-col font-sans text-neutral-900 selection:bg-brand-yellow selection:text-black">
            <Navbar />
            <CartDrawer />
            
            {/* Componenta invizibilă care se ocupă de tracking */}
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
    </HelmetProvider>
  );
}

export default App;