/**
 * SEO Component for React 19+
 * Uses document.head manipulation for meta tags since react-helmet-async
 * doesn't support React 19 yet.
 */

import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  canonicalUrl?: string;
  ogType?: string;
  ogImage?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  schema?: object | object[];
  geoRegion?: string;
  geoPlacename?: string;
}

export function SEO({
  title,
  description,
  keywords,
  canonicalUrl,
  ogType = 'website',
  ogImage = 'https://dealersface.com/og-image.png',
  twitterCard = 'summary_large_image',
  schema,
  geoRegion,
  geoPlacename,
}: SEOProps) {
  useEffect(() => {
    // Update document title
    const fullTitle = `${title} | Dealers Face`;
    document.title = fullTitle;

    // Helper to update or create meta tag
    const updateMeta = (name: string, content: string, isProperty = false) => {
      const attr = isProperty ? 'property' : 'name';
      let meta = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attr, name);
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    // Helper to update or create link tag
    const updateLink = (rel: string, href: string) => {
      let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = rel;
        document.head.appendChild(link);
      }
      link.href = href;
    };

    // Basic meta tags
    updateMeta('description', description);
    if (keywords) {
      updateMeta('keywords', keywords);
    }

    // Open Graph tags
    updateMeta('og:title', fullTitle, true);
    updateMeta('og:description', description, true);
    updateMeta('og:type', ogType, true);
    if (ogImage) {
      updateMeta('og:image', ogImage, true);
    }
    if (canonicalUrl) {
      updateMeta('og:url', canonicalUrl, true);
      updateLink('canonical', canonicalUrl);
    }

    // Twitter Card tags
    updateMeta('twitter:card', twitterCard);
    updateMeta('twitter:title', fullTitle);
    updateMeta('twitter:description', description);
    if (ogImage) {
      updateMeta('twitter:image', ogImage);
    }

    // Geo tags for local SEO
    if (geoRegion) {
      updateMeta('geo.region', geoRegion);
    }
    if (geoPlacename) {
      updateMeta('geo.placename', geoPlacename);
    }

    // Schema.org structured data
    if (schema) {
      // Remove existing schema scripts
      const existingSchemas = document.querySelectorAll('script[data-seo-schema]');
      existingSchemas.forEach(s => s.remove());

      // Add new schema(s)
      const schemas = Array.isArray(schema) ? schema : [schema];
      schemas.forEach((s, index) => {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.setAttribute('data-seo-schema', `schema-${index}`);
        script.textContent = JSON.stringify(s);
        document.head.appendChild(script);
      });
    }

    // Cleanup function
    return () => {
      // Optional: Clean up schema scripts when component unmounts
      const schemaScripts = document.querySelectorAll('script[data-seo-schema]');
      schemaScripts.forEach(s => s.remove());
    };
  }, [title, description, keywords, canonicalUrl, ogType, ogImage, twitterCard, schema, geoRegion, geoPlacename]);

  // This component doesn't render anything visible
  return null;
}

export default SEO;
