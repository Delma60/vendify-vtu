"use client";
import React, { useState } from "react";
import {
  Smartphone,
  Wifi,
  Tv,
  Zap,
  ChevronDown,
  Menu,
  X,
  MessageCircle,
  ArrowRight,
  ShieldCheck,
  HeadphonesIcon,
  BookOpen,
  Mail,
  Landmark,
  Download,
  CheckCircle,
  CheckCircle2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";

// --- TYPES ---
interface PricingData {
  network: string;
  plan: string;
  price: string;
  validity: string;
}

// --- DATA ---
const SERVICES = [
  {
    icon: <Wifi />,
    title: "Cheap Data",
    desc: "Instant SME, Gifting & Corporate data for all networks.",
  },
  {
    icon: <Smartphone />,
    title: "Airtime Top-up",
    desc: "Get instant airtime recharge with 2% discount.",
  },
  {
    icon: <Tv />,
    title: "Cable TV",
    desc: "DStv, GOtv, and Startimes subscriptions made easy.",
  },
  {
    icon: <Zap />,
    title: "Utility Bills",
    desc: "Pay electricity bills (EKEDC, IKEDC, etc) instantly.",
  },
  {
    icon: <BookOpen />,
    title: "Exam Pins",
    desc: "Purchase WAEC, NECO, and NABTEB result checkers.",
  },
  {
    icon: <Mail />,
    title: "Bulk SMS",
    desc: "Send customized bulk SMS to any number at low rates.",
  },
  {
    icon: <Landmark />,
    title: "Airtime to Cash",
    desc: "Convert your excess airtime to cash in your bank account.",
  },
  {
    icon: <ShieldCheck />,
    title: "Agent Program",
    desc: "Become a reseller and earn commissions on every sale.",
  },
];

const PRICING: PricingData[] = [
  { network: "MTN", plan: "1GB SME", price: "₦255", validity: "30 Days" },
  {
    network: "Airtel",
    plan: "1GB Corporate",
    price: "₦280",
    validity: "30 Days",
  },
  { network: "Glo", plan: "2.9GB", price: "₦900", validity: "30 Days" },
  { network: "9Mobile", plan: "1GB", price: "₦180", validity: "30 Days" },
];

const App = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const app_name = process.env.NEXT_PUBLIC_APP_NAME;
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 scroll-smooth">
      {/* --- NAVIGATION --- */}
      <nav className="bg-white/90 backdrop-blur-md shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between h-16 items-center">
          <div className="flex items-center gap-2">
            <div className="bg-[--brand-orange] p-1.5 rounded-lg">
              <Zap className="h-6 w-6 text-white fill-current" />
            </div>
            <span className="text-xl font-bold tracking-tight">{app_name}</span>
          </div>

          <div className="hidden md:flex space-x-8 items-center text-sm font-semibold text-gray-600">
            <a href="#services" className="hover:text-[--brand-orange] transition">
              Services
            </a>
            <a href="#pricing" className="hover:text-[--brand-orange] transition">
              Pricing
            </a>
            <a href="#about" className="hover:text-[--brand-orange] transition">
              About
            </a>
            <button
              onClick={() => router.push("/login")}
              className="text-[--brand-orange]"
            >
              Login
            </button>
            <button
              onClick={() => router.push("/register")}
              className="bg-[--brand-orange] text-white px-6 py-2 rounded-full hover:bg-[--brand-orange-dark] shadow-md transition"
            >
              Register
            </button>
          </div>

          <button
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {/* --- HERO SECTION --- */}
      <section className="relative pt-12 pb-20 lg:pt-24 lg:pb-32 overflow-hidden bg-white">
        {/* Decorative Background Elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-50 blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] rounded-full bg-blue-100/50 blur-[100px]" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* LEFT COLUMN: TEXT CONTENT */}
            <div className="text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 mb-6 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[--brand-orange]"></span>
                </span>
                <span className="text-[--brand-orange-dark] text-xs font-bold uppercase tracking-widest">
                  Reliable & Automated VTU
                </span>
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-gray-900 leading-[1.1] mb-6">
                Digital Solutions <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[--brand-orange] to-blue-400">
                  Smart Connection.
                </span>
              </h1>

              <p className="text-lg text-gray-600 mb-10 leading-relaxed max-w-xl">
                Join 50,000+ Nigerians saving money on data, airtime, and
                utility bills. Instant delivery, even at midnight.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-10">
                <button onClick={() => router.push("/login")} className="bg-[--brand-orange] text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-[--brand-orange-dark] shadow-xl shadow-blue-200 transition-all flex items-center justify-center gap-2 group">
                  Get Started Free
                  <ArrowRight
                    size={20}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </button>
                <button className="bg-white text-gray-900 border border-gray-200 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
                  <Download size={20} className="text-[--brand-orange]" /> Download App
                </button>
              </div>

              {/* Micro-Social Proof */}
              <div className="flex items-center gap-4 border-t border-gray-100 pt-8">
                <div className="flex -space-x-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-10 h-10 rounded-full border-2 border-white bg-gray-200 overflow-hidden"
                    >
                      <img
                        src={`https://i.pravatar.cc/100?img=${i + 10}`}
                        alt="user"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-500 font-medium">
                  <span className="text-gray-900 font-bold">4.8/5</span> from
                  2,000+ reviews
                </p>
              </div>
            </div>

            {/* RIGHT COLUMN: THE IMAGE */}
            <div className="relative lg:block">
              <div className="relative z-10 w-full animate-float">
                <Image
                  src="/banner01.jpg"
                  alt="Spur Connect Interface"
                  width={500}
                  height={500}
                  className="w-full h-auto rounded-[2.5rem] shadow-2xl border-8 border-white"
                />

                {/* Floating Stats Card */}
                <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-2xl shadow-xl border border-gray-50 flex items-center gap-4 animate-bounce-slow">
                  <div className="bg-green-100 p-2 rounded-lg">
                    <CheckCircle2 className="text-green-600" size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-bold uppercase">
                      Transaction
                    </p>
                    <p className="text-sm font-black text-gray-900">
                      Success: 100%
                    </p>
                  </div>
                </div>
              </div>

              {/* Decorative Ring behind image */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] border border-blue-50 rounded-full z-0" />
            </div>
          </div>
        </div>

        <style jsx>{`
          @keyframes float {
            0% {
              transform: translateY(0px);
            }
            50% {
              transform: translateY(-20px);
            }
            100% {
              transform: translateY(0px);
            }
          }
          @keyframes bounce-slow {
            0%,
            100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-10px);
            }
          }
          .animate-float {
            animation: float 6s ease-in-out infinite;
          }
          .animate-bounce-slow {
            animation: bounce-slow 4s ease-in-out infinite;
          }
        `}</style>
      </section>

      {/* --- IMAGE INSERTION --- */}
      {/* <div className="max-w-7xl mx-auto px-4 -mt-20 relative z-20">
        <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white">
          <Image 
            src="/banner01.jpg" // Using MadiTel's hero image as inspiration
            alt="Spur Connect Dashboard" 
            className="w-full h-auto object-cover" 
            width={1000}
            height={600}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"></div>
          <div className="absolute bottom-8 left-8 text-white text-left">
            <h3 className="text-2xl font-bold">Your Digital Hub.</h3>
            <p className="text-sm opacity-90">Seamless transactions at your fingertips.</p>
          </div>
        </div>
      </div> */}

      {/* --- FEATURES (Like MadiTel) --- */}
      <section id="services" className="py-12 max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold">Our Awesome Services</h2>
          <p className="text-gray-500 mt-4">
            Everything you need to stay connected in one platform.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {SERVICES.map((s, i) => (
            <div
              key={i}
              className="p-8 rounded-3xl border border-gray-100 hover:border-blue-200 hover:shadow-xl transition-all group bg-white"
            >
              <div className="w-12 h-12 bg-blue-50 text-[--brand-orange] rounded-xl flex items-center justify-center mb-6 group-hover:bg-[--brand-orange] group-hover:text-white transition-colors">
                {React.cloneElement(s.icon as React.ReactElement, { size: 24 })}
              </div>
              <h3 className="text-xl font-bold mb-3">{s.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* --- ABOUT SECTION with Image --- */}
      <section id="about" className="py-24 bg-blue-50">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-[--brand-orange-dark] bg-blue-100 px-3 py-1 rounded-full text-sm font-semibold">
              ABOUT US
            </span>
            <h2 className="text-4xl font-bold text-gray-900 mt-6 mb-4">
              Why Choose Spur Connect?
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              At Spur Connect, we believe in making digital transactions
              seamless and accessible for everyone. Our platform is built on
              principles of speed, security, and affordability, ensuring you get
              the best value for your money with every transaction.
            </p>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-center gap-2">
                <CheckCircle size={20} className="text-[--brand-orange]" /> Instant
                Service Delivery
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle size={20} className="text-[--brand-orange]" /> 24/7
                Customer Support
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle size={20} className="text-[--brand-orange]" /> Secure
                Payment Gateways
              </li>
            </ul>
            <button className="mt-8 bg-[--brand-orange] text-white px-8 py-3 rounded-full hover:bg-[--brand-orange-dark] transition shadow-md">
              Learn More
            </button>
          </div>
          <div></div>
        </div>
      </section>

      {/* --- APP DOWNLOAD SECTION --- */}
      <section className="relative py-20 mx-4 my-10 rounded-md overflow-hidden">
        {/* Background image layer (covers) */}
        <div
          className="absolute inset-0 bg-center bg-cover"
          style={{ backgroundImage: "url('/phone.png')" }}
          aria-hidden="true"
        />

        {/* Dark gradient overlay to guarantee readable text */}
        <div
          className="absolute inset-0 bg-gradient-to-b from-black/60 to-black/35"
          aria-hidden="true"
        />

        {/* Content */}
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-5xl font-extrabold text-white leading-tight mb-4">
            Experience better mobile banking
          </h2>

          <p className="mx-auto max-w-2xl text-lg text-white/90 mb-8">
            Download our mobile app for seamless transactions, real-time
            notifications, and 24/7 support — all from your phone.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            {/* App Store */}
            <a
              href="/app-store-link"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Download on the App Store (opens in new tab)"
              className="w-full sm:w-auto inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-white text-black font-semibold shadow-md hover:shadow-lg transition focus:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
            >
              {/* simple phone/apple-like icon (generic) */}
              <svg
                className="w-6 h-6 flex-none"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <rect x="5" y="2" width="14" height="20" rx="3" />
              </svg>

              <span className="text-left leading-none">
                <span className="text-xs block">Download on the</span>
                <span className="text-lg font-bold block">App Store</span>
              </span>
            </a>

            {/* Google Play */}
            <a
              href="/google-play-link"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Get it on Google Play (opens in new tab)"
              className="w-full sm:w-auto inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-white text-black font-semibold shadow-md hover:shadow-lg transition focus:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
            >
              {/* generic play icon */}
              <svg
                className="w-6 h-6 flex-none"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M4 2v20l16-10L4 2z" />
              </svg>

              <span className="text-left leading-none">
                <span className="text-xs block">Get it on</span>
                <span className="text-lg font-bold block">Google Play</span>
              </span>
            </a>
          </div>

          {/* Optional small note */}
          <p className="mt-6 text-sm text-white/70">
            Available on iOS and Android.
          </p>
        </div>
      </section>

      {/* --- PRICING SECTION --- */}
      <section id="pricing" className="py-24 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black">Our Data Pricing</h2>
            <p className="text-gray-500">Affordable plans tailored for you.</p>
          </div>
          <div className="bg-white rounded-3xl shadow-sm overflow-hidden border border-gray-200">
            <table className="w-full text-left">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-sm font-bold">Network</th>
                  <th className="px-6 py-4 text-sm font-bold">Plan</th>
                  <th className="px-6 py-4 text-sm font-bold">Price</th>
                  <th className="px-6 py-4 text-sm font-bold">Validity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {PRICING.map((p, i) => (
                  <tr key={i} className="hover:bg-blue-50 transition">
                    <td className="px-6 py-4 font-semibold">{p.network}</td>
                    <td className="px-6 py-4 text-gray-600">{p.plan}</td>
                    <td className="px-6 py-4 font-bold text-[--brand-orange]">
                      {p.price}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {p.validity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* --- FAQ SECTION --- */}
      <section id="faq" className="py-24 max-w-3xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-12">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          {[
            {
              q: "Is MadiTel/Spur Connect secure?",
              a: "Yes, we use bank-level encryption to ensure all transactions and user data are 100% protected.",
            },
            {
              q: "Can I check my WAEC/NECO results here?",
              a: "Absolutely! Simply navigate to the Exam Pin section to purchase your result checker instantly.",
            },
            {
              q: "How do I become an Agent?",
              a: "Register an account and upgrade your status to 'Agent' in your dashboard to enjoy wholesale prices.",
            },
          ].map((item, i) => (
            <div
              key={i}
              className="border border-gray-200 rounded-2xl overflow-hidden"
            >
              <button
                className="w-full text-left px-6 py-5 font-bold flex justify-between items-center"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                {item.q}
                <ChevronDown
                  className={`transition-transform ${openFaq === i ? "rotate-180" : ""}`}
                />
              </button>
              {openFaq === i && (
                <div className="px-6 pb-5 text-gray-500 text-sm leading-relaxed">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="bg-gray-900 text-gray-400 py-20 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center gap-2 mb-6">
              <Zap className="text-blue-500 fill-current" />
              <span className="text-white text-xl font-bold">{app_name}</span>
            </div>
            <p className="text-sm">
              Your all-in-one digital solution platform for airtime, data, and
              bill payments.
            </p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-6">Links</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a href="#" className="hover:text-blue-400">
                  About Us
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-blue-400">
                  Pricing Plan
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-blue-400">
                  Contact Us
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-6">Contact</h4>
            <p className="text-sm">Ilorin, Kwara State, Nigeria</p>
            <p className="text-sm mt-2">support@spurconnect.com</p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-6">Newsletter</h4>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Email"
                className="bg-gray-800 border-none rounded-lg px-4 py-2 w-full text-sm outline-none focus:ring-1 ring-blue-500"
              />
              <button className="bg-[--brand-orange] text-white px-4 py-2 rounded-lg text-sm font-bold">
                Join
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* WhatsApp Support Button */}
      <a
        href="https://wa.me/234..."
        className="fixed bottom-6 right-6 bg-green-500 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform z-50"
      >
        <MessageCircle size={28} />
      </a>
    </div>
  );
};

export default App;
