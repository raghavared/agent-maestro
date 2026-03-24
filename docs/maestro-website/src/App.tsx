import Layout from './components/Layout'
import HeroSection from './components/HeroSection'
import PillarsSection from './components/PillarsSection'
import CoordinationSection from './components/CoordinationSection'
import TasksSection from './components/TasksSection'
import TeamsSection from './components/TeamsSection'
import TerminalSection from './components/TerminalSection'
import GettingStartedSection from './components/GettingStartedSection'
import CTASection from './components/CTASection'
import Footer from './components/Footer'

export default function App() {
  return (
    <Layout>
      <HeroSection />
      <PillarsSection />
      <CoordinationSection />
      <TasksSection />
      <TeamsSection />
      <TerminalSection />
      <GettingStartedSection />
      <CTASection />
      <Footer />
    </Layout>
  )
}
