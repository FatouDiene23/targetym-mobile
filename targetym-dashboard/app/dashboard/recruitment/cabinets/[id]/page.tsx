import CabinetDetailClient from './CabinetDetailClient';

export async function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function CabinetDetailPage() {
  return <CabinetDetailClient />;
}
