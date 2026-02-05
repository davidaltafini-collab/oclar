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
  const defaultImage = "https://oclar.ro/og-image.jpg"; // Vom pune un link real mai târziu
  const siteUrl = "https://oclar.ro";

  return (
    <Helmet>
      {/* Date Standard */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url || siteUrl} />

      {/* Facebook / Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image || defaultImage} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
    </Helmet>
  );
};