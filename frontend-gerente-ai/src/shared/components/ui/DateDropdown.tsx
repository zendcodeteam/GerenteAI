import { Calendar } from "lucide-react";

interface DateDropdownProps {
  value?: string;
  onChange?: (value: string) => void;
  options?: {
    value: string;
    label: string;
  }[];
}

export function DateDropdown({
  value = "30",
  onChange,
  options = [
    {
      value: "7",
      label: "Últimos 7 días",
    },
    {
      value: "30",
      label: "Últimos 30 días",
    },
    {
      value: "this_month",
      label: "Este mes",
    },
    {
      value: "this_year",
      label: "Este año",
    },
  ],
}: DateDropdownProps) {
  return (
    <div className="relative inline-flex items-center">
      <Calendar
        className="
          absolute
          left-2.5
          z-10
          h-4
          w-4
          pointer-events-none
          text-muted-foreground
        "
        aria-hidden="true"
      />

      <select
        value={value}
        onChange={(event) =>
          onChange?.(
            event.target.value,
          )
        }
        className="
          appearance-none
          cursor-pointer
          rounded-lg
          border
          border-border
          bg-muted/50
          py-2
          pl-8
          pr-7
          text-xs
          font-bold
          text-foreground
          outline-none
          transition-all

          hover:bg-muted

          focus:border-indigo-500
          focus:ring-2
          focus:ring-indigo-500/20

          [&>option]:bg-background
          [&>option]:text-foreground
        "
      >
        {options.map(
          (option) => (
            <option
              key={option.value}
              value={option.value}
              className="
                bg-background
                text-foreground
              "
            >
              {option.label}
            </option>
          ),
        )}
      </select>

      <div
        className="
          absolute
          right-2.5
          pointer-events-none
          text-muted-foreground
        "
        aria-hidden="true"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </div>
  );
}