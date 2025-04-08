import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  Shield, 
  Users, 
  Wallet, 
  TrendingUp, 
  ExternalLink, 
  Facebook, 
  Twitter, 
  Instagram,
  Star,
  CheckCircle,
  Award,
  ArrowUpRight
} from 'lucide-react';
import { useAuth } from '../lib/auth';

function GlowingButton({ children, className = '', as = 'button', to = '' }: { children: React.ReactNode; className?: string; as?: 'button' | 'link'; to?: string }) {
  const classes = `relative px-8 py-3 bg-blue-600 text-white rounded-lg overflow-hidden transition-all 
    hover:bg-blue-700 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] ${className}
    before:content-[''] before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent 
    before:via-white/20 before:to-transparent before:translate-x-[-200%] before:transition-transform 
    hover:before:translate-x-[200%] before:duration-1000`;

  return as === 'link' ? (
    <Link to={to} className={classes}>
      {children}
    </Link>
  ) : (
    <button className={classes}>
      {children}
    </button>
  );
}

function InvestmentCard({ amount, returns, duration }: { amount: string; returns: string; duration: string }) {
  return (
    <div className="relative p-6 rounded-xl bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700
      hover:border-blue-500/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(59,130,246,0.2)]
      backdrop-blur-sm group">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-purple-600/5 rounded-xl opacity-0 
        group-hover:opacity-100 transition-opacity"></div>
      <h3 className="text-2xl font-bold text-white mb-4">{amount}</h3>
      <p className="text-gray-400 mb-2">Monthly Returns: <span className="text-blue-400">{returns}</span></p>
      <p className="text-gray-400 mb-4">Duration: {duration}</p>
      <GlowingButton className="w-full" as="link" to="/signup">
        <span className="flex items-center justify-center gap-2">
          Invest Now <ArrowRight size={18} />
        </span>
      </GlowingButton>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="relative p-6 rounded-xl bg-gradient-to-br from-gray-800/30 to-gray-900/30 border border-gray-800
      hover:border-blue-500/30 transition-all duration-300 group">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-purple-600/5 rounded-xl opacity-0 
        group-hover:opacity-100 transition-opacity"></div>
      <div className="p-3 bg-blue-500/10 rounded-lg w-fit mb-4 group-hover:scale-110 transition-transform">
        <Icon size={24} className="text-blue-400" />
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  );
}

function TestimonialCard({ name, role, content, image }: { name: string; role: string; content: string; image: string }) {
  return (
    <div className="p-6 rounded-xl bg-gradient-to-br from-gray-800/30 to-gray-900/30 border border-gray-800">
      <div className="flex items-center gap-4 mb-4">
        <img src={image} alt={name} className="w-12 h-12 rounded-full object-cover" />
        <div>
          <h4 className="font-semibold">{name}</h4>
          <p className="text-sm text-gray-400">{role}</p>
        </div>
      </div>
      <p className="text-gray-300">{content}</p>
      <div className="flex gap-1 mt-4 text-yellow-400">
        {[...Array(5)].map((_, i) => (
          <Star key={i} size={16} fill="currentColor" />
        ))}
      </div>
    </div>
  );
}

