import Link from 'next/link';
import { Disc3, Globe2, Headphones, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { EditablePageText } from '@/components/EditablePageText';

const pillars = [
  {
    icon: Sparkles,
    title: 'Excellence',
    text: 'We pursue the highest standards in songwriting, production, branding and presentation.',
  },
  {
    icon: Users,
    title: 'Authenticity',
    text: 'Every project is built around genuine artistic identity rather than short-term trends.',
  },
  {
    icon: Disc3,
    title: 'Legacy',
    text: 'Our ambition is to create music people will still be listening to decades from now.',
  },
  {
    icon: ShieldCheck,
    title: 'Quality Without Compromise',
    text: 'Every release reflects our commitment to professional production, creative excellence and lasting artistic value.',
  },
];

const services = [
  ['01', 'Artist Development', 'Developing distinctive talent, authentic identities and lasting creative careers.'],
  ['02', 'Music Production', 'Creating original music with professional production and long-term commercial value.'],
  ['03', 'Global Distribution', 'Connecting releases with audiences through digital platforms around the world.'],
  ['04', 'Streaming & Membership', 'Delivering premium listening, playlists, videos and member experiences.'],
  ['05', 'Creator Licensing', 'Providing clear music licensing for creators, podcasts and modern digital media.'],
  ['06', 'Commercial Licensing', 'Supporting businesses, brands and commercial partners with transparent music licensing.'],
  ['07', 'Merchandise & Media', 'Extending music through merchandise, music videos, editorial content and news.'],
  ['08', 'Rights Management', 'Protecting catalogues, intellectual property and the long-term value of every release.'],
];

export default function AboutPage() {
  return (
    <main className="page-shell about-page">
      <Header />

      <section className="about-hero about-hero-clean">
        <div className="about-hero-copy">
          <EditablePageText
            slug="about"
            field="companyKicker"
            fallback="About Aureon Music Group"
            as="p"
            className="eyebrow"
          />
          <EditablePageText
            slug="about"
            field="companyTitle"
            fallback="Creating Tomorrow’s Classics"
            as="h1"
          />
          <EditablePageText
            slug="about"
            field="companyIntroduction"
            fallback="Aureon Music Group is a premium independent music company dedicated to discovering, developing, producing and distributing original music for audiences around the world."
            as="p"
          />
          <div className="about-hero-actions">
            <Link href="/music" className="primary-button">Explore the music →</Link>
            <Link href="/membership" className="ghost-button">Discover membership →</Link>
          </div>
        </div>
      </section>

      <section className="about-story-section">
        <div className="about-section-label">
          <p className="eyebrow">Who We Are</p>
          <span>Music, technology and creativity working together.</span>
        </div>
        <div className="about-story-copy">
          <EditablePageText
            slug="about"
            field="companyBeliefTitle"
            fallback="Built on the belief that truly great music never goes out of style."
            as="h2"
          />
          <EditablePageText
            slug="about"
            field="companyBelief"
            fallback="Aureon combines exceptional artistry, world-class production and innovative technology to create a catalogue designed to inspire listeners for generations to come."
            as="p"
          />
          <EditablePageText
            slug="about"
            field="companyEcosystem"
            fallback="Through artist development, digital distribution, streaming, commercial licensing and premium memberships, Aureon provides a complete music ecosystem where creativity and quality come first."
            as="p"
          />
        </div>
      </section>

      <section className="about-mission-section">
        <div className="about-mission-card">
          <Headphones size={34} />
          <p className="eyebrow">Our Mission</p>
          <EditablePageText
            slug="about"
            field="companyMissionTitle"
            fallback="Create timeless music that connects people across cultures."
            as="h2"
          />
          <EditablePageText
            slug="about"
            field="companyMission"
            fallback="To create timeless music that connects people across cultures, inspires emotion and empowers artists to build lasting careers while delivering exceptional experiences for listeners, creators and commercial partners."
            as="p"
          />
        </div>
        <div className="about-mission-card">
          <Globe2 size={34} />
          <p className="eyebrow">Our Vision</p>
          <EditablePageText
            slug="about"
            field="companyVisionTitle"
            fallback="Build one of the world’s most respected independent music companies."
            as="h2"
          />
          <EditablePageText
            slug="about"
            field="companyVision"
            fallback="To become one of the world’s most respected independent music companies by building a catalogue of iconic songs, developing extraordinary talent and creating a premium destination where music, technology and creativity work together."
            as="p"
          />
        </div>
      </section>

      <section className="about-journey-section">
        <div className="about-section-heading">
          <p className="eyebrow">What We Do</p>
          <h2>A complete modern music company</h2>
          <p>Aureon Music Group brings together every stage of the music journey under one premium platform. Every release is professionally developed with a focus on originality, quality and long-term commercial value.</p>
        </div>
        <div className="about-journey-grid">
          {services.map(([number, title, text]) => (
            <article key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-pillars-section">
        <div className="about-section-heading">
          <p className="eyebrow">Our Philosophy</p>
          <h2>Great music is not created by following trends.</h2>
          <p>It is created by authentic artists telling meaningful stories through unforgettable songs. Everything we release is guided by the principles below.</p>
        </div>
        <div className="about-pillars-grid">
          {pillars.map(({ icon: Icon, title, text }) => (
            <article key={title}>
              <Icon size={28} />
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-story-section">
        <div className="about-section-label">
          <p className="eyebrow">Our Platform</p>
          <span>More than a music label.</span>
        </div>
        <div className="about-story-copy">
          <EditablePageText
            slug="about"
            field="platformTitle"
            fallback="A premium digital ecosystem for listeners, creators and commercial partners."
            as="h2"
          />
          <EditablePageText
            slug="about"
            field="platformMembers"
            fallback="Members can discover new music, build playlists, watch exclusive videos, explore artist content and enjoy premium listening experiences."
            as="p"
          />
          <EditablePageText
            slug="about"
            field="platformLicensing"
            fallback="Creators and businesses can license music confidently through a transparent commercial licensing platform designed for modern media."
            as="p"
          />
        </div>
      </section>

      <section className="about-mission-section">
        <div className="about-mission-card">
          <ShieldCheck size={34} />
          <p className="eyebrow">Quality Without Compromise</p>
          <EditablePageText
            slug="about"
            field="qualityTitle"
            fallback="Professional production. Creative excellence. Lasting artistic value."
            as="h2"
          />
          <EditablePageText
            slug="about"
            field="qualityText"
            fallback="Every release published under Aureon Music Group reflects our commitment to professional production, creative excellence and lasting artistic value. We believe listeners deserve music created with passion, precision and purpose—not disposable content."
            as="p"
          />
        </div>
        <div className="about-mission-card">
          <Sparkles size={34} />
          <p className="eyebrow">The Future of Aureon</p>
          <EditablePageText
            slug="about"
            field="futureTitle"
            fallback="We are not simply building another music platform."
            as="h2"
          />
          <EditablePageText
            slug="about"
            field="futureText"
            fallback="We are building a home for exceptional artists, unforgettable music and innovative technology that connects creators, businesses and listeners through one premium ecosystem."
            as="p"
          />
        </div>
      </section>

      <section className="about-final-cta">
        <div>
          <p className="eyebrow">Aureon Music Group</p>
          <EditablePageText
            slug="about"
            field="companyClosing"
            fallback="Every song. Every artist. Every release. Built to become tomorrow’s classics."
            as="h2"
          />
        </div>
        <div>
          <Link href="/music" className="primary-button">Explore the catalogue →</Link>
          <Link href="/contact" className="ghost-button">Contact Aureon →</Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
