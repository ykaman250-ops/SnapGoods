import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, Shield, Search, BarChart, Users, AlertCircle, 
  Check, Laptop, Server, ArrowRightCircle, Box, Clock,
  Building2, Command, Figma, Github, Slack, Trello, Twitch, 
  Star, ChevronDown, ChevronLeft, ChevronRight, Activity, Database, Zap, Sparkles, Cpu, Loader2, RefreshCw, UserCheck
} from 'lucide-react';
import { Logo } from '../components/Logo';
import { AbstractLogoStrip } from '../components/AbstractLogos';

// --- API Helpers ---
import { GoogleGenAI, Type } from "@google/genai";

// --- Animation Components ---
export const FadeIn = ({ children, delay = 0, className = "", direction = "up" }: any) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (ref.current) observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1, rootMargin: "50px" }
    );
    
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const translateClass = direction === "up" ? "translate-y-8" : direction === "down" ? "-translate-y-8" : direction === "left" ? "translate-x-8" : "-translate-x-8";

  return (
    <div 
      ref={ref} 
      className={`transition-all duration-1000 ease-out ${isVisible ? 'opacity-100 translate-y-0 translate-x-0' : `opacity-0 ${translateClass}`} ${className}`} 
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

const FAQItem = ({ question, answer }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border border-[#e5e5e5] rounded-xl mb-4 bg-white overflow-hidden transition-all duration-300 hover:border-[#c5a059]/30">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full px-6 py-4 flex items-center justify-between font-medium text-[#1f1f1f] focus:outline-none"
      >
        <span className="text-left">{question}</span>
        <ChevronDown className={`w-5 h-5 text-[#737373] transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#c5a059]' : ''}`} />
      </button>
      <div 
        className={`px-6 transition-all duration-300 ease-in-out text-[#737373] text-sm overflow-hidden ${isOpen ? 'max-h-48 pb-4 opacity-100' : 'max-h-0 opacity-0'}`}
      >
        {answer}
      </div>
    </div>
  );
};

export default function Landing() {
  const navigate = useNavigate();
  // --- AI Demo State ---
  const [aiInput, setAiInput] = useState("Just bought 3 new MacBook Pro M3s (32GB RAM, 1TB SSD) for the new engineering hires: Sarah, Michael, and David. Oh, and grabbed a Dell 32-inch 4K monitor for the lobby display.");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedAssets, setExtractedAssets] = useState<any[] | null>(null);
  const [aiError, setAiError] = useState("");

  // --- Scroll State for Cards ---
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDown = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    isDown.current = true;
    scrollRef.current.classList.add('cursor-grabbing');
    scrollRef.current.classList.remove('snap-x', 'snap-mandatory');
    startX.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeft.current = scrollRef.current.scrollLeft;
  };

  const handleMouseLeave = () => {
    isDown.current = false;
    if (scrollRef.current) {
      scrollRef.current.classList.remove('cursor-grabbing');
      scrollRef.current.classList.add('snap-x', 'snap-mandatory');
    }
  };

  const handleMouseUp = () => {
    isDown.current = false;
    if (scrollRef.current) {
      scrollRef.current.classList.remove('cursor-grabbing');
      scrollRef.current.classList.add('snap-x', 'snap-mandatory');
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDown.current || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX.current) * 2;
    scrollRef.current.scrollLeft = scrollLeft.current - walk;
  };

  const scrollCards = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 400; // Approximating card width + gap
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const handleAIExtract = async () => {
    if (!aiInput.trim()) return;
    setIsExtracting(true);
    setAiError("");
    setExtractedAssets(null);
    
    try {
      if (aiInput.length > 2000) {
        throw new Error("Input text exceeds maximum length of 2000 characters.");
      }

      const response = await fetch('/api/extract-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiInput })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "AI extraction is currently under maintenance. Please try again later.");
      }

      const data = await response.json();
      
      if (Array.isArray(data.assets)) {
        setExtractedAssets(data.assets);
      } else {
        throw new Error("Invalid format returned from server");
      }
    } catch (err: any) {
      console.error("AI Extraction Error:", err);
      setAiError(err.message || "Oops! Our AI couldn't parse that. Try tweaking the text.");
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div 
      className="min-h-screen text-[#1f1f1f] font-sans selection:bg-[#c5a059]/20 relative overflow-x-hidden bg-texture-light"
      style={{ colorScheme: 'light' }}
    >
      {/* Inject custom background, fonts and animation keyframes */}
      <style dangerouslySetInnerHTML={{__html: `
        body {
          background-color: #fdfbf7;
        }
        .bg-texture-light {
          background-color: #fdfbf7;
          background-image: url("data:image/svg+xml,%3Csvg width='80' height='138.56' viewBox='0 0 80 138.56' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M40 0L80 23.09v46.19L40 92.38 0 69.28V23.09Zm0 138.56L80 115.47V69.28L40 46.19 0 69.28v46.19z' fill='none' stroke='%23c5a059' stroke-width='1' stroke-opacity='0.15' /%3E%3C/svg%3E");
          background-attachment: fixed;
        }
        .bg-texture-dark {
          background-color: #1f1f1f;
          background-image: url("data:image/svg+xml,%3Csvg width='80' height='138.56' viewBox='0 0 80 138.56' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M40 0L80 23.09v46.19L40 92.38 0 69.28V23.09Zm0 138.56L80 115.47V69.28L40 46.19 0 69.28v46.19z' fill='none' stroke='%23c5a059' stroke-width='1' stroke-opacity='0.08' /%3E%3C/svg%3E");
          background-attachment: fixed;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-blob { animation: blob 10s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
      `}} />

      {/* 1. Navbar */}
      <nav className="sticky top-0 z-50 w-full border-b border-[#e5e5e5] bg-[#fdfbf7]/80 backdrop-blur-md transition-all">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center hover:opacity-80 transition-opacity cursor-pointer">
            <Logo variant="full" forceLight={true} className="h-[31.5px] w-auto md:h-[35.7px]" />
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[#737373]">
            <a href="#features" className="hover:text-[#1f1f1f] transition-colors">Features</a>
            <a href="#ai-demo" className="hover:text-[#c5a059] flex items-center gap-1 transition-colors"><Sparkles className="w-3.5 h-3.5" /> AI Demo</a>
            <a href="#how-it-works" className="hover:text-[#1f1f1f] transition-colors">How it Works</a>
            <a href="#pricing" className="hover:text-[#1f1f1f] transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <button 
              onClick={() => navigate('/login?view=signin')}
              className="text-sm font-medium hover:text-[#1f1f1f] text-[#737373] transition-colors"
            >
              Log in
            </button>
            <button 
              onClick={() => navigate('/login?view=signup')}
              className="bg-[#1f1f1f] text-[#fdfbf7] px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-sm font-medium hover:bg-[#1f1f1f]/90 transition-all shadow-[0_4px_14px_0_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)] hover:-translate-y-0.5"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* 2. Hero Section */}
      <section className="relative pt-16 sm:pt-24 pb-20 sm:pb-32 overflow-hidden">
        {/* Animated Background Blobs & Big Logo */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-60">
          {/* Big Logo Design Element */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[10%] lg:translate-x-[5%] opacity-[0.25] transform -rotate-[15deg] scale-[1.3] lg:scale-[1.6] origin-center">
            <Logo variant="icon" forceLight={true} className="w-[346px] h-[346px] lg:w-[462px] lg:h-[462px]" />
          </div>
          
          <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-[#c5a059]/30 rounded-full filter blur-3xl animate-blob opacity-40"></div>
          <div className="absolute top-[20%] right-[-10%] w-96 h-96 bg-[#e5e5e5] rounded-full filter blur-3xl animate-blob animation-delay-2000 opacity-40"></div>
          <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-[#c5a059]/15 rounded-full filter blur-3xl animate-blob animation-delay-4000 opacity-40"></div>
        </div>

        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="max-w-2xl relative z-10">
            <FadeIn delay={100}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/50 backdrop-blur-sm border border-[#c5a059]/30 text-xs sm:text-sm font-medium mb-4 sm:mb-6 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c5a059] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#c5a059]"></span>
                </span>
                Asset Management 2.0
              </div>
            </FadeIn>
            
            <FadeIn delay={200}>
              <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold tracking-tight text-[#1f1f1f] leading-[1.1] mb-4 sm:mb-6">
                Asset Management,<br />
                Reimagined for <span className="relative inline-block whitespace-nowrap">
                  Modern Teams
                  <span className="absolute bottom-1 left-0 w-full h-3 bg-[#c5a059]/20 -z-10 rounded-sm transform -rotate-1"></span>
                </span>
              </h1>
            </FadeIn>

            <FadeIn delay={300}>
              <p className="text-base sm:text-lg text-[#737373] leading-relaxed mb-6 sm:mb-8 max-w-xl">
                Track, assign, and manage every asset with precision. Eliminate hardware losses, streamline audits, and scale your operations effortlessly with AI-powered data entry.
              </p>
            </FadeIn>

            <FadeIn delay={400}>
              <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
                <button 
                  onClick={() => navigate('/login?view=signup')}
                  className="group w-full sm:w-auto bg-[#1f1f1f] text-[#fdfbf7] px-6 py-3.5 rounded-xl text-base font-medium hover:bg-[#1f1f1f]/90 transition-all flex items-center justify-center gap-2 shadow-[0_4px_14px_0_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)] hover:-translate-y-0.5"
                >
                  Get Started Free
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
                <button className="w-full sm:w-auto bg-white/50 backdrop-blur-sm text-[#1f1f1f] border border-[#e5e5e5] px-6 py-3.5 rounded-xl text-base font-medium hover:bg-white hover:border-[#c5a059]/50 transition-all flex items-center justify-center shadow-sm hover:-translate-y-0.5">
                  Book a Demo
                </button>
              </div>
            </FadeIn>

            <FadeIn delay={500}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 text-sm text-[#737373]">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-[#c5a059]/10 flex items-center justify-center">
                    <Check className="w-3 h-3 text-[#c5a059]" />
                  </div>
                  No credit card required
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-[#c5a059]/10 flex items-center justify-center">
                    <Check className="w-3 h-3 text-[#c5a059]" />
                  </div>
                  Setup in under 5 minutes
                </div>
              </div>
            </FadeIn>
          </div>

          {/* Hero UI Preview (Animated) */}
          <FadeIn delay={400} direction="left">
            <div className="relative z-10 w-full animate-float">
              {/* Decorative elements behind card */}
              <div className="absolute -inset-1 bg-gradient-to-r from-[#c5a059]/20 to-transparent rounded-2xl blur-xl opacity-50"></div>
              
              <div className="relative rounded-2xl border border-[#e5e5e5] bg-white/60 backdrop-blur-xl shadow-2xl p-5 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#c5a059] to-transparent opacity-40"></div>
                
                {/* Header */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#e5e5e5]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1f1f1f] to-[#404040] flex items-center justify-center text-white font-medium text-sm shadow-inner">JS</div>
                    <div>
                      <div className="text-sm font-semibold text-[#1f1f1f]">Command Center</div>
                      <div className="text-xs text-[#737373] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Live Updates
                      </div>
                    </div>
                  </div>
                  <div className="px-3 py-1.5 bg-[#f5f5f5] rounded-md border border-[#e5e5e5] text-xs font-medium flex items-center gap-2 text-[#737373] shadow-sm">
                    <Search className="w-3 h-3" />
                    Find any asset...
                  </div>
                </div>

                {/* List */}
                <div className="space-y-3">
                  {[
                    { name: "MacBook Pro M3 Max", id: "AST-9021", user: "Sarah Jenkins", role: "Engineering", status: "Active", icon: Laptop },
                    { name: "Dell UltraSharp 32\"", id: "AST-8842", user: "Michael Chen", role: "Design", status: "Active", icon: Laptop },
                    { name: "AWS Prod Database", id: "AST-0199", user: "Ops Team", role: "Infrastructure", status: "Maintenance", icon: Database },
                    { name: "iPhone 15 Pro", id: "AST-3321", user: "Emma Davis", role: "Sales", status: "Pending", icon: AlertCircle },
                  ].map((item, i) => (
                    <div key={i} className="group flex items-center justify-between p-3 rounded-lg border border-[#e5e5e5] bg-[#fdfbf7]/50 hover:bg-white hover:border-[#c5a059]/30 hover:shadow-sm transition-all cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-md bg-white border border-[#e5e5e5] group-hover:border-[#c5a059]/20 transition-colors shadow-sm">
                          <item.icon className="w-4 h-4 text-[#737373] group-hover:text-[#c5a059] transition-colors" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-[#1f1f1f] group-hover:text-[#c5a059] transition-colors">{item.name}</div>
                          <div className="text-[11px] text-[#737373]">{item.id} • {item.user} ({item.role})</div>
                        </div>
                      </div>
                      <div className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-semibold border ${
                        item.status === 'Active' ? 'bg-[#c5a059]/10 text-[#826330] border-[#c5a059]/20' : 
                        item.status === 'Maintenance' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                        'bg-[#f5f5f5] text-[#737373] border-[#e5e5e5]'
                      }`}>
                        {item.status}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* 2.5 Trusted By Section (Social Proof) */}
      <AbstractLogoStrip />

      {/* 3. Problem Section */}
      <section className="py-24 bg-transparent relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <FadeIn>
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#1f1f1f] mb-4">Your Assets Are Slipping Through the Cracks</h2>
              <p className="text-[#737373] text-lg">Without a dedicated system, scaling a team turns asset management into a constant game of catch-up and financial leaks.</p>
            </div>
          </FadeIn>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: "Assets go missing", desc: "Hardware is lost during offboarding or desk moves, costing thousands annually.", icon: AlertCircle },
              { title: "No ownership clarity", desc: "No one knows who currently holds which device or expensive software license.", icon: Users },
              { title: "Audit chaos", desc: "Compliance audits become a nightmare of manual verification and missing data.", icon: Shield },
              { title: "Spreadsheet rot", desc: "Static spreadsheet data becomes outdated the moment it's entered by HR.", icon: Database }
            ].map((prob, i) => (
              <FadeIn key={i} delay={i * 100}>
                <div className="bg-texture-light border border-[#e5e5e5] p-6 rounded-2xl hover:border-[#c5a059]/40 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 h-full relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="relative z-10 w-12 h-12 rounded-xl bg-white/80 backdrop-blur-sm border border-[#e5e5e5] flex items-center justify-center mb-5 shadow-sm">
                    <prob.icon className="w-6 h-6 text-[#737373]" />
                  </div>
                  <h3 className="font-semibold text-[#1f1f1f] mb-3 text-lg">{prob.title}</h3>
                  <p className="text-sm text-[#737373] leading-relaxed">{prob.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Solution & Features Grid */}
      <section id="features" className="py-32 bg-transparent border-y border-[#e5e5e5] relative overflow-hidden">
        {/* Subtle decorative background line */}
        <div className="absolute top-0 left-1/2 w-px h-full bg-gradient-to-b from-transparent via-[#c5a059]/20 to-transparent -translate-x-1/2 hidden lg:block"></div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <FadeIn>
            <div className="text-center max-w-2xl mx-auto mb-20">
              <div className="text-[#c5a059] font-semibold text-sm mb-3 uppercase tracking-wider">The Solution</div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-[#1f1f1f] mb-6">A System Built for Control and Clarity</h2>
              <p className="text-[#737373] text-lg leading-relaxed">Centralized registry, full lifecycle tracking, and real-time visibility from a single, elegant pane of glass.</p>
            </div>
          </FadeIn>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-16">
            {[
              { icon: Box, title: "Asset Tracking", desc: "Track every asset with structured data, custom categories, and automatically generated unique IDs." },
              { icon: Users, title: "Employee Assignment", desc: "Assign ownership with one click, complete with tamper-proof historical logs and acceptance workflows." },
              { icon: Clock, title: "Lifecycle Management", desc: "Track the entire journey from procurement, to active usage, maintenance, and safe disposal." },
              { icon: BarChart, title: "Audit & Reporting", desc: "Generate flawless, audit-ready reports instantly for finance, compliance, and leadership teams." },
              { icon: Shield, title: "Role-Based Access", desc: "Granular permissions ensure Admin, HR, and external auditors see exactly and only what they need to." },
              { icon: Zap, title: "Automated Alerts", desc: "Get proactively notified before warranties expire, licenses renew, or routine maintenance is due." }
            ].map((feat, i) => (
              <FadeIn key={i} delay={i * 100}>
                <div className="group cursor-default relative">
                  {/* Hover effect background */}
                  <div className="absolute -inset-4 bg-[#fdfbf7] rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 border border-[#e5e5e5]/50"></div>
                  
                  <div className="w-14 h-14 rounded-2xl bg-[#fdfbf7] border border-[#e5e5e5] flex items-center justify-center mb-6 group-hover:bg-[#c5a059]/10 group-hover:border-[#c5a059]/30 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-sm">
                    <feat.icon className="w-7 h-7 text-[#1f1f1f] group-hover:text-[#c5a059] transition-colors" />
                  </div>
                  <h3 className="text-xl font-semibold text-[#1f1f1f] mb-3 group-hover:text-[#c5a059] transition-colors">{feat.title}</h3>
                  <p className="text-[#737373] leading-relaxed">{feat.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* 4.5 AI Integration Demo Section */}
      <section id="ai-demo" className="py-24 bg-texture-dark border-y border-[#333] relative overflow-hidden text-white">
        {/* Glow effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-[400px] bg-[#c5a059]/20 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <FadeIn>
            <div className="text-center max-w-2xl mx-auto mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm font-medium mb-6 text-[#c5a059]">
                <Sparkles className="w-4 h-4" />
                Powered by Generative AI
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-white mb-6">Say goodbye to manual entry.</h2>
              <p className="text-[#a3a3a3] text-lg leading-relaxed">
                Paste messy notes, invoice emails, or chat logs directly into SnapGoods. Our AI instantly extracts, structures, and categorizes your hardware in seconds.
              </p>
            </div>
          </FadeIn>

          <div className="grid lg:grid-cols-2 gap-8 items-start">
            {/* Left: Input */}
            <FadeIn delay={100} direction="right">
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-sm font-medium text-[#a3a3a3]">Raw Input (Notes, Email, etc.)</label>
                  <Cpu className="w-4 h-4 text-[#c5a059]" />
                </div>
                <textarea 
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  maxLength={2000}
                  className="w-full h-48 bg-black/40 border border-white/10 rounded-xl p-4 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#c5a059]/50 resize-none transition-all placeholder-[#404040]"
                  placeholder="Paste your raw text here..."
                />
                <div className="text-xs text-right text-muted mt-2">{aiInput.length}/2000 chars</div>
                
                <button 
                  onClick={handleAIExtract}
                  disabled={isExtracting || !aiInput.trim()}
                  className="mt-4 w-full py-4 rounded-xl bg-[#c5a059] text-[#1f1f1f] font-bold hover:bg-[#dfc182] transition-all shadow-[0_0_20px_rgba(197,160,89,0.2)] hover:shadow-[0_0_30px_rgba(197,160,89,0.4)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExtracting ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> AI is Analyzing...</>
                  ) : (
                    <><Sparkles className="w-5 h-5" /> ✨ Extract Assets</>
                  )}
                </button>
                {aiError && <p className="text-red-400 text-sm mt-3 text-center">{aiError}</p>}
              </div>
            </FadeIn>

            {/* Right: Output */}
            <FadeIn delay={200} direction="left" className="h-full">
              <div className="bg-black/40 border border-white/10 rounded-3xl p-6 backdrop-blur-md h-full min-h-[300px] flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <label className="text-sm font-medium text-[#a3a3a3]">Structured Data Output</label>
                  <div className="px-2 py-1 bg-white/10 rounded text-xs text-white/70 font-mono">JSON / UI</div>
                </div>

                {!extractedAssets && !isExtracting && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center text-[#a3a3a3] border-2 border-dashed border-white/10 rounded-xl p-8">
                    <Database className="w-8 h-8 mb-3 opacity-50" />
                    <p>Click "Extract Assets" to see the AI in action.</p>
                  </div>
                )}

                {isExtracting && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center text-[#c5a059]">
                    <div className="relative">
                      <div className="absolute inset-0 border-4 border-[#c5a059]/20 rounded-full"></div>
                      <div className="w-12 h-12 border-4 border-transparent border-t-[#c5a059] rounded-full animate-spin"></div>
                    </div>
                    <p className="mt-4 text-sm font-medium animate-pulse">Structuring data...</p>
                  </div>
                )}

                {extractedAssets && !isExtracting && (
                  <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar relative pb-16">
                    {extractedAssets.map((asset, idx) => (
                      <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-[#c5a059]/50 transition-colors shadow-sm">
                        <div className="flex items-start justify-between mb-3">
                          <div className="font-semibold text-white whitespace-pre-wrap">{asset.name}</div>
                          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#c5a059]/20 text-[#dfc182] border border-[#c5a059]/30 whitespace-nowrap ml-3">
                            {asset.category}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div className="bg-white/5 rounded-lg p-2.5 border border-white/5">
                            <div className="text-[10px] uppercase tracking-wider text-[#a3a3a3] mb-1">Quantity</div>
                            <div className="text-sm text-white font-medium">{asset.quantity || 1} Unit(s)</div>
                          </div>
                          {asset.specs && (
                            <div className="bg-white/5 rounded-lg p-2.5 border border-white/5">
                              <div className="text-[10px] uppercase tracking-wider text-[#a3a3a3] mb-1">Specifications</div>
                              <div className="text-xs text-white/90 line-clamp-2" title={asset.specs}>{asset.specs}</div>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <div className="text-[10px] uppercase tracking-wider text-[#a3a3a3]">Assigned To</div>
                          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-white/80">
                            {Array.isArray(asset.assignedTo) && asset.assignedTo.length > 0 ? (
                              asset.assignedTo.map((assignee: string, i: number) => (
                                <div key={i} className="flex items-center gap-1.5 bg-[#1f1f1f] py-1 px-2.5 rounded-lg border border-white/10">
                                  <Users className="w-3.5 h-3.5 text-[#c5a059]" />
                                  {assignee}
                                </div>
                              ))
                            ) : (
                              <div className="flex items-center gap-1.5 bg-[#1f1f1f] py-1 px-2.5 rounded-lg border border-white/10 opacity-70">
                                  <Users className="w-3.5 h-3.5 text-[#c5a059]" />
                                  Unassigned
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="mt-4 p-4 border border-[#c5a059]/30 bg-[#c5a059]/10 rounded-xl text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Activity className="w-4 h-4 text-[#c5a059]" />
                        <span className="text-xs font-bold uppercase tracking-wider text-[#dfc182]">Live Demo Output</span>
                      </div>
                      <p className="text-xs text-[#a3a3a3] leading-relaxed">
                        This is an automated preview. The production system extracts significantly more detailed metadata including warranty information, serial numbers, deprecation schedules, and exact facility locations.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* 5. Deep Feature Highlight (Interactive Timeline) */}
      <section className="py-32 bg-transparent overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <FadeIn>
              <div className="text-[#c5a059] font-semibold text-sm mb-3 uppercase tracking-widest flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Immutable Audits
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-[#1f1f1f] mb-6">Track Asset Lifecycle with Precision</h2>
              <p className="text-lg text-[#737373] leading-relaxed mb-8">
                Never lose context again. Our immutable timeline logs every status change, employee assignment, and repair, creating a perfect, unalterable audit trail for every single asset in your organization.
              </p>
            </FadeIn>
            
            <ul className="space-y-5">
              {['Automated timestamping on every action', 'Historical employee ownership logs', 'Automated depreciation tracking', 'Maintenance and repair records'].map((item, i) => (
                <FadeIn key={i} delay={200 + (i * 100)}>
                  <li className="flex items-center gap-4 text-[#1f1f1f] font-medium bg-texture-light p-3 rounded-xl border border-[#e5e5e5] shadow-sm hover:border-[#c5a059]/30 transition-colors relative overflow-hidden group">
                    <div className="absolute inset-0 bg-white/40 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="relative z-10 w-8 h-8 rounded-full bg-[#c5a059]/10 flex items-center justify-center shrink-0">
                      <Check className="w-4 h-4 text-[#c5a059]" />
                    </div>
                    {item}
                  </li>
                </FadeIn>
              ))}
            </ul>
          </div>
          
          {/* Timeline UI Mock */}
          <FadeIn direction="left" delay={300}>
            <div className="bg-texture-light border border-[#e5e5e5] rounded-3xl p-8 shadow-xl relative transform lg:rotate-2 hover:rotate-0 transition-transform duration-500 overflow-hidden">
              <div className="absolute inset-0 bg-white/60 pointer-events-none"></div>
              <div className="absolute top-0 right-0 w-40 h-40 bg-[#c5a059]/10 blur-3xl rounded-full pointer-events-none"></div>

              <div className="flex items-center justify-between mb-10 relative z-10 pb-6 border-b border-[#e5e5e5]">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/80 backdrop-blur-sm border border-[#e5e5e5] flex items-center justify-center shadow-sm">
                    <Laptop className="w-6 h-6 text-[#1f1f1f]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-[#1f1f1f]">MacBook Pro 16"</h4>
                    <div className="text-sm text-[#737373] font-mono">AST-88201</div>
                  </div>
                </div>
                <div className="px-3 py-1.5 bg-[#c5a059]/10 text-[#826330] border border-[#c5a059]/20 rounded-full text-xs font-bold uppercase tracking-wider">
                  In Use
                </div>
              </div>
              
              <div className="relative pl-8 border-l-2 border-[#e5e5e5] space-y-10 z-10">
                {[
                  { title: "Assigned to Sarah Jenkins", date: "Today, 09:41 AM", user: "Admin", active: true },
                  { title: "Returned from Maintenance", date: "Oct 12, 14:30 PM", user: "Support Team", active: false },
                  { title: "Assigned to Michael Chen", date: "Jan 04, 10:15 AM", user: "Admin", active: false },
                  { title: "Asset Purchased & Registered", date: "Jan 02, 08:00 AM", user: "Finance", active: false }
                ].map((log, i) => (
                  <div key={i} className="relative group cursor-default">
                    <div className={`absolute -left-[41px] w-4 h-4 rounded-full border-[3px] transition-colors duration-300 ${log.active ? 'bg-white border-[#c5a059] ring-4 ring-[#c5a059]/20' : 'bg-white border-[#e5e5e5] group-hover:border-[#c5a059]/50'}`}></div>
                    <div className={`text-base font-semibold ${log.active ? 'text-[#1f1f1f]' : 'text-[#737373] group-hover:text-[#1f1f1f] transition-colors'}`}>{log.title}</div>
                    <div className="text-sm text-[#737373] flex items-center gap-2 mt-1.5 font-medium">
                      <Clock className="w-3.5 h-3.5" /> {log.date} 
                      <span className="w-1 h-1 rounded-full bg-[#e5e5e5]"></span> 
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> {log.user}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-24 md:py-32 relative overflow-hidden bg-texture-light border-y border-[#e5e5e5]">
        <div className="max-w-6xl mx-auto px-6 relative z-10 text-center">
          
          {/* Heading */}
          <FadeIn>
            <div className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#e5e5e5] shadow-sm mb-6">
              <span className="w-2 h-2 rounded-full bg-[#c5a059]"></span>
              <span className="text-xs font-bold uppercase tracking-wider text-[#1f1f1f]">Workflow</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-[#1f1f1f]">
              How It Works
            </h2>
            <p className="mt-4 text-lg md:text-xl text-[#737373] font-medium max-w-2xl mx-auto">
              Add. Assign. Track. Streamline your entire asset lifecycle in three simple steps.
            </p>
          </FadeIn>

          {/* Cards */}
          <div className="mt-16 w-full relative z-10 -mx-6 px-6 md:mx-0 md:px-0 group">
            {/* Scroll Buttons */}
            <button 
              onClick={() => scrollCards('left')}
              className="absolute left-8 lg:-left-6 top-1/2 -translate-y-[calc(50%+24px)] z-20 w-12 h-12 flex items-center justify-center bg-white/30 backdrop-blur-md border border-[#e5e5e5]/50 rounded-full text-[#1f1f1f] shadow-[0_4px_20px_rgba(0,0,0,0.08)] opacity-0 group-hover:opacity-100 transition-all hover:bg-white hover:scale-110 hidden md:flex"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <button 
              onClick={() => scrollCards('right')}
              className="absolute right-8 lg:-right-6 top-1/2 -translate-y-[calc(50%+24px)] z-20 w-12 h-12 flex items-center justify-center bg-white/30 backdrop-blur-md border border-[#e5e5e5]/50 rounded-full text-[#1f1f1f] shadow-[0_4px_20px_rgba(0,0,0,0.08)] opacity-0 group-hover:opacity-100 transition-all hover:bg-white hover:scale-110 hidden md:flex"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            <div 
              ref={scrollRef}
              onMouseDown={handleMouseDown}
              onMouseLeave={handleMouseLeave}
              onMouseUp={handleMouseUp}
              onMouseMove={handleMouseMove}
              className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-12 pt-4 px-6 md:px-12 xl:px-24 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] cursor-grab select-none"
            >
              {[
                {
                  icon: Database,
                  title: "Add Your Assets",
                  description: "Create a structured inventory and keep all assets organized in one centralized place."
                },
                {
                  icon: UserCheck,
                  title: "Assign Ownership",
                  description: "Link assets to employees with clear responsibility tracking and complete history."
                },
                {
                  icon: Activity,
                  title: "Track & Manage",
                  description: "Monitor condition, usage, and lifecycle in real time with comprehensive visibility."
                },
                {
                  icon: Shield,
                  title: "Automate Audits",
                  description: "Conduct rapid audits with automated reporting, verification, and compliance checks."
                },
                {
                  icon: RefreshCw,
                  title: "Optimize Lifecycle",
                  description: "Monitor depreciation, forecast future budgets, and plan hardware refresh cycles."
                },
                {
                  icon: Box,
                  title: "Secure Offboarding",
                  description: "Revoke access and seamlessly trigger hardware return workflows upon departure."
                }
              ].map((step, index) => {
                const Icon = step.icon;
                return (
                  <FadeIn key={index} delay={index * 100} direction="up" className="relative shrink-0 w-[85vw] md:w-[360px] snap-center">
                    <div className="group rounded-2xl border border-[#e5e5e5] bg-white/70 backdrop-blur-sm p-8 text-center shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-[#c5a059]/40 h-full min-h-[320px] relative overflow-hidden flex flex-col items-center">
                      <div className="absolute inset-0 bg-gradient-to-br from-white to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-0"></div>
                      
                      <div className="relative z-10 flex flex-col items-center flex-grow">
                        {/* Step Number Badge */}
                        <div className="absolute -top-4 -right-4 w-12 h-12 rounded-bl-2xl bg-[#fafafa] border-b border-l border-[#e5e5e5] text-[#c5a059] font-bold font-mono flex items-center justify-center opacity-50 group-hover:opacity-100 transition-opacity">
                           0{index + 1}
                        </div>

                        {/* Icon */}
                        <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-white border border-[#e5e5e5] mb-6 group-hover:bg-[#c5a059]/10 group-hover:border-[#c5a059]/30 transition-all duration-300 shadow-sm group-hover:scale-110">
                          <Icon className="w-7 h-7 text-[#1f1f1f] group-hover:text-[#c5a059] transition-colors" />
                        </div>

                        {/* Title */}
                        <h3 className="text-xl font-bold text-[#1f1f1f] mb-3 group-hover:text-[#c5a059] transition-colors">
                          {step.title}
                        </h3>

                        {/* Description */}
                        <p className="text-base text-[#737373] leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </FadeIn>
                );
              })}
            </div>

            {/* Edge Gradients for scrolling cue */}
            <div className="pointer-events-none absolute top-4 bottom-12 left-0 w-8 md:w-24 bg-gradient-to-r from-[#fdfbf7] via-[#fdfbf7]/80 to-transparent z-10 hidden md:block"></div>
            <div className="pointer-events-none absolute top-4 bottom-12 right-0 w-8 md:w-24 bg-gradient-to-l from-[#fdfbf7] via-[#fdfbf7]/80 to-transparent z-10 hidden md:block"></div>
          </div>

          {/* Bottom line */}
          <FadeIn delay={450} direction="up">
            <p className="mt-16 text-base font-medium text-[#737373]">
              Everything stays organized, visible, and under control.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* 11. Final CTA */}
      <section className="py-32 border-t border-[#e5e5e5] relative overflow-hidden bg-texture-dark">
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <FadeIn>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white mb-6">Take Full Control of Your Assets</h2>
            <p className="text-xl text-[#a3a3a3] mb-10 max-w-2xl mx-auto">Join thousands of teams who have chosen clarity, accountability, and efficiency over spreadsheet chaos.</p>
            <button 
              onClick={() => navigate('/login?view=signup')}
              className="bg-[#c5a059] text-[#1f1f1f] px-8 py-5 rounded-xl text-lg font-bold hover:bg-[#dfc182] transition-all flex items-center justify-center gap-3 mx-auto shadow-[0_0_30px_rgba(197,160,89,0.3)] hover:scale-105 duration-300"
            >
              Get Started for Free
              <ArrowRightCircle className="w-6 h-6" />
            </button>
            <p className="mt-6 text-[#737373] text-sm">No credit card required. Setup takes 5 minutes.</p>
          </FadeIn>
        </div>
      </section>

      {/* 12. Footer */}
      <footer className="bg-texture-dark border-t border-[#333333] py-12 pt-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <Logo variant="full" forceLight={true} className="h-[35.7px] w-auto opacity-70 brightness-0 invert" />
              </div>
              <p className="text-[#a3a3a3] text-sm max-w-sm leading-relaxed">
                The modern, frictionless way to track hardware, software, and organizational assets. Built for teams that value design and precision.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 tracking-wider text-sm uppercase">Product</h4>
              <ul className="space-y-2 text-[#a3a3a3] text-sm">
                <li><span className="hover:text-[#c5a059] transition-colors cursor-pointer">Features</span></li>
                <li><span className="hover:text-[#c5a059] transition-colors cursor-pointer">Integrations</span></li>
                <li><span className="hover:text-[#c5a059] transition-colors cursor-pointer">Pricing</span></li>
                <li><span className="hover:text-[#c5a059] transition-colors cursor-pointer">Changelog</span></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 tracking-wider text-sm uppercase">Company</h4>
              <ul className="space-y-2 text-[#a3a3a3] text-sm">
                <li><span className="hover:text-[#c5a059] transition-colors cursor-pointer">About Us</span></li>
                <li><span className="hover:text-[#c5a059] transition-colors cursor-pointer">Privacy Policy</span></li>
                <li><span className="hover:text-[#c5a059] transition-colors cursor-pointer">Terms of Service</span></li>
                <li><span className="hover:text-[#c5a059] transition-colors cursor-pointer">Contact Support</span></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-[#333333] pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-[#737373]">
              &copy; {new Date().getFullYear()} SnapGoods Inc. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
