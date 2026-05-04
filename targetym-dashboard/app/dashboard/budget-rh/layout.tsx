import AddonGate from '@/components/AddonGate';

export default function BudgetRhLayout({ children }: { children: React.ReactNode }) {
  return <AddonGate module="budget_rh">{children}</AddonGate>;
}
