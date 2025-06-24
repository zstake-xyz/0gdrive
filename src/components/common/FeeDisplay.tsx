import { formatUnits } from 'viem';
import { FeeInfo } from '@/hooks/useFees';
import { formatFileSize } from '@/utils/format';

interface FeeDisplayProps {
  feeInfo: FeeInfo;
  size: number;
  error?: string | null;
  onRetry?: () => void;
}

/**
 * A component for displaying fee information for a file upload
 */
export function FeeDisplay({ feeInfo, size, error, onRetry }: FeeDisplayProps) {
  if (error) {
    return (
      <div className="mt-4 p-4 bg-red-100 border border-red-200 rounded-lg text-sm text-red-800">
        <p className="font-semibold">Error calculating fee:</p>
        <p className="text-xs mt-1">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 text-xs font-semibold text-red-800 underline hover:text-red-900"
          >
            Click here to retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 border border-brand-border rounded-lg bg-brand-background">
      <h3 className="text-sm font-semibold text-brand-text mb-3">Estimated Storage Fee</h3>
      {feeInfo.isLoading ? (
        <div className="flex items-center text-sm text-brand-text-secondary">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Calculating fee...
        </div>
      ) : (
        <ul className="text-xs space-y-2 text-brand-text-secondary">
          <li className="flex justify-between">
            <span>Data Size:</span>
            <span className="font-medium text-brand-text">{formatFileSize(size)}</span>
          </li>
          <li className="flex justify-between items-center">
            <span>Estimated Fee:</span>
            <span className="font-semibold text-brand-text text-sm">{feeInfo.totalFee} 0G</span>
          </li>
        </ul>
      )}
    </div>
  );
} 