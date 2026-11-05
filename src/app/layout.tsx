import Providers from '@/components/layout/providers';
import { Toaster } from '@/components/ui/sonner';
import { DEFAULT_THEME } from '@/components/themes/theme.config';
import ThemeProvider from '@/components/themes/theme-provider';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';
import { Barlow, Barlow_Condensed, JetBrains_Mono } from 'next/font/google';
import '../styles/globals.css';

const sans = Barlow({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-sans' });
const display = Barlow_Condensed({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-display' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Vasl Console',
  description: 'Management console for Vasl Media Server',
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en' suppressHydrationWarning className={cn(sans.variable, display.variable, mono.variable)} data-theme={DEFAULT_THEME}>
      <body className='bg-background text-foreground overflow-x-hidden font-sans antialiased'>
        <ThemeProvider attribute='class' defaultTheme='dark' enableSystem={false} themes={['light', 'dark']}>
          <Providers activeThemeValue={DEFAULT_THEME}>
            <Toaster />
            {children}
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
