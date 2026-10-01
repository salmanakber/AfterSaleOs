import { Fraunces, DM_Sans } from "next/font/google";
import "./customer.css";
import { ThemeProvider } from "./components/ThemeToggle";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--as-font-display",
});

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--as-font-sans",
  weight: ["400", "500", "600", "700"],
});

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`as-customer-root ${display.variable} ${sans.variable}`}>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem('aftersale-theme');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light');document.documentElement.style.colorScheme=t==='dark'?'dark':'light';}catch(e){document.documentElement.setAttribute('data-theme','light')}})();`,
        }}
      />
      <div className="as-atmosphere" aria-hidden="true">
        <span className="as-orb as-orb-a" />
        <span className="as-orb as-orb-b" />
        <span className="as-orb as-orb-c" />
        <span className="as-grain" />
        <span className="as-grid" />
      </div>
      <ThemeProvider>{children}</ThemeProvider>
    </div>
  );
}
