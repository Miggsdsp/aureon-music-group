import Image from 'next/image';
import Link from 'next/link';
import { Headphones, Instagram, Mail, Music2, Radio, Youtube } from 'lucide-react';

export function Footer() {
  return (
    <footer className="aureon-footer">
      <div className="aureon-footer-grid">
        <section className="aureon-footer-panel">
          <div className="aureon-footer-icon"><Radio size={21} /></div>
          <div>
            <p className="aureon-footer-kicker">Our Mission</p>
            <p>Elevating music. Empowering artists. Creating legacies that inspire generations.</p>
            <Link href="/about">Learn more →</Link>
          </div>
        </section>

        <section className="aureon-footer-panel aureon-release-panel">
          <div className="aureon-footer-icon"><Music2 size={21} /></div>
          <div>
            <p className="aureon-footer-kicker">Latest Release</p>
            <div className="aureon-release-content">
              <Image
                src="/images/solara-alive.jpg"
                alt="Solara Alive"
                width={86}
                height={86}
                unoptimized
              />
              <div>
                <strong>SOLARA</strong>
                <span>Alive</span>
                <Link href="/music">Listen now →</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="aureon-footer-panel">
          <div className="aureon-footer-icon"><Mail size={21} /></div>
          <div>
            <p className="aureon-footer-kicker">Join The Journey</p>
            <p>Be the first to hear about new music, artists and exclusive content.</p>
            <Link href="/contact">Sign up →</Link>
          </div>
        </section>

        <section className="aureon-footer-panel">
          <div className="aureon-footer-icon"><Headphones size={21} /></div>
          <div>
            <p className="aureon-footer-kicker">Follow Us</p>
            <div className="aureon-social-links" aria-label="Aureon social media">
              <a href="#" aria-label="Spotify">Spotify</a>
              <a href="#" aria-label="YouTube"><Youtube size={18} /></a>
              <a href="#" aria-label="Instagram"><Instagram size={18} /></a>
              <a href="#" aria-label="TikTok">TikTok</a>
              <a href="#" aria-label="Apple Music">Apple</a>
            </div>
          </div>
        </section>
      </div>

      <div className="aureon-footer-bottom">
        <p>© 2026 Aureon Music Group. All rights reserved.</p>
        <nav aria-label="Footer links">
          <Link href="/artists">Artists</Link>
          <Link href="/music">Music</Link>
          <Link href="/videos">Videos</Link>
          <Link href="/contact">Contact</Link>
        </nav>
      </div>
    </footer>
  );
}
