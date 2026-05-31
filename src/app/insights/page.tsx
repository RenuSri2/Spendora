import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import InsightsDashboard from '@/components/insights/InsightsDashboard';

export const metadata: Metadata = {
  title: 'Financial Insights | Sephora',
  description: 'Gain valuable insights into your spending patterns and saving opportunities.',
};

export default async function InsightsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login?callbackUrl=/insights');
  }

  return (
    <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <InsightsDashboard />
    </div>
  );
}
