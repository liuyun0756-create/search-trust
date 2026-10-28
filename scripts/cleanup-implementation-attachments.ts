// Explicit, bounded maintenance. Does not load environment files or schedule itself.
import {isImplementationAttachmentsEnabled} from "../src/lib/implementation-attachments/config";
import {attachmentClient} from "../src/lib/implementation-attachments/server";
import {PrivateAttachmentStorage} from "../src/lib/implementation-attachments/storage";
import {cleanupAttachments} from "../src/lib/implementation-attachments/cleanup";
async function main() {
  if (process.argv.includes("--help")) {
    console.log("With explicitly supplied environment: node --conditions=react-server --import tsx scripts/cleanup-implementation-attachments.ts --run. Processes at most 20 expired/removal records. Never loads .env. Requires attachment and implementation feature flags.");return;
  }
  if (!process.argv.includes("--run") || !isImplementationAttachmentsEnabled()) throw new Error("Cleanup disabled or --run missing");
  const db=attachmentClient();console.log(JSON.stringify(await cleanupAttachments(db,new PrivateAttachmentStorage(db))));
}
main().catch(()=>{console.error("Attachment maintenance unavailable; no sensitive details logged.");process.exitCode=1;});
