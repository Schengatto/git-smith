import { mdToPdf } from "md-to-pdf";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const input = path.join(root, "USER_MANUAL.md");
const output = path.join(root, "USER_MANUAL.pdf");

const pdf = await mdToPdf({ path: input }, { dest: output });
if (pdf?.filename) {
  console.log(`PDF generated: ${pdf.filename}`);
} else {
  console.error("Failed to generate PDF");
  process.exit(1);
}
