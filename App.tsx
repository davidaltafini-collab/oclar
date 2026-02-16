import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { Home } from './pages/Home';
import { ProductDetails } from './pages/ProductDetails';
import { About } from './pages/About';
import { Admin } from './pages/Admin';
import { Diagnostics } from './pages/Diagnostics';
import { Terms } from './pages/Terms';
import { Privacy } from './pages/Privacy';
import { Success } from './pages/Success';
import { Contact } from './pages/Contact';
import { Cookies } from './pages/Cookies';

import { CartProvider } from './context/CartContext';
import { CartDrawer } from './components/CartDrawer';
import { CookieConsent } from './components/CookieConsent';
import { CookieChoice } from './types';

// --- 1. COMPONENTA SCROLL TO TOP ---
// Aceasta forțează fereastra să meargă sus (0,0) la fiecare schimbare de rută
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

// --- 2. ANALYTICS MANAGER ---
const AnalyticsManager = () => {
  const location = useLocation();

  useEffect(() => {
    const consent = localStorage.getItem('lumina_cookie_consent');

    if (consent === CookieChoice.ACCEPTED_ALL || consent === 'ACCEPTED_ALL') {
      console.log('Analytics Enabled: User accepted cookies.');

      const gaId = 'G-XXXXXXXXXX'; // PUNE ID-ul TĂU

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

        const script = document.createElement('script');
        script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
        script.async = true;
        document.head.appendChild(script);
      } else {
        // @ts-ignore
        if (window.gtag) window.gtag('config', gaId, { page_path: location.pathname });
      }

      const pixelId = '123456789012345'; // PUNE ID-ul TĂU
      
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
      // @ts-ignore
      if (window.fbq) window.fbq('track', 'PageView');
    }
  }, [location]);

  return null;
};

function App() {
  return (
    <HelmetProvider>
      <Router>
        {/* ScrollToTop trebuie să fie aici, imediat după Router */}
        <ScrollToTop />
        
        <CartProvider>
          <div className="min-h-screen bg-neutral-50 flex flex-col font-sans text-neutral-900 selection:bg-brand-yellow selection:text-black">
            <Navbar />
            <CartDrawer />
            <AnalyticsManager />
            
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/product/:id" element={<ProductDetails />} />
              <Route path="/about" element={<About />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/diagnostics" element={<Diagnostics />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              
              <Route path="/success" element={<Success />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/cookies" element={<Cookies />} />
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