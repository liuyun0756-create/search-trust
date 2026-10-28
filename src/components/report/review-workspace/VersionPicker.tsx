"use client";
import { useState } from "react";
import type { Identity } from "@/lib/review-workspace/client";
import type { Target } from "@/lib/review-workspace/types";
import { useDirectory, DirectoryStatus } from "./SourcePicker";
import { instant } from "./EvidenceFacts";
import styles from "./workspace.module.css";
export function SavedHistory({
  identity,
  onOpen,
  onFailure,
}: {
  identity: Identity;
  onOpen: (id: string) => void;
  onFailure: (e: unknown) => void;
}) {
  const directory = useDirectory(
    identity,
    { operation: "history", kind: "history" },
    onFailure,
  );
  return (
    <section className={styles.history}>
      <p className={styles.eyebrow}>Saved snapshots</p>
      <h2>Return to an exact review.</h2>
      <p>
        Saved evidence stays pinned to its original versions. Newer records do
        not replace it.
      </p>
      <ul>
        {directory.items.map((i) => (
          <li key={i.id}>
            <button type="button" onClick={() => onOpen(i.id)}>
              <strong>{instant(i.at)}</strong>
              <span>
                Delivery {i.delivery_revision} · {i.id.slice(0, 8)} →
              </span>
            </button>
          </li>
        ))}
      </ul>
      <DirectoryStatus
        directory={directory}
        empty="No evidence snapshots have been saved for this report."
      />
    </section>
  );
}
function Implementations({
  identity,
  deliveryId,
  onSelect,
  onFailure,
}: {
  identity: Identity;
  deliveryId: string;
  onSelect: (t: Target) => void;
  onFailure: (e: unknown) => void;
}) {
  const directory = useDirectory(
    identity,
    { operation: "versions", kind: "implementations", delivery_id: deliveryId },
    onFailure,
  );
  return (
    <section>
      <h3>02 · Choose a saved implementation</h3>
      <p className={styles.small}>
        Select the version you intend to review—not automatically the latest.
      </p>
      <ul className={styles.versionList}>
        {directory.items.map((i) => (
          <li key={`${i.id}:${i.revision}`}>
            <button
              type="button"
              onClick={() =>
                onSelect({
                  delivery_id: deliveryId,
                  implementation_id: i.id,
                  implementation_revision: i.revision,
                })
              }
            >
              <strong>Implementation revision {i.revision}</strong>
              <span>{instant(i.at)} →</span>
            </button>
          </li>
        ))}
      </ul>
      <DirectoryStatus
        directory={directory}
        empty="Save an implementation record before preparing review evidence."
      />
    </section>
  );
}
export function VersionPicker({
  identity,
  onSelect,
  onFailure,
}: {
  identity: Identity;
  onSelect: (t: Target) => void;
  onFailure: (e: unknown) => void;
}) {
  const directory = useDirectory(
      identity,
      { operation: "versions", kind: "deliveries" },
      onFailure,
    ),
    [delivery, setDelivery] = useState("");
  return (
    <section className={styles.versionPicker}>
      <div>
        <p className={styles.eyebrow}>Choose your review basis</p>
        <h2>Keep the versions explicit.</h2>
        <label>
          01 · Approved delivery
          <select
            value={delivery}
            onChange={(e) => setDelivery(e.target.value)}
          >
            <option value="">Choose an approved version</option>
            {directory.items.map((i) => (
              <option key={i.id} value={i.id}>
                Delivery revision {i.delivery_revision} · {instant(i.at)}
              </option>
            ))}
          </select>
        </label>
        <DirectoryStatus
          directory={directory}
          empty="No approved delivery is available for this report."
        />
      </div>
      {delivery && (
        <Implementations
          key={delivery}
          identity={identity}
          deliveryId={delivery}
          onSelect={onSelect}
          onFailure={onFailure}
        />
      )}
    </section>
  );
}
