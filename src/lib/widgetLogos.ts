import { Directory, File } from "expo-file-system";
import { getCompanyLogoSource } from "@/lib/companyLogos";
import { getSharedDirectory } from "../../modules/coupon-widget";

/**
 * Company logos for the home-screen widget.
 *
 * `getCompanyLogoSource` now always returns a remote URL (the Supabase
 * `company-logos` bucket, the legacy host, or a favicon fallback). A widget
 * extension is a separate process with no network stack of its own, so the app
 * downloads the handful of logos it actually needs (at most 4) into a directory
 * both processes can read, and the payload carries file paths.
 */

/** Filesystem-safe, stable name for a coupon's logo. */
function logoFileName(couponId: number, extension: string): string {
  return `coupon-${couponId}.${extension}`;
}

function extensionOf(uri: string): string {
  const match = /\.(png|jpe?g|webp|gif)(?:[?#]|$)/i.exec(uri);
  return match ? match[1].toLowerCase() : "png";
}

/**
 * Materialises one coupon's logo into `directory` and returns its path, or null
 * when there is nothing usable to copy.
 */
async function materialiseLogo(
  couponId: number,
  company: string,
  dbImagePath: string | null,
  directory: string
): Promise<string | null> {
  try {
    const source = getCompanyLogoSource(company, dbImagePath);

    // Bundled handles are gone; guard anyway so the types stay honest.
    if (typeof source === "number") return null;

    if (!/^https?:\/\//i.test(source.uri)) return null;

    const target = new File(directory, logoFileName(couponId, extensionOf(source.uri)));
    if (target.exists) target.delete();
    const downloaded = await File.downloadFileAsync(source.uri, target);
    return downloaded.uri.replace(/^file:\/\//, "");
  } catch {
    // A missing logo is cosmetic — the widget falls back to initials.
    return null;
  }
}

export type LogoRequest = {
  couponId: number;
  company: string;
  dbImagePath: string | null;
};

/**
 * Copies each coupon's logo into shared storage.
 * Returns coupon id -> absolute file path for the ones that succeeded.
 */
export async function prepareWidgetLogos(
  requests: LogoRequest[]
): Promise<Record<number, string>> {
  const directory = getSharedDirectory();
  if (!directory) return {};

  const dir = new Directory(directory);
  if (!dir.exists) dir.create({ intermediates: true });

  const results = await Promise.all(
    requests.map(async (request) => {
      const path = await materialiseLogo(
        request.couponId,
        request.company,
        request.dbImagePath,
        directory
      );
      return [request.couponId, path] as const;
    })
  );

  return Object.fromEntries(results.filter(([, path]) => path !== null)) as Record<
    number,
    string
  >;
}
