import { useEffect, useState } from "react";
import type { Repository } from "@/db/repository";

/**
 * 入力中の単語が、同じ単語帳にすでにあるかを調べ、あれば警告文を返す
 * 入力のたびに DB を引かないよう、打ち終わって 300ms 待ってから調べる
 */
export function useDuplicateWarning(repository: Repository, deckId: string | undefined, term: string, excludeCardId?: string): string | null {
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = term.trim();
    if (!deckId || !trimmed) {
      setWarning(null);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      repository
        .findDuplicates(deckId, trimmed, excludeCardId)
        .then((found) => {
          if (!active) return;
          setWarning(found.length > 0 ? `単語帳に、すでに${found.length}件あります（意味: ${found[0].meaning || "なし"}）` : null);
        })
        .catch(() => active && setWarning(null));
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [repository, deckId, term, excludeCardId]);

  return warning;
}
