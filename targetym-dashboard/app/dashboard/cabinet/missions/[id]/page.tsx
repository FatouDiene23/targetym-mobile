import MissionDetailClient from './MissionDetailClient';

export async function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function MissionDetailPage() {
  return <MissionDetailClient />;
}
