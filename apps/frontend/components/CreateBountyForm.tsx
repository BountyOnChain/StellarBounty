"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// ─── Validation Schema ───────────────────────────────────────────
const bountySchema = z.object({
  title: z
    .string()
    .min(5, "Title must be at least 5 characters")
    .max(100, "Title must be at most 100 characters"),
  description: z
    .string()
    .min(20, "Description must be at least 20 characters")
    .max(2000, "Description must be at most 2000 characters"),
  reward: z
    .string()
    .regex(/^\d+(\.\d{1,7})?$/, "Reward must be a valid XLM amount")
    .refine((val) => parseFloat(val) > 0, "Reward must be greater than 0"),
  deadline: z
    .string()
    .min(1, "Deadline is required")
    .refine(
      (val) => new Date(val) > new Date(),
      "Deadline must be in the future"
    ),
  tags: z.string().optional(),
});

type BountyFormData = z.infer<typeof bountySchema>;

// ─── Form Component ──────────────────────────────────────────────
interface CreateBountyFormProps {
  onSubmitSuccess?: () => void;
  onCancel?: () => void;
}

export default function CreateBountyForm({
  onSubmitSuccess,
  onCancel,
}: CreateBountyFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<BountyFormData>({
    resolver: zodResolver(bountySchema),
    defaultValues: {
      title: "",
      description: "",
      reward: "",
      deadline: "",
      tags: "",
    },
  });

  const onSubmit = async (data: BountyFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const tagsArray = data.tags
        ? data.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];

      const payload = {
        title: data.title,
        description: data.description,
        reward: data.reward,
        deadline: new Date(data.deadline).toISOString(),
        tags: tagsArray,
      };

      const res = await fetch("/api/bounties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.message || `Failed to create bounty (${res.status})`
        );
      }

      reset();
      onSubmitSuccess?.();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Input Field Helper ──────────────────────────────────────
  const inputClass = (hasError: boolean) =>
    `w-full rounded-lg border px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 ${
      hasError
        ? "border-red-500 focus:ring-red-400 bg-red-50"
        : "border-gray-300 focus:ring-blue-400 focus:border-blue-400 bg-white"
    }`;

  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Create Bounty</h2>
          <p className="mt-1 text-sm text-gray-500">
            Submit a new bounty for the community to work on
          </p>
        </div>

        {/* Error Banner */}
        {submitError && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <svg
              className="h-5 w-5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <span>{submitError}</span>
            <button
              onClick={() => setSubmitError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              &times;
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Title */}
          <div>
            <label htmlFor="title" className={labelClass}>
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              placeholder="e.g., Implement dark mode toggle"
              className={inputClass(!!errors.title)}
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? "title-error" : undefined}
              {...register("title")}
            />
            {errors.title && (
              <p id="title-error" className="mt-1 text-xs text-red-500" role="alert">
                {errors.title.message}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className={labelClass}>
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="description"
              rows={5}
              placeholder="Describe the bounty in detail..."
              className={inputClass(!!errors.description)}
              aria-invalid={!!errors.description}
              aria-describedby={errors.description ? "description-error" : undefined}
              {...register("description")}
            />
            {errors.description && (
              <p id="description-error" className="mt-1 text-xs text-red-500" role="alert">
                {errors.description.message}
              </p>
            )}
          </div>

          {/* Reward + Deadline Row */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Reward */}
            <div>
              <label htmlFor="reward" className={labelClass}>
                Reward (XLM) <span className="text-red-500">*</span>
              </label>
              <input
                id="reward"
                type="text"
                placeholder="e.g., 100"
                className={inputClass(!!errors.reward)}
                aria-invalid={!!errors.reward}
                aria-describedby={errors.reward ? "reward-error" : undefined}
                {...register("reward")}
              />
              {errors.reward && (
                <p id="reward-error" className="mt-1 text-xs text-red-500" role="alert">
                  {errors.reward.message}
                </p>
              )}
            </div>

            {/* Deadline */}
            <div>
              <label htmlFor="deadline" className={labelClass}>
                Deadline <span className="text-red-500">*</span>
              </label>
              <input
                id="deadline"
                type="datetime-local"
                className={inputClass(!!errors.deadline)}
                aria-invalid={!!errors.deadline}
                aria-describedby={errors.deadline ? "deadline-error" : undefined}
                {...register("deadline")}
              />
              {errors.deadline && (
                <p id="deadline-error" className="mt-1 text-xs text-red-500" role="alert">
                  {errors.deadline.message}
                </p>
              )
            </div>
          </div>

          {/* Tags */}
          <div>
            <label htmlFor="tags" className={labelClass}>
              Tags (optional)
            </label>              <input
              id="tags"
              type="text"
              placeholder="e.g., frontend, bug, documentation"
              className={inputClass(!!errors.tags)}
              aria-invalid={!!errors.tags}
              aria-describedby={errors.tags ? "tags-error" : undefined}
              {...register("tags")}
            />
            <p className="mt-1 text-xs text-gray-400">
              Separate tags with commas
            </p>
            {errors.tags && (
              <p id="tags-error" className="mt-1 text-xs text-red-500" role="alert">
                {errors.tags.message}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-4 border-t border-gray-100 pt-6">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Submitting...
                </>
              ) : (
                "Create Bounty"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
