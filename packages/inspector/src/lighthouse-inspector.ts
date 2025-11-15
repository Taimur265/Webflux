/**
 * Lighthouse Inspector
 */

import * as lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import type { LighthouseResult, InspectorOptions } from './types';

export class LighthouseInspector {
  async inspect(
    url: string,
    options: InspectorOptions & {
      categories?: Array<'performance' | 'accessibility' | 'best-practices' | 'seo'>;
    } = {}
  ): Promise<LighthouseResult> {
    const categories = options.categories || ['performance', 'accessibility', 'best-practices', 'seo'];

    let chrome: chromeLauncher.LaunchedChrome | undefined;

    try {
      // Launch Chrome
      chrome = await chromeLauncher.launch({
        chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu'],
      });

      // Run Lighthouse
      const lighthouseOptions = {
        logLevel: 'error' as const,
        output: 'json' as const,
        onlyCategories: categories,
        port: chrome.port,
      };

      const runnerResult = await lighthouse(url, lighthouseOptions);

      if (!runnerResult) {
        throw new Error('Lighthouse returned no results');
      }

      const lhr = runnerResult.lhr;

      // Extract scores
      const scores: LighthouseResult['scores'] = {
        performance: lhr.categories.performance?.score || 0,
        accessibility: lhr.categories.accessibility?.score || 0,
        'best-practices': lhr.categories['best-practices']?.score || 0,
        seo: lhr.categories.seo?.score || 0,
      };

      // Extract metrics
      const metrics: LighthouseResult['metrics'] = {};

      const audits = lhr.audits;
      if (audits['first-contentful-paint']) {
        metrics['first-contentful-paint'] = audits['first-contentful-paint'].numericValue;
      }
      if (audits['largest-contentful-paint']) {
        metrics['largest-contentful-paint'] = audits['largest-contentful-paint'].numericValue;
      }
      if (audits['total-blocking-time']) {
        metrics['total-blocking-time'] = audits['total-blocking-time'].numericValue;
      }
      if (audits['cumulative-layout-shift']) {
        metrics['cumulative-layout-shift'] = audits['cumulative-layout-shift'].numericValue;
      }
      if (audits['speed-index']) {
        metrics['speed-index'] = audits['speed-index'].numericValue;
      }

      return {
        scores,
        metrics,
      };
    } finally {
      if (chrome) {
        await chrome.kill();
      }
    }
  }
}
