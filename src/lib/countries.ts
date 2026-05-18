export const COUNTRIES = [
  { name: 'United States', code: 'US', currency: 'USD' },
  { name: 'United Kingdom', code: 'GB', currency: 'GBP' },
  { name: 'Canada', code: 'CA', currency: 'CAD' },
  { name: 'Australia', code: 'AU', currency: 'AUD' },
  { name: 'India', code: 'IN', currency: 'INR' },
  { name: 'Germany', code: 'DE', currency: 'EUR' },
  { name: 'France', code: 'FR', currency: 'EUR' },
  { name: 'Singapore', code: 'SG', currency: 'SGD' },
  { name: 'United Arab Emirates', code: 'AE', currency: 'AED' },
  { name: 'Brazil', code: 'BR', currency: 'BRL' },
  { name: 'Mexico', code: 'MX', currency: 'MXN' },
  { name: 'Japan', code: 'JP', currency: 'JPY' },
  { name: 'South Korea', code: 'KR', currency: 'KRW' },
  { name: 'South Africa', code: 'ZA', currency: 'ZAR' }
].sort((a, b) => a.name.localeCompare(b.name));

export const INDUSTRIES = [
  'Technology & Software',
  'Healthcare & Medical',
  'Education & Training',
  'Manufacturing & Production',
  'Retail & E-commerce',
  'Finance & Banking',
  'Consulting & Professional Services',
  'Real Estate & Construction',
  'Media & Entertainment',
  'Non-Profit & Organization',
  'Other'
].sort();
