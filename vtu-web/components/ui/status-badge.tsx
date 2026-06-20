import { B } from "@/lib/utils";

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px] font-bold"
      style={{
        background: active ? B.greenLight : B.redLight,
        color: active ? B.green : B.red,
      }}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}