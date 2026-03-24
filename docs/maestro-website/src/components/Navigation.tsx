import { useState, useEffect, useCallback } from 'react'

const navItems = [
  { id: 'overview', label: 'Overview' },
  { id: 'pillars', label: 'Pillars' },
  { id: 'coordination', label: 'Coordination' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'teams', label: 'Teams' },
  { id: 'terminal', label: 'Terminal' },
]

export default function Navigation() {
  const [scrolled, setScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState('overview')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const sections = navItems.map(item => document.getElementById(item.id)).filter(Boolean) as HTMLElement[]
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        })
      },
      { threshold: 0.3 }
    )
    sections.forEach(section => observer.observe(section))
    return () => observer.disconnect()
  }, [])

  const handleNavClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault()
    setMenuOpen(false)
    const el = document.getElementById(id)
    if (el) {
      const top = el.offsetTop - 56
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }, [])

  return (
    <nav className={`nav${scrolled ? ' nav-scrolled' : ''}`} aria-label="Main navigation">
      <a href="#overview" className="nav-logo" onClick={(e) => handleNavClick(e, 'overview')}>
        <span className="nav-logomark" aria-hidden="true">M</span>
        Maestro
      </a>

      <ul className={`nav-links${menuOpen ? ' open' : ''}`}>
        {navItems.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={`nav-link${activeSection === item.id ? ' active' : ''}`}
              onClick={(e) => handleNavClick(e, item.id)}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>

      <div className="nav-right">
        <a
          href="#get-started"
          className={`${scrolled ? 'btn-primary' : 'btn-ghost'} nav-cta${menuOpen ? '' : ' mobile-hidden'}`}
          onClick={(e) => handleNavClick(e, 'get-started')}
        >
          Get Started
        </a>
        <button
          className={`nav-hamburger${menuOpen ? ' open' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </nav>
  )
}
