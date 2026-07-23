import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export type PickerCompany = {
  name: string;
  logo: string;
};

type CompanyPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: PickerCompany[];
  value: string;
  onSelect: (companyName: string) => void;
  onSelectOther: () => void;
};

// Grid picker of company logos + names, mirroring the iOS CompanyPickerView:
// sorted list, tap to select, an "אחר" (other) tile at the end for a custom name.
export function CompanyPicker({ open, onOpenChange, companies, value, onSelect, onSelectOther }: CompanyPickerProps) {
  const [query, setQuery] = useState("");

  const sorted = useMemo(
    () => [...companies].sort((a, b) => a.name.localeCompare(b.name, "he")),
    [companies]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((company) => company.name.toLowerCase().includes(q));
  }, [sorted, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="legacy-modal-content company-picker-modal-react" dir="rtl">
        <DialogHeader>
          <DialogTitle>בחר חברה</DialogTitle>
        </DialogHeader>

        <div className="company-picker-search">
          <Search className="company-picker-search-icon" aria-hidden />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="חיפוש חברה..."
            aria-label="חיפוש חברה"
          />
        </div>

        <div className="company-picker-grid">
          {filtered.map((company) => (
            <button
              key={company.name}
              type="button"
              className={`company-picker-tile${value === company.name ? " is-selected" : ""}`}
              onClick={() => {
                onSelect(company.name);
                onOpenChange(false);
              }}
            >
              <span className="company-picker-logo">
                <img
                  src={company.logo}
                  alt={company.name}
                  loading="lazy"
                  onError={(event) => {
                    (event.target as HTMLImageElement).src = "/legacy-images/default.png";
                  }}
                />
              </span>
              <span className="company-picker-name">{company.name}</span>
            </button>
          ))}

          <button
            type="button"
            className="company-picker-tile company-picker-tile-other"
            onClick={() => {
              onSelectOther();
              onOpenChange(false);
            }}
          >
            <span className="company-picker-logo company-picker-logo-other">
              <Plus aria-hidden />
            </span>
            <span className="company-picker-name">אחר</span>
          </button>

          {filtered.length === 0 && (
            <p className="company-picker-empty">לא נמצאו חברות תואמות. אפשר לבחור "אחר" ולהזין שם חדש.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
