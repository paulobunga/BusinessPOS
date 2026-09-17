import { cn } from "@/lib/utils"
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom"
import { useEffect, useRef } from "react"

export type ChatContainerRootProps = {
  children: React.ReactNode
  className?: string
} & React.HTMLAttributes<HTMLDivElement>

export type ChatContainerContentProps = {
  children: React.ReactNode
  className?: string
} & React.HTMLAttributes<HTMLDivElement>

export type ChatContainerScrollAnchorProps = {
  className?: string
  ref?: React.RefObject<HTMLDivElement>
} & React.HTMLAttributes<HTMLDivElement>

export type ChatAutoScrollProps = {
  dependencies?: React.DependencyList
}

function ChatAutoScroll({ dependencies = [] }: ChatAutoScrollProps) {
  const { scrollToBottom } = useStickToBottomContext()
  const lastDepsRef = useRef<string>("")
  const scheduledRef = useRef(false)

  const key = JSON.stringify(dependencies)

  useEffect(() => {
    if (key === lastDepsRef.current) return
    lastDepsRef.current = key
    if (scheduledRef.current) return
    scheduledRef.current = true
    const id = requestAnimationFrame(() => {
      scheduledRef.current = false
      scrollToBottom({ animation: "instant", wait: true })
    })
    return () => { cancelAnimationFrame(id) }
  }, [key, scrollToBottom])

  return null
}

function ChatContainerRoot({
  children,
  className,
  ...props
}: ChatContainerRootProps) {
  return (
    <StickToBottom
      className={cn("flex overflow-y-auto", className)}
      resize="smooth"
      initial="instant"
      role="log"
      {...props}
    >
      {children}
    </StickToBottom>
  )
}

function ChatContainerContent({
  children,
  className,
  ...props
}: ChatContainerContentProps) {
  return (
    <StickToBottom.Content
      className={cn("flex w-full flex-col", className)}
      {...props}
    >
      {children}
    </StickToBottom.Content>
  )
}

function ChatContainerScrollAnchor({
  className,
  ...props
}: ChatContainerScrollAnchorProps) {
  return (
    <div
      className={cn("h-px w-full shrink-0 scroll-mt-4", className)}
      aria-hidden="true"
      {...props}
    />
  )
}

export { ChatContainerRoot, ChatContainerContent, ChatContainerScrollAnchor, ChatAutoScroll }
