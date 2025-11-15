/**
 * SEO Inspector
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import type { SEOResult, InspectorOptions } from './types';

export class SEOInspector {
  async inspect(url: string, options: InspectorOptions = {}): Promise<SEOResult> {
    const response = await axios.get(url, {
      timeout: options.timeout || 30000,
      headers: {
        'User-Agent': options.user_agent || 'UWG-Inspector/1.0',
      },
      maxRedirects: options.follow_redirects !== false ? 5 : 0,
    });

    const html = response.data;
    const $ = cheerio.load(html);

    const issues: SEOResult['issues'] = [];
    const suggestions: string[] = [];

    // Extract meta tags
    const title = $('title').text();
    const description = $('meta[name="description"]').attr('content');
    const keywords = $('meta[name="keywords"]').attr('content');
    const og_title = $('meta[property="og:title"]').attr('content');
    const og_description = $('meta[property="og:description"]').attr('content');
    const og_image = $('meta[property="og:image"]').attr('content');

    // Check title
    if (!title) {
      issues.push({
        type: 'error',
        message: 'Missing <title> tag',
      });
    } else if (title.length < 30) {
      issues.push({
        type: 'warning',
        message: 'Title is too short (recommended: 50-60 characters)',
        element: title,
      });
    } else if (title.length > 60) {
      issues.push({
        type: 'warning',
        message: 'Title is too long (recommended: 50-60 characters)',
        element: title,
      });
    }

    // Check meta description
    if (!description) {
      issues.push({
        type: 'error',
        message: 'Missing meta description',
      });
    } else if (description.length < 120) {
      issues.push({
        type: 'warning',
        message: 'Meta description is too short (recommended: 150-160 characters)',
      });
    } else if (description.length > 160) {
      issues.push({
        type: 'warning',
        message: 'Meta description is too long (recommended: 150-160 characters)',
      });
    }

    // Check headings
    const h1Count = $('h1').length;
    if (h1Count === 0) {
      issues.push({
        type: 'error',
        message: 'Missing H1 tag',
      });
    } else if (h1Count > 1) {
      issues.push({
        type: 'warning',
        message: `Multiple H1 tags found (${h1Count}). Recommended: 1 H1 per page`,
      });
    }

    // Check images
    $('img').each((i, elem) => {
      const alt = $(elem).attr('alt');
      const src = $(elem).attr('src');

      if (!alt) {
        issues.push({
          type: 'warning',
          message: 'Image missing alt attribute',
          element: src,
        });
      }
    });

    // Check Open Graph
    if (!og_title) {
      suggestions.push('Add Open Graph title meta tag for better social sharing');
    }
    if (!og_description) {
      suggestions.push('Add Open Graph description meta tag');
    }
    if (!og_image) {
      suggestions.push('Add Open Graph image meta tag');
    }

    // Check canonical URL
    const canonical = $('link[rel="canonical"]').attr('href');
    if (!canonical) {
      suggestions.push('Add canonical URL to avoid duplicate content issues');
    }

    // Check viewport
    const viewport = $('meta[name="viewport"]').attr('content');
    if (!viewport) {
      issues.push({
        type: 'error',
        message: 'Missing viewport meta tag (important for mobile)',
      });
    }

    // Check robots
    const robots = $('meta[name="robots"]').attr('content');
    if (robots && robots.includes('noindex')) {
      issues.push({
        type: 'warning',
        message: 'Page is set to noindex',
      });
    }

    // Calculate score (simple heuristic)
    const errorCount = issues.filter(i => i.type === 'error').length;
    const warningCount = issues.filter(i => i.type === 'warning').length;

    let score = 100;
    score -= errorCount * 15;
    score -= warningCount * 5;
    score = Math.max(0, Math.min(100, score));

    return {
      score,
      issues,
      suggestions,
      meta: {
        title,
        description,
        keywords,
        og_title,
        og_description,
        og_image,
      },
    };
  }
}
