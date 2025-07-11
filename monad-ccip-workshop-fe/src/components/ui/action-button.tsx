import { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Info, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type ButtonVariant = "primary" | "secondary" | "green" | "red" | "blue" | "orange"
type ButtonState = "enabled" | "disabled" | "loading"

interface ActionButtonProps {
  children: ReactNode
  variant?: ButtonVariant
  state?: ButtonState
  icon?: ReactNode
  rightIcon?: ReactNode
  tooltip?: string
  onClick?: () => void
  className?: string
  size?: "sm" | "md" | "lg"
  fullWidth?: boolean
  animated?: boolean
}

export function ActionButton({
  children,
  variant = "primary",
  state = "enabled",
  icon,
  rightIcon,
  tooltip,
  onClick,
  className,
  size = "md",
  fullWidth = false,
  animated = false
}: ActionButtonProps) {
  const isDisabled = state === "disabled" || state === "loading"
  const isLoading = state === "loading"

  const variantClasses = {
    primary: "bg-white/10 border-white/40 text-white hover:bg-white hover:text-monad-purple",
    secondary: "bg-white/5 border-white/20 text-white/70 hover:bg-white/10 hover:text-white",
    green: "bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-300 border-green-500/40 hover:from-green-500/30 hover:to-emerald-500/30 hover:text-green-200 hover:border-green-400/60",
    red: "bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-300 border-red-500/40 hover:from-red-500/30 hover:to-rose-500/30 hover:text-red-200 hover:border-red-400/60",
    blue: "bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-300 border-blue-500/40 hover:from-blue-500/30 hover:to-cyan-500/30 hover:text-blue-200 hover:border-blue-400/60",
    orange: "bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-300 border-orange-500/40 hover:from-orange-500/30 hover:to-red-500/30 hover:text-orange-200 hover:border-orange-400/60"
  }

  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm", 
    lg: "px-6 py-3 text-base"
  }

  const disabledClasses = "bg-white/5 border-white/20 text-white/40 cursor-not-allowed opacity-50"

  const buttonContent = (
    <Button
      onClick={onClick}
      disabled={isDisabled}
      className={cn(
        "group flex items-center justify-between gap-3 font-body cta-enhanced transition-all duration-200 border-2 backdrop-blur-sm",
        !isDisabled ? variantClasses[variant] : disabledClasses,
        sizeClasses[size],
        fullWidth && "w-full",
        animated && "animate-pulse", 
        className
      )}
    >
      <div className="flex items-center space-x-2">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : icon && (
          <div className="relative">
            <div className={cn(
              "absolute inset-0 rounded-full",
              !isDisabled && animated && "animate-pulse",
              !isDisabled ? "bg-current/20" : "bg-white/10"
            )}></div>
            <div className="relative z-10">
              {icon}
            </div>
          </div>
        )}
        <span className="font-body font-medium">
          {children}
        </span>
      </div>
      {rightIcon && (
        <div className={cn(
          "transition-colors",
          !isDisabled ? "text-current" : "text-white/40"
        )}>
          {rightIcon}
        </div>
      )}
    </Button>
  )

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {buttonContent}
        </TooltipTrigger>
        <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
          <p className="font-body text-xs">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return buttonContent
} 