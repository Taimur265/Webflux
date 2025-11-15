/**
 * Node type definitions and schemas for all node categories
 */

export interface TriggerNodeTypes {
  'http.webhook': {
    params: {
      path: string;
      method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      auth?: 'none' | 'signing_secret' | 'bearer';
      signature_header_name?: string;
    };
    outputs: {
      body: any;
      headers: Record<string, string>;
      query: Record<string, string>;
    };
  };
  'cron.schedule': {
    params: {
      cron: string;
      timezone?: string;
    };
    outputs: {
      timestamp: string;
    };
  };
  'manual': {
    params: Record<string, never>;
    outputs: {
      trigger_data?: any;
    };
  };
}

export interface AINodeTypes {
  'AI_CopyGen': {
    params: {
      prompt_template: string;
      tone?: 'professional' | 'casual' | 'friendly' | 'technical' | 'persuasive';
      length_hint?: 'short' | 'medium' | 'long';
      max_tokens: number;
      temperature?: number;
    };
    outputs: {
      text: string;
      language: string;
      word_count: number;
    };
  };
  'AI_LayoutGen': {
    params: {
      prompt_template: string;
      output_format: 'HTML' | 'JSX' | 'JSON_COMPONENT';
      screen_sizes?: Array<'mobile' | 'tablet' | 'desktop'>;
      max_tokens: number;
    };
    outputs: {
      html?: string;
      jsx?: string;
      component_json?: any;
    };
  };
  'AI_SectionGen': {
    params: {
      prompt_template: string;
      section_type?: 'hero' | 'features' | 'pricing' | 'testimonials' | 'cta' | 'footer';
      output_format: 'HTML' | 'JSX' | 'JSON_COMPONENT';
      max_tokens: number;
    };
    outputs: {
      html?: string;
      jsx?: string;
      component_json?: any;
    };
  };
  'AI_AssetGen': {
    params: {
      prompt_template: string;
      size?: string;
      format?: 'png' | 'jpg' | 'svg';
    };
    outputs: {
      asset_ref: string;
      url?: string;
    };
  };
  'AI_SEOFix': {
    params: {
      prompt_template: string;
      target_url: string;
      focus_keyword?: string;
    };
    outputs: {
      title: string;
      description: string;
      keywords: string[];
      suggestions: string[];
    };
  };
  'AI_AccessibilityFix': {
    params: {
      prompt_template: string;
      html_content: string;
    };
    outputs: {
      fixed_html: string;
      improvements: string[];
    };
  };
}

export interface ActionNodeTypes {
  // Webflow
  'webflow.createItem': {
    params: {
      collection: string;
      fields: Record<string, any>;
    };
    outputs: {
      id: string;
      url: string;
      created_at: string;
      fields: Record<string, any>;
    };
  };
  'webflow.updateItem': {
    params: {
      collection: string;
      item_id: string;
      fields: Record<string, any>;
    };
    outputs: {
      id: string;
      updated_at: string;
      fields: Record<string, any>;
    };
  };
  'webflow.publishSite': {
    params: {
      site_id: string;
      domains?: string[];
    };
    outputs: {
      publish_id: string;
      status: string;
    };
  };

  // Netlify
  'netlify.triggerBuild': {
    params: {
      site_id: string;
      build_hook: string;  // secret_ref
    };
    outputs: {
      deploy_id: string;
      status: string;
      url?: string;
    };
  };
  'netlify.listSites': {
    params: Record<string, never>;
    outputs: {
      sites: Array<{
        id: string;
        name: string;
        url: string;
      }>;
    };
  };

  // Slack
  'slack.postMessage': {
    params: {
      channel: string;
      text: string;
      blocks?: any[];
    };
    outputs: {
      message_id: string;
      timestamp: string;
    };
  };
  'slack.uploadFile': {
    params: {
      channels: string[];
      file: string;  // file path or URL
      title?: string;
    };
    outputs: {
      file_id: string;
    };
  };

