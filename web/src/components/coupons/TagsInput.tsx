import { useState, KeyboardEvent } from 'react';
import { useTags } from '@/hooks/useTags';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface TagsInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}

export function TagsInput({ value, onChange, disabled }: TagsInputProps) {
  const [input, setInput] = useState('');
  const { data: allTags } = useTags();

  const addTag = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setInput('');
  };

  const removeTag = (name: string) => onChange(value.filter((t) => t !== name));

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && value.length) {
      removeTag(value[value.length - 1]);
    }
  };

  const suggestions = (allTags || [])
    .map((t) => t.name)
    .filter((name) => !value.includes(name) && input && name.toLowerCase().includes(input.toLowerCase()))
    .slice(0, 6);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 rounded-md border border-input p-2 min-h-[42px]">
        {value.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1">
            {tag}
            {!disabled && (
              <button type="button" onClick={() => removeTag(tag)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => input && addTag(input)}
          disabled={disabled}
          placeholder={value.length ? '' : 'הוסף תגית ולחץ Enter...'}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-sm"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suggestions.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => addTag(name)}
              className="text-xs rounded-full border px-2 py-0.5 text-muted-foreground hover:bg-accent"
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
