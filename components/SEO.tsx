import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title: string;
  description: string;
  image?: string;
  url?: string;
}

export const SEO: React.FC<SEOProps> = ({ title, description, image, url }) => {
  const siteTitle = "Oclar | Vezi până la capăt";
  const fullTitle = title === "Home" ? siteTitle : `${title} | Oclar`;
  const siteUrl = "https://oclar.ro"; // Domeniul tău principal

  // LOGICA NOUA: Construim URL-ul complet pentru imagine
  let fullImageUrl = "https://oclar.ro/og-image.jpg"; // Imaginea default
  
  if (image) {
    if (image.startsWith('http')) {
      // Daca e deja link complet (ex: de pe un CDN), il lasam asa
      fullImageUrl = image;
    } else {
      // Daca e cale locala (ex: /poze/oclar.png), ii punem domeniul in fata
      // Ne asiguram ca nu avem dublu slash //
      const cleanPath = image.startsWith('/') ? image.substring(1) : image;
      fullImageUrl = `${siteUrl}/${cleanPath}`;
    }
  }

  return (
    <Helmet>
      {/* Date Standard */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url || siteUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={fullImageUrl} />
      <meta property="og:url" content={url || siteUrl} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullImageUrl} />
    </Helmet>
  );
};