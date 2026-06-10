import { FOOTER_LINKS, BRAND } from '@/content/marketing';
import { BrandLogo } from './BrandLogo';

/** Minimal Apple-style footer. */
export function MarketingFooter() {
  return (
    <footer className="border-t border-white/40 glass-panel">
      <div className="mx-auto flex max-w-[980px] flex-col items-center gap-6 px-4 py-12 sm:flex-row sm:justify-between sm:px-6">
        <BrandLogo size="sm" />
        <nav className="flex flex-wrap items-center justify-center gap-6">
          {FOOTER_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-xs text-[#6e6e73] hover:text-[#1d1d1f] transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <p className="text-xs text-[#86868b]">
          &copy; {new Date().getFullYear()} {BRAND.name}
        </p>
      </div>
    </footer>
  );
}
