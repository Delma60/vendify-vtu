import { B } from "@/lib/utils";
import { ToggleLeft, ToggleRight } from "lucide-react";

export function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className="flex items-center transition-all active:scale-95 disabled:opacity-40"
    >
      {checked ? (
        <ToggleRight size={26} style={{ color: B.green }} strokeWidth={2} />
      ) : (
        <ToggleLeft size={26} style={{ color: B.textFaint }} strokeWidth={2} />
      )}
    </button>
  );
}
