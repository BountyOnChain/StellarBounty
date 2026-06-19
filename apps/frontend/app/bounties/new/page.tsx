"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import MarkdownRenderer from "@/app/components/MarkdownRenderer";
import { useWallet } from "@/components/WalletContext";
import { useToast } from "@/components/toast/ToastProvider";
import { useAuth } from "@/lib/api";

const MAX_REWARD_AMOUNT = 1_000_000_000;

const createBountySchema = z.object({
  title: z.string().trim().min(1, "Title is required."),
  description: z.string().trim().min(1, "Description is required."),
  reward: z
    .string()
    .trim()
    .min(1, "Reward amount is required.")
    .regex(/^\d+$/, "Reward must be a whole number.")
    .refine((value) => Number(value) > 0, "Reward must be greater than 0.")
    .refine(
      (value) => Number(value) <= MAX_REWARD_AMOUNT,
      `Reward must be ${MAX_REWARD_AMOUNT.toLocaleString()} XLM or less.`
    ),
  deadline: z.string().min(1, "Deadline is required."),
});

type CreateBountyFormValues = z.infer<typeof createBountySchema>;

type CreateBountyResponse = {
  id: string;
};

function formatErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unable to create bounty.";
}

export default function CreateBountyPage() {
  const router = useRouter();
  const { publicKey } = useWallet();
  const toast = useToast();
  const { getToken, clearToken, apiUrl } = useAuth();
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateBountyFormValues>({
    resolver: zodResolver(createBountySchema),
    defaultValues: {
      title: "",
      description: "",
      reward: "",
      deadline: "",
    },
  });

  const description = watch("description");

  useEffect(() => {
    if (!publicKey) {
      router.replace("/");
    }
  }, [publicKey, router]);

  const fieldErrorClass = useMemo(() => "mt-1 text-sm text-red-600 dark:text-red-300", []);

  const onSubmit = handleSubmit(async (values) => {
    if (!publicKey) {
      router.replace("/");
      return;
    }

    setSubmitError(null);

    try {
      const accessToken = await getToken(publicKey);
      const response = await fetch(`${apiUrl}/api/v1/bounties`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title: values.title.trim(),
          description: values.description.trim(),
          rewardAmount: values.reward.trim(),
          ownerAddress: publicKey,
          deadline: new Date(values.deadline).toISOString(),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          message?: string | string[];
        } | null;
        const message = Array.isArray(payload?.message)
          ? payload.message.join(" ")
          : payload?.message;

        if (message?.toLowerCase().includes("title")) {
          setError("title", { message });
          return;
        }
        if (message?.toLowerCase().includes("description")) {
          setError("description", { message });
          return;
        }
        if (message?.toLowerCase().includes("reward")) {
          setError("reward", { message });
          return;
        }
        if (message?.toLowerCase().includes("deadline")) {
          setError("deadline", { message });
          return;
        }

        if (response.status === 401) clearToken();

        throw new Error(message || "Unable to create bounty.");
      }

      const created = (await response.json()) as CreateBountyResponse;
      toast.success("Bounty created successfully.");
      router.push(`/bounties/${created.id}`);
    } catch (error) {
      const message = formatErrorMessage(error);
      setSubmitError(message);
      toast.error(message);
    }
  });

  if (!publicKey) return null;

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="mb-6 break-words text-2xl font-bold sm:text-3xl">Create a New Bounty</h1>

        <form onSubmit={onSubmit} className="min-w-0 space-y-6">
          <div>
            <label htmlFor="title" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Title
            </label>
            <input
              id="title"
              type="text"
              {...register("title")}
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              placeholder="e.g. Build a bounty listing page"
            />
            {errors.title && <p className={fieldErrorClass}>{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="reward" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Reward (XLM)
              </label>
              <input
                id="reward"
                type="text"
                inputMode="numeric"
                {...register("reward")}
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="e.g. 500"
              />
              {errors.reward && <p className={fieldErrorClass}>{errors.reward.message}</p>}
            </div>
            <div>
              <label htmlFor="deadline" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Deadline
              </label>
              <input
                id="deadline"
                type="date"
                {...register("deadline")}
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              {errors.deadline && <p className={fieldErrorClass}>{errors.deadline.message}</p>}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Description (supports Markdown)
            </label>

            <div className="mb-0 flex overflow-hidden rounded-t-lg border border-b-0 border-slate-300 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setActiveTab("write")}
                className={`min-h-11 flex-1 px-4 py-2 text-sm font-medium transition-colors sm:flex-none ${
                  activeTab === "write"
                    ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-b-2 border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                Write
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={`min-h-11 flex-1 px-4 py-2 text-sm font-medium transition-colors sm:flex-none ${
                  activeTab === "preview"
                    ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-b-2 border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                Preview
              </button>
            </div>

            {activeTab === "write" ? (
              <textarea
                rows={12}
                {...register("description")}
                className="min-h-64 w-full resize-y rounded-b-lg border border-slate-300 bg-white p-4 font-mono text-sm text-slate-950 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Write your bounty requirements in markdown..."
              />
            ) : (
              <div className="min-h-64 min-w-0 overflow-x-auto rounded-b-lg border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                {description ? (
                  <MarkdownRenderer content={description} />
                ) : (
                  <p className="text-sm italic text-slate-500 dark:text-slate-500">Nothing to preview yet...</p>
                )}
              </div>
            )}
            {errors.description && (
              <p className={fieldErrorClass}>{errors.description.message}</p>
            )}
          </div>

          {submitError && (
            <div className="rounded-lg border border-red-500/40 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-200">
              {submitError}
            </div>
          )}

          <div className="flex justify-stretch sm:justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-11 w-full rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
            >
              {isSubmitting ? "Creating..." : "Create Bounty"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
