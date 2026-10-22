import { useEffect, useState } from "react";
import { useRepository } from "@/db/AppDatabase";
import type { Deck } from "@/db/types";

/**
 * 単語を入れる単語帳（画面では1冊として扱う）を読み込む
 * 読み込めるまでは deck が null。失敗したら error に文章が入る
 */
export function useDefaultDeck(): { deck: Deck | null; error: string | null } {
  const repository = useRepository();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    repository
      .getDefaultDeck()
      .then((found) => active && setDeck(found))
      .catch(() => active && setError("単語帳を読み込めませんでした"));
    return () => {
      active = false;
    };
  }, [repository]);

  return { deck, error };
}
