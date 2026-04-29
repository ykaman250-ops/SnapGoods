import { useAuth } from './auth';
import { format } from 'date-fns';

export function useDateFormatter() {
  const { profile } = useAuth();
  
  return (date: Date | string | number | undefined | null | any, includeTime = true) => {
    if (!date) return 'N/A';
    
    try {
      let d: Date;
      if (date && typeof date === 'object' && 'seconds' in date) {
        d = new Date(date.seconds * 1000);
      } else {
        d = new Date(date);
      }
      const dateFormat = profile?.preferences?.dateFormat || 'MMM d, yyyy';
      const timeFormat = profile?.preferences?.timeFormat === '24h' ? 'HH:mm' : 'h:mm a';
      
      const formatStr = includeTime ? `${dateFormat} ${timeFormat}` : dateFormat;
      return format(d, formatStr);
    } catch (e) {
      return 'Invalid Date';
    }
  };
}
