import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { useAddCoupon, useUpdateCoupon, useCoupons, DecryptedCoupon } from "@/hooks/useCoupons";
import { useCouponTags, useSetCouponTags } from "@/hooks/useTags";
import { useAuth } from "@/contexts/AuthContext";
import { notify } from "@/lib/notify";
import { clearCouponDraft, loadCouponDraft, saveCouponDraft } from "@/lib/couponDraft";
import {
  buildCouponPayload,
  findDuplicateCoupons,
  getDefaultAutoProvider,
  normalizeAutoProvider,
  validateCouponForm,
  type AutoProvider,
  type CouponFormErrors,
  type CouponFormFields,
} from "@/lib/couponForm";

export type UseCouponFormArgs = {
  existingCoupon?: DecryptedCoupon;
  initialCompany?: string;
  initialCode?: string;
  initialValue?: string;
  initialCost?: string;
  initialExpiration?: string;
  initialDescription?: string;
  initialCvv?: string;
  initialCardExp?: string;
};

/**
 * All of the add/edit coupon form except its markup: field state, the draft
 * that survives a failed save, tag editing, and the submit sequence.
 *
 * Split out of AddEditCouponScreen so the screen is a form to look at and this
 * is a form to reason about. The pure parts — validation and the row the
 * fields turn into — live in lib/couponForm.ts and are tested there.
 */
