import { type ReactNode, useEffect } from 'react'
import Navigation from './Navigation'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -80px 0px' }
    )

    document.querySelectorAll('.reveal, .reveal-left, .reveal-scale, .reveal-right').forEach((el) => {
      observer.observe(el)
    })

    return () => observer.disconnect()
  }, [])

  return (
    <div className="page">
      <a href="#pillars" className="skip-link">Skip to content</a>
      <Navigation />
      <main>
        {children}
      </main>
    </div>
  )
}
