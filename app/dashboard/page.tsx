import { redirect } from 'next/navigation';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  redirect(params?.tab === 'simcards' ? '/simcards' : '/dispositivos');
}

