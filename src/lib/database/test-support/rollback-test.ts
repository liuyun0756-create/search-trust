import type {PGlite, Transaction} from '@electric-sql/pglite';

/** Keep writes by one test out of the next test on this file's migrated database. */
export async function withRolledBackTransaction(
  db: PGlite,
  test: (tx: Transaction) => Promise<void>,
): Promise<void> {
  await db.transaction(async tx => {
    try {
      await test(tx);
    } finally {
      await tx.rollback();
    }
  });
}