export function HomePage() {
  const { user, profile } = useAuth();

  useEffect(() => {
    // Parallax effect for background elements
    const handleScroll = () => {
      const scrolled = window.scrollY;
      const circles = document.querySelectorAll('.parallax-circle');
      circles.forEach((circle: Element, index) => {
        const speed = 0.2 + (index * 0.1);
        const yPos = -(scrolled * speed);
        if (circle instanceof HTMLElement) {
          circle.style.transform = `translate3d(0, ${yPos}px, 0)`;
        }
      });
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0">
          {/* Gradient circles */}
          <div className="parallax-circle absolute top-[-20%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-3xl"></div>
          <div className="parallax-circle absolute top-[20%] right-[-20%] w-[50%] h-[50%] rounded-full bg-purple-500/10 blur-3xl"></div>
          <div className="parallax-circle absolute bottom-[-10%] left-[20%] w-[30%] h-[30%] rounded-full bg-emerald-500/10 blur-3xl"></div>
        </div>
        {/* Grain effect */}
        <div className="absolute inset-0 opacity-20" style={{ 
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` 
        }}></div>
      </div>

      {/* Navigation */}
      <nav className="absolute top-0 right-0 p-6 z-20">
        {user ? (
          <GlowingButton 
            as="link" 
            to={profile?.role === 'admin' ? '/admin' : '/dashboard'} 
            className="mr-4"
          >
            {profile?.role === 'admin' ? 'Admin Panel' : 'Dashboard'}
          </GlowingButton>
        ) : (
          <GlowingButton as="link" to="/signin" className="mr-4">
            Login
          </GlowingButton>
        )}
      </nav>

      {/* Hero Section */}
      <div className="relative min-h-screen flex items-center justify-center px-4">
        <div className="container mx-auto text-center relative z-10 max-w-4xl">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 mb-8">
            <Star size={16} className="text-blue-400" fill="currentColor" />
            <span className="text-blue-400">Trusted by 10,000+ investors worldwide</span>
          </div>
          <h1 className="text-4xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500 bg-clip-text text-transparent">
            Smart Investments,<br />Exceptional Returns
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Experience the power of smart investing with our guaranteed 5% monthly ROI for 40 months.
            Join thousands of successful investors today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <GlowingButton as="link" to="/signup" className="text-lg">
              Start Investing Now <ArrowRight className="inline ml-2" size={20} />
            </GlowingButton>
            <button className="px-8 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2">
              Learn More <ArrowUpRight size={20} />
            </button>
          </div>
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <h4 className="text-3xl font-bold text-white">$50M+</h4>
              <p className="text-gray-400">Total Invested</p>
            </div>
            <div>
              <h4 className="text-3xl font-bold text-white">10K+</h4>
              <p className="text-gray-400">Active Investors</p>
            </div>
            <div>
              <h4 className="text-3xl font-bold text-white">5%</h4>
              <p className="text-gray-400">Monthly Returns</p>
            </div>
            <div>
              <h4 className="text-3xl font-bold text-white">40</h4>
              <p className="text-gray-400">Months Duration</p>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <section className="py-20 relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Choose Us</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              We combine cutting-edge technology with years of investment expertise to deliver exceptional returns
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              icon={Shield}
              title="Bank-Grade Security"
              description="Your investments are protected by state-of-the-art security systems and protocols"
            />
            <FeatureCard
              icon={TrendingUp}
              title="Guaranteed Returns"
              description="Enjoy fixed 5% monthly returns on your investments for 40 months"
            />
            <FeatureCard
              icon={Users}
              title="Community Driven"
              description="Join a thriving community of successful investors and earn through referrals"
            />
          </div>
        </div>
      </section>

      {/* Investment Plans */}
      <section className="py-20 relative overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Investment Plans</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Choose the investment plan that best suits your goals
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <InvestmentCard amount="₹1,000" returns="₹50" duration="40 Months" />
            <InvestmentCard amount="₹10,000" returns="₹500" duration="40 Months" />
            <InvestmentCard amount="₹100,000" returns="₹5,000" duration="40 Months" />
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">What Our Investors Say</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Don't just take our word for it - hear from our satisfied investors
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <TestimonialCard
              name="Sarah Johnson"
              role="Early Investor"
              content="The consistent monthly returns have helped me achieve financial freedom. The platform is incredibly user-friendly."
              image="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80"
            />
            <TestimonialCard
              name="Michael Chen"
              role="Business Owner"
              content="I've tried many investment platforms, but none have delivered returns as consistently as this one."
              image="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80"
            />
            <TestimonialCard
              name="Emma Williams"
              role="Professional Investor"
              content="The referral system has created an additional income stream. It's a win-win for everyone involved."
              image="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&h=150&q=80"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900/80 border-t border-gray-800">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4">Quick Links</h3>
              <ul className="space-y-2">
                <li>
                  <a href="#" className="text-gray-400 hover:text-blue-400 flex items-center gap-2">
                    <ExternalLink size={16} /> Terms & Conditions
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-blue-400 flex items-center gap-2">
                    <ExternalLink size={16} /> Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-blue-400 flex items-center gap-2">
                    <ExternalLink size={16} /> Support
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-4">Contact</h3>
              <p className="text-gray-400">support@example.com</p>
              <p className="text-gray-400">+1 (555) 123-4567</p>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-4">Follow Us</h3>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-400 hover:text-blue-400 transition-colors">
                  <Facebook size={24} />
                </a>
                <a href="#" className="text-gray-400 hover:text-blue-400 transition-colors">
                  <Twitter size={24} />
                </a>
                <a href="#" className="text-gray-400 hover:text-blue-400 transition-colors">
                  <Instagram size={24} />
                </a>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-400">
            <p>&copy; 2025 Investment Platform. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}