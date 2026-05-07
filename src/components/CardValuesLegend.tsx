import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

const PRIMIERA_POINTS: Record<number, number> = {
  7: 21,
  6: 18,
  1: 16,
  5: 15,
  4: 14,
  3: 13,
  2: 12,
  10: 10,
  9: 10,
  8: 10,
};

const CARD_ROWS: { points: number; labelKey: string }[] = [
  { points: 21, labelKey: "premiera.seven" },
  { points: 18, labelKey: "premiera.six" },
  { points: 16, labelKey: "premiera.ace" },
  { points: 15, labelKey: "premiera.five" },
  { points: 14, labelKey: "premiera.four" },
  { points: 13, labelKey: "premiera.three" },
  { points: 12, labelKey: "premiera.two" },
];

type CardValuesLegendProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tr: (key: string, params?: Record<string, string>) => string;
};

// Opacity scale: 21 (highest) = full, 10 (lowest) = faded
function pointOpacity(points: number): number {
  return 0.4 + 0.6 * ((points - 10) / (21 - 10));
}

function CardGrid({ tr }: { tr: (key: string) => string }) {
  return (
    <div className="space-y-1">
      {CARD_ROWS.map(({ points, labelKey }) => (
        <div
          key={labelKey}
          className="flex items-center justify-between px-1 py-1"
        >
          <span className="text-base font-medium">{tr(labelKey)}</span>
          <span className="flex-1 mx-2 border-b border-dotted border-border/60" />
          <span
            className="text-lg font-bold text-primary"
            style={{ opacity: pointOpacity(points) }}
          >
            {points}
          </span>
        </div>
      ))}
      <div className="flex items-center justify-between px-1 py-1">
        <span className="text-sm font-medium text-muted-foreground">
          {tr("premiera.fante")}, {tr("premiera.cavallo")}, {tr("premiera.re")}
        </span>
        <span className="flex-1 mx-2 border-b border-dotted border-border/60" />
        <span
          className="text-lg font-bold text-primary"
          style={{ opacity: pointOpacity(10) }}
        >
          10
        </span>
      </div>
    </div>
  );
}

export function CardValuesLegend({
  open,
  onOpenChange,
  tr,
}: CardValuesLegendProps) {
  const isMobile = useIsMobile();

  const handleClose = () => onOpenChange(false);

  return (
    <>
      {/* Bottom sheet: Your view (normal) */}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="h-auto max-h-[45vh] overflow-y-auto p-0"
        >
          <div className="max-w-lg mx-auto">
            <SheetHeader className="px-4 pt-2 pb-2">
              <SheetTitle>{tr("cardValues.title")}</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4 pt-2">
              <CardGrid tr={tr} />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Top sheet: For showing to others (rotated) - mobile only */}
      {isMobile && (
        <Sheet open={open} onOpenChange={handleClose}>
          <SheetContent
            side="top"
            overlay={false}
            className="h-auto max-h-[45vh] overflow-y-auto p-0"
          >
            <div className="max-w-lg mx-auto">
              <div className="px-4 pb-2 pt-4">
                <div
                  className="flex justify-center"
                  style={{ transform: "rotate(180deg)" }}
                >
                  <CardGrid tr={tr} />
                </div>
              </div>
              <SheetHeader className="px-4 pt-2 pb-2">
                <SheetTitle style={{ transform: "rotate(180deg)" }}>
                  {tr("cardValues.title")}
                </SheetTitle>
              </SheetHeader>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
