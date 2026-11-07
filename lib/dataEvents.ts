/**
 * 単語が、画面の外から変わったこと（「元に戻す」で単語が戻った、など）を、開いている画面に知らせる
 * 画面は、subscribe で受け取って、一覧を読み直す
 */
type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeDataChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyDataChanged(): void {
  for (const listener of Array.from(listeners)) listener();
}
