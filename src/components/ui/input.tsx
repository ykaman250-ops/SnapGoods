import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, defaultValue, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      defaultValue={defaultValue ?? (props.value === undefined ? "" : undefined)}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-lg border border-transparent bg-zinc-100 dark:bg-zinc-900 px-3 py-1 text-base transition-all outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-zinc-400 focus-visible:bg-white dark:focus-visible:bg-zinc-950 focus-visible:border-zinc-300 dark:focus-visible:border-zinc-700 focus-visible:ring-[3px] focus-visible:ring-zinc-200 dark:focus-visible:ring-zinc-800 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-zinc-100/50 aria-invalid:border-red-500 aria-invalid:ring-red-200 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