export function useCouponForm({
  existingCoupon,
  initialCompany,
  initialCode,
  initialValue,
  initialCost,
  initialExpiration,
  initialDescription,
  initialCvv,
  initialCardExp,
}: UseCouponFormArgs) {
  const router = useRouter();
  const isEditing = existingCoupon !== undefined;

  const addCoupon = useAddCoupon();
  const updateCoupon = useUpdateCoupon();
  const { data: allCoupons = [] } = useCoupons();
  const setCouponTags = useSetCouponTags();
  const { data: existingTags = [] } = useCouponTags(existingCoupon?.id);
  const { user } = useAuth();
  const showAutoUsageUpdater = user?.id === 1;

  const [company, setCompany] = useState(
    existingCoupon?.company || initialCompany || ""
  );
  const [code, setCode] = useState(existingCoupon?.code || initialCode || "");
  const [value, setValue] = useState(
    existingCoupon?.value ? String(existingCoupon.value) : initialValue || ""
  );
  const [cost, setCost] = useState(
    existingCoupon?.cost !== undefined ? String(existingCoupon.cost) : initialCost || "0"
  );
  // Sliced to `YYYY-MM-DD`: the date field (and the column) only carry the day,
  // but older rows can come back with a time component attached.
  const [expiration, setExpiration] = useState(
    (existingCoupon?.expiration || initialExpiration || "").slice(0, 10)
  );
  const [isOneTime, setIsOneTime] = useState(Boolean(existingCoupon?.is_one_time));
  const [purpose, setPurpose] = useState(existingCoupon?.purpose || "");
  const [description, setDescription] = useState(
    existingCoupon?.description || initialDescription || ""
  );
  const [includeCardInfo, setIncludeCardInfo] = useState(
    Boolean(existingCoupon?.cvv || existingCoupon?.card_exp || initialCvv || initialCardExp)
  );
  const [cvv, setCvv] = useState(existingCoupon?.cvv || initialCvv || "");
  const [cardExp, setCardExp] = useState(existingCoupon?.card_exp || initialCardExp || "");
  // The automatic balance updater only runs for the maintainer's own account,
  // so everyone else stores `auto_download_details: null` and never sees it.
  const [autoProvider, setAutoProvider] = useState<AutoProvider | null>(() =>
    normalizeAutoProvider(
      existingCoupon?.auto_download_details ??
        getDefaultAutoProvider(existingCoupon?.company || initialCompany),
      showAutoUsageUpdater
    )
  );
  const [redemptionUrl, setRedemptionUrl] = useState(
    existingCoupon?.buyme_coupon_url ||
      existingCoupon?.strauss_coupon_url ||
      existingCoupon?.xgiftcard_coupon_url ||
      existingCoupon?.xtra_coupon_url ||
      ""
  );

  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [isCompanyPickerOpen, setIsCompanyPickerOpen] = useState(false);
  const [errors, setErrors] = useState<CouponFormErrors>({});

  useEffect(() => {
    if (isEditing) return;
    void loadCouponDraft().then((draft) => {
      if (!draft) return;
      setCompany(draft.company);
      setCode(draft.code);
      setValue(draft.value);
      setCost(draft.cost);
      setExpiration(draft.expiration);
      setIsOneTime(Boolean(draft.isOneTime));
      setPurpose(draft.purpose || "");
      setDescription(draft.description);
      setIncludeCardInfo(draft.includeCardInfo);
      setCvv(draft.cvv);
      setCardExp(draft.cardExp);
      setRedemptionUrl(draft.redemptionUrl);
    });
  }, [isEditing]);

  useEffect(() => {
    if (existingTags.length > 0) {
      setTags(existingTags.map((t) => t.name));
    }
  }, [existingTags]);

  // Picking a company suggests its provider, but never overrides an explicit
  // choice the user already made.
  const handleSelectCompany = (name: string) => {
    setCompany(name);
    if (showAutoUsageUpdater && !autoProvider) {
      setAutoProvider(getDefaultAutoProvider(name));
    }
  };

  const handleAddTag = () => {
    const trimmed = newTagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setNewTagInput("");
    }
  };

  const handleRemoveTag = (tagName: string) => {
    setTags(tags.filter((t) => t !== tagName));
  };

  const currentFields = (): CouponFormFields => ({
    company,
    code,
    value,
    cost,
    expiration,
    isOneTime,
    purpose,
    description,
    includeCardInfo,
    cvv,
    cardExp,
    redemptionUrl,
    autoProvider,
  });

  const persistDraft = () =>
    saveCouponDraft({
      company,
      code,
      value,
      cost,
      expiration,
      isOneTime,
      purpose,
      description,
      cvv,
      cardExp,
      redemptionUrl,
      includeCardInfo,
    });

  useEffect(() => {
    if (isEditing) return;
    const timer = setTimeout(() => void persistDraft(), 600);
    return () => clearTimeout(timer);
  }, [cardExp, code, company, cost, cvv, description, expiration, includeCardInfo, isEditing, isOneTime, purpose, redemptionUrl, value]);

  /**
   * Tags are a second write, and the coupon is already saved by the time it
   * runs. Failing it must not read as "the coupon was not saved" — that sends
   * the user back to save again, which in add mode means a duplicate coupon.
   */
  const applyTags = async (couponId: number): Promise<boolean> => {
    try {
      await setCouponTags.mutateAsync({ couponId, tagNames: tags });
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const handleSubmit = async () => {
    const validationErrors = validateCouponForm(currentFields());
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const payload = buildCouponPayload(currentFields(), showAutoUsageUpdater);

    if (isEditing && existingCoupon) {
      try {
        await updateCoupon.mutateAsync({ id: existingCoupon.id, updates: payload });
      } catch (e) {
        console.error(e);
        notify.error("שגיאה בשמירת הקופון", "נסה שוב בעוד רגע.");
        return;
      }

      // The coupon is saved either way. A tag failure keeps the user on the
      // form so they can retry it; saving again just rewrites the same row.
      if (!(await applyTags(existingCoupon.id))) {
        notify.error("הקופון נשמר", "עדכון התגיות נכשל. נסה לשמור שוב.");
        return;
      }

      router.back();
      return;
    }

    // A code the user already holds is almost always a re-scan, not a second
    // coupon. Match ignores dashes and spaces, so "9376-1104" and "93761104"
    // count as the same code.
    const duplicates = findDuplicateCoupons(payload.code, allCoupons);
    if (duplicates.length > 0) {
      const finishedBefore = duplicates.some((c) => c.status === "נוצל");
      const message = finishedBefore
        ? "כבר השתמשת בקופון עם הקוד הזה וסיימת אותו. להוסיף אותו שוב?"
        : "כבר יש לך קופון עם הקוד הזה. להוסיף אותו שוב?";
      notify.confirm("קופון כפול", message, () => void finishAdd(payload), "הוסף בכל זאת");
      return;
    }

    await finishAdd(payload);
  };

  const finishAdd = async (payload: ReturnType<typeof buildCouponPayload>) => {
    let created: unknown;
    try {
      created = await addCoupon.mutateAsync({
        ...payload,
        used_value: 0,
        status: "פעיל",
      });
    } catch (e) {
      console.error(e);
      await persistDraft();
      notify.error("שגיאה בשמירת הקופון", "הטיוטה נשמרה. נסה שוב בעוד רגע.");
      return;
    }

    const newCouponId = (created as any)?.id;
    const tagsApplied =
      !newCouponId || tags.length === 0 ? true : await applyTags(newCouponId);

    // The coupon exists from here on, so the draft has to go: keeping it would
    // offer the user a second copy of a coupon they already have.
    await clearCouponDraft();

    if (!tagsApplied) {
      notify.error("הקופון נשמר", "התגיות לא נשמרו. אפשר להוסיף אותן בעריכה.");
    }

    // A new coupon usually arrives via the scanner, and going `back` would
    // drop the user onto the scanner they are done with. Send them to the
    // dashboard, where the coupon they just saved is now counted.
    router.replace({
      pathname: "/(tabs)",
      params: {
        saved: "1",
        ...(newCouponId ? { savedCouponId: String(newCouponId) } : {}),
      },
    });
  };

  return {
    isEditing,
    showAutoUsageUpdater,
    isSaving: addCoupon.isPending || updateCoupon.isPending,
    canSubmit: Object.keys(validateCouponForm(currentFields())).length === 0,

    company,
    setCompany,
    code,
    setCode,
    value,
    setValue,
    cost,
    setCost,
    expiration,
    setExpiration,
    isOneTime,
    setIsOneTime,
    purpose,
    setPurpose,
    description,
    setDescription,
    includeCardInfo,
    setIncludeCardInfo,
    cvv,
    setCvv,
    cardExp,
    setCardExp,
    autoProvider,
    setAutoProvider,
    redemptionUrl,
    setRedemptionUrl,

    tags,
    newTagInput,
    setNewTagInput,
    handleAddTag,
    handleRemoveTag,

    isCompanyPickerOpen,
    setIsCompanyPickerOpen,
    handleSelectCompany,

    errors,
    handleSubmit,
  };
}
