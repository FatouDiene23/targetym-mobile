import VariablesClient from './VariablesClient';

export async function generateStaticParams() {
  return [{ runId: 'placeholder' }];
}

export default function VariablesPage() {
  return <VariablesClient />;
}
