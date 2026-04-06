import RecapClient from './RecapClient';

export async function generateStaticParams() {
  return [{ runId: 'placeholder' }];
}

export default function RecapPage() {
  return <RecapClient />;
}
