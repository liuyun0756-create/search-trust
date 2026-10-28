"use client";
import { useEffect, useState } from "react";
import {
  errorMessage,
  requestWorkspace,
  type Identity,
  type PublicCommand,
} from "@/lib/review-workspace/client";
import type {
  Cursor,
  Directory,
  DirectoryItem,
  Target,
} from "@/lib/review-workspace/types";
import { instant } from "./EvidenceFacts";
import styles from "./workspace.module.css";

// Shared bounded directory: an error is never rendered as an empty result.
export function useDirectory(
  identity: Identity,
  command: PublicCommand,
  onFailure?: (e: unknown) => void,
) {
  const key = JSON.stringify(command),
    identityKey = JSON.stringify(identity);
  const [items, setItems] = useState<DirectoryItem[]>([]),
    [cursor, setCursor] = useState<Cursor | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading"),
    [message, setMessage] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setItems([]);
    setCursor(null);
    setState("loading");
    setMessage("");
    void requestWorkspace(
      JSON.parse(identityKey),
      JSON.parse(key),
      controller.signal,
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        if (!("items" in result)) throw new Error("directory");
        setItems(result.items);
        setCursor(result.next_cursor);
        setState("ready");
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setState("error");
          setMessage(errorMessage(error));
          onFailure?.(error);
        }
      });
    return () => controller.abort();
    // Each request is captured by its serialized identity/command; callbacks do not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, identityKey, retry]);
  async function more() {
    if (state === "loading" || !cursor) return;
    setState("loading");
    setMessage("");
    try {
      const result = (await requestWorkspace(identity, {
        ...command,
        cursor,
      } as PublicCommand)) as Directory;
      if (!("items" in result)) throw new Error("directory");
      setItems((old) => [
        ...old,
        ...result.items.filter(
          (n) => !old.some((o) => o.id === n.id && o.revision === n.revision),
        ),
      ]);
      setCursor(result.next_cursor);
      setState("ready");
    } catch (error) {
      setState("error");
      setMessage(errorMessage(error));
      onFailure?.(error);
    }
  }
  return {
    items,
    cursor,
    state,
    message,
    more,
    retry: () =>
      items.length && cursor ? void more() : setRetry((n) => n + 1),
  };
}

export function DirectoryStatus({
  directory: d,
  empty,
}: {
  directory: ReturnType<typeof useDirectory>;
  empty: string;
}) {
  return (
    <>
      {d.state === "loading" && (
        <p role="status" className={styles.small}>
          Loading saved records…
        </p>
      )}
      {d.message && (
        <p role="alert" className={styles.warning}>
          {d.message}{" "}
          <button type="button" onClick={d.retry}>
            Retry
          </button>
        </p>
      )}
      {d.state === "ready" && !d.items.length && (
        <p className={styles.notice}>{empty}</p>
      )}
      {d.cursor && d.state === "ready" && (
        <button
          type="button"
          className={styles.textButton}
          onClick={() => void d.more()}
        >
          Load earlier records
        </button>
      )}
    </>
  );
}
export function SourcePicker({
  identity,
  target,
  actionId,
  kind,
  value,
  previous,
  onChange,
  onPrevious,
  onFailure,
  disabled,
}: {
  identity: Identity;
  target: Target;
  actionId: string;
  kind: "page" | "gsc" | "ga4";
  value: string | null;
  previous?: string | null;
  onChange: (v: string | null) => void;
  onPrevious?: (v: string | null) => void;
  onFailure: (e: unknown) => void;
  disabled: boolean;
}) {
  const directory = useDirectory(
    identity,
    { operation: "candidates", kind, target, action_id: actionId },
    onFailure,
  );
  const label =
    kind === "page"
      ? "page check"
      : kind === "gsc"
        ? "Search Console comparison"
        : "Google Analytics collection";
  const options = (chosen: string | null, exclude?: string | null) => (
    <>
      <option value="">Not selected</option>
      {chosen && !directory.items.some((i) => i.id === chosen) && (
        <option value={chosen}>Selected record · {chosen}</option>
      )}
      {directory.items
        .filter((i) => i.id !== exclude)
        .map((i) => (
          <option key={i.id} value={i.id}>
            {instant(i.at)} · {i.id.slice(0, 8)}
          </option>
        ))}
    </>
  );
  return (
    <div className={styles.picker}>
      <label>
        Choose a saved {label}
        <select
          value={value ?? ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value || null)}
        >
          {options(value)}
        </select>
      </label>
      {kind === "page" && value && (
        <label>
          Previous check · optional
          <select
            value={previous ?? ""}
            disabled={disabled}
            onChange={(e) => onPrevious?.(e.target.value || null)}
          >
            {options(previous ?? null, value)}
          </select>
        </label>
      )}
      <DirectoryStatus
        directory={directory}
        empty="No saved source is available for this action."
      />
      <p className={styles.small}>
        Only records for this exact action and implementation version are
        available. Selecting a record does not collect new data.
      </p>
    </div>
  );
}