  // SMTP
  'smtp.send': {
    params: {
      to: string | string[];
      from: string;
      subject: string;
      html?: string;
      text?: string;
      attachments?: Array<{
        filename: string;
        content: string;
      }>;
    };
    outputs: {
      message_id: string;
      status: string;
    };
  };

  // Airtable
  'airtable.createRecord': {
    params: {
      base_id: string;
      table: string;
      fields: Record<string, any>;
    };
    outputs: {
      id: string;
      created_time: string;
      fields: Record<string, any>;
    };
  };
  'airtable.updateRecord': {
    params: {
      base_id: string;
      table: string;
      record_id: string;
      fields: Record<string, any>;
    };
    outputs: {
      id: string;
      fields: Record<string, any>;
    };
  };

  // Supabase
  'supabase.insert': {
    params: {
      table: string;
      record: Record<string, any>;
    };
    outputs: {
      data: any;
      error?: string;
    };
  };
  'supabase.update': {
    params: {
      table: string;
      record: Record<string, any>;
      match: Record<string, any>;
    };
    outputs: {
      data: any;
      error?: string;
    };
  };

  // GitHub
  'github.createPR': {
    params: {
      repo: string;
      branch: string;
      title: string;
      body: string;
    };
    outputs: {
      pr_number: number;
      url: string;
    };
  };

  // AWS S3
  'aws_s3.upload': {
    params: {
      bucket: string;
      key: string;
      body: string;
      content_type?: string;
    };
    outputs: {
      url: string;
      etag: string;
    };
  };
}

export interface ComponentNodeTypes {
  'HeroComponent': {
    params: {
      headline: string;
      subheadline?: string;
      cta_text?: string;
      cta_url?: string;
      image_url?: string;
      background_color?: string;
    };
    outputs: {
      html: string;
      component_json: any;
    };
  };
  'PricingComponent': {
    params: {
      plans: Array<{
        name: string;
        price: string;
        features: string[];
        cta_text: string;
        cta_url: string;
      }>;
    };
    outputs: {
      html: string;
      component_json: any;
    };
  };
  'FooterComponent': {
    params: {
      links: Array<{
        label: string;
        url: string;
      }>;
      copyright?: string;
      social_links?: Record<string, string>;
    };
    outputs: {
      html: string;
      component_json: any;
    };
  };
}

export interface InspectorNodeTypes {
  'inspector.lighthouse': {
    params: {
      url: string;
      categories?: Array<'performance' | 'accessibility' | 'best-practices' | 'seo'>;
    };
    outputs: {
      scores: Record<string, number>;
      metrics: any;
      report_url?: string;
    };
  };
  'inspector.seo': {
    params: {
      url: string;
    };
    outputs: {
      issues: string[];
      suggestions: string[];
      score: number;
    };
  };
  'inspector.links': {
    params: {
      url: string;
    };
    outputs: {
      total_links: number;
      broken_links: string[];
      external_links: string[];
    };
  };
}

export interface PublishNodeTypes {
  'deploy.preview': {
    params: {
      site_id: string;
      build_hook: string;
    };
    outputs: {
      deploy_id: string;
      preview_url: string;
      status: string;
    };
  };
  'deploy.production': {
    params: {
      site_id: string;
      build_hook: string;
      confirm?: boolean;
    };
    outputs: {
      deploy_id: string;
      url: string;
      status: string;
    };
  };
  'cdn.purge': {
    params: {
      urls: string[];
    };
    outputs: {
      purged: string[];
      status: string;
    };
  };
}

// Complete node type registry
export type AllNodeTypes =
  & TriggerNodeTypes
  & AINodeTypes
  & ActionNodeTypes
  & ComponentNodeTypes
  & InspectorNodeTypes
  & PublishNodeTypes;

export type NodeTypeName = keyof AllNodeTypes;
