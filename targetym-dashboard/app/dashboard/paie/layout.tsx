import AddonGate from '@/components/AddonGate';

export default function PaieLayout({ children }: { children: React.ReactNode }) {
  return <AddonGate module="payroll">{children}</AddonGate>;
}
