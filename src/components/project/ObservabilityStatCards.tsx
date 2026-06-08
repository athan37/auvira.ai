import { Card } from '@/components/ui/Card';

export function ObservabilityStatCards({
  cards,
}: {
  cards: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.label} variant="glass" className="p-4">
          <p className="text-xs uppercase tracking-wide text-[#86868b]">{card.label}</p>
          <p className="text-xl font-semibold text-[#1d1d1f] mt-1">{card.value}</p>
        </Card>
      ))}
    </div>
  );
}
