import { Asset } from "expo-asset";
import { Directory, File } from "expo-file-system";
import { getCompanyLogoSource } from "@/lib/companyLogos";
import { getSharedDirectory } from "../../modules/coupon-widget";

/**
 * Company logos for the home-screen widget.
 *
 * The app draws logos from Metro-bundled assets (`getCompanyLogoSource` returns
 * a `require()` handle for the 66 bundled files). A widget extension is a
 * separate process with no access to the JS bundle, so it cannot use those.
 *
 * Remote URLs are not a fallback either: `resolveCompanyLogo` points at a
 * Supabase `company-logos` bucket that does not exist, and every request there
 * returns `NoSuchBucket`. That is why the widget showed initials.
 *
 * So the app copies the handful of logos it actually needs (at most 4) into a
 * directory both processes can read, and the payload carries file paths.
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

    // A bundled asset: Metro gives it to us as a module handle.
    if (typeof source === "number") {
      const asset = Asset.fromModule(source);
      await asset.downloadAsync();
      const localUri = asset.localUri ?? asset.uri;
      if (!localUri) return null;

      const target = new File(directory, logoFileName(couponId, extensionOf(localUri)));
      if (target.exists) target.delete();
      new File(localUri).copy(target);
      return target.uri.replace(/^file:\/\//, "");
    }

    // A remote URL — only reachable for coupons whose DB row carries a full
    // https path, since the storage bucket is missing.
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
