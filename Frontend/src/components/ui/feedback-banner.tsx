import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FeedbackBannerProps {
  variant: 'success' | 'error'
  message: string
  onDismiss?: () => void
}

export function FeedbackBanner({ variant, message, onDismiss }: FeedbackBannerProps) {
  const isError = variant === 'error'
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
        isError
          ? 'border-red-300 bg-red-50 text-red-800'
          : 'border-emerald-300 bg-emerald-50 text-emerald-900'
      }`}
    >
      <span className="flex items-start gap-2.5 font-medium">
        {isError ? (
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
        )}
        <span>{message}</span>
      </span>
      {onDismiss && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          aria-label="Fechar aviso"
          className="h-7 w-7 shrink-0 text-current hover:bg-black/5"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
