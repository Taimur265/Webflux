/**
 * Inspector service types
 */

export interface LighthouseResult {
  scores: {
    performance: number;
    accessibility: number;
    'best-practices': number;
    seo: number;
  };
  metrics: {
    'first-contentful-paint'?: number;
    'largest-contentful-paint'?: number;
    'total-blocking-time'?: number;
    'cumulative-layout-shift'?: number;
    'speed-index'?: number;
  };
  report_url?: string;
}

export interface SEOResult {
  score: number;
  issues: Array<{
    type: 'error' | 'warning' | 'info';
    message: string;
    element?: string;
  }>;
  suggestions: string[];
  meta: {
    title?: string;
    description?: string;
    keywords?: string;
    og_title?: string;
    og_description?: string;
    og_image?: string;
  };
}

export interface LinkCheckResult {
  total_links: number;
  internal_links: number;
  external_links: number;
  broken_links: Array<{
    url: string;
    status_code?: number;
    error?: string;
    source_location?: string;
  }>;
  warnings: Array<{
    url: string;
    message: string;
  }>;
}

export interface InspectorOptions {
  timeout?: number;
  user_agent?: string;
  follow_redirects?: boolean;
}
