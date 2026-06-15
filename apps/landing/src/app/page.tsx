'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ShieldCheck, Coins, TrendingUp, Smartphone, ChevronDown,
  ChevronUp, Menu, X, ArrowRight, Building2, Lock,
  BarChart3, Globe, Zap, RefreshCw, MapPin,
} from 'lucide-react';
import { TENANT } from '@/lib/tenant.config';
import { HeroVisual } from '@/components/hero-visual';

// ── Types & fetchers ─────────────────────────────────────────────────────────

interface Snapshot {
  goldHeldOz: string;
  tokenSupply: string;
  backingRatio: string;
  goldPriceUsd: string;
  custodianName?: string;
  createdAt: string;
}

async function fetchSnapshot(): Promise<Snapshot> {
  const res = await fetch(`${TENANT.apiUrl}/reserve/snapshot/public`);
  if (!res.ok) throw new Error('reserve unavailable');
  return res.json();
}

async function fetchGhsRate(): Promise<number> {
  const res = await fetch('https://open.er-api.com/v6/latest/USD');
  if (!res.ok) throw new Error('rate unavailable');
  const data = await res.json();
  const rate = data?.rates?.GHS;
  if (typeof rate !== 'number') throw new Error('GHS rate not found');
  return rate;
}

function fmtUsd(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtNum(n: number, decimals = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ── Nav ──────────────────────────────────────────────────────────────────────

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    handler();
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const links = [
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Reserve', href: '#reserve' },
    { label: 'For Institutions', href: '#institutions' },
    { label: 'FAQs', href: '#faqs' },
  ];

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled || open
          ? 'bg-white/95 backdrop-blur-sm shadow-sm border-b border-gray-100'
          : 'bg-transparent'
      }`}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-sm select-none">A</span>
          </div>
          <span className={`font-bold text-lg tracking-tight ${scrolled || open ? 'text-gray-900' : 'text-white'}`}>
            {TENANT.name}
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-7">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`text-sm font-medium transition-colors hover:text-gold-500 ${
                scrolled ? 'text-gray-600' : 'text-white/80'
              }`}
            >
              {l.label}
            </a>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href={TENANT.investorPortalUrl}
            className={`text-sm font-medium transition-colors hover:text-gold-500 ${
              scrolled ? 'text-gray-600' : 'text-white/80'
            }`}
          >
            Sign In
          </Link>
          <Link
            href={`${TENANT.investorPortalUrl}/register`}
            className="rounded-full bg-gold-500 hover:bg-gold-400 text-white text-sm font-semibold px-5 py-2 transition-colors shadow-sm"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-1"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {open
            ? <X className="h-5 w-5 text-gray-900" />
            : <Menu className={`h-5 w-5 ${scrolled ? 'text-gray-900' : 'text-white'}`} />}
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 space-y-3">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block py-2 text-sm font-medium text-gray-700 hover:text-gold-600 transition-colors"
            >
              {l.label}
            </a>
          ))}
          <div className="flex flex-col gap-2.5 pt-3 border-t border-gray-100">
            <Link
              href={TENANT.investorPortalUrl}
              className="py-2 text-sm font-medium text-center text-gray-700 hover:text-gold-600"
            >
              Sign In
            </Link>
            <Link
              href={`${TENANT.investorPortalUrl}/register`}
              className="rounded-full bg-gold-500 text-white text-sm font-semibold text-center py-2.5 hover:bg-gold-400 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ ghsRate }: { ghsRate: number | null }) {
  const minLabel = `GH₵${TENANT.minimumGhs}`;

  return (
    <section className="relative min-h-screen bg-gray-950 flex flex-col items-center justify-center overflow-hidden pt-20">
      {/* Gradient blobs */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_60%_-10%,rgba(245,158,11,0.15),transparent)]" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-72 w-72 rounded-full bg-gold-500/5 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        {/* Badge */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-gold-500/30 bg-gold-500/10 px-4 py-1.5 text-sm text-gold-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          100% backed by physical gold
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-7xl font-bold text-white leading-[1.08] tracking-tight">
          Own real gold.
          <br />
          <span className="text-gold-400">No vault needed.</span>
        </h1>

        {/* Subheadline */}
        <p className="mt-7 text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
          Buy physical gold from{' '}
          <span className="text-white font-medium">{minLabel}</span>, backed by vault holdings
          at {TENANT.custodian.name} and verifiable on-chain. Pay with Mobile Money or card.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href={`${TENANT.investorPortalUrl}/register`}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-gold-500 hover:bg-gold-400 text-white font-semibold text-base px-8 py-3.5 transition-colors shadow-lg shadow-gold-500/20"
          >
            Buy Gold Tokens
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#institutions"
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-full border border-white/20 text-white hover:bg-white/10 font-medium text-base px-8 py-3.5 transition-colors"
          >
            For Institutions
          </a>
        </div>

        {/* Payment method row */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {TENANT.paymentMethods.map((m) => (
            <span key={m} className="flex items-center gap-1.5 text-sm text-gray-500">
              <span className="h-1 w-1 rounded-full bg-gold-500/60 shrink-0" />
              {m}
            </span>
          ))}
        </div>

        {/* Gold bars illustration */}
        <HeroVisual className="mx-auto mt-10 w-full max-w-xl opacity-95" />
      </div>

      {/* Scroll cue */}
      <a
        href="#how-it-works"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-gray-700 hover:text-gray-400 transition-colors animate-bounce"
        aria-label="Scroll down"
      >
        <ChevronDown className="h-6 w-6" />
      </a>
    </section>
  );
}

// ── How It Works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    {
      icon: <Smartphone className="h-7 w-7 text-gold-600" />,
      title: 'Pay with Mobile Money',
      description:
        'Buy gold directly with MTN Mobile Money, Telecel Cash, AirtelTigo Money, or a card — from GH₵15. No bank account, no stored balance: your payment goes straight to the vault.',
    },
    {
      icon: <Coins className="h-7 w-7 text-gold-600" />,
      title: 'Receive AUR tokens',
      description: `Gold is allocated in your name at ${TENANT.custodian.name}'s vault. AUR tokens land in a secure wallet created for you automatically — no crypto experience needed. 1 AUR = 1 troy oz.`,
    },
    {
      icon: <TrendingUp className="h-7 w-7 text-gold-600" />,
      title: 'Sell or redeem anytime',
      description:
        'Cash out via Mobile Money or bank transfer. Or redeem for physical gold bars — collect from the vault or have it delivered.',
    },
  ];

  return (
    <section id="how-it-works" className="py-28 bg-white">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-18">
          <p className="text-sm font-semibold text-gold-600 uppercase tracking-widest mb-3">Simple process</p>
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900">
            As simple as sending money
          </h2>
          <p className="mt-5 text-lg text-gray-500 max-w-xl mx-auto">
            Own gold in three steps — no broker, no minimum bar, no storage headache.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-10 md:grid-cols-3 mt-16">
          {steps.map((step, i) => (
            <div key={step.title} className="relative flex flex-col items-center text-center">
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-10 left-[calc(50%+3.5rem)] right-[-calc(50%-3.5rem)] h-px bg-gradient-to-r from-gold-200 via-gold-100 to-transparent" />
              )}

              <div className="relative mb-6">
                <div className="h-20 w-20 rounded-2xl bg-gold-50 flex items-center justify-center">
                  {step.icon}
                </div>
                <span className="absolute -top-3 -right-3 h-7 w-7 rounded-full bg-gold-500 text-white text-xs font-bold flex items-center justify-center shadow-md">
                  {i + 1}
                </span>
              </div>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">{step.title}</h3>
              <p className="text-gray-500 leading-relaxed text-sm max-w-xs">{step.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <Link
            href={`${TENANT.investorPortalUrl}/register`}
            className="inline-flex items-center gap-2 text-gold-600 font-medium hover:text-gold-700 transition-colors"
          >
            Create your account in minutes
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Live Reserve Widget ───────────────────────────────────────────────────────

function LiveReserve() {
  const { data: snapshot, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['landing-reserve'],
    queryFn: fetchSnapshot,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const ratio = snapshot ? parseFloat(snapshot.backingRatio) : null;
  const ratioStr = ratio ? (ratio * 100).toFixed(2) : null;
  const goldOz = snapshot ? parseFloat(snapshot.goldHeldOz) : null;
  const supply = snapshot ? parseFloat(snapshot.tokenSupply) : null;
  const goldValueUsd = snapshot && goldOz ? goldOz * parseFloat(snapshot.goldPriceUsd) : null;
  const healthy = ratio !== null && ratio >= 1;

  const lastUpdated = dataUpdatedAt
    ? new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(
        new Date(dataUpdatedAt),
      )
    : null;

  return (
    <section id="reserve" className="py-28 bg-gray-950">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-16">
          <div className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-green-400">
            <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            Live Proof of Reserve
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-white">
            Every token, fully backed
          </h2>
          <p className="mt-5 text-gray-400 max-w-lg mx-auto text-lg">
            Our reserve is publicly verifiable on-chain and audited by third parties.
            Here's the live status, updated every minute.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <RefreshCw className="h-8 w-8 text-gold-500 animate-spin" />
          </div>
        ) : snapshot ? (
          <>
            {/* Big ratio */}
            <div className="text-center mb-14">
              <p
                className="text-8xl sm:text-[9rem] font-bold tabular-nums leading-none"
                style={{ color: healthy ? '#10b981' : '#ef4444' }}
              >
                {ratioStr}%
              </p>
              <p className="mt-3 text-gray-500 text-sm">
                collateral ratio —{' '}
                <span className={healthy ? 'text-green-400' : 'text-red-400'}>
                  {healthy ? 'fully backed' : 'undercollateralized'}
                </span>
              </p>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-3xl mx-auto">
              {[
                {
                  label: 'Gold in vault',
                  value: goldOz ? `${fmtNum(goldOz)} oz` : '—',
                  sub: goldValueUsd ? `≈ ${fmtUsd(goldValueUsd)}` : undefined,
                },
                {
                  label: `${TENANT.ticker} in circulation`,
                  value: supply ? `${fmtNum(supply)} ${TENANT.ticker}` : '—',
                  sub: 'tokens issued',
                },
                {
                  label: 'Custodian',
                  value: snapshot.custodianName ?? TENANT.custodian.name,
                  sub: TENANT.custodian.jurisdiction,
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl border border-gray-800 bg-gray-900 px-6 py-5 text-center"
                >
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">{s.label}</p>
                  <p className="text-xl font-bold text-white">{s.value}</p>
                  {s.sub && <p className="text-xs text-gray-500 mt-1">{s.sub}</p>}
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col items-center gap-2.5">
              {lastUpdated && (
                <p className="text-xs text-gray-700">
                  Last updated: {lastUpdated}
                  {' ·'}
                  <button
                    className="ml-1 inline-flex items-center gap-1 text-gray-600 hover:text-gray-400 transition-colors"
                    onClick={() => window.location.reload()}
                  >
                    <RefreshCw className="h-2.5 w-2.5" /> refresh
                  </button>
                </p>
              )}
              <Link
                href={`${TENANT.investorPortalUrl}/reserve`}
                className="flex items-center gap-1.5 text-sm text-gold-500 hover:text-gold-400 transition-colors font-medium"
              >
                View full reserve report
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </>
        ) : (
          <p className="text-center text-gray-600 py-16 text-sm">Reserve data temporarily unavailable</p>
        )}
      </div>
    </section>
  );
}

// ── Why Tokenized Gold ────────────────────────────────────────────────────────

function WhyTokenizedGold({ ghsRate: _ghsRate }: { ghsRate: number | null }) {
  const minLabel = `GH₵${TENANT.minimumGhs}`;

  const benefits = [
    {
      icon: <Smartphone className="h-6 w-6 text-gold-600" />,
      title: `Buy from ${minLabel}`,
      description:
        'Fractional ownership means you don\'t need a whole bar. Start small, stack over time.',
    },
    {
      icon: <Lock className="h-6 w-6 text-gold-600" />,
      title: 'No storage risk',
      description: `Your gold lives in ${TENANT.custodian.name}'s insured vault. No home security risk, no hidden custody fees.`,
    },
    {
      icon: <Zap className="h-6 w-6 text-gold-600" />,
      title: 'Instant liquidity',
      description:
        'Sell anytime, 24/7. Payout via Mobile Money within 1–2 business days.',
    },
    {
      icon: <Globe className="h-6 w-6 text-gold-600" />,
      title: 'On-chain transparency',
      description:
        'Every token is backed by physical gold. The reserve is publicly verifiable — no trust required.',
    },
  ];

  return (
    <section className="py-28 bg-gray-50">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-gold-600 uppercase tracking-widest mb-3">Why {TENANT.name}?</p>
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900">
            All the benefits of gold.
            <br />
            None of the hassle.
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((b) => (
            <div
              key={b.title}
              className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gold-50">
                {b.icon}
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">{b.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{b.description}</p>
            </div>
          ))}
        </div>

        {/* Comparison callout */}
        <div className="mt-12 rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          <div className="grid grid-cols-3 text-sm">
            <div className="px-6 py-4 bg-gray-50 text-gray-500 font-medium" />
            <div className="px-6 py-4 text-center font-semibold text-gray-900 border-l border-gray-100">Physical gold</div>
            <div className="px-6 py-4 text-center font-semibold text-gold-700 border-l border-gold-100 bg-gold-50/50">
              {TENANT.ticker} tokens
            </div>
          </div>
          {[
            ['Minimum buy', 'Full bar (≥ 1g)', `From ${minLabel}`],
            ['Storage', 'Your problem', 'Insured vault included'],
            ['Liquidity', 'Days (broker required)', 'Instant, 24/7'],
            ['Transparency', 'Trust the dealer', 'On-chain, verifiable'],
            ['Pay via MoMo', '✗', '✓'],
          ].map(([label, trad, aur]) => (
            <div key={label} className="grid grid-cols-3 border-t border-gray-100 text-sm">
              <div className="px-6 py-3.5 text-gray-500">{label}</div>
              <div className="px-6 py-3.5 text-center text-gray-600 border-l border-gray-100">{trad}</div>
              <div className="px-6 py-3.5 text-center font-medium text-gold-700 border-l border-gold-100 bg-gold-50/50">{aur}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Security & Custody ────────────────────────────────────────────────────────

function SecurityCustody() {
  const pillars = [
    {
      icon: <Building2 className="h-5 w-5" />,
      title: 'Physical vault storage',
      description: `Gold is held in ${TENANT.custodian.name}'s secure vault in ${TENANT.custodian.jurisdiction}, with reserves designed for independent attestation.`,
    },
    {
      icon: <ShieldCheck className="h-5 w-5" />,
      title: 'Custodial protection',
      description:
        `Vault holdings are kept under ${TENANT.custodian.name}'s professional custody, subject to their security and insurance controls.`,
    },
    {
      icon: <BarChart3 className="h-5 w-5" />,
      title: 'On-chain proof',
      description:
        'Token supply is tracked on-chain. Anyone can verify the backing ratio at any time with no special access.',
    },
    {
      icon: <Lock className="h-5 w-5" />,
      title: 'Verifiable minting',
      description:
        `New ${TENANT.ticker} tokens can only be minted against verified gold reserves. The token contract is open for independent security audit ahead of mainnet launch.`,
    },
  ];

  return (
    <section className="py-28 bg-white">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-sm font-semibold text-gold-600 uppercase tracking-widest mb-4">Security & Custody</p>
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight">
              Built on trust,
              <br />
              <span className="text-gold-600">verified by code.</span>
            </h2>
            <p className="mt-6 text-lg text-gray-500 leading-relaxed">
              We partner with{' '}
              <span className="font-medium text-gray-900">{TENANT.custodian.name}</span>, a licensed
              gold custodian in {TENANT.custodian.jurisdiction}. Your gold is held in your name —
              if {TENANT.name} ceased to exist, you could redeem directly from the custodian.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Link
                href={`${TENANT.investorPortalUrl}/reserve`}
                className="inline-flex items-center gap-2 text-gold-600 font-medium hover:text-gold-700 transition-colors"
              >
                View live reserve
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {pillars.map((p) => (
              <div key={p.title} className="rounded-2xl border border-gray-100 bg-gray-50 p-5 hover:shadow-sm transition-shadow">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gold-100 text-gold-700">
                  {p.icon}
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">{p.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{p.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── For Institutions ──────────────────────────────────────────────────────────

function ForInstitutions() {
  const features = [
    'OTC desk for volumes above GH₵150,000',
    'RESTful API with webhook notifications (rolling out)',
    'Dedicated compliance officer',
    'Custom settlement timelines',
    'Priority KYC for entity onboarding',
    'Bulk physical gold redemption',
  ];

  return (
    <section id="institutions" className="py-28 bg-gold-50">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-gold-100 border border-gold-200 px-3.5 py-1.5 text-sm font-medium text-gold-800">
              <Building2 className="h-3.5 w-3.5" />
              Institutional Access
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight">
              For banks, funds,
              <br />
              and wealth managers.
            </h2>
            <p className="mt-6 text-lg text-gray-600 leading-relaxed">
              {TENANT.name} provides institutional-grade gold exposure — OTC pricing,
              full API integration, and a dedicated relationship manager to support your compliance team.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={TENANT.institutionalPortalUrl}
                className="inline-flex items-center gap-2 rounded-full bg-gray-900 hover:bg-gray-800 text-white font-semibold px-6 py-3 transition-colors"
              >
                Access institutional portal
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href={`mailto:${TENANT.social.email}`}
                className="inline-flex items-center gap-2 rounded-full border border-gray-300 hover:border-gray-400 text-gray-700 font-medium px-6 py-3 transition-colors"
              >
                Contact our desk
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {features.map((f) => (
              <div key={f} className="flex items-start gap-3 rounded-xl bg-white shadow-sm border border-gold-100 p-4">
                <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="h-3 w-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm text-gray-700">{f}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── FAQs ─────────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: 'What is AUR?',
    a: `AUR is a digital token representing one troy ounce of physical gold held in ${TENANT.custodian.name}'s vault in ${TENANT.custodian.jurisdiction}. Every token is fully backed 1:1 by physical gold before it is minted.`,
  },
  {
    q: 'How do I buy AUR tokens?',
    a: 'Sign up with your phone number, complete a quick identity check, then buy gold directly with MTN Mobile Money, Telecel Cash, AirtelTigo Money, or a card — from GH₵15. A secure wallet is created for you automatically, so no crypto experience is needed.',
  },
  {
    q: 'Can I get physical gold?',
    a: 'Yes. You can redeem your AUR tokens for physical gold bars in standard denominations (1g, 5g, 10g, 1oz, and others). Either collect from the vault in person or have it delivered to your address in Ghana.',
  },
  {
    q: `What happens to my gold if ${TENANT.name} shuts down?`,
    a: `Your gold is held in your name at ${TENANT.custodian.name}, not by ${TENANT.name}. Even if ${TENANT.name} ceased operations, your physical gold would remain yours and you could redeem it directly from the custodian.`,
  },
  {
    q: 'Is there a minimum investment?',
    a: `The minimum buy order is GH₵${TENANT.minimumGhs}. There is no maximum. You do not need to buy a full ounce — you can own a fraction.`,
  },
  {
    q: 'How is my ownership proven?',
    a: `You receive AUR tokens on-chain (a low-cost, Ethereum-compatible network). The wallet created for you at sign-up is fully yours — it's your certificate of ownership, and ${TENANT.name} never holds your tokens or your keys. The reserve backing every token is publicly verifiable on-chain, so no trust in ${TENANT.name} is required.`,
  },
];

function FAQs() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section id="faqs" className="py-28 bg-white">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-gold-600 uppercase tracking-widest mb-3">FAQs</p>
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900">
            Frequently asked questions
          </h2>
        </div>

        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <div key={i} className="rounded-xl border border-gray-100 overflow-hidden">
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="font-medium text-gray-900 pr-4">{faq.q}</span>
                {openIdx === i ? (
                  <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                )}
              </button>
              {openIdx === i && (
                <div className="px-5 pb-5 text-sm text-gray-500 leading-relaxed border-t border-gray-50">
                  <p className="pt-3">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="mt-12 text-center text-sm text-gray-400">
          More questions?{' '}
          <a href={`mailto:${TENANT.social.email}`} className="text-gold-600 hover:underline">
            Email us at {TENANT.social.email}
          </a>
        </p>
      </div>
    </section>
  );
}

// ── CTA Banner ────────────────────────────────────────────────────────────────

function CTABanner({ ghsRate: _ghsRate }: { ghsRate: number | null }) {
  const minLabel = `GH₵${TENANT.minimumGhs}`;
  return (
    <section className="py-24 bg-gray-950">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-4xl sm:text-5xl font-bold text-white leading-tight">
          Start owning gold today.
        </h2>
        <p className="mt-5 text-lg text-gray-400">
          Join thousands of Ghanaians protecting their wealth with real gold — from {minLabel}.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href={`${TENANT.investorPortalUrl}/register`}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-gold-500 hover:bg-gold-400 text-white font-semibold text-base px-8 py-3.5 transition-colors shadow-lg shadow-gold-500/20"
          >
            Create free account
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href={TENANT.investorPortalUrl}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-full border border-white/20 text-white hover:bg-white/10 font-medium text-base px-8 py-3.5 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="bg-gray-950 border-t border-gray-900 text-gray-400">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4 mb-14">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm select-none">A</span>
              </div>
              <span className="font-bold text-white">{TENANT.name}</span>
            </Link>
            <p className="text-sm leading-relaxed text-gray-500">{TENANT.tagline}</p>
            <div className="mt-5 flex items-center gap-1.5 text-xs text-gray-600">
              <MapPin className="h-3 w-3" />
              Custodian: {TENANT.custodian.name}, {TENANT.custodian.jurisdiction}
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-5">Product</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href={`${TENANT.investorPortalUrl}/register`} className="hover:text-white transition-colors">
                  Get Started
                </Link>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
              </li>
              <li>
                <a href="#reserve" className="hover:text-white transition-colors">Proof of Reserve</a>
              </li>
              <li>
                <a href="#faqs" className="hover:text-white transition-colors">FAQs</a>
              </li>
            </ul>
          </div>

          {/* Portals */}
          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-5">Portals</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href={TENANT.investorPortalUrl} className="hover:text-white transition-colors">
                  Investor Portal
                </Link>
              </li>
              <li>
                <Link href={TENANT.institutionalPortalUrl} className="hover:text-white transition-colors">
                  Institutional Portal
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-5">Contact</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a href={`mailto:${TENANT.social.email}`} className="hover:text-white transition-colors">
                  {TENANT.social.email}
                </a>
              </li>
              <li>
                <a href={TENANT.social.telegram} className="hover:text-white transition-colors">Telegram</a>
              </li>
              <li>
                <a href={TENANT.social.twitter} className="hover:text-white transition-colors">Twitter / X</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800/80 pt-8 flex flex-col sm:flex-row justify-between gap-4 text-xs text-gray-600">
          <p>© {new Date().getFullYear()} {TENANT.name}. All rights reserved.</p>
          <p className="sm:max-w-md sm:text-right leading-relaxed">
            {TENANT.ticker} tokens are backed by physical gold held by {TENANT.custodian.name}.
            Investing in digital assets carries risk. Past performance does not guarantee future results.
            Not financial advice.
          </p>
        </div>
      </div>
    </footer>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const { data: ghsRate } = useQuery({
    queryKey: ['ghs-rate'],
    queryFn: fetchGhsRate,
    staleTime: 6 * 60 * 60 * 1000,
    retry: 1,
  });

  const rate = ghsRate ?? null;

  return (
    <>
      <Nav />
      <main>
        <Hero ghsRate={rate} />
        <HowItWorks />
        <LiveReserve />
        <WhyTokenizedGold ghsRate={rate} />
        <SecurityCustody />
        <ForInstitutions />
        <FAQs />
        <CTABanner ghsRate={rate} />
      </main>
      <Footer />
    </>
  );
}
