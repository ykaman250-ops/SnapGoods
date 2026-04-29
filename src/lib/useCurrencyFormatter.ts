import { useAuth } from './auth';

export function useCurrencyFormatter() {
  const { organization } = useAuth();

  const CURRENCIES = [
    { code: 'USD', symbol: '$' },
    { code: 'INR', symbol: '₹' },
    { code: 'EUR', symbol: '€' },
    { code: 'GBP', symbol: '£' },
    { code: 'AED', symbol: 'د.إ' },
    { code: 'PKR', symbol: '₨' },
    { code: 'BDT', symbol: '৳' },
  ];

  const currencyCode = organization?.currency || 'USD';
  const currency = CURRENCIES.find(c => c.code === currencyCode) || CURRENCIES[0];

  return (amount: number | string | undefined) => {
    if (amount === undefined || amount === null) return '-';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return '-';
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'symbol',
    }).format(num);
  };
}
