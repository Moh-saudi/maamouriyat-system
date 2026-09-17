import { ReactNode } from 'react'

export interface V2PageContainerProps {
  children: ReactNode
  className?: string
  /**
   * If true, removes the max-width restriction for high-density data views.
   * Defaults to false (constrained to max-w-7xl for standard editorial/form views).
   */
  fluid?: boolean
}

export function V2PageContainer({
  children,
  className = '',
  fluid = false,
}: V2PageContainerProps) {
  return (
    <div
      className={`w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 ${
        fluid ? 'max-w-full' : 'max-w-7xl'
      } ${className}`}
    >
      {children}
    </div>
  )
}
