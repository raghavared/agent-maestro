interface MediaPlaceholderProps {
  id: string
  description: string
  width?: number
  height?: number
  className?: string
}

export default function MediaPlaceholder({ id, description, width, height, className = '' }: MediaPlaceholderProps) {
  return (
    <div
      className={className}
      style={{
        background: `repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(255, 255, 255, 0.01) 8px, rgba(255, 255, 255, 0.01) 16px), var(--color-surface-2)`,
        border: '1px dashed rgba(255, 255, 255, 0.04)',
        borderRadius: 'inherit',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-text-muted)',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-xs)',
        textAlign: 'center' as const,
        padding: 'var(--space-6)',
        width: width ? `${width}px` : '100%',
        maxWidth: '100%',
        aspectRatio: width && height ? `${width}/${height}` : undefined,
      }}
      aria-hidden="true"
    >
      [{id}] {width && height ? `${width}\u00D7${height}` : description}
    </div>
  )
}
