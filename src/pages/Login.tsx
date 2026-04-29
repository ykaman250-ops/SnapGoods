import React, { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { toast } from 'sonner';
import { 
  MapPin, 
  Building2, 
  PieChart, 
  Mail, 
  Lock, 
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  User
} from 'lucide-react';
import { Logo } from '../components/Logo';

const styles = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fade-in-up {
    animation: fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    opacity: 0;
  }

  .delay-100 { animation-delay: 100ms; }
  .delay-200 { animation-delay: 200ms; }
  .delay-300 { animation-delay: 300ms; }
`;

export default function Login() {
  const { user, profile, loading } = useAuth();
  
  const [view, setView] = useState<'signin' | 'signup'>('signin');
  const [isHoveringBtn, setIsHoveringBtn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // Signup State
  const [orgName, setOrgName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);

  // Invite
  const [searchParams] = useSearchParams();
  const inviteTokenParam = searchParams.get('invite');
  const [inviteToken, setInviteToken] = useState(inviteTokenParam || '');
  const [acceptInviteLoading, setAcceptInviteLoading] = useState(false);

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (user) {
    if (profile === undefined) return <div className="flex items-center justify-center h-screen">Loading...</div>;
    return <Navigate to={profile?.preferences?.defaultPage || "/"} />;
  }

  const handleResetPassword = async () => {
    if (!email) {
      toast.error('Please enter your email address first to reset password.');
      return;
    }
    
    try {
      setResetLoading(true);
      await sendPasswordResetEmail(auth, email);
      toast.success('Password reset email sent! Check your inbox.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send password reset email');
    } finally {
      setResetLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAuthLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        toast.error('Invalid credentials. The account may not exist or the password is incorrect.');
      } else if (error.code === 'auth/wrong-password') {
        toast.error('Wrong password. Please try again.');
      } else {
        toast.error(error.message || 'Authentication failed');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName || !adminName || !signupEmail || !signupPassword) {
      toast.error('Please fill in all fields.');
      return;
    }
    try {
      setSignupLoading(true);
      const res = await fetch('/api/create-organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: signupEmail,
          password: signupPassword,
          orgName,
          adminName
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      toast.success('Organization created successfully! Logging you in...');
      
      await signInWithEmailAndPassword(auth, signupEmail, signupPassword);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create organization');
    } finally {
      setSignupLoading(false);
    }
  };

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteToken || !adminName || !signupPassword) {
      toast.error('Please fill in your name and password.');
      return;
    }
    try {
      setAcceptInviteLoading(true);
      const res = await fetch('/api/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: inviteToken,
          name: adminName,
          password: signupPassword
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      toast.success('Invite accepted successfully! Logging you in...');
      setEmail(signupEmail);
      toast.info('Please enter your email and password to sign in now.', { duration: 6000 });
      setInviteToken('');
      setView('signin');
    } catch (error: any) {
      toast.error(error.message || 'Failed to accept invite');
    } finally {
      setAcceptInviteLoading(false);
    }
  };

  const features = [
    {
      icon: <MapPin className="w-5 h-5 text-primary" />,
      title: "Real-time asset tracking",
      description: "Know exactly where your equipment is at any given moment."
    },
    {
      icon: <Building2 className="w-5 h-5 text-primary" />,
      title: "Multi-organization management",
      description: "Seamlessly handle assets across different branches and teams."
    },
    {
      icon: <PieChart className="w-5 h-5 text-primary" />,
      title: "Depreciation & lifecycle insights",
      description: "Make data-driven decisions with automated value tracking."
    }
  ];

  return (
    <>
      <style>{styles}</style>
      <div className="min-h-screen w-full flex flex-col lg:flex-row font-sans overflow-hidden">
        
        {/* ================= LEFT SIDE (INFO SECTION) ================= */}
        <div className="dark bg-background bg-pattern text-foreground relative w-full lg:w-[60%] p-8 sm:p-12 lg:p-16 lg:pl-20 xl:pl-32 flex flex-col justify-between overflow-hidden min-h-[500px] lg:min-h-screen">
          
          {/* Abstract Nodes */}
          <div className="absolute top-0 right-0 -mr-24 -mt-24 w-96 h-96 bg-primary/10 rounded-full blur-3xl z-0"></div>
          <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-80 h-80 bg-primary/5 rounded-full blur-3xl z-0"></div>

          {/* Top Branding */}
          <div className="relative z-10 flex items-center justify-start mb-12 w-40 sm:w-48 h-12">
            <Logo variant="full" />
          </div>

          {/* Main Content */}
          <div className="relative z-10 flex-1 flex flex-col justify-center max-w-xl mx-auto lg:mx-0">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary font-medium text-sm mb-6 w-fit animate-fade-in-up">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              AssetHive is live
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-6 animate-fade-in-up delay-100 leading-[1.15]">
              Take Control of Your <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-400 to-gold-600">Company Assets</span>
            </h1>
            
            <p className="text-lg text-zinc-400 mb-12 animate-fade-in-up delay-200 leading-relaxed">
              Track, manage, and monitor assets across teams and locations with complete visibility and absolute ease.
            </p>

            <div className="space-y-6 animate-fade-in-up delay-300">
              {features.map((feature, idx) => (
                <div key={idx} className="flex items-start gap-4 group">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">{feature.title}</h3>
                    <p className="text-sm text-zinc-400 mt-0.5 leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Footer Info */}
          <div className="relative z-10 mt-16 text-sm text-zinc-500 font-medium hidden lg:block animate-fade-in-up delay-300">
            @ {new Date().getFullYear()} Asset Hive
          </div>
        </div>

        {/* ================= RIGHT SIDE (LOGIN SECTION) ================= */}
        <div className="bg-background bg-pattern text-foreground w-full lg:w-[40%] flex items-center justify-center p-6 sm:p-8 lg:p-12 relative z-20 shadow-[-20px_0_50px_-20px_rgba(0,0,0,0.15)] lg:border-l border-border/40">
          
          {/* Main Card container */}
          <div className="w-full max-w-[420px] bg-card rounded-2xl shadow-xl sm:shadow-2xl border border-border/50 p-8 sm:p-10 animate-fade-in-up transition-all duration-500">
            
            {/* Header / Logo */}
            <div className="text-center mb-8 flex flex-col items-center">
              <div className="w-48 h-12 flex items-center justify-center mb-1">
                <Logo variant="full" />
              </div>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Manage, Track & Control in one place</p>
            </div>

            {inviteToken ? (
              // Invite Flow
              <form onSubmit={handleAcceptInvite} className="space-y-5 animate-fade-in-up">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-bold">Accept Invite</h3>
                  <p className="text-sm text-muted-foreground">Join your organization</p>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Your Name</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                      <User className="w-5 h-5" />
                    </div>
                    <input 
                      type="text" 
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="Jane Doe" 
                      className="w-full pl-10 pr-4 py-3 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground text-foreground"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Confirm Email</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                      <Mail className="w-5 h-5" />
                    </div>
                    <input 
                      type="email" 
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      placeholder="you@company.com" 
                      className="w-full pl-10 pr-4 py-3 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground text-foreground"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Create Password</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                      <Lock className="w-5 h-5" />
                    </div>
                    <input 
                      type={showPassword ? "text" : "password"}
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="••••••••" 
                      className="w-full pl-10 pr-10 py-3 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground text-foreground"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={acceptInviteLoading}
                  onMouseEnter={() => setIsHoveringBtn(true)}
                  onMouseLeave={() => setIsHoveringBtn(false)}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground text-sm font-semibold rounded-xl transition-all duration-300 mt-2 shadow-md hover:shadow-lg active:scale-[0.98]"
                >
                  {acceptInviteLoading ? 'Joining...' : 'Join Workspace'}
                  {!acceptInviteLoading && <ArrowRight className={`w-4 h-4 transition-transform duration-300 ${isHoveringBtn ? 'translate-x-1' : ''}`} />}
                </button>
              </form>
            ) : (
              <>
                {/* Toggle Buttons */}
                <div className="flex p-1 bg-muted rounded-xl mb-8">
                  <button 
                    type="button"
                    onClick={() => setView('signin')}
                    className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                      view === 'signin' 
                        ? 'bg-background shadow-sm text-foreground' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
                    }`}
                  >
                    Sign In
                  </button>
                  <button 
                    type="button"
                    onClick={() => setView('signup')}
                    className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                      view === 'signup' 
                        ? 'bg-background shadow-sm text-foreground' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
                    }`}
                  >
                    Create Org
                  </button>
                </div>

                {/* Form */}
                <form className="space-y-5" onSubmit={view === 'signin' ? handleLoginSubmit : handleCreateOrg}>
                  
                  {/* Extra Fields for Sign Up */}
                  {view === 'signup' && (
                    <div className="space-y-5 animate-fade-in-up">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Organization Name</label>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                            <Building2 className="w-5 h-5" />
                          </div>
                          <input 
                            type="text" 
                            value={orgName}
                            onChange={(e) => setOrgName(e.target.value)}
                            placeholder="Acme Corp" 
                            required
                            className="w-full pl-10 pr-4 py-3 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground text-foreground"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Your Name</label>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                            <User className="w-5 h-5" />
                          </div>
                          <input 
                            type="text" 
                            value={adminName}
                            onChange={(e) => setAdminName(e.target.value)}
                            placeholder="Jane Doe" 
                            required
                            className="w-full pl-10 pr-4 py-3 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground text-foreground"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Email Input */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Work Email</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                        <Mail className="w-5 h-5" />
                      </div>
                      <input 
                        type="email" 
                        value={view === 'signin' ? email : signupEmail}
                        onChange={(e) => view === 'signin' ? setEmail(e.target.value) : setSignupEmail(e.target.value)}
                        placeholder="you@company.com" 
                        className="w-full pl-10 pr-4 py-3 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground text-foreground"
                        required
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-foreground">Password</label>
                      {view === 'signin' && (
                        <button 
                          type="button"
                          onClick={handleResetPassword}
                          disabled={resetLoading}
                          className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                        >
                          {resetLoading ? 'Sending...' : 'Forgot password?'}
                        </button>
                      )}
                    </div>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                        <Lock className="w-5 h-5" />
                      </div>
                      <input 
                        type={showPassword ? "text" : "password"}
                        value={view === 'signin' ? password : signupPassword}
                        onChange={(e) => view === 'signin' ? setPassword(e.target.value) : setSignupPassword(e.target.value)}
                        placeholder="••••••••" 
                        className="w-full pl-10 pr-10 py-3 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground text-foreground"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button 
                    type="submit"
                    disabled={view === 'signin' ? authLoading : signupLoading}
                    onMouseEnter={() => setIsHoveringBtn(true)}
                    onMouseLeave={() => setIsHoveringBtn(false)}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground text-sm font-semibold rounded-xl transition-all duration-300 mt-2 shadow-md hover:shadow-lg active:scale-[0.98]"
                  >
                    {view === 'signin' 
                      ? (authLoading ? 'Authenticating...' : 'Sign In') 
                      : (signupLoading ? 'Creating Account...' : 'Create Account')
                    }
                    {((view === 'signin' && !authLoading) || (view === 'signup' && !signupLoading)) && (
                      <ArrowRight className={`w-4 h-4 transition-transform duration-300 ${isHoveringBtn ? 'translate-x-1' : ''}`} />
                    )}
                  </button>
                </form>

                {/* Trusted By / Social Proof */}
                <div className="mt-8 pt-6 border-t border-border flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span>Enterprise-grade security & encryption</span>
                </div>
              </>
            )}

          </div>
        </div>
      </div>
    </>
  );
}

