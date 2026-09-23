import { Loader2 } from 'lucide-react'
import { Button } from './ui/button'

interface LoadingButtonProps extends React.ComponentPropsWithoutRef<typeof Button> {
  isLoading: boolean
  isDisabled?: boolean
  loadingText?: string
  children: React.ReactNode
  variant?: 'default' | 'secondary' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  type?: 'submit' | 'button'
  className?: string
  onClick?: () => void
}

export function LoadingButton({
  isLoading,
  isDisabled = false,
  loadingText = 'Sending...',
  children,
  variant = 'secondary',
  size,
  type = 'submit',
  onClick,
  className,
  ...props
}: LoadingButtonProps) {
  return (
    <Button
      className={className}
      variant={variant}
      size={size}
      type={type}
      disabled={isLoading || isDisabled}
      onClick={onClick}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </Button>
  )
}
