/**
 * Link Checker
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import type { LinkCheckResult, InspectorOptions } from './types';

export class LinkChecker {
  async check(url: string, options: InspectorOptions = {}): Promise<LinkCheckResult> {
    const response = await axios.get(url, {
      timeout: options.timeout || 30000,
      headers: {
        'User-Agent': options.user_agent || 'UWG-Inspector/1.0',
      },
    });

    const html = response.data;
    const $ = cheerio.load(html);

    const baseUrl = new URL(url);
    const links: Array<{ url: string; isInternal: boolean; sourceLocation: string }> = [];

    // Extract all links
    $('a[href]').each((i, elem) => {
      const href = $(elem).attr('href');
      if (!href) return;

      try {
        const absoluteUrl = new URL(href, url);
        const isInternal = absoluteUrl.hostname === baseUrl.hostname;

        links.push({
          url: absoluteUrl.toString(),
          isInternal,
          sourceLocation: `<a> tag on ${url}`,
        });
      } catch (error) {
        // Invalid URL, skip
      }
    });

    const internalLinks = links.filter(l => l.isInternal);
    const externalLinks = links.filter(l => !l.isInternal);

    // Check links (sample first 50 to avoid overwhelming the target site)
    const linksToCheck = links.slice(0, 50);
    const brokenLinks: LinkCheckResult['broken_links'] = [];
    const warnings: LinkCheckResult['warnings'] = [];

    await Promise.all(
      linksToCheck.map(async (link) => {
        try {
          const checkResponse = await axios.head(link.url, {
            timeout: 10000,
            maxRedirects: 5,
            validateStatus: (status) => status < 500, // Don't throw on 4xx
          });

          if (checkResponse.status >= 400) {
            brokenLinks.push({
              url: link.url,
              status_code: checkResponse.status,
              source_location: link.sourceLocation,
            });
          } else if (checkResponse.status >= 300 && checkResponse.status < 400) {
            warnings.push({
              url: link.url,
              message: `Redirects (${checkResponse.status})`,
            });
          }
        } catch (error: any) {
          brokenLinks.push({
            url: link.url,
            error: error.message || 'Request failed',
            source_location: link.sourceLocation,
          });
        }
      })
    );

    return {
      total_links: links.length,
      internal_links: internalLinks.length,
      external_links: externalLinks.length,
      broken_links: brokenLinks,
      warnings,
    };
  }
}
