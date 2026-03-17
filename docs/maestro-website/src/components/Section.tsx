import { type ReactNode } from 'react'

interface SectionProps {
  id: string
  eyebrow?: string
  title?: string
  description?: string
  children: ReactNode
  className?: string
  align?: 'left' | 'center'
  paddingTop?: string
  paddingBottom?: string
  fullWidth?: boolean
  background?: string
}

export default function Section({
  id,
  eyebrow,
  title,
  description,
  children,
  className = '',
  align = 'left',
  paddingTop,
  paddingBottom,
  fullWidth,
  background,
}: SectionProps) {
  return (
    <section
      id={id}
      className={`section ${className}`}
      style={{
        ...(paddingTop ? { paddingTop } : {}),
        ...(paddingBottom ? { paddingBottom } : {}),
        ...(background ? { background } : {}),
        position: 'relative',
      }}
      aria-label={title || id}
    >
      <div
        className="container"
        style={fullWidth ? { maxWidth: 'none' } : undefined}
      >
        {(eyebrow || title || description) && (
          <div className={`section-heading reveal ${align === 'center' ? 'section-heading-center' : 'section-heading-left'}`}>
            {eyebrow && <p className="section-eyebrow">{eyebrow}</p>}
            {title && <h2 className="section-title">{title}</h2>}
            {description && <p className="section-description">{description}</p>}
          </div>
        )}
        {children}
      </div>
    </section>
  )
}
